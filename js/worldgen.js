// worldgen.js — 決定論的な地形/biome/鉱石/木の生成
window.Game = window.Game || {};

Game.WorldGen = (function () {
  const N = Game.Noise;
  const U = Game.Utils;
  const T = Game.TILE;
  const O = Game.OBJ;

  // 1タイル分の生成（world tile 座標）。{ground, obj} を返す
  function genTile(wx, wy, seed) {
    const e = N.fbm(wx * 0.012, wy * 0.012, seed, 5);          // 標高
    const m = N.fbm(wx * 0.02 + 911, wy * 0.02 + 911, seed ^ 0x9e37, 4); // 湿度

    let ground;
    if (e < 0.30) ground = T.DEEP_WATER;
    else if (e < 0.355) ground = T.WATER;
    else if (e < 0.40) ground = T.SAND;
    else if (e > 0.82) ground = T.SNOW;
    else if (e > 0.70) ground = T.STONE;
    else if (m > 0.58) ground = T.FOREST;
    else if (m < 0.30 && e < 0.55) ground = T.SAND;  // 乾燥帯
    else ground = T.GRASS;

    let obj = O.NONE;
    const h = U.hash3(wx, wy, seed + 777);  // 配置用 0..1

    // 石碑（超低確率・両世界・陸地）
    const walkableGround = ground === T.GRASS || ground === T.FOREST || ground === T.SAND || ground === T.STONE;
    if (walkableGround && U.hash3(wx, wy, seed + 31337) < 0.0007) {
      return { ground: ground, obj: O.STELA };
    }

    // ダンジョン（両世界・複数種: 遺跡/氷窟/影の神殿）
    if (ground !== T.DEEP_WATER && ground !== T.WATER) {
      const DG = 74;
      const ax = Math.round(wx / DG) * DG, ay = Math.round(wy / DG) * DG;
      if (U.hash3(ax, ay, seed + 8888) < 0.085) {
        const dx = wx - ax, dy = wy - ay, hw = 5, hh = 4;
        if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) {
          const ice = ground === T.SNOW;
          const wall = ice ? O.ICE_WALL : O.DUNGEON_WALL;
          const edge = Math.abs(dx) === hw || Math.abs(dy) === hh;
          const entrance = dy === hh && Math.abs(dx) <= 1; // 下側に入口
          if (edge && !entrance) return { ground: T.DUNGEON_FLOOR, obj: wall };
          if (dx === 0 && dy === 0) return { ground: T.DUNGEON_FLOOR, obj: O.TREASURE_CHEST };
          if (dy === 0 && Math.abs(dx) === 3) return { ground: T.DUNGEON_FLOOR, obj: O.SPAWNER };
          const rh = U.hash3(wx, wy, seed + 99);
          return { ground: T.DUNGEON_FLOOR, obj: rh < 0.05 ? O.ROCK : O.NONE };
        }
      }
    }

    // 影世界: 同じ地形形状(標高)・別オブジェクト
    const shadow = Game.state && Game.state.worldName === 'shadow';

    // 共鳴遺跡（両世界の同座標に対構造）
    if (ground !== T.DEEP_WATER && ground !== T.WATER) {
      const G = 96;
      const ax = Math.round(wx / G) * G, ay = Math.round(wy / G) * G;
      const dxv = wx - ax, dyv = wy - ay;
      if (Math.abs(dxv) <= 1 && Math.abs(dyv) <= 1 && U.hash3(ax, ay, seed + 5151) < 0.085) {
        const key = ax + ',' + ay;
        const resonated = Game.state && Game.state.resonated && Game.state.resonated[key];
        const center = dxv === 0 && dyv === 0;
        if (shadow) {
          return { ground: T.STONE, obj: center ? (resonated ? O.NONE : O.RESONANCE_CORE) : O.NONE };
        }
        if (resonated) return { ground: T.DIRT, obj: center ? O.TREASURE_CHEST : O.NONE };
        return { ground: T.STONE, obj: O.SEAL_WALL };
      }
    }

    if (shadow) {
      // 深層は鉱脈が濃くなる
      const deep = Math.max(Math.abs(wx), Math.abs(wy)) >= Game.TUNE.DEEP_THRESHOLD;
      if (ground === T.FOREST || ground === T.GRASS) {
        if (h < 0.16) obj = O.SHADOW_TREE;
        else if (h < (deep ? 0.30 : 0.22)) obj = O.SHADOW_CRYSTAL;
        else if (h < 0.35) obj = O.SOUL_FLOWER;
      } else if (ground === T.STONE || ground === T.SNOW) {
        if (h < 0.14) obj = O.VOID_ROCK;
        else if (h < (deep ? 0.34 : 0.22)) obj = O.SHADOW_CRYSTAL;
        else if (h < (deep ? 0.42 : 0.25)) obj = O.LUMEN_ORE;
        else if (h < (deep ? 0.47 : 0.275)) obj = O.PHANTOM_ORE;
      } else if (ground === T.SAND) {
        if (h < 0.05) obj = O.VOID_ROCK;
        else if (h < (deep ? 0.12 : 0.07)) obj = O.SHADOW_CRYSTAL;
      }
      return { ground: ground, obj: obj };
    }

    if (ground === T.FOREST) {
      if (h < 0.22) obj = O.TREE;
      else if (h < 0.27) obj = O.BUSH;
      else if (h < 0.30) obj = O.BERRY_BUSH;
    } else if (ground === T.GRASS) {
      if (h < 0.06) obj = O.TREE;
      else if (h < 0.09) obj = O.BUSH;
      else if (h < 0.11) obj = O.BERRY_BUSH;
      else if (h < 0.14) obj = O.FLOWER;
    } else if (ground === T.SNOW) {
      if (h < 0.07) obj = O.PINE_TREE;
      else if (h < 0.11) obj = O.ROCK;
      else if (h < 0.15) obj = O.COAL_ORE;
      else if (h < 0.18) obj = O.IRON_ORE;
      else if (h < 0.19) obj = O.GOLD_ORE;
    } else if (ground === T.STONE) {
      if (h < 0.10) obj = O.ROCK;
      else if (h < 0.145) obj = O.COAL_ORE;
      else if (h < 0.175) obj = O.IRON_ORE;
      else if (h < 0.185) obj = O.GOLD_ORE;
      else if (h < 0.195) obj = O.PHANTOM_ORE;
    } else if (ground === T.SAND) {
      if (e > 0.40 && h < 0.03) obj = O.CACTUS;   // 砂漠のサボテン
      else if (h < 0.04) obj = O.ROCK;
    }
    return { ground, obj };
  }

  // チャンク全体を生成（typed array に書き込む）
  function generateChunk(chunk, seed) {
    const CS = Game.CFG.CHUNK_SIZE;
    const baseX = chunk.cx * CS, baseY = chunk.cy * CS;
    for (let ly = 0; ly < CS; ly++) {
      for (let lx = 0; lx < CS; lx++) {
        const t = genTile(baseX + lx, baseY + ly, seed);
        const i = ly * CS + lx;
        chunk.ground[i] = t.ground;
        chunk.object[i] = t.obj;
      }
    }
  }

  // 歩けるスポーン地点を原点付近から探す -> {tx, ty}
  function findSpawn(seed) {
    for (let r = 0; r < 400; r++) {
      for (let a = 0; a < Math.max(1, r * 6); a++) {
        const ang = (a / Math.max(1, r * 6)) * Math.PI * 2;
        const tx = Math.round(Math.cos(ang) * r);
        const ty = Math.round(Math.sin(ang) * r);
        const t = genTile(tx, ty, seed);
        const walkable = t.obj === O.NONE &&
          (t.ground === T.GRASS || t.ground === T.SAND || t.ground === T.FOREST || t.ground === T.DIRT);
        if (walkable) return { tx, ty };
      }
    }
    return { tx: 0, ty: 0 };
  }

  return { genTile, generateChunk, findSpawn };
})();
