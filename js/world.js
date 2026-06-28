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
    ch.object[localIndex(tx, ty)] = val;
    ch.dirty = true;
    recordDelta(tx, ty, undefined, val);
  }
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

  return {
    Chunk, getChunk, groundAt, objAt, setObj, setGround,
    isWalkable, updateChunks, toChunkCoord,
  };
})();
