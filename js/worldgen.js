// worldgen.js — 決定論的な地形/biome/鉱石/木の生成
window.Game = window.Game || {};

Game.WorldGen = (function () {
  const N = Game.Noise;
  const U = Game.Utils;
  const T = Game.TILE;
  const O = Game.OBJ;

  // 1タイル分の生成（world tile 座標）。{ground, obj} を返す
  // 宇宙: 小惑星(歩ける)＋虚空(不可)＋星鉱/宝箱/巣。(0,0)に帰還ロケット
  function genSpace(wx, wy, seed) {
    if (Math.abs(wx) <= 1 && Math.abs(wy) <= 1) {
      return { ground: T.STONE, obj: (wx === 0 && wy === 0) ? O.ROCKET : O.NONE };
    }
    const ae = N.fbm(wx * 0.04, wy * 0.04, seed ^ 0x5a5a, 4);
    if (ae < 0.46) return { ground: T.DEEP_WATER, obj: O.NONE }; // 虚空
    const h = U.hash3(wx, wy, seed + 777);
    let o = O.NONE;
    if (h < 0.05) o = O.STAR_ORE;
    else if (h < 0.09) o = O.LUMEN_ORE;
    else if (h < 0.12) o = O.IRON_ORE;
    else if (h < 0.135) o = O.SHADOW_CRYSTAL;
    else if (h < 0.143) o = O.TREASURE_CHEST;
    else if (h < 0.15) o = O.SPAWNER;
    else if (h < 0.17) o = O.ROCK;
    return { ground: T.STONE, obj: o };
  }

  // 標高/湿度→自然地形(バイオーム)。genTile と dungeonThemeAt で共有(閾値は従来のまま=決定論/セーブ互換維持)
  const TERRA = { ground: 0, e: 0, m: 0 }; // 使い回しスクラッチ(チャンク生成時のGC回避)。呼出直後に読み取ること
  function terrainAt(wx, wy, seed) {
    const e = N.fbm(wx * 0.0085, wy * 0.0085, seed, 5);        // 標高（低周波=大陸/バイオームを広大に）
    const m = N.fbm(wx * 0.014 + 911, wy * 0.014 + 911, seed ^ 0x9e37, 4); // 湿度

    let ground;
    if (e < 0.30) ground = T.DEEP_WATER;
    else if (e < 0.355) ground = T.WATER;
    else if (e < 0.40) ground = T.SAND;
    else if (m > 0.66 && e < 0.52) ground = T.SWAMP;   // 高湿・低地=毒の沼地
    else if (e > 0.78 && m < 0.32) ground = T.VOLCANIC; // 高標高・乾燥=火山地帯
    else if (m > 0.5 && m < 0.62 && e > 0.42 && e < 0.6) ground = T.MUSHROOM; // 中湿・低中標高=キノコの森
    else if (m > 0.40 && m < 0.50 && e > 0.46 && e < 0.62) ground = T.BLOOM; // 穏やかな中湿地=花の野
    else if (e > 0.82) ground = T.SNOW;
    else if (e > 0.70) ground = T.STONE;
    else if (m > 0.58) ground = T.FOREST;
    else if (m < 0.30 && e < 0.55) ground = T.SAND;  // 乾燥帯
    else ground = T.GRASS;
    TERRA.ground = ground; TERRA.e = e; TERRA.m = m;
    return TERRA;
  }

  // ダンジョンテーマ判定(タイル座標)。genTile のダンジョン生成条件と同一ロジックで
  // 「そのタイルがダンジョン内なら壁テーマ」を返す(なければ null)。危険度バンド/巣の湧きプールが参照。
  // 戻り値: 'ruin'(遺跡) | 'ice'(氷窟) | 'crystal'(水晶洞) | 'tomb'(砂の墳墓) | 'forge'(溶岩工房)
  function dungeonThemeAt(wx, wy, seed) {
    if (Game.state && Game.state.worldName === 'space') return null;
    const g0 = terrainAt(wx, wy, seed).ground; // 自然地形(ダンジョン床で上書きされる前)
    if (g0 === T.DEEP_WATER || g0 === T.WATER) return null;
    const DG = 74;
    const ax = Math.round(wx / DG) * DG, ay = Math.round(wy / DG) * DG;
    if (U.hash3(ax, ay, seed + 8888) >= 0.085) return null;
    const big = U.hash3(ax, ay, seed + 1212) < 0.34;
    const hw = big ? 8 : 5, hh = big ? 6 : 4;
    if (Math.abs(wx - ax) > hw || Math.abs(wy - ay) > hh) return null;
    if (g0 === T.SNOW) return (U.hash3(ax, ay, seed + 222) < 0.5) ? 'crystal' : 'ice';
    if (g0 === T.SAND) return 'tomb';
    if (g0 === T.STONE) return 'forge';
    return 'ruin';
  }

  // ===== 空島(スカイエンクレーブ) =====
  // 光世界の seed 決定論的な固定座標に浮かぶ隔離領域。中心=スポーンアンカーから約360タイル、半径 SKY_R。
  // genTile の最初でバウンズ判定し、外側は既存生成に一切触れない(バイト同一維持)。
  // SKY_READY: 空島の到達導線(祭壇interact→ムービー→テレポート)と固有モブが未実装の間は false。
  //   false の間は inSkyEnclave が常に false を返し、エンクレーブ生成・風の祭壇スポーンを完全に無効化(inert scaffold)。
  const SKY_READY = false;
  const SKY_R = 48;          // エンクレーブ半径(タイル)
  const SKY_DIST = 360;      // アンカーからの距離
  let skyMemo = null, skyMemoSeed = null;
  function skyCenter(seed) {
    if (skyMemoSeed === seed && skyMemo) return skyMemo;
    const a = spawnAnchor(seed);
    const ang = U.hash3(11, 22, seed + 909) * Math.PI * 2;
    skyMemoSeed = seed;
    skyMemo = {
      tx: a.tx + Math.round(Math.cos(ang) * SKY_DIST),
      ty: a.ty + Math.round(Math.sin(ang) * SKY_DIST),
    };
    // 番人の宝殿: 中心から seed 決定論的な方角に浮かぶ小島
    const ang2 = U.hash3(3, 7, seed + 606) * Math.PI * 2;
    skyMemo.gx = skyMemo.tx + Math.round(Math.cos(ang2) * 27);
    skyMemo.gy = skyMemo.ty + Math.round(Math.sin(ang2) * 27);
    return skyMemo;
  }
  // 純幾何のバウンズ判定(worldName 非依存)。呼び出し側で光世界に限定する
  function inSkyEnclave(wx, wy, seed) {
    if (!SKY_READY) return false; // 未完成の間は無効(scaffoldを完全にinert化)
    const C = skyCenter(seed);
    const dx = wx - C.tx, dy = wy - C.ty;
    if (dx > SKY_R || dx < -SKY_R || dy > SKY_R || dy < -SKY_R) return false;
    return dx * dx + dy * dy <= SKY_R * SKY_R;
  }
  // 到達ムービー後の着地点(帰還の祭壇のすぐ南)
  function skyArrival(seed) { const C = skyCenter(seed); return { tx: C.tx, ty: C.ty + 2 }; }
  // 帰還の祭壇のタイル座標(帰路 tileData の格納先)
  function skyReturnAltar(seed) { const C = skyCenter(seed); return { tx: C.tx, ty: C.ty }; }

  function genSkyTile(wx, wy, seed) {
    const C = skyCenter(seed);
    const dx = wx - C.tx, dy = wy - C.ty;
    const d = Math.sqrt(dx * dx + dy * dy);
    // 外縁リング: 空の虚(不可侵の境界。地上との間を隔てる)
    if (d > SKY_R - 3) return { ground: T.SKYVOID, obj: O.NONE };
    // 到着プラットフォーム: 中心の円島。帰還の祭壇＋四隅の風化した柱
    if (d <= 5.5) {
      let obj = O.NONE;
      if (dx === 0 && dy === 0) obj = O.RETURN_ALTAR;
      else if (Math.abs(dx) === 3 && Math.abs(dy) === 3) obj = O.SKY_PILLAR;
      return { ground: T.CLOUD, obj: obj };
    }
    // 番人の宝殿: 宝箱＋魔物の巣(番人が湧く)＋柱の環(南が開口)
    const tdx = wx - C.gx, tdy = wy - C.gy;
    const td = Math.sqrt(tdx * tdx + tdy * tdy);
    if (td <= 5.5) {
      let obj = O.NONE;
      if (tdx === 0 && tdy === 0) obj = O.TREASURE_CHEST;
      else if (Math.abs(tdx) === 2 && tdy === 0) obj = O.SPAWNER;
      else if (td > 4.2 && !(tdy > 2 && Math.abs(tdx) <= 1)) {
        if (U.hash3(wx, wy, seed + 515) < 0.7) obj = O.SKY_PILLAR;
      }
      return { ground: T.CLOUD, obj: obj };
    }
    // 浮島クラスタ: 低周波ノイズで島/虚を刻む。高コアは草地(空石の草原)
    const v = N.fbm(wx * 0.05, wy * 0.05, seed ^ 0x51ab, 4);
    if (v < 0.55) return { ground: T.SKYVOID, obj: O.NONE };
    const ground = v > 0.66 ? T.GRASS : T.CLOUD;
    const h = U.hash3(wx, wy, seed + 777);
    let obj = O.NONE;
    if (ground === T.GRASS) {
      if (h < 0.09) obj = O.SKY_TREE;
      else if (h < 0.12) obj = O.BUSH;
      else if (h < 0.16) obj = O.FLOWER;
      else if (h < 0.19) obj = O.WIND_ORE;
    } else {
      if (h < 0.05) obj = O.SKY_TREE;
      else if (h < 0.10) obj = O.WIND_ORE;
      else if (h < 0.13) obj = O.SKY_PILLAR;
      else if (h < 0.15) obj = O.ROCK;
    }
    return { ground: ground, obj: obj };
  }

  function genTile(wx, wy, seed) {
    if (Game.state && Game.state.worldName === 'space') return genSpace(wx, wy, seed);
    // 空島エンクレーブ(光世界のみ)。バウンズ判定を最初に行い、外側は従来生成へフォールスルー
    if (!(Game.state && Game.state.worldName === 'shadow') && inSkyEnclave(wx, wy, seed)) {
      return genSkyTile(wx, wy, seed);
    }
    const tr = terrainAt(wx, wy, seed);
    let ground = tr.ground;
    const e = tr.e; // サボテン配置(乾燥帯判定)で使用

    let obj = O.NONE;
    const h = U.hash3(wx, wy, seed + 777);  // 配置用 0..1

    // 石碑（超低確率・両世界・陸地）
    const walkableGround = ground === T.GRASS || ground === T.FOREST || ground === T.SAND || ground === T.STONE;
    if (walkableGround && U.hash3(wx, wy, seed + 31337) < 0.0007) {
      return { ground: ground, obj: O.STELA };
    }

    // 古の祭壇（さらに低確率・陸地）— 触れると一時的な祝福を授かる探索報酬
    if (walkableGround && U.hash3(wx, wy, seed + 24601) < 0.0004) {
      return { ground: ground, obj: O.WISH_ALTAR };
    }

    // 風の祭壇（空島への門・高標高の石場/雪原・光世界のみ・未使用ハッシュ窓 seed+77777）
    // 風の羽根を持って傍らに立つと空島エンクレーブへ昇れる
    if (SKY_READY && (ground === T.STONE || ground === T.SNOW) &&
        !(Game.state && Game.state.worldName === 'shadow') &&
        U.hash3(wx, wy, seed + 77777) < 0.0006) {
      return { ground: ground, obj: O.WIND_ALTAR };
    }

    // ダンジョン（両世界・テーマ＆サイズ複数種: 遺跡/氷窟/砂の墳墓/溶岩工房）
    if (ground !== T.DEEP_WATER && ground !== T.WATER) {
      const DG = 74;
      const ax = Math.round(wx / DG) * DG, ay = Math.round(wy / DG) * DG;
      if (U.hash3(ax, ay, seed + 8888) < 0.085) {
        // サイズ: 約1/3 を大型(8x6)に。大型は巣2・宝箱複数・柱あり
        const big = U.hash3(ax, ay, seed + 1212) < 0.34;
        const hw = big ? 8 : 5, hh = big ? 6 : 4;
        const dx = wx - ax, dy = wy - ay;
        if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) {
          // テーマを地形で決定（雪原は氷窟/水晶洞窟に分岐）
          let wall;
          if (ground === T.SNOW) wall = (U.hash3(ax, ay, seed + 222) < 0.5) ? O.CRYSTAL_WALL : O.ICE_WALL;
          else if (ground === T.SAND) wall = O.TOMB_WALL;
          else if (ground === T.STONE) wall = O.FORGE_WALL;
          else wall = O.DUNGEON_WALL;
          const edge = Math.abs(dx) === hw || Math.abs(dy) === hh;
          const entrance = dy === hh && Math.abs(dx) <= 1; // 下側に入口
          if (entrance) return { ground: T.DUNGEON_FLOOR, obj: O.NONE }; // 入口は確実に開ける
          if (edge) return { ground: T.DUNGEON_FLOOR, obj: wall };
          // 内部を十字の通路(中央3x3ハブ＋幅1の縦横回廊)で4部屋に区切る迷路状レイアウト
          // 縦仕切り(dx=0)・横仕切り(dy=0)。中央付近(|*|<=1)は開けてハブ＆回廊を残す → 連結性保証
          const innerV = dx === 0 && Math.abs(dy) > 1;
          const innerH = dy === 0 && Math.abs(dx) > 1;
          if (innerV || innerH) return { ground: T.DUNGEON_FLOOR, obj: wall };
          // 中央ハブに主宝箱
          if (dx === 0 && dy === 0) return { ground: T.DUNGEON_FLOOR, obj: O.TREASURE_CHEST };
          // 各部屋(4象限)の奥に特徴物: 宝箱/巣/空 をハッシュで決定
          if (Math.abs(dx) === hw - 2 && Math.abs(dy) === hh - 2) {
            const q = (dx > 0 ? 1 : 0) + (dy > 0 ? 2 : 0);
            const hv = U.hash3(ax + q * 17, ay + q * 29, seed + 555);
            if (hv < 0.5) return { ground: T.DUNGEON_FLOOR, obj: O.TREASURE_CHEST };
            if (hv < 0.9) return { ground: T.DUNGEON_FLOOR, obj: O.SPAWNER };
          }
          // 大型は各部屋にもう1段の仕切り(開口付き)で入り組ませる
          if (big) {
            const subV = Math.abs(dx) === 4 && Math.abs(dy) > 2 && Math.abs(dy) < hh;
            if (subV) { const gapY = 3 + (U.hash3(ax + (dx > 0 ? 5 : -5), ay, seed + 71) < 0.5 ? 0 : 1); if (Math.abs(dy) !== gapY) return { ground: T.DUNGEON_FLOOR, obj: wall }; }
          }
          // 部屋内に散発的な柱/岩(回廊 |dx|<=1 or |dy|<=1 は除外して通路を確保)
          if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
            const rh = U.hash3(wx, wy, seed + 99);
            if (rh < 0.05) return { ground: T.DUNGEON_FLOOR, obj: wall };
            if (rh < 0.09) return { ground: T.DUNGEON_FLOOR, obj: O.ROCK };
          }
          return { ground: T.DUNGEON_FLOOR, obj: O.NONE };
        }
      }
    }

    // 影世界: 同じ地形形状(標高)・別オブジェクト
    const shadow = Game.state && Game.state.worldName === 'shadow';

    // 打ち捨てられた宝箱（地上=光世界のみ・ダンジョン外の探索報酬。石ブロックの小廃墟＋宝箱）
    if (walkableGround && !shadow && !(Game.state && Game.state.worldName === 'space')) {
      const CG = 53;
      const cax = Math.round(wx / CG) * CG, cay = Math.round(wy / CG) * CG;
      if (U.hash3(cax, cay, seed + 44444) < 0.06) {
        const cdx = wx - cax, cdy = wy - cay;
        if (cdx === 0 && cdy === 0) return { ground: ground, obj: O.TREASURE_CHEST };
        if (Math.abs(cdx) === 1 && Math.abs(cdy) === 1) return { ground: ground, obj: O.STONE_BLOCK };
      }
    }

    // 略奪者の野営地（地上=光世界のみ・無法者ロアと接続。柵で囲まれた拠点＋焚き火＋篝火の巣＋中央宝箱）
    if (walkableGround && !shadow && !(Game.state && Game.state.worldName === 'space')) {
      const BG = 61;
      const bax = Math.round(wx / BG) * BG, bay = Math.round(wy / BG) * BG;
      if (U.hash3(bax, bay, seed + 71717) < 0.045) {
        const bdx = wx - bax, bdy = wy - bay;
        if (Math.abs(bdx) <= 3 && Math.abs(bdy) <= 3) {
          const edge = Math.abs(bdx) === 3 || Math.abs(bdy) === 3;
          const entrance = bdy === 3 && bdx === 0; // 下側に入口
          if (edge) return { ground: ground, obj: entrance ? O.NONE : O.FENCE };
          if (bdx === 0 && bdy === 0) return { ground: ground, obj: O.TREASURE_CHEST };
          if ((bdx === 2 && bdy === 0) || (bdx === -2 && bdy === 0)) return { ground: ground, obj: O.BANDIT_SPAWNER };
          if ((bdx === -1 && bdy === -1) || (bdx === 1 && bdy === 1)) return { ground: ground, obj: O.CAMPFIRE };
          return { ground: ground, obj: O.NONE };
        }
      }
    }

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
    } else if (ground === T.SWAMP) {
      if (h < 0.07) obj = O.DEAD_TREE;
      else if (h < 0.14) obj = O.POISON_MUSHROOM;
      else if (h < 0.16) obj = O.BUSH;
    } else if (ground === T.VOLCANIC) {
      if (h < 0.08) obj = O.OBSIDIAN;
      else if (h < 0.16) obj = O.SULFUR_VENT;
      else if (h < 0.19) obj = O.ROCK;
    } else if (ground === T.MUSHROOM) {
      if (h < 0.1) obj = O.GIANT_MUSHROOM;
      else if (h < 0.2) obj = O.GLOW_SHROOM;
      else if (h < 0.23) obj = O.BUSH;
    } else if (ground === T.BLOOM) {
      // 花の野: 花が密生＋採取できる木の実の茂み(穏やかな採集地)
      if (h < 0.28) obj = O.FLOWER;
      else if (h < 0.34) obj = O.BERRY_BUSH;
      else if (h < 0.37) obj = O.BUSH;
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
          (t.ground === T.GRASS || t.ground === T.SAND || t.ground === T.FOREST || t.ground === T.DIRT) &&
          !inSkyEnclave(tx, ty, seed); // 空島の草地を初期スポーンに選ばない(海洋シード保険)
        if (walkable) return { tx, ty };
      }
    }
    return { tx: 0, ty: 0 };
  }

  // 危険度バンドの基準点(seed から決定論再計算・worldName 非依存)。findSpawn と同一の螺旋探索順だが
  // オブジェクトの有無を見ない(影世界でも同じ点になる)ため、実スポーンとほぼ同地点の安定アンカーになる。
  // 海洋シードでは螺旋走査が重いため seed 毎にメモ化(決定論なので安全)
  let anchorMemo = null, anchorMemoSeed = null;
  function spawnAnchor(seed) {
    if (anchorMemoSeed === seed && anchorMemo) return anchorMemo;
    anchorMemoSeed = seed;
    anchorMemo = scanAnchor(seed);
    return anchorMemo;
  }
  function scanAnchor(seed) {
    for (let r = 0; r < 400; r++) {
      for (let a = 0; a < Math.max(1, r * 6); a++) {
        const ang = (a / Math.max(1, r * 6)) * Math.PI * 2;
        const tx = Math.round(Math.cos(ang) * r);
        const ty = Math.round(Math.sin(ang) * r);
        const g = terrainAt(tx, ty, seed).ground;
        if (g === T.GRASS || g === T.SAND || g === T.FOREST || g === T.DIRT) return { tx, ty };
      }
    }
    return { tx: 0, ty: 0 };
  }

  return { genTile, generateChunk, findSpawn, dungeonThemeAt, spawnAnchor,
    inSkyEnclave, skyCenter, skyArrival, skyReturnAltar };
})();
