// world.js — チャンク管理・タイル取得/設定（差分オーバーレイ）・load/unload
window.Game = window.Game || {};

Game.World = (function () {
  const CS = Game.CFG.CHUNK_SIZE;
  const U = Game.Utils;

  function Chunk(cx, cy) {
    this.cx = cx; this.cy = cy;
    this.ground = new Uint16Array(CS * CS);
    this.object = new Uint16Array(CS * CS);
    this.dirty = true;   // 描画キャッシュ再構築要
    this.cache = null;   // オフスクリーンcanvas
  }

  function toChunkCoord(tile) { return U.floorDiv(tile, CS); }

  // 生成＋差分適用してチャンクを得る
  function getChunk(cx, cy) {
    const key = U.chunkKey(cx, cy);
    let ch = Game.state.chunks.get(key);
    if (ch) return ch;
    ch = new Chunk(cx, cy);
    Game.WorldGen.generateChunk(ch, Game.state.seed);
    applyDeltas(ch);
    Game.state.chunks.set(key, ch);
    return ch;
  }

  function applyDeltas(ch) {
    const baseX = ch.cx * CS, baseY = ch.cy * CS;
    const mods = Game.state.modifiedTiles;
    if (mods.size === 0) return;
    for (let ly = 0; ly < CS; ly++) {
      for (let lx = 0; lx < CS; lx++) {
        const d = mods.get(U.tileKey(baseX + lx, baseY + ly));
        if (!d) continue;
        const i = ly * CS + lx;
        if (d.g !== undefined) ch.ground[i] = d.g;
        if (d.o !== undefined) ch.object[i] = d.o;
      }
    }
  }

  function localIndex(tx, ty) {
    const lx = U.mod(tx, CS), ly = U.mod(ty, CS);
    return ly * CS + lx;
  }

  function groundAt(tx, ty) {
    const ch = getChunk(toChunkCoord(tx), toChunkCoord(ty));
    return ch.ground[localIndex(tx, ty)];
  }
  function objAt(tx, ty) {
    const ch = getChunk(toChunkCoord(tx), toChunkCoord(ty));
    return ch.object[localIndex(tx, ty)];
  }

  function setObj(tx, ty, val) {
    const ch = getChunk(toChunkCoord(tx), toChunkCoord(ty));
    const prev = ch.object[localIndex(tx, ty)];
    ch.object[localIndex(tx, ty)] = val;
    ch.dirty = true;
    recordDelta(tx, ty, undefined, val);
    if (val === Game.OBJ.NONE && prev !== Game.OBJ.NONE) clearTileData(tx, ty);
  }

  // 状態付きオブジェクト（チェスト中身・作物成長）のデータ
  function getTileData(tx, ty) { return Game.state.tileData.get(U.tileKey(tx, ty)); }
  function setTileData(tx, ty, data) { Game.state.tileData.set(U.tileKey(tx, ty), data); }
  function clearTileData(tx, ty) { Game.state.tileData.delete(U.tileKey(tx, ty)); }
  function setGround(tx, ty, val) {
    const ch = getChunk(toChunkCoord(tx), toChunkCoord(ty));
    ch.ground[localIndex(tx, ty)] = val;
    ch.dirty = true;
    recordDelta(tx, ty, val, undefined);
  }

  function recordDelta(tx, ty, g, o) {
    const key = U.tileKey(tx, ty);
    const d = Game.state.modifiedTiles.get(key) || {};
    if (g !== undefined) d.g = g;
    if (o !== undefined) d.o = o;
    Game.state.modifiedTiles.set(key, d);
  }

  // タイルが移動可能か（プレイヤー/モブ衝突）
  function isWalkable(tx, ty) {
    const g = groundAt(tx, ty);
    if (Game.SOLID_TILE[g]) return false;
    const o = objAt(tx, ty);
    if (o === Game.OBJ.NONE) return true;
    const meta = Game.OBJ_META[o];
    return meta ? !meta.solid : true;
  }

  // プレイヤー周辺チャンクの load / 遠方 unload
  function updateChunks(centerTx, centerTy) {
    const ccx = toChunkCoord(centerTx), ccy = toChunkCoord(centerTy);
    const R = Game.CFG.LOAD_RADIUS;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        getChunk(ccx + dx, ccy + dy);

    // 遠方を破棄（seed再現可能なので安全）
    const keep = R + 2;
    Game.state.chunks.forEach(function (ch, key) {
      if (Math.abs(ch.cx - ccx) > keep || Math.abs(ch.cy - ccy) > keep) {
        Game.state.chunks.delete(key);
      }
    });
  }

  // ===== 二相世界 =====
  function setActiveWorld(name) {
    const w = Game.state.worlds[name];
    Game.state.worldName = name;
    Game.state.chunks = w.chunks;
    Game.state.modifiedTiles = w.modifiedTiles;
    Game.state.tileData = w.tileData;
    Game.state.mobs = w.mobs;
    Game.state.drops = w.drops;
  }

  // 影鏡で光⇄影をシフト
  function shift() {
    const st = Game.state;
    if (!st || st.paused || st.shiftCd > 0) return false;
    if (Game.Inventory.count('shadow_mirror') < 1) { Game.UI.toast('影鏡が必要（夜の敵から影の欠片を集めて作る）'); return false; }
    const target = st.worldName === 'light' ? 'shadow' : 'light';
    setActiveWorld(target);
    st.shiftCd = Game.TUNE.SHIFT_COOLDOWN;
    st.hasShifted = true;
    const pt = Game.Player.playerTile();
    // シフト先で足元が塞がっていたら近傍の空きへ押し出す
    if (!isWalkable(pt.tx, pt.ty)) nudgeToWalkable();
    updateChunks(pt.tx, pt.ty);
    Game.Render.flash(target === 'shadow' ? '#3a1a55' : '#cfe0ff');
    Game.Audio.play('shift');
    Game.UI.toast(target === 'shadow' ? '影の世界へ…' : '光の世界へ戻った');
    Game.UI.refreshWorld();
    Game.UI.updateMinimap();
    if (Game.Achievements) Game.Achievements.unlock(target === 'shadow' ? 'first_shift' : null);
    return true;
  }

  function nudgeToWalkable() {
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (isWalkable(ptx + dx, pty + dy)) {
          p.x = (ptx + dx) * TS + TS / 2; p.y = (pty + dy) * TS + TS / 2; p.prevX = p.x; p.prevY = p.y; return;
        }
      }
    }
  }

  // 両世界に同時設置（裂け目の楔）
  function setObjBothWorlds(tx, ty, val) {
    const cur = Game.state.worldName;
    ['light', 'shadow'].forEach(function (name) {
      const w = Game.state.worlds[name];
      const key = U.tileKey(tx, ty);
      const d = w.modifiedTiles.get(key) || {};
      d.o = val; w.modifiedTiles.set(key, d);
      // ロード済みチャンクがあれば即反映
      const ch = w.chunks.get(U.chunkKey(toChunkCoord(tx), toChunkCoord(ty)));
      if (ch) { ch.object[localIndex(tx, ty)] = val; ch.dirty = true; }
    });
    if (val === Game.OBJ.NONE) { Game.state.worlds.light.tileData.delete(U.tileKey(tx, ty)); Game.state.worlds.shadow.tileData.delete(U.tileKey(tx, ty)); }
  }

  // 共鳴: 影で核を壊すと両世界の該当遺跡を再生成（光の封印が解け宝が出現）
  function resonate(tx, ty) {
    const key = tx + ',' + ty;
    if (!Game.state.resonated) Game.state.resonated = {};
    if (Game.state.resonated[key]) return;
    Game.state.resonated[key] = 1;
    ['light', 'shadow'].forEach(function (name) {
      Game.state.worlds[name].chunks.delete(U.chunkKey(toChunkCoord(tx), toChunkCoord(ty)));
    });
    Game.Render.flash('#ffe9a0');
    Game.Audio.play('levelup');
    Game.UI.toast('遠くで封印が解ける音がした… 光の世界に宝が現れた');
    if (Game.Achievements) Game.Achievements.unlock('resonance');
  }

  return {
    Chunk, getChunk, groundAt, objAt, setObj, setGround,
    getTileData, setTileData, clearTileData,
    isWalkable, updateChunks, toChunkCoord,
    setActiveWorld, shift, setObjBothWorlds, resonate,
  };
})();
