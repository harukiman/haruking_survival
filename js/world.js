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
    const o = objAt(tx, ty);
    const meta = Game.OBJ_META[o];
    if (meta && meta.bridge) return true; // 橋は水上でも通れる
    const g = groundAt(tx, ty);
    if (Game.SOLID_TILE[g]) return false;
    if (o === Game.OBJ.NONE) return true;
    return meta ? !meta.solid : true;
  }

  // プレイヤー周辺チャンクの load / 遠方 unload
  function updateChunks(centerTx, centerTy) {
    const ccx = toChunkCoord(centerTx), ccy = toChunkCoord(centerTy);
    const R = Game.CFG.LOAD_RADIUS;
    // 探索済み記録(フォグ・オブ・ウォー用): 周囲のチャンクを世界別に記録。世界地図はこれのみ描画
    if (!Game.state.explored) Game.state.explored = {};
    const ex = Game.state.explored[Game.state.worldName] || (Game.state.explored[Game.state.worldName] = {});
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        getChunk(ccx + dx, ccy + dy);
        ex[(ccx + dx) + ',' + (ccy + dy)] = 1;
      }

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
    if (target === 'shadow' && Game.Story) Game.Story.unlock('sundering', true); // 初の影渡りで第一章
    Game.state.shiftCount = (Game.state.shiftCount || 0) + 1;
    if (Game.state.shiftCount >= 4 && Game.Story && !Game.Story.seen('phase')) Game.Story.unlock('phase', true); // 幾度も相を渡ると「相を渡る」
    if (Game.Save) Game.Save.autosave('shift'); // 相を渡る(イベント)で自動保存
    return true;
  }

  function nudgeToWalkable() {
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    // まず歩けるタイルから BFS で「壁を越えずに到達できる」最寄りの開けたマスへ救出（壁抜け防止）
    const start = isWalkable(ptx, pty) ? { x: ptx, y: pty } : null;
    if (start) {
      const seen = {}, q = [start]; seen[ptx + ',' + pty] = 1;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let head = 0;
      while (head < q.length && head < 80) {
        const c = q[head++];
        // 自分の現在地でなく、4方向すべて歩ける広い場所なら脱出成功
        if (!(c.x === ptx && c.y === pty)) {
          let open = 0; for (let i = 0; i < 4; i++) if (isWalkable(c.x + dirs[i][0], c.y + dirs[i][1])) open++;
          if (open >= 3) { p.x = c.x * TS + TS / 2; p.y = c.y * TS + TS / 2; p.prevX = p.x; p.prevY = p.y; return; }
        }
        for (let i = 0; i < 4; i++) {
          const nx = c.x + dirs[i][0], ny = c.y + dirs[i][1], k = nx + ',' + ny;
          if (!seen[k] && isWalkable(nx, ny)) { seen[k] = 1; q.push({ x: nx, y: ny }); }
        }
      }
    }
    // フォールバック: 壁の中に埋まっている等で BFS 起点が無い場合のみ、近傍スキャン（最終手段）
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

  // 別世界へ移動（ロケット等）。spawnTileで着地位置指定可
  function travelTo(name, spawnTile) {
    setActiveWorld(name);
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    if (spawnTile) { p.x = spawnTile.tx * TS + TS / 2; p.y = spawnTile.ty * TS + TS / 2; }
    if (name === 'space') { p.x = 0; p.y = 2 * TS; if (Game.Achievements) Game.Achievements.unlock('space_traveler'); } // 宇宙の帰還ロケット脇
    else if (name === 'light') { p.x = Game.state.spawn.tx * TS + TS / 2; p.y = Game.state.spawn.ty * TS + TS / 2; }
    p.prevX = p.x; p.prevY = p.y;
    if (!isWalkable(Math.floor(p.x / TS), Math.floor(p.y / TS))) nudgeToWalkable();
    updateChunks(Math.floor(p.x / TS), Math.floor(p.y / TS));
    Game.UI.refreshWorld();
    Game.UI.updateMinimap();
  }

  // 同一世界内テレポート(空島の祭壇など)。位置替え＋足元救済＋チャンク/ミニマップ更新
  function teleport(tx, ty) {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    p.x = tx * TS + TS / 2; p.y = ty * TS + TS / 2;
    p.prevX = p.x; p.prevY = p.y;
    if (!isWalkable(tx, ty)) nudgeToWalkable();
    updateChunks(Math.floor(p.x / TS), Math.floor(p.y / TS));
    Game.UI.updateMinimap();
    if (Game.UI.refreshWorld) Game.UI.refreshWorld(); // エリア名(空島/古代都市/狭間)のHUD更新
  }

  // エリア別BGMムード(audio.js updateMood が参照するフック)。該当エリア外は null。
  // 防御的: WorldGen 側の実装有無/例外に依らず安全に null を返す
  function currentAreaMood() {
    try {
      if (Game.state && Game.state.player && Game.WorldGen && Game.WorldGen.inSkyEnclave) {
        const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
        const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
        if (Game.state.worldName === 'light') {
          if (Game.WorldGen.inSkyEnclave(ptx, pty, Game.state.seed)) return 'sky';
          if (Game.WorldGen.inRuinCity && Game.WorldGen.inRuinCity(ptx, pty, Game.state.seed)) return 'ruins';
        } else if (Game.state.worldName === 'shadow') {
          if (Game.WorldGen.inRiftVoid && Game.WorldGen.inRiftVoid(ptx, pty, Game.state.seed)) return 'rift';
        }
      }
    } catch (e) {}
    return null;
  }

  // 影の深層: 原点からの距離（タイル）
  function depthOf() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    return Math.max(Math.abs(p.x / TS), Math.abs(p.y / TS));
  }
  function inDepths() {
    return Game.state.worldName === 'shadow' && depthOf() >= Game.TUNE.DEEP_THRESHOLD;
  }

  // ===== エリア危険度バンド =====
  // 既存地理からの決定論的な純導出(worldgen レイアウト不変・セーブ互換)。定義表は Game.DANGER (config.js) 参照。
  // band: 0=安全圏(〜40タイル) 1=開拓圏(〜90) 2=辺境(〜160) 3=深域(160+) 4=深域+(補正上限)
  // 補正: ダンジョンは明示ティア(遺跡=1 氷窟/墳墓=2 工房/水晶洞=3 影神殿=4) /
  //       雪原/砂漠/火山 +1(安全圏では不適用) / キノコの森は夜+1 / 影世界 +1 / 宇宙=3固定
  // 距離は「初期スポーンの決定論アンカー」基準(seed から再計算・ベッド移動やセーブに依らず不変)。
  // UI/描画からの可視化にも使える公開API。引数はタイル座標。
  let bandAnchor = null, bandAnchorSeed = null;
  function dangerBandAt(tx, ty) {
    const D = Game.DANGER;
    if (!D) return 1;
    if (Game.state.worldName === 'space') return 3;
    // 空島/古代都市エンクレーブ(光世界): 深域級 band3 に固定(バイオーム/ダンジョン補正は適用しない)
    if (Game.state.worldName === 'light' && Game.WorldGen.inSkyEnclave &&
        Game.WorldGen.inSkyEnclave(tx, ty, Game.state.seed)) return 3;
    if (Game.state.worldName === 'light' && Game.WorldGen.inRuinCity &&
        Game.WorldGen.inRuinCity(tx, ty, Game.state.seed)) return 3;
    // 狭間(影世界): 最難関 band4
    if (Game.state.worldName === 'shadow' && Game.WorldGen.inRiftVoid &&
        Game.WorldGen.inRiftVoid(tx, ty, Game.state.seed)) return 4;
    if (bandAnchorSeed !== Game.state.seed) {
      bandAnchor = Game.WorldGen.spawnAnchor ? Game.WorldGen.spawnAnchor(Game.state.seed) : { tx: 0, ty: 0 };
      bandAnchorSeed = Game.state.seed;
    }
    const dist = Math.max(Math.abs(tx - bandAnchor.tx), Math.abs(ty - bandAnchor.ty)); // チェビシェフ(depthOf と同系)
    let band = dist < D.RADII[0] ? 0 : dist < D.RADII[1] ? 1 : dist < D.RADII[2] ? 2 : 3;
    // ダンジョン: テーマ別の明示ティア。影世界のダンジョン(影神殿)は最高危険帯
    const theme = Game.WorldGen.dungeonThemeAt ? Game.WorldGen.dungeonThemeAt(tx, ty, Game.state.seed) : null;
    if (theme) {
      band = Math.max(band, D.DUNGEON_TIER[theme] || 1);
      if (Game.state.worldName === 'shadow') band = 4;
    }
    // バイオーム補正(安全圏0では適用しない: 序盤導線の保護)
    if (band >= 1) {
      const g = groundAt(tx, ty);
      if (g === Game.TILE.SNOW || g === Game.TILE.SAND || g === Game.TILE.VOLCANIC) band += 1;
      else if (g === Game.TILE.MUSHROOM && Game.Lighting && Game.Lighting.ambientDarkness() > 0.4) band += 1;
    }
    if (Game.state.worldName === 'shadow') band += 1; // 影世界は常時+1(深層の既存強化はそのまま別枠)
    return band > 4 ? 4 : band;
  }
  function dangerBandName(band) {
    const D = Game.DANGER;
    return (D && D.NAMES[Math.max(0, Math.min(4, band | 0))]) || '';
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
    isWalkable, updateChunks, toChunkCoord, rescueStuck: nudgeToWalkable,
    setActiveWorld, shift, setObjBothWorlds, resonate, depthOf, inDepths, travelTo,
    dangerBandAt, dangerBandName, teleport, currentAreaMood,
  };
})();
