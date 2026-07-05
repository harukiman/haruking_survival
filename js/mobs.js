// mobs.js — モブAI・スポーン・描画・戦闘連携
window.Game = window.Game || {};

Game.Mobs = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const TUNE = Game.TUNE;

  // ===== ㊼ ボスのアーキタイプ: 攻撃パターン/速度をボスごとに明確に変える =====
  // berserker=高速猛攻/bruiser=重い近接/caster=距離を取り弾幕/summoner=召喚主体/artillery=遠距離砲撃
  const BOSS_ARCH = {
    hunger_beast: 'berserker', dire_alpha: 'berserker', shadow_knight: 'berserker', wanted_boss: 'berserker',
    twilight_colossus: 'bruiser', forge_titan: 'bruiser', lava_lord: 'bruiser', stone_warden: 'bruiser', city_warden: 'bruiser', colossus: 'bruiser',
    sovereign: 'caster', crystal_queen: 'caster', swamp_lord: 'caster', sky_warden: 'caster', rift_keeper: 'caster',
    spore_queen: 'summoner', star_guardian: 'summoner', tomb_king: 'summoner', broodmother: 'summoner',
    abyss_dragon: 'artillery', endbringer: 'artillery', storm_sovereign: 'artillery', void_emperor: 'artillery', ruin_king: 'artillery',
  };
  // volley=扇状弾幕 / slam=溜め叩き / summon=召喚 / radial=全方位弾 / zone=遅延設置爆発 / leap=跳躍叩きつけ
  // 各型に「得意技(signature)」を持たせ、ボスごとにモーション・攻め筋が明確に異なるようにする
  const ARCH = {
    berserker: { speed: 1.5, volley: 0.4, slam: 1.4, summon: 0.4, keepDist: 0, radial: 0, zone: 0.3, leap: 2.4 },
    bruiser: { speed: 1.15, volley: 0.5, slam: 1.6, summon: 0.6, keepDist: 0, radial: 0.2, zone: 0.5, leap: 1.3 },
    caster: { speed: 0.8, volley: 1.8, slam: 0.4, summon: 0.8, keepDist: 1, radial: 2.4, zone: 0.9, leap: 0 },
    summoner: { speed: 0.95, volley: 1.0, slam: 0.7, summon: 2.6, keepDist: 0.4, radial: 0.6, zone: 1.7, leap: 0.3 },
    artillery: { speed: 1.0, volley: 2.2, slam: 0.7, summon: 1.0, keepDist: 0.7, radial: 1.2, zone: 2.6, leap: 0 },
  };
  function archOf(type) { return ARCH[BOSS_ARCH[type] || 'bruiser']; }

  function list() { return Game.state.mobs; }

  // 指定タイル周辺(radius)に発光オブジェクトがあるか(夜の湧き抑制=光の安全圏)。
  // 呼び出しは湧き試行時のみ(スロットル済み)なので9x9走査で十分軽い
  function isLitArea(tx, ty, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const o = Game.World.objAt(tx + dx, ty + dy);
        if (o && Game.LIGHT_LEVEL[o] >= 6) return true; // たいまつ(8)/焚き火(9)/ランタン(10)等
      }
    }
    return false;
  }

  function spawnMob(type, wx, wy) {
    const def = Game.MOBS[type];
    if (!def) return;
    const diff = Game.DIFFICULTIES[Game.state.difficulty] || Game.DIFFICULTIES.normal;
    const mult = 1 + (Game.state.ngLevel || 0) * Game.TUNE.NG_HP_PER;
    // エリア危険度バンド(Game.DANGER/Game.World.dangerBandAt): 出現地点の帯で控えめに補強。
    // 非ボス敵対のみ・帯4でも+36%上限(既存ネームドボスのステータスは不変)。XP/バーツも帯で上昇
    const DZ = Game.DANGER;
    const band = (DZ && Game.World.dangerBandAt) ? Game.World.dangerBandAt(Math.floor(wx / TS), Math.floor(wy / TS)) : 1;
    const bandOver = Math.max(0, band - 1);
    const bandMult = (DZ && def.hostile && !def.boss) ? 1 + Math.min(DZ.STAT_MAX, DZ.STAT_PER * bandOver) : 1;
    // ボス強化(ユーザー指示: 脆すぎ→大幅強化)。プレイヤーLvに応じてHPが伸び、成長しても歯応えを保つ。
    // ダメージは据え置き(タンク化のみ)。中ボスは控えめ。
    const plv = (Game.state.player && Game.state.player.level) || 1;
    // ボスは「かなり強くてよい」(ユーザー指示)。スキルツリー/装備強化前提でHPも与ダメも伸ばし、成長しても歯応えを保つ
    const bossMult = def.boss ? 3.2 * (1 + Math.min(2.8, (plv - 1) * 0.045))
                   : def.midboss ? 2.2 * (1 + Math.min(1.4, (plv - 1) * 0.028)) : 1;
    // ボス/中ボスの与ダメも底上げ(タンク化だけでなく脅威に)。レベルで緩やかに増加
    const bossDmg = def.boss ? 1.4 * (1 + Math.min(0.8, (plv - 1) * 0.02))
                  : def.midboss ? 1.2 * (1 + Math.min(0.5, (plv - 1) * 0.015)) : 1;
    // 通常の敵対もプレイヤーLvで緩やかに強化(成長で雑魚化しすぎない)。+2%/Lv・最大+70%。ダメージは+1.2%/Lv・最大+45%
    const lvHp = (def.hostile && !def.boss && !def.midboss) ? 1 + Math.min(0.7, (plv - 1) * 0.02) : 1;
    const lvDmg = (def.hostile && !def.boss && !def.midboss) ? 1 + Math.min(0.45, (plv - 1) * 0.012) : 1;
    // 深夜の高ぶり: 光世界の夜、敵対モブは目を光らせ HP/攻撃/速度が明確に上がる。
    // その代わり撃破時のレア/固有ドロップ期待が上がる(killMob側)。血の月は別途さらに荒れる。
    const nightAmp = (def.hostile && !def.boss && Game.state.worldName === 'light' && Game.DayNight && Game.DayNight.isNight());
    const nightHp = nightAmp ? 1.55 : 1;   // 深夜個体はさらに強く(ユーザー: もっと強く)
    const nightDmg = nightAmp ? 1.4 : 1;
    // 星々の世界(space)は最終盤(超高コストのロケットで到達)。固有の敵をかなり強化
    const spaceHp = def.space ? (def.boss ? 1.5 : 2.4) : 1;
    const spaceDmg = def.space ? (def.boss ? 1.35 : 1.9) : 1;
    // 協力プレイ: ボス/中ボスは参加人数でHPが増える(共闘が歯応えを保つ)。+55%/人(自分以外)
    const peers = (Game.Net && Game.Net.isConnected && Game.Net.isConnected() && Game.Net.peerCount) ? Game.Net.peerCount() : 0;
    const coopHp = (def.boss || def.midboss) ? (1 + 0.55 * Math.min(3, peers)) : 1;
    const flatBossHp = def.boss ? 2 : def.midboss ? 1.5 : 1; // ユーザー指示: ボスHP一律×2/中ボス×1.5
    const flatBossDmg = def.boss ? 2 : def.midboss ? 1.5 : 1; // 攻撃力も同様に(ユーザー指示: HPだけでなく強さも)
    const diffHp = (def.hostile && diff.hpMult != null) ? diff.hpMult : 1; // 難易度(hard=1.35)で敵HP増
    const hp = Math.round(def.hp * mult * bandMult * bossMult * lvHp * nightHp * coopHp * spaceHp * flatBossHp * diffHp);
    const dmgMult = mult * bandMult * lvDmg * nightDmg * bossDmg * spaceDmg * flatBossDmg * (diff.dmgMult != null ? diff.dmgMult : 1);
    Game.state._mobId = (Game.state._mobId || 0) + 1;
    const m = {
      id: Game.state._mobId, type: type, def: def,
      x: wx, y: wy, prevX: wx, prevY: wy,
      hp: hp, maxHp: hp, dmg: Math.round(def.dmg * dmgMult),
      vx: 0, vy: 0, dir: 'down',
      state: 'wander', stateTimer: 0, attackCd: 0,
      hurt: 0, fleeTimer: 0, hopPhase: Math.random() * 6,
      knockX: 0, knockY: 0,
      // 個体差: 同じ種でも大きさ/色味/動き方を変えて一辺倒を避ける
      sizeVar: 0.78 + Math.random() * 0.46,          // 0.78〜1.24(個体差を拡大して見た目を多様化)
      tint: Math.round((Math.random() - 0.5) * 38),  // 色の明暗揺らぎ -19〜+19
      moveStyle: pickMoveStyle(type, def),
      wobble: Math.random() * 6,
      band: band,
      xpMult: (DZ && def.hostile) ? 1 + DZ.XP_PER * bandOver : 1,
      nightAmped: !!nightAmp, glowEyes: !!nightAmp,
      nightSpeed: nightAmp ? 1.2 : 1,
      archSpeed: def.boss ? archOf(type).speed : 1, // ㊼ ボスの機動性を型で差別化
    };
    // 精鋭(elite)抽選: 非ボスの敵対モブが低確率で精鋭化（HP/攻撃UP・発光オーラ・確定レアドロップ）
    // 帯別倍率: 安全圏0=精鋭なし / 辺境2倍 / 深域3倍 / 深域+4倍 → 奥地ほど戦利品厳選が捗る
    const eliteMult = ((DZ && DZ.ELITE_MULT[band] != null) ? DZ.ELITE_MULT[band] : 1) * (diff.eliteMult || 1); // hardは精鋭が出やすい
    if (!def.boss && def.hostile && Math.random() < (TUNE.ELITE_CHANCE || 0.04) * eliteMult) {
      m.elite = true;
      m.maxHp = m.hp = Math.round(m.maxHp * (TUNE.ELITE_HP_MULT || 2.2));
      m.dmg = Math.round(m.dmg * (TUNE.ELITE_DMG_MULT || 1.5));
      m.auraPhase = Math.random() * 6;
      // 精鋭アフィックス: 特殊変異を1つ抽選
      const ak = Object.keys(Game.ELITE_AFFIXES || {});
      if (ak.length) {
        m.eliteAffix = ak[Math.floor(Math.random() * ak.length)];
        const af = Game.ELITE_AFFIXES[m.eliteAffix];
        if (af.speed) m.eliteSpeedMult = af.speed;
        m.auraRGB = hexToRgb(af.aura);
      }
      // チャンピオン: 精鋭の上位レア。2つ目のアフィックス＋固有名＋追加強化＋専用カラー(深域では2倍)
      const champMult = (DZ && DZ.CHAMP_MULT[band] != null) ? DZ.CHAMP_MULT[band] : 1;
      if (ak.length && Math.random() < (TUNE.CHAMPION_CHANCE || 0.08) * champMult) {
        m.champion = true;
        m.maxHp = m.hp = Math.round(m.maxHp * (TUNE.CHAMPION_HP_MULT || 1.6));
        m.dmg = Math.round(m.dmg * (TUNE.CHAMPION_DMG_MULT || 1.2));
        const others = ak.filter(function (k) { return k !== m.eliteAffix; });
        if (others.length) {
          m.eliteAffix2 = others[Math.floor(Math.random() * others.length)];
          const af2 = Game.ELITE_AFFIXES[m.eliteAffix2];
          if (af2.speed && !m.eliteSpeedMult) m.eliteSpeedMult = af2.speed;
        }
        m.championName = makeChampionName();
        m.auraRGB = [255, 90, 200]; // チャンピオン専用カラー
      }
    }
    // ボス/中ボス/チャンピオンはアリーナ(出現地点)を記録: 遠方離脱時にここへ帰還し再戦可能にする
    if (def.boss || def.midboss || m.champion) { m.homeX = m.x; m.homeY = m.y; }
    Game.state.mobs.push(m);
    // 中ボス(ランクD)の出現通知＋効果音
    if (def.midboss && Game.UI && Game.UI.toast && !(Game.Net.isConnected() && !Game.Net.host)) {
      Game.UI.toast('⚔ ランクD 中ボス「' + (def.name || type) + '」が現れた！');
      Game.Audio.play('event_horde'); if (Game.Render.shake) Game.Render.shake(5);
    }
    // ボス登場アニメムービー（種別ごと初回・ローカル再生）
    if (def.boss && Game.Cutscene && Game.Cutscene.playBossIntro && !(Game.Net.isConnected() && !Game.Net.host)) {
      if (!Game.state.bossSeen) Game.state.bossSeen = {};
      if (!Game.state.bossSeen[type] && !Game.Cutscene.isPlaying()) {
        Game.state.bossSeen[type] = 1;
        Game.state.paused = true;
        Game.Cutscene.playBossIntro(type, function () { Game.state.paused = false; });
      }
    }
    return m;
  }

  // 周辺の空き walkable タイルを探してスポーン
  function trySpawn() {
    if (Game.state.mobs.length >= TUNE.MOB_CAP) return;
    if (Game.state.worldName === 'space') return; // 宇宙は巣からのみ
    const shadowWorld = Game.state.worldName === 'shadow';
    const night = Game.Lighting.ambientDarkness() > 0.4;
    const p = Game.state.player;
    for (let attempt = 0; attempt < 8; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = (14 + Math.random() * 8) * TS;
      const wx = p.x + Math.cos(ang) * dist;
      const wy = p.y + Math.sin(ang) * dist;
      const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
      if (!Game.World.isWalkable(tx, ty)) continue;
      const g = Game.World.groundAt(tx, ty);
      const diff = Game.DIFFICULTIES[Game.state.difficulty] || Game.DIFFICULTIES.normal;
      // エリア危険度バンド: 湧き地点の帯で「どの種が出るか」を選別(ステータス乗算より種選別を優先)
      const DZ = Game.DANGER;
      const band = (DZ && Game.World.dangerBandAt) ? Game.World.dangerBandAt(tx, ty) : 1;
      let type = null;
      // 空島エンクレーブ(光世界): 昼夜問わず固有の飛来モブ(風の精/雲鷹)を湧かせる。番人は巣が担当
      if (Game.state.worldName === 'light' && Game.WorldGen.inSkyEnclave && Game.WorldGen.inSkyEnclave(tx, ty, Game.state.seed)) {
        if (!diff.spawnHostiles) continue;
        spawnMob(Math.random() < 0.5 ? 'wind_wisp' : 'cloud_hawk', wx, wy); return;
      }
      // 古代都市エンクレーブ(光世界): 哨士の亡骸/幽き蛾を湧かせる。守番は神殿の巣が担当
      if (Game.state.worldName === 'light' && Game.WorldGen.inRuinCity && Game.WorldGen.inRuinCity(tx, ty, Game.state.seed)) {
        if (!diff.spawnHostiles) continue;
        spawnMob(Math.random() < 0.55 ? 'sentinel_husk' : 'gloom_moth', wx, wy); return;
      }
      // 狭間エンクレーブ(影世界): 狭間の亡霊/反響の幻を湧かせる。番人は巣が担当
      if (Game.state.worldName === 'shadow' && Game.WorldGen.inRiftVoid && Game.WorldGen.inRiftVoid(tx, ty, Game.state.seed)) {
        if (!diff.spawnHostiles) continue;
        spawnMob(Math.random() < 0.55 ? 'rift_wraith' : 'echo_phantom', wx, wy); return;
      }
      if (shadowWorld) {
        if (!diff.spawnHostiles) continue; // のんびり: 影世界でも敵なし
        // 影世界でも光の安全圏は有効(半径3タイル=光世界より狭い)。常闇の世界では明かりが文字通り命綱
        if (isLitArea(tx, ty, 3)) continue;
        // 影世界は固有の敵が常時出現。深層では徘徊者も
        const deep = Game.World.inDepths();
        if (deep && Math.random() < 0.02 && countType('abyss_dragon') === 0) { type = 'abyss_dragon'; } // 深淵の竜(エンドゲーム)
        else if (deep && Math.random() < 0.04 && countType('hunger_beast') === 0) { type = 'hunger_beast'; }
        else if (Math.random() < 0.025 && !hasMidboss()) { type = 'shadow_knight'; } // 影の騎士(中ボスD)が稀出現
        const pool = deep
          ? ['wraith', 'watcher', 'abyss_stalker', 'abyss_stalker', 'spider', 'hex_caster', 'shade_stalker']
          : ['wraith', 'wraith', 'watcher', 'spider', 'hex_caster', 'gazer', 'shade_stalker'];
        if (!type)
        type = pool[Math.floor(Math.random() * pool.length)];
      } else if (night && diff.spawnHostiles) {
        // 光の安全圏: 松明/焚き火など発光オブジェクトの近く(半径4タイル)には夜の敵が湧かない。
        // 「明かりで陣地を作る」動機(世界反応性)。血の月だけは光を恐れない
        if (!Game.state.bloodMoon && isLitArea(tx, ty, 4)) continue;
        // 夜は敵対モブ（のんびりは出ない）。血の月は強敵寄りで帯制限も無視する唯一の例外
        // 血の月の夜は地上ボス「黄昏の巨像」が稀出現(1体まで)
        if (Game.state.bloodMoon && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('twilight_colossus') === 0) {
          type = 'twilight_colossus';
        } else if (g === Game.TILE.SWAMP && Game.state.worldName === 'light' && band >= 1 && Math.random() < 0.02 && countType('swamp_lord') === 0) {
          type = 'swamp_lord'; // 夜の毒の沼地に沼の主が稀出現
        } else if (g === Game.TILE.VOLCANIC && Game.state.worldName === 'light' && band >= 1 && Math.random() < 0.02 && countType('lava_lord') === 0) {
          type = 'lava_lord'; // 火山地帯に溶岩の王が稀出現
        } else if (g === Game.TILE.MUSHROOM && Game.state.worldName === 'light' && band >= 1 && Math.random() < 0.02 && countType('spore_queen') === 0) {
          type = 'spore_queen'; // キノコの森に胞子の女王が稀出現
        } else if ((band >= 1 || Game.state.bloodMoon) && Math.random() < (Game.state.bloodMoon ? 0.03 : 0.015) * (band >= 3 ? 2 : 1) && !hasMidboss()) {
          // 中ボス(ランクD)が夜に稀出現。1体まで。安全圏では血の月以外出ない・深域は率2倍
          const mb = ['dire_alpha', 'stone_warden', 'broodmother'];
          type = mb[Math.floor(Math.random() * mb.length)];
        } else {
          // 帯別プール: 安全圏=弱敵のみ＋湧き半減 / 開拓圏=従来 / 辺境・深域=強敵混成(config.js の DANGER 表)
          let pool;
          if (Game.state.bloodMoon) {
            pool = ['zombie', 'zombie', 'skeleton', 'spider', 'leech', 'bandit', 'bat', 'gazer', 'troll', 'harpy', 'viper', 'charger'];
          } else if (band === 0) {
            if (Math.random() < 0.5) continue; // 安全圏: 夜も湧きを半減して序盤の理不尽死を防ぐ
            pool = (DZ && DZ.POOL_NIGHT[0]) || ['slime', 'zombie', 'skeleton'];
          } else if (band >= 2 && DZ && DZ.POOL_NIGHT[Math.min(band, 3)]) {
            pool = DZ.POOL_NIGHT[Math.min(band, 3)];
          } else {
            pool = ['zombie', 'skeleton', 'spider', 'slime', 'leech', 'bat', 'gazer', 'harpy', 'viper', 'charger'];
          }
          type = pool[Math.floor(Math.random() * pool.length)];
        }
      } else {
        // 昼: 動物＋環境ごとの敵（砂漠=サソリ/呪術師, 雪原=白熊, 森=稀に猪/トロル/旅人）
        // 安全圏(band0)の昼は敵対を湧かせない(オンボーディング保護)。深域は昼でも強敵が徘徊
        const diffH = diff.spawnHostiles && band >= 1;
        if (band >= 3 && diffH && Math.random() < 0.18) {
          const dp = (DZ && DZ.POOL_DAY3) || ['troll', 'charger', 'golem'];
          type = dp[Math.floor(Math.random() * dp.length)];
        } else if (g === Game.TILE.GRASS || g === Game.TILE.FOREST || g === Game.TILE.BLOOM) {
          if (Math.random() < 0.04 && countType('wanderer') === 0) type = 'wanderer';
          else if (diffH && g === Game.TILE.FOREST && Math.random() < 0.05) type = 'troll';
          else if (diffH && g === Game.TILE.FOREST && Math.random() < 0.12) type = 'mud_crawler';
          else if (diffH && g === Game.TILE.FOREST && Math.random() < 0.10) type = 'giant_toad';
          else if (diffH && Math.random() < 0.12) type = 'boar';
          else { const pool = ['rabbit', 'deer', 'sheep']; type = pool[Math.floor(Math.random() * pool.length)]; }
        } else if (g === Game.TILE.SAND && diffH && Math.random() < 0.5) {
          const r2 = Math.random();
          type = r2 < 0.25 ? 'dust_mage' : r2 < 0.45 ? 'dune_serpent' : r2 < 0.7 ? 'sand_wurm' : 'scorpion';
        } else if (g === Game.TILE.SNOW && diffH && Math.random() < 0.4) {
          const r2 = Math.random();
          type = r2 < 0.4 ? 'frost_wolf' : r2 < 0.7 ? 'frost_spider' : 'ice_bear';
        } else if (g === Game.TILE.STONE && diffH && Math.random() < 0.3) {
          type = 'slime'; // 敵対のためのんびり/安全圏では出さない(帯ゲート追加)
        } else if (g === Game.TILE.SWAMP && diffH && Math.random() < 0.55) {
          // 毒の沼地: 沼特有の敵が出やすい
          const sp = ['bog_horror', 'mud_crawler', 'leech', 'swamp_wisp', 'swamp_wisp', 'giant_toad', 'giant_toad', 'viper'];
          type = sp[Math.floor(Math.random() * sp.length)];
        } else if (g === Game.TILE.VOLCANIC && diffH && Math.random() < 0.55) {
          // 火山地帯: 火の敵が出やすい
          const vp = ['ember_imp', 'ember_imp', 'salamander', 'salamander', 'dust_mage', 'golem', 'cursed_armor'];
          type = vp[Math.floor(Math.random() * vp.length)];
        }
      }
      if (type) { spawnMob(type, wx, wy); return; }
    }
  }

  // ダンジョンの魔物の巣から、テーマ別の敵を湧かせる
  function spawnerSpawn() {
    if (Game.state.mobs.length >= TUNE.MOB_CAP) return;
    const p = Game.state.player, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    let spawned = 0;
    for (let dy = -8; dy <= 8 && spawned < 1; dy++) {
      for (let dx = -8; dx <= 8 && spawned < 1; dx++) {
        const spObj = Game.World.objAt(ptx + dx, pty + dy);
        if (spObj !== Game.OBJ.SPAWNER && spObj !== Game.OBJ.BANDIT_SPAWNER) continue;
        if (Math.random() > 0.32) continue;
        const stx = ptx + dx, sty = pty + dy;
        const g = Game.World.groundAt(stx, sty);
        // ダンジョンテーマ判定: 巣タイルの ground はダンジョン床(DUNGEON_FLOOR)になるため、
        // 自然地形から復元する WorldGen.dungeonThemeAt でテーマ湧きを正しく決める(旧: g 判定は床で常に不成立だった)
        const DZ = Game.DANGER;
        const theme = (Game.WorldGen.dungeonThemeAt && Game.state.worldName !== 'space')
          ? Game.WorldGen.dungeonThemeAt(stx, sty, Game.state.seed) : null;
        let pool;
        if (spObj === Game.OBJ.BANDIT_SPAWNER) { pool = ['bandit', 'bandit', 'bandit', 'skeleton']; } // 略奪者の野営地
        else if (Game.state.worldName === 'space') { pool = (Math.random() < 0.04 && countType('star_guardian') === 0) ? ['star_guardian'] : ['void_drone', 'void_drone', 'astral_serpent', 'void_jelly']; }
        else if (Game.state.worldName === 'shadow') pool = (theme && DZ && DZ.DUNGEON_POOLS.shadow) ? DZ.DUNGEON_POOLS.shadow : ['wraith', 'watcher', 'hex_caster', 'gazer']; // 影神殿=最高危険帯
        else if (theme && DZ && DZ.DUNGEON_POOLS[theme]) pool = DZ.DUNGEON_POOLS[theme]; // 遺跡=低/氷窟・墳墓=中/工房・水晶洞=高
        else if (Game.state.worldName === 'light' && Game.WorldGen.inSkyEnclave && Game.WorldGen.inSkyEnclave(stx, sty, Game.state.seed)) pool = ['wind_wisp', 'cloud_hawk', 'wind_wisp']; // 空島の番人の宝殿=風の精/雲鷹
        else if (Game.state.worldName === 'light' && Game.WorldGen.inRuinCity && Game.WorldGen.inRuinCity(stx, sty, Game.state.seed)) pool = ['sentinel_husk', 'gloom_moth', 'sentinel_husk']; // 古代都市の神殿=哨士/幽き蛾
        else if (Game.state.worldName === 'shadow' && Game.WorldGen.inRiftVoid && Game.WorldGen.inRiftVoid(stx, sty, Game.state.seed)) pool = ['rift_wraith', 'echo_phantom', 'rift_wraith']; // 狭間の巣=亡霊/反響の幻
        else if (g === Game.TILE.SNOW) pool = ['frost_wisp', 'frost_wisp', 'cursed_armor', 'ice_bear'];
        else if (g === Game.TILE.SAND) pool = ['scorpion', 'scorpion', 'dust_mage', 'cursed_armor', 'golem'];
        else pool = ['zombie', 'skeleton', 'spider', 'cursed_armor', 'golem', 'ember_imp', 'bog_horror'];
        // テーマ別ダンジョンボス（稀・1体まで）
        let type = null;
        if (Game.state.worldName === 'light' && spObj !== Game.OBJ.BANDIT_SPAWNER && theme && DZ && DZ.DUNGEON_BOSS[theme]) {
          const tb = DZ.DUNGEON_BOSS[theme];
          // 各ダンジョンに番人が居るように出現率を大幅UP(ユーザー: 固有中ボスが居ない)。世界全体で最大3体まで
          if (Math.random() < 0.14 && countType(tb) < 3) type = tb;
        }
        // 空島の固有ボス「嵐の主」(稀・1体まで)＞ 番人(中ボスD)
        if (!type && Game.state.worldName === 'light' && Game.WorldGen.inSkyEnclave && Game.WorldGen.inSkyEnclave(stx, sty, Game.state.seed)) {
          if (Math.random() < 0.025 && countType('storm_sovereign') === 0) type = 'storm_sovereign';
          else if (Math.random() < 0.05 && countType('sky_warden') === 0) type = 'sky_warden';
        }
        // 古代都市の固有ボス「玉座の王」(稀) ＞ 守番(中ボスD)
        if (!type && Game.state.worldName === 'light' && Game.WorldGen.inRuinCity && Game.WorldGen.inRuinCity(stx, sty, Game.state.seed)) {
          if (Math.random() < 0.025 && countType('ruin_king') === 0) type = 'ruin_king';
          else if (Math.random() < 0.05 && countType('city_warden') === 0) type = 'city_warden';
        }
        // 狭間の固有ボス「虚無の帝」(稀) ＞ 番人(中ボスD)
        if (!type && Game.state.worldName === 'shadow' && Game.WorldGen.inRiftVoid && Game.WorldGen.inRiftVoid(stx, sty, Game.state.seed)) {
          if (Math.random() < 0.025 && countType('void_emperor') === 0) type = 'void_emperor';
          else if (Math.random() < 0.05 && countType('rift_keeper') === 0) type = 'rift_keeper';
        }
        if (!type) type = pool[Math.floor(Math.random() * pool.length)];
        // 近傍の歩ける床へ
        for (let a = 0; a < 6; a++) {
          const ox = stx + (Math.floor(Math.random() * 3) - 1), oy = sty + (Math.floor(Math.random() * 3) - 1);
          const wxx = ox * TS + TS / 2, wyy = oy * TS + TS / 2;
          if (Math.hypot(wxx - p.x, wyy - p.y) < 3.5 * TS) continue; // 至近湧きの不意打ち防止
          if (Game.World.isWalkable(ox, oy)) { spawnMob(type, wxx, wyy); spawned++; break; }
        }
      }
    }
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }

  function hasAffix(m, key) { return m.eliteAffix === key || m.eliteAffix2 === key; }

  // 種族(シルエット)ごとに動き方を偏らせ、家族単位の個性を出す
  // 獣=跳びかかり / 蛇=蛇行 / 蜘蛛=旋回 / 人型=直進・回り込み / 浮遊系=旋回・蛇行
  function pickMoveStyle(type, def) {
    const shape = def.shape || defaultShape(type);
    const r = Math.random();
    if (shape === 'beast') return r < 0.5 ? 'pounce' : r < 0.8 ? 'strafe' : 'direct';
    if (shape === 'serpent') return r < 0.65 ? 'zigzag' : 'direct';
    if (shape === 'spider') return r < 0.5 ? 'orbit' : r < 0.8 ? 'zigzag' : 'strafe';
    if (shape === 'humanoid') return r < 0.45 ? 'direct' : r < 0.8 ? 'strafe' : 'zigzag';
    if (shape === 'orb' || shape === 'wisp' || shape === 'bird' || shape === 'bat') return r < 0.5 ? 'orbit' : 'zigzag';
    return r < 0.36 ? 'direct' : r < 0.56 ? 'zigzag' : r < 0.72 ? 'strafe' : r < 0.86 ? 'pounce' : 'orbit';
  }

  // 群れ連携(lite): 仲間が攻撃されると周囲の同族が呼応して駆けつける種族
  const PACK_TYPES = { frost_wolf: 1, spider: 1, frost_spider: 1, bandit: 1, ember_imp: 1, void_drone: 1 };

  function makeChampionName() {
    const N = Game.CHAMPION_NAMES || { title: ['名もなき'], name: ['強者'] };
    return N.title[Math.floor(Math.random() * N.title.length)] + N.name[Math.floor(Math.random() * N.name.length)];
  }

  // 弾の種類→敵の状態異常付与（fire=燃焼/venom・hex=毒/frost=鈍足）
  const KIND_DOT = { fire: ['burn', 150], venom: ['poison', 180], hex: ['poison', 150], frost: ['slow', 150] };
  // 元素反応: 熱衝撃(炎↔凍)。燃えている敵に凍/凍えている敵に炎を重ねると急激な温度差でバースト＋両状態を消費。
  // 属性を「重ねる」読み合いに意味を持たせる(密度A)。
  function thermalShock(m) {
    const dmg = Math.max(7, Math.round((m.def.hp || 30) * 0.13));
    if (m.dot) { m.dot.burn = 0; m.dot.slow = 0; }
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '熱衝撃!', '#ffd0e0', true);
    if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elem_thermal', '元素反応「熱衝撃」！ 炎と氷を重ねると急激な温度差で大ダメージ。属性を切り替えて攻めよう');
    if (Game.Render.spawnParticles) { Game.Render.spawnParticles(m.x, m.y, '#bfe4ff', 10); Game.Render.spawnParticles(m.x, m.y, '#ff9a4a', 10); }
    if (Game.Audio) Game.Audio.play('thermal');
    Game.state.hitstop = Math.max(Game.state.hitstop || 0, 3); // 反応の重みを一拍で伝える
    damageMob(m, dmg, m.x, m.y, false);
  }
  // 敵の属性(名前/種別から導出、キャッシュ)。火/氷/null(無属性)
  function mobElement(m) {
    if (m._elem !== undefined) return m._elem;
    const t = m.type || '';
    let e = null;
    if (/ember|salamander|magma|lava|cinder|forge|flame|scorch|fire|sun|solar|blaze/.test(t)) e = 'fire';
    else if (/frost|^ice|_ice|glacier|snow|rime|winter|chill|blizzard|frozen/.test(t)) e = 'ice';
    m._elem = e; return e;
  }
  // 属性の敵は接触で対応する状態異常を付与(火=炎上/氷=凍え)。双方向の元素テーマ=敵の属性を尊重する読み合い
  function inflictMobElement(m) {
    if (!Game.Status || !Game.Status.add) return;
    const el = mobElement(m);
    if (el === 'fire') Game.Status.add('burn', 130);
    else if (el === 'ice') Game.Status.add('cold', 130);
  }
  function applyDot(m, kind) {
    if (!m || !m.def || m.def.npc) return;
    const e = KIND_DOT[kind]; if (!e) return;
    m.dot = m.dot || {};
    // 元素相性: 同属性は無効(炎の敵に炎/氷の敵に凍結は効かない)。逆属性は弱点。
    const elem = mobElement(m);
    if ((kind === 'fire' && elem === 'fire') || (kind === 'frost' && elem === 'ice')) {
      if (Game.Render.spawnFloat && Game.state.tick % 4 === 0) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, '無効', '#9aa', false);
      if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elem_affinity', '属性相性！ 炎の敵に炎/氷の敵に氷は効かない。逆属性(炎の敵には氷、氷の敵には炎)が弱点だ');
      return;
    }
    if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elem_intro', '元素武器: 🔥炎上(継続ダメ)/❄凍え(鈍足)/☠毒。凍った敵に会心で「粉砕」、逆属性は弱点。組み合わせを試そう');
    const weak = (kind === 'fire' && elem === 'ice') || (kind === 'frost' && elem === 'fire');
    if (weak && Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, '弱点!', '#ffe27a', true);
    if ((kind === 'fire' && (m.dot.slow || 0) > 0) || (kind === 'frost' && (m.dot.burn || 0) > 0)) { thermalShock(m); m.chill = 0; return; }
    // 弱点属性は状態が強く入る(氷の敵は炎で長く燃え、火の敵は氷で早く凍る)
    if (weak && kind === 'frost' && !m.def.boss) { m.chill = (m.chill || 0) + 1; } // 追加で凍結が早い(通常の加算と合わせ実質2倍)
    // 氷結: 氷を重ねがけ(3スタック)すると敵が凍りつき停止。ボスは免疫、中ボスは短縮。
    if (kind === 'frost' && !m.def.boss && (m.iced || 0) <= 0) {
      m.chill = (m.chill || 0) + 1;
      if (m.chill >= 3) {
        m.chill = 0; m.iced = m.def.midboss ? 36 : 66; m.dot.slow = 0;
        if (Game.Audio) Game.Audio.play('freeze');
        Game.state.hitstop = Math.max(Game.state.hitstop || 0, 2);
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '氷結!', '#bfe4ff', true);
        if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, '#dff0ff', 14);
        if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elem_freeze', '氷結！ 氷を重ねがけすると敵が凍りついて動けない。今のうちに会心で「粉砕」を狙え');
        return;
      }
    }
    // 天候の影響: 雨/雪は炎上が消えやすく(半減)、吹雪は凍えが長引く(1.5倍)。天候で武器を持ち替える理由になる
    let wMul = 1;
    const wt2 = Game.state.weather && Game.state.weather.type;
    if (kind === 'fire' && (wt2 === 'rain' || wt2 === 'storm' || wt2 === 'snow' || wt2 === 'blizzard')) { wMul = 0.5; if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('weather_fire', '🌧 雨や雪の中では炎が消えやすい(炎上半減)。天候に合わせて武器を選ぼう'); }
    if (kind === 'frost' && wt2 === 'blizzard') { wMul = 1.5; if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('weather_frost', '🌨 吹雪の中では凍えが長引く(1.5倍)。氷武器の好機だ'); }
    m.dot[e[0]] = Math.max(m.dot[e[0]] || 0, Math.round(e[1] * (weak ? 1.6 : 1) * wMul)); // 弱点は状態異常が長い
  }
  // 武器由来の出血DoT: dmg/秒相当を dur フレーム継続(既存より深手を優先)
  function applyBleed(m, dmg, dur, every, col) {
    if (!m || !m.def || m.def.npc || m.def.friendly) return;
    const total = (m.bleed && m.bleed.left) || 0;
    if (!m.bleed || dur > total) m.bleed = { dmg: dmg, left: dur, every: every || 30, col: col || '#ff5a6a' };
  }

  // 騒音アグロ(C: 世界の反応性): 銃声/爆発など大きな音は周囲の敵を警戒させ引き寄せる。
  // 近接/採掘は静かで音を出さない=ステルス寄りに遊べる。alertT を立てると aggro 範囲1.7倍+遠方から駆けつける。
  function alertNoise(x, y, radiusTiles, frames) {
    const TS = Game.CFG.TILE_SIZE, r = (radiusTiles || 8) * TS, mobs = Game.state.mobs;
    let n = 0;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i]; if (!m.def || !m.def.hostile) continue;
      if (Math.hypot(m.x - x, m.y - y) > r) continue;
      m.alertT = Math.max(m.alertT || 0, frames || 120);
      if (n < 6 && Game.Render.spawnFloat && Math.random() < 0.5) Game.Render.spawnFloat(m.x, m.y - m.def.size, '❕', '#ffd24a');
      n++;
    }
    return n;
  }

  // ボスの色から弾幕の属性を推定(赤=炎/青=氷/緑=毒/他=呪)。ボスごとの個性を安価に付与
  function bossElement(hex) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return 'hex';
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (r > g + 30 && r > b + 30) return 'fire';
    if (b > r + 30 && b > g + 10) return 'frost';
    if (g > r + 20 && g > b + 20) return 'venom';
    return 'hex';
  }

  // 反射の盾核(reflect_aegis): 受けたダメージの一定割合を攻撃元モブへ跳ね返す。ボスにも有効。
  function reflectShield(m, rawDmg, p) {
    if (!p || !p.gearReflect || p.gearReflect <= 0 || !m || m.hp <= 0) return;
    const refl = Math.max(1, Math.round((rawDmg || 0) * p.gearReflect));
    Game.Render.spawnParticles(m.x, m.y, '#8fd0ff', 6);
    if (Game.Render.spawnImpact) Game.Render.spawnImpact(m.x, m.y, '#bfe8ff');
    damageMob(m, refl, p.x, p.y, false);
  }

  // 形が未指定のモブを、種ごとに安定して多彩な形へ(一辺倒の'round'を解消)
  const SHAPE_POOL = ['blob', 'tall', 'spiky', 'beast', 'humanoid', 'round'];
  // 種ごとに実在生物/敵らしいシルエットへ割当
  const TYPE_SHAPE = {
    rabbit: 'beast', deer: 'beast', sheep: 'beast', boar: 'beast', ice_bear: 'beast', frost_wolf: 'beast', giant_toad: 'beast', troll: 'beast', charger: 'beast', golem: 'tall',
    zombie: 'humanoid', skeleton: 'humanoid', bandit: 'humanoid', cursed_armor: 'humanoid', hex_caster: 'humanoid', dust_mage: 'humanoid', wanderer: 'humanoid',
    bat: 'bat', harpy: 'bird',
    viper: 'serpent', dune_serpent: 'serpent', astral_serpent: 'serpent', sand_wurm: 'serpent', salamander: 'serpent', mud_crawler: 'serpent', leech: 'serpent',
    scorpion: 'spiky', frost_spider: 'spider', ember_imp: 'spiky', void_drone: 'orb', gazer: 'orb',
    swamp_wisp: 'wisp', frost_wisp: 'wisp', bog_horror: 'blob', void_jelly: 'blob', mimic: 'blob',
  };
  function defaultShape(type) {
    if (type === 'slime') return 'blob';
    if (type === 'spider') return 'spider';
    if (TYPE_SHAPE[type]) return TYPE_SHAPE[type];
    let h = 0; for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
    return SHAPE_POOL[h % SHAPE_POOL.length];
  }

  // 16進色を明暗シフト(個体差の色味)
  function shadeHex(hex, amt) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
    const cl = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v; };
    const r = cl(parseInt(hex.slice(1, 3), 16) + amt);
    const g = cl(parseInt(hex.slice(3, 5), 16) + amt);
    const b = cl(parseInt(hex.slice(5, 7), 16) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function moveMob(m, dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    if (m.eliteSpeedMult) speed *= m.eliteSpeedMult; // 俊足アフィックス
    if (m.nightSpeed && m.nightSpeed !== 1) speed *= m.nightSpeed; // 深夜の高ぶり
    if (m.archSpeed && m.archSpeed !== 1) speed *= m.archSpeed; // ボスのアーキタイプ機動
    if (m.dot && m.dot.slow > 0) speed *= 0.55; // 凍えで鈍足
    dx /= len; dy /= len;
    if (Math.abs(dx) > Math.abs(dy)) m.dir = dx < 0 ? 'left' : 'right';
    else m.dir = dy < 0 ? 'up' : 'down';
    // 火避け: 火/爆発に弱い敵は燃え盛るタイルへ踏み込まない(炎が戦術的な壁になる=ゾーン制圧)。
    // 火属性/自爆虫/ボスは無視して踏破。既に火中に居る敵は「新たな火タイル」だけ避ける=脱出は可能。
    const fset = (Game.state.fires && Game.state.fires.length) ? Game.state._fireTiles : null;
    const avoidFire = fset && !m.def.boss && !m.def.bomber && mobElement(m) !== 'fire';
    const nx = m.x + dx * speed;
    if (walkAt(nx, m.y, m) && !(avoidFire && fset.has(Math.floor(nx / TS) + ',' + Math.floor(m.y / TS)))) m.x = nx;
    const ny = m.y + dy * speed;
    if (walkAt(m.x, ny, m) && !(avoidFire && fset.has(Math.floor(m.x / TS) + ',' + Math.floor(ny / TS)))) m.y = ny;
  }

  function walkAt(wx, wy, m) {
    const r = m.def.size * 0.5;
    const pts = [[wx - r, wy - r], [wx + r, wy - r], [wx - r, wy + r], [wx + r, wy + r]];
    for (let i = 0; i < pts.length; i++) {
      if (!Game.World.isWalkable(Math.floor(pts[i][0] / TS), Math.floor(pts[i][1] / TS))) return false;
    }
    return true;
  }

  // ===== 危険度バンド越え警告(ローカル・セッション毎1回・ヒステリシス付き) =====
  // 状態は Game.state 直下(_bandWatch)に置く: serialize() の許可リスト外なので保存されず、
  // リロード/ニューゲームで再アーム(=セッション毎)。境界振動対策として同一帯を連続2回(約1秒)観測で確定
  function watchDangerBand() {
    if (!Game.World.dangerBandAt || !Game.state.player || Game.state.paused) return;
    if (Game.state.tick % 15 !== 0) return;
    let W = Game.state._bandWatch;
    if (!W) W = Game.state._bandWatch = { seen: {}, cur: 0, pend: -1, n: 0 };
    const p = Game.state.player;
    const b = Game.World.dangerBandAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
    if (b === W.cur) { W.pend = -1; W.n = 0; return; }
    if (b !== W.pend) { W.pend = b; W.n = 1; return; }
    W.n++;
    if (W.n < 2) return;
    W.cur = b; W.pend = -1; W.n = 0;
    if (b >= 1 && !W.seen[b]) {
      W.seen[b] = 1;
      const DZ = Game.DANGER;
      const msg = DZ && DZ.TOASTS && DZ.TOASTS[b];
      if (msg && Game.UI && Game.UI.toast) Game.UI.toast(msg);
      if (b >= 3) { // 深域: 強めの警告演出(赤フラッシュ＋ライザー＋微シェイク)
        if (Game.Audio.cue) Game.Audio.cue('riser');
        if (Game.Render.flash) Game.Render.flash('rgba(200,40,60,0.18)');
        if (Game.Render.shake) Game.Render.shake(4);
      } else if (b === 2) {
        if (Game.Audio.cue) Game.Audio.cue('swell');
      } else {
        Game.Audio.play('select');
      }
    }
  }

  function update() {
    // コンボ継続タイマー: 時間切れでリセット
    if (Game.state.comboT > 0) { Game.state.comboT--; if (Game.state.comboT === 0) Game.state.combo = 0; }
    // バンド越え警告はローカル(各プレイヤー画面)で判定 — クライアントでもホスト依存なしで動く
    watchDangerBand();
    // マルチ: クライアントは敵を simulate せずホストの配信を描画＋自分への接触判定
    if (Game.Net.isConnected() && !Game.Net.host) { clientUpdate(); return; }

    const mobs = Game.state.mobs;
    const p = Game.state.player;
    if (Game.state.mobFreeze > 0) Game.state.mobFreeze--; // 時止め残り

    if (Game.state.tick % TUNE.SPAWN_INTERVAL === 0) {
      trySpawn();
      if (Game.state.bloodMoon) trySpawn();
      // 深夜は敵が増える(光世界の夜、追加スポーン)。血の月はさらに上乗せ
      if (Game.state.worldName === 'light' && Game.DayNight && Game.DayNight.isNight()) { trySpawn(); if (Math.random() < 0.5) trySpawn(); }
    }
    if (Game.state.tick % 80 === 0) spawnerSpawn();

    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      m.prevX = m.x; m.prevY = m.y;
      if (m.hurt > 0) m.hurt--;
      if (m.attackCd > 0) m.attackCd--;
      if (m.rangedCd > 0) m.rangedCd--;
      if (m.alertT > 0) m.alertT--;
      // 状態異常(DoT/鈍足): 炎/毒は継続ダメージ、凍は moveMob で減速
      if (m.dot) {
        if (m.dot.slow > 0) { m.dot.slow--; if (m.dot.slow === 0) m.chill = 0; } // 凍え終了で氷結ゲージ減衰
        if (Game.state.tick % 20 === 0 && ((m.dot.burn || 0) > 0 || (m.dot.poison || 0) > 0)) {
          const d = ((m.dot.burn || 0) > 0 ? 2 : 0) + ((m.dot.poison || 0) > 0 ? 1 : 0);
          m.hp -= d; m.hurt = Math.max(m.hurt, 2);
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, d, m.dot.burn > 0 ? '#ff8a4a' : '#9fe04a');
          if (m.hp <= 0) { killMob(m); continue; }
        }
        // 燃えている敵は可燃物に触れると延焼させる(創発: 火だるまの敵が森へ突っ込むと山火事に)。
        // 低確率＋オブジェクト限定で暴走を抑制。草地へは燃え移らせない。
        if (m.dot.burn > 0 && Game.state.tick % 15 === 0 && Math.random() < 0.25 && Game.World.igniteTile) {
          const TS2 = Game.CFG.TILE_SIZE, mtx = Math.floor(m.x / TS2), mty = Math.floor(m.y / TS2);
          const o = Game.World.objAt(mtx, mty);
          if (o !== Game.OBJ.NONE) Game.World.igniteTile(mtx, mty);
        }
        if (m.dot.burn > 0) m.dot.burn--;
        if (m.dot.poison > 0) m.dot.poison--;
      }
      // 武器由来の出血(斬撃DoT): 一定間隔で武器スケールのダメージ。3秒間毎秒など
      if (m.bleed && m.bleed.left > 0) {
        m.bleed.left--;
        if (m.bleed.left % (m.bleed.every || 30) === 0) {
          m.hp -= m.bleed.dmg; m.hurt = Math.max(m.hurt, 2);
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, m.bleed.dmg, m.bleed.col || '#ff5a6a');
          if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, m.bleed.col || '#c0303a', 3);
          if (m.hp <= 0) { killMob(m); continue; }
        }
        if (m.bleed.left <= 0) m.bleed = null;
      }
      if (m.leaveTimer) { m.leaveTimer--; if (m.leaveTimer <= 0) { mobs.splice(i, 1); continue; } }
      if (m.stateTimer > 0) m.stateTimer--;

      // ノックバック
      if (Math.abs(m.knockX) > 0.1 || Math.abs(m.knockY) > 0.1) {
        if (walkAt(m.x + m.knockX, m.y, m)) m.x += m.knockX;
        if (walkAt(m.x, m.y + m.knockY, m)) m.y += m.knockY;
        m.knockX *= 0.8; m.knockY *= 0.8;
      }

      const dxp = p.x - m.x, dyp = p.y - m.y;
      const distP = Math.hypot(dxp, dyp);

      // 遠すぎたら消滅。ただしボス/中ボス/チャンピオンは消さず、アリーナへ帰還させて再戦を可能にする
      // (従来は28タイルで無条件消滅→画面外に出た瞬間ボスが永久消滅し、再エンカウント不能だった)
      const named = (m.def.boss || m.def.midboss || m.champion);
      if (distP > TUNE.DESPAWN_TILES * TS) {
        if (!named) { mobs.splice(i, 1); continue; }
        if (m.homeX == null) { m.homeX = m.x; m.homeY = m.y; }
        // 地域を完全に離れた(アリーナから90タイル超)場合はボスも消滅させ MOB_CAP を圧迫しない。
        // 近距離の離脱(画面外程度)では消さず再戦可能に保つ、が両立の肝
        if (Math.hypot(p.x - m.homeX, p.y - m.homeY) > 90 * TS) { mobs.splice(i, 1); continue; }
        // 離脱中: 非交戦(ゲージ/ボスBGMを解除)、アリーナへ戻る、HPを緩やかに全快させ仕切り直す
        m.engaged = false;
        const hx = m.homeX - m.x, hy = m.homeY - m.y, hd = Math.hypot(hx, hy);
        if (hd > 60 * TS) { m.x = m.homeX; m.y = m.homeY; } // 画面外で見失った場合はアリーナへ即帰還
        else if (hd > TS) { const sp = (m.def.speed || 1) * 0.7; m.x += hx / hd * sp; m.y += hy / hd * sp; }
        if (Game.state.tick % 12 === 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * 0.02)));
        m.enraged = m.hp <= m.maxHp * 0.3 ? m.enraged : false; // 全快したら激昂フェーズも解除
        continue; // 遠方なので通常AI/攻撃はスキップ
      }
      if (named) m.engaged = true; // 交戦圏内: ゲージ＆ボスBGMを起動

      // 時止め(砂時計): 敵は動かず攻撃もしない。プレイヤーの攻撃は通る(damageMobは別経路)
      if (Game.state.mobFreeze > 0) { m.frozen = true; continue; }
      m.frozen = false;
      // 氷結(frost蓄積で氷漬け): 移動も攻撃もできず、粉砕(会心)の的になる。ボスは免疫(中ボスは短縮)
      if (m.iced > 0) {
        m.iced--;
        if (Game.state.tick % 5 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(m.x + (Math.random() - 0.5) * m.def.size, m.y - m.def.size * 0.3, '#cfeeff', 1);
        continue;
      }

      // 激昂の決死ノヴァ: テレグラフ後に半径 novaR の爆発。範囲外へ逃げれば回避(読み合い)
      if (m.novaT > 0) {
        m.novaT--;
        if (Game.state.tick % 3 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(m.x + (Math.random() - 0.5) * m.novaR * TS, m.y + (Math.random() - 0.5) * m.novaR * TS, '#ff5a3a', 1);
        if (m.novaT <= 0) {
          const R = (m.novaR || 4) * TS;
          if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, '#ff7a3c', 36);
          if (Game.Render.flash) Game.Render.flash('rgba(255,80,40,0.3)'); if (Game.Render.shake) Game.Render.shake(11);
          Game.Audio.play('boom_sfx');
          if (distP <= R && Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 2.2), m.def.name || 'mob') !== false) { const kl = distP || 1; p.x += (dxp / kl) * 22; p.y += (dyp / kl) * 22; }
        }
      }
      // ボスの隙(スタン/弱点窓): 大技を回避された後の反撃猶予。動かず攻撃もしない=絶好の攻めどき
      if (m.vulnerable > 0) m.vulnerable--;
      if (m.stunned > 0) {
        m.stunned--;
        m.hopPhase = (m.hopPhase || 0) + 0.06;
        if (Game.state.tick % 8 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(m.x + (Math.random() - 0.5) * m.def.size, m.y - m.def.size * 0.5, '#ffe27a', 1);
        continue; // AI/攻撃を停止(隙をさらす)
      }

      // 精鋭アフィックス: 再生(不死) — 毎秒 最大HPの一定割合を回復
      if ((m.blinkCd || 0) > 0) m.blinkCd--; // 瞬影のクールダウン
      if (hasAffix(m, 'warded')) m.wardT = (m.wardT || 0) + 1; // 結界の周期(150tick中 先頭60tickが展開)
      if (hasAffix(m, 'regened') && m.hp < m.maxHp && Game.state.tick % 30 === 0) {
        const af = Game.ELITE_AFFIXES.regened;
        m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * af.regenPct)));
      }

      if (m.def.hostile) {
        let aggro = (m.def.boss ? 22 : 13) * TS;
        if (Game.state.worldName === 'shadow') aggro *= 1.5; // 影の世界=別ゲーの緊張感。敵はより遠くから執拗に追う
        if (m.alertT > 0) aggro *= 1.7; // 群れ連携: 呼応中は遠くからでも駆けつける
        // 瞬間移動する敵: 一定間隔でプレイヤー近くへ blink(煙＋音)。間合いを潰す脅威
        if (m.def.blink && distP < aggro && distP > 2.4 * TS) {
          m.blinkCd = (m.blinkCd || m.def.blink.cd) - 1;
          if (m.blinkCd <= 0) {
            Game.Render.spawnParticles(m.x, m.y, m.def.color || '#b06ad0', 10);
            const ang = Math.atan2(dyp, dxp), nd = (1.6 + Math.random()) * TS;
            const nx = p.x - Math.cos(ang) * nd, ny = p.y - Math.sin(ang) * nd;
            // 修正: isWalkable はタイル座標を取る(旧: ピクセル座標を渡すバグで blink が常に不発/異常判定)
            if (Game.World.isWalkable(Math.floor(nx / TS), Math.floor(ny / TS))) { m.x = nx; m.y = ny; m.prevX = nx; m.prevY = ny; }
            Game.Render.spawnParticles(m.x, m.y, '#fff', 8); Game.Audio.play('shift');
            m.blinkCd = m.def.blink.cd;
          }
        }
        // ボス/召喚持ち中ボスは手下を召喚(激昂中は倍速で召喚)
        const summonEvery = Math.max(40, Math.round((m.enraged ? 120 : 200) / (m.def.boss ? archOf(m.type).summon : 1))); // 召喚型ほど短間隔
        if ((m.def.boss || (m.def.midboss && m.def.summon)) && m.attackCd <= 0 && Game.state.tick % summonEvery === 0) {
          const minion = m.def.summon || 'shadow_spawn';
          const cap = m.def.boss ? 8 : 4, n = m.def.boss ? 3 : 2;
          if (countType(minion) < cap) { for (let k = 0; k < n; k++) spawnMob(minion, m.x + (Math.random() - 0.5) * 60, m.y + (Math.random() - 0.5) * 60); Game.Audio.play('shift'); }
        }
        // ボスの弾幕(扇状の魔法弾): 遠中距離で一定間隔。約0.8秒のテレグラフ後に発射(回避を要する)
        if (m.def.boss) {
          if (m.volleyAim != null) {
            m.volleyAim--;
            m.dir = Math.abs(dxp) > Math.abs(dyp) ? (dxp < 0 ? 'left' : 'right') : (dyp < 0 ? 'up' : 'down');
            if (Game.state.tick % 4 === 0) Game.Render.spawnParticles(m.x, m.y - m.def.size * 0.3, '#c884f0', 2);
            if (m.volleyAim <= 0) {
              m.volleyAim = null; m.volleyCd = m.enraged ? 100 : 170;
              Game.Projectiles.enemyVolley(m, Math.round((m.dmg || m.def.dmg) * 0.7), bossElement(m.def.color), m.enraged ? 7 : 5, 0.65);
            }
            m.hopPhase += 0.2; continue; // 詠唱中は静止(回避猶予)
          }
          if ((m.volleyCd || 0) > 0) m.volleyCd--;
          else if (distP > 3 * TS && distP < 13 * TS && Math.random() < (m.enraged ? 0.05 : 0.028) * archOf(m.type).volley) {
            m.volleyAim = 24; Game.Audio.play('whirl');
            if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '弾幕!', '#c884f0', true);
          }
        }
        // ボスの溜め叩きつけ攻撃: テレグラフ(着弾予告)→範囲ダメージ。全ボスに戦闘の駆け引きを付与
        if (m.def.boss) {
          if (m.slam != null) {
            m.slam--;
            if (m.slam <= 0) {
              const R = (m.slamR || 2.4) * TS;
              const hit = distP <= R;
              if (hit && Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 1.6), m.def.name || 'mob') !== false) {
                const kl = distP || 1; p.x += (dxp / kl) * 18; p.y += (dyp / kl) * 18;
              }
              Game.Render.spawnParticles(m.x, m.y, '#ff7a3c', 26);
              if (Game.Render.shake) Game.Render.shake(10);
              Game.Audio.play('boom_sfx');
              m.slam = null; m.slamCd = m.enraged ? 90 : 150;
              // 読み合い: 大技を回避されたら大きな「隙(スタン+被ダメ増)」。当てられたら猶予は短い。
              // 回避→反撃のループを全ボスに付与(A: 戦闘の読み合い)
              m.stunned = hit ? 8 : 40; m.vulnerable = hit ? 24 : 96; m.vulnMax = m.vulnerable;
              if (!hit && Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, 'スキ!', '#ffe27a', true);
              if (!hit && Game.UI.tipOnce) Game.UI.tipOnce('weakpoint', 'ボスの大技を回避すると「隙」が生まれ、その間は与ダメージが増えます。回避→反撃が鍵');
            }
            m.hopPhase += 0.2; continue; // 溜め中は移動・他攻撃しない(回避猶予)
          }
          if ((m.slamCd || 0) > 0) m.slamCd--;
          else if (distP < 6 * TS && Math.random() < (m.enraged ? 0.06 : 0.035) * archOf(m.type).slam) { m.slam = m.enraged ? 14 : 18; m.slamMax = m.slam; m.slamR = (m.def.big ? 3 : 2.4); Game.Audio.play('whirl'); }
        }
        // ── ボス/中ボスの多彩な大技(ボス=型ごとの得意技3種 / 中ボス=識別に応じ1種を控えめに) ──
        // 中ボスにも読み合いの大技を1つ付与し、mid-tier戦闘にも「テレグラフ→回避→反撃」を作る(密度A)
        if (m.def.boss || m.def.midboss) {
          const A = m.def.boss ? archOf(m.type) : null, enr = m.enraged;
          const mbRanged = !A && !!m.def.ranged;                 // 中ボスの術者系=全方位弾
          const mbHeavy = !A && !m.def.ranged && (m.def.big || m.def.pound); // 中ボスの重量系=跳躍
          // 全方位弾(radial): テレグラフ→360°弾。激昂時は半ピッチずらした2波で隙間を突く読み合い
          if (m.radial != null) {
            m.radial--;
            if (Game.state.tick % 3 === 0) Game.Render.spawnParticles(m.x, m.y - m.def.size * 0.2, '#ffd24a', 2);
            if (m.radial <= 0) {
              m.radial = null; m.radialCd = enr ? 130 : 210;
              const rd = Math.round((m.dmg || m.def.dmg) * 0.6), rk = bossElement(m.def.color), cnt = enr ? 16 : 12;
              Game.Projectiles.enemyRing(m, rd, rk, cnt, 0);
              if (enr) Game.Projectiles.enemyRing(m, rd, rk, cnt, Math.PI / cnt);
              if (Game.Render.shake) Game.Render.shake(6);
            }
            m.hopPhase += 0.2; continue;
          }
          if ((m.radialCd || 0) > 0) m.radialCd--;
          else if (((A && A.radial > 0) || mbRanged) && distP < 12 * TS && Math.random() < (A ? (enr ? 0.05 : 0.03) * A.radial : 0.017)) {
            m.radial = 26; m.radialMax = 26; Game.Audio.play('whirl');
            if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '全方位弾!', '#ffd24a', true);
          }
          // 設置爆撃(zone): プレイヤー周辺に複数の遅延爆発円。踏み続けは危険=移動を強いる(動きながら継続)
          if (m.zones) {
            let alive = false;
            for (let zi = 0; zi < m.zones.length; zi++) {
              const zo = m.zones[zi]; if (zo.done) continue; alive = true; zo.t--;
              if (zo.t <= 0) {
                zo.done = true; const R = (zo.r || 2.2) * TS, d2 = Math.hypot(p.x - zo.x, p.y - zo.y);
                if (d2 <= R) Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 1.1), m.def.name || 'mob');
                Game.Render.spawnParticles(zo.x, zo.y, '#ff8a3c', 20);
                if (Game.Render.shake && d2 < R * 1.5) Game.Render.shake(7);
                Game.Audio.play('boom_sfx');
              }
            }
            if (!alive) { m.zones = null; m.zoneCd = enr ? 120 : 200; }
          } else if ((m.zoneCd || 0) > 0) m.zoneCd--;
          else if (A && A.zone > 0 && distP < 11 * TS && Math.random() < (enr ? 0.045 : 0.028) * A.zone) {
            const n = enr ? 5 : 4, zs = []; Game.Audio.play('whirl');
            for (let zi = 0; zi < n; zi++) { const ang = (zi / n) * Math.PI * 2 + m.wobble; const rad = (zi === 0 ? 0 : (1.4 + (zi % 3) * 0.9)) * TS; zs.push({ x: p.x + Math.cos(ang) * rad, y: p.y + Math.sin(ang) * rad, t: 34 + zi * 7, tmax: 34 + zi * 7, r: 2.2 }); }
            m.zones = zs;
            if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '爆撃!', '#ff8a3c', true);
          }
          // 跳躍叩きつけ(leap): しゃがみ溜め→放物線で着地点へ跳躍→衝撃波。着地点は影で予告(移動で回避)
          if (m.leap) {
            if (m.leap.phase === 'crouch') {
              m.leap.t--;
              if (m.leap.t <= 0) { m.leap.phase = 'air'; m.leap.t = m.leap.air; m.leap.sx = m.x; m.leap.sy = m.y; }
              m.hopPhase += 0.3; continue;
            } else {
              m.leap.t--;
              const pr = 1 - m.leap.t / m.leap.air;
              m.x = m.leap.sx + (m.leap.tx - m.leap.sx) * pr; m.y = m.leap.sy + (m.leap.ty - m.leap.sy) * pr;
              m.leapZ = Math.sin(pr * Math.PI) * (m.def.size * 1.4);
              if (m.leap.t <= 0) {
                const R = (m.def.big ? 3.4 : 2.8) * TS, d2 = Math.hypot(p.x - m.x, p.y - m.y), hit = d2 <= R;
                if (hit && Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 1.8), m.def.name || 'mob') !== false) { const kl = d2 || 1; p.x += (p.x - m.x) / kl * 22; p.y += (p.y - m.y) / kl * 22; }
                Game.Render.spawnParticles(m.x, m.y, '#ffcaa0', 30); if (Game.Render.shake) Game.Render.shake(12); Game.Audio.play('boom_sfx');
                m.leapZ = 0; m.leap = null; m.leapCd = enr ? 110 : 180;
                m.stunned = hit ? 6 : 34; m.vulnerable = hit ? 20 : 84; m.vulnMax = m.vulnerable;
                if (!hit && Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, 'スキ!', '#ffe27a', true);
              }
              m.hopPhase += 0.2; continue;
            }
          }
          if ((m.leapCd || 0) > 0) m.leapCd--;
          else if (((A && A.leap > 0) || mbHeavy) && distP > 3 * TS && distP < 9 * TS && Math.random() < (A ? (enr ? 0.055 : 0.035) * A.leap : 0.02)) {
            m.leap = { phase: 'crouch', t: enr ? 12 : 16, air: 18, tx: p.x, ty: p.y }; Game.Audio.play('whirl');
            if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '跳躍!', '#ffcaa0', true);
          }
        }
        // 重量級の溜め叩きつけ(非ボス): ボスslamのテレグラフ描画を流用。回避ゲーで攻撃に幅
        if (m.def.pound && !m.def.boss) {
          if (m.slam != null) {
            m.slam--;
            if (m.slam <= 0) {
              const R = (m.def.pound.r || 1.8) * TS;
              if (distP <= R && Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 1.4), m.def.name || 'mob') !== false) { const kl = distP || 1; p.x += (dxp / kl) * 12; p.y += (dyp / kl) * 12; if (Game.Render.spawnHitDir) Game.Render.spawnHitDir(m.x, m.y); }
              Game.Render.spawnParticles(m.x, m.y, '#ff9a4a', 16);
              if (Game.Render.shake) Game.Render.shake(6); Game.Audio.play('boom_sfx');
              m.slam = null; m.slamCd = m.def.pound.cd || 130;
            }
            m.hopPhase += 0.2; continue;
          }
          if ((m.slamCd || 0) > 0) m.slamCd--;
          else if (distP < 4.5 * TS && Math.random() < 0.03) { m.slam = 16; m.slamMax = 16; m.slamR = m.def.pound.r || 1.8; Game.Audio.play('whirl'); }
        }
        // 突進する敵: 溜め(テレグラフ)→高速ダッシュで突っ込む。溜め中に避ければ回避可能
        if (m.def.charge) {
          const ch = m.def.charge;
          if (m.charge) {
            if (m.charge.phase === 'windup') {
              m.charge.t--;
              if (m.charge.t <= 0) { const l = distP || 1; m.charge.vx = dxp / l; m.charge.vy = dyp / l; m.charge.phase = 'dash'; m.charge.t = ch.dashTicks; }
              m.hopPhase += 0.2; continue; // 溜め中は静止
            } else {
              m.charge.t--;
              moveMob(m, m.charge.vx, m.charge.vy, ch.dashSpeed);
              if (distP < (m.def.size * 0.5 + 14)) { if (Game.Survival.damage(ch.dmg, m.def.name || 'mob') !== false) { const kl = distP || 1; p.x += (dxp / kl) * 16; p.y += (dyp / kl) * 16; } m.charge = null; m.chargeCd = ch.cd; }
              else if (m.charge.t <= 0) { m.charge = null; m.chargeCd = ch.cd; }
              m.hopPhase += 0.2; continue;
            }
          }
          if ((m.chargeCd || 0) > 0) m.chargeCd--;
          else if (distP < ch.range * TS && distP > 2 * TS) { m.charge = { phase: 'windup', t: ch.windup }; m.dir = Math.abs(dxp) > Math.abs(dyp) ? (dxp < 0 ? 'left' : 'right') : (dyp < 0 ? 'up' : 'down'); Game.Audio.play('whirl'); }
        }
        // 自爆兵(bomber): 接近で導火線点火→短い溜め(点滅・接近継続)→大爆発。爆風は地形/火/火薬樽/他の自爆兵を巻き込み連鎖。逃げれば回避可
        if (m.def.bomber) {
          const bd = m.def.bomber;
          if (m.fuse != null) {
            m.fuse--;
            if (Game.state.tick % (m.fuse < 12 ? 3 : 6) === 0 && Game.Audio) Game.Audio.play('select');
            if (distP < aggro) moveMob(m, dxp, dyp, m.def.speed * 0.7); // にじり寄る
            if (m.fuse <= 0) {
              if (Game.Projectiles.explode) Game.Projectiles.explode(m.x, m.y, bd.r || 2.6, bd.dmg || 30, 'fire');
              const pdd = Math.hypot(p.x - m.x, p.y - m.y), R = (bd.r || 2.6) * TS;
              if (pdd <= R && !p.vehicle) Game.Survival.damage(Math.max(5, Math.round((bd.dmg || 30) * (1 - pdd / R))), 'blast');
              m.hp = 0; killMob(m); continue;
            }
            m.hopPhase += 0.3; continue;
          }
          if (distP < ((bd.trigger || 2.4) * TS)) {
            m.fuse = bd.fuse || 26; m.fuseMax = m.fuse;
            if (Game.Audio) Game.Audio.play('whirl');
            if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '⚠ 自爆!', '#ff5a3a', true);
          }
        }
        const rg = m.def.ranged;
        // 射撃の予兆(照準): 約300ms 静止して構えてから撃つ。スマホでも反応できる猶予を保証
        if (rg && m.aim != null) {
          m.aim--;
          m.dir = Math.abs(dxp) > Math.abs(dyp) ? (dxp < 0 ? 'left' : 'right') : (dyp < 0 ? 'up' : 'down');
          if (m.aim <= 0) {
            m.aim = null; m.rangedCd = rg.cd;
            if (distP < (rg.range + 1.5) * TS) Game.Projectiles.enemyShoot(m, rg.dmg, rg.kind, rg.status);
          }
          m.hopPhase += 0.2; continue;
        }
        // 遠距離魔法攻撃タイプ: 距離を取りつつ魔法弾を撃つ
        if (rg && distP < rg.range * TS && distP > (m.def.size * 0.5 + 14)) {
          if ((m.rangedCd || 0) <= 0) { m.aim = 9; Game.Audio.play('whirl'); }
          if (distP < rg.range * TS * 0.5) moveMob(m, -dxp, -dyp, m.def.speed * 0.8);      // 近すぎ→離れる
          else if (distP > rg.range * TS * 0.82) moveMob(m, dxp, dyp, m.def.speed * 0.8);  // 遠い→寄る
          m.dir = Math.abs(dxp) > Math.abs(dyp) ? (dxp < 0 ? 'left' : 'right') : (dyp < 0 ? 'up' : 'down');
        } else if (distP < aggro) {
          // 敵対: プレイヤーを追跡（個体ごとの動き方=直進/ジグザグ/回り込みで一辺倒を避ける）
          let mvx = dxp, mvy = dyp, spdM = 1;
          const st = m.moveStyle;
          if (st === 'zigzag') {
            const px = -dyp, py = dxp, pl2 = Math.hypot(px, py) || 1, mag = Math.hypot(dxp, dyp);
            const osc = Math.sin((Game.state.tick + m.wobble * 30) * 0.17) * 0.6;
            mvx = dxp + (px / pl2) * mag * osc; mvy = dyp + (py / pl2) * mag * osc;
          } else if (st === 'strafe' && distP < aggro * 0.62 && distP > m.def.size * 0.5 + 26) {
            const px = -dyp, py = dxp; const dart = (Game.state.tick + m.wobble * 17) % 96 < 24;
            mvx = px * 0.9 + dxp * (dart ? 0.85 : 0.12); mvy = py * 0.9 + dyp * (dart ? 0.85 : 0.12);
          } else if (st === 'pounce') {
            // 跳びかかり: 周期的に素早く踏み込み、間で溜める
            const ph = (Game.state.tick + m.wobble * 20) % 74; spdM = ph < 13 ? 2.0 : 0.62;
          } else if (st === 'orbit' && distP < aggro * 0.7 && distP > m.def.size * 0.5 + 30) {
            // 旋回: 一定距離を保ちながら円を描いて回り込み、隙を伺う
            const dir = (m.wobble % 2) ? 1 : -1; const px = -dyp * dir, py = dxp * dir;
            const pull = (distP > 5 * TS) ? 0.5 : -0.25; // 遠ければ寄り、近すぎれば離れる
            mvx = px + dxp * pull; mvy = py + dyp * pull; spdM = 1.05;
          }
          moveMob(m, mvx, mvy, m.def.speed * 0.82 * spdM);
          // 接触攻撃
          if (distP < (m.def.size * 0.5 + 12) && m.attackCd <= 0) {
            if (Game.Survival.damage(m.dmg || m.def.dmg, m.def.name || 'mob') !== false) {
              if (Game.Render.spawnHitDir) Game.Render.spawnHitDir(m.x, m.y); // 被弾方向インジケータ
              if (m.def.inflict) for (const k in m.def.inflict) Game.Status.add(k, m.def.inflict[k]);
              inflictMobElement(m); // 火/氷属性の敵は接触で炎上/凍え
              if (hasAffix(m, 'blazing')) Game.Status.add('burn', Game.ELITE_AFFIXES.blazing.burn); // 業火: 接触で炎上
              // 棘(thorns)防具: 被弾時に攻撃元へダメージ反射
              if (p.gearThorns > 0 && !m.def.boss) { const refl = Math.max(1, Math.round((m.dmg || m.def.dmg) * p.gearThorns)); Game.Render.spawnParticles(m.x, m.y, '#ff8a6a', 5); damageMob(m, refl, p.x, p.y, false); }
              reflectShield(m, (m.dmg || m.def.dmg), p);
              const kl = distP || 1;
              p.x += (dxp / kl) * (m.def.boss ? 12 : 6); p.y += (dyp / kl) * (m.def.boss ? 12 : 6);
            }
            m.attackCd = m.def.boss ? 30 : 42; // 空振りでもCDは消費(連続判定スパム防止)
          }
        } else {
          wander(m);
        }
      } else {
        // 臆病(金喰い等): プレイヤーが近いと常に逃げ続ける
        if (m.def.skittish && distP < 11 * TS) {
          const jx = -dyp * (m.wobble % 2 ? 0.5 : -0.5); // 蛇行して捕まえにくく
          moveMob(m, -dxp + jx, -dyp - jx * (dxp / (Math.abs(dxp) || 1)) * 0, m.def.speed * 1.25);
          if (Game.state.tick % 30 === 0) Game.Render.spawnParticles(m.x, m.y, m.def.color || '#ffd24a', 2); // きらめきの足跡
        }
        // 動物: 攻撃されたら逃走、それ以外は徘徊
        else if (m.fleeTimer > 0) {
          m.fleeTimer--;
          moveMob(m, -dxp, -dyp, m.def.speed * 1.3);
        } else {
          wander(m);
        }
      }
      m.hopPhase += 0.2;
      // 属性別のアイドル粒子(識別性＋雰囲気)。火=残り火/氷=冷気/毒=胞子/影=紫塵
      if (Game.Render.spawnParticles && (Game.state.tick + (m.wobble || 0)) % 14 === 0) {
        const t = m.type, col = /salamander|ember|lava|forge|magma/.test(t) ? '#ff7a3c'
          : /frost|ice_bear|crystal|snow/.test(t) ? '#bfe8ff'
          : /spore|swamp|bog|venom|viper|toad|mud/.test(t) ? '#9fe04a'
          : (m.def.shadow || m.def.ghost) ? '#b06ad0' : null;
        if (col) Game.Render.spawnParticles(m.x + (Math.random() - 0.5) * 8, m.y - m.def.size * 0.4, col, 1);
      }
      // 激昂ボスは立ち昇る赤い炎を常時まとい、第二段階を視覚的に劇化
      if (m.enraged && Game.Render.spawnParticles && Game.state.tick % 4 === 0) {
        const sz = m.def.size * 0.5;
        Game.Render.spawnParticles(m.x + (Math.random() - 0.5) * sz * 1.6, m.y + (Math.random() - 0.5) * sz, Math.random() < 0.5 ? '#ff3a2a' : '#ff8a3c', 1);
      }
    }
  }

  function buildSnapshot() {
    const mobs = Game.state.mobs, out = [];
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      out.push({ i: m.id, t: m.type, x: Math.round(m.x), y: Math.round(m.y), h: Math.round(m.hp), d: m.dir, w: m.def.boss ? 1 : 0 });
    }
    return out;
  }

  // クライアント: ホストの敵を反映＋自分への接触ダメージ
  function applyMobSnapshot(arr) {
    const cur = {}; const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) cur[mobs[i].id] = mobs[i];
    const next = [];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i]; let m = cur[s.i];
      if (!m) { const def = Game.MOBS[s.t]; if (!def) continue; m = { id: s.i, type: s.t, def: def, x: s.x, y: s.y, prevX: s.x, prevY: s.y, hp: s.h, maxHp: def.hp, dir: s.d, hurt: 0, hopPhase: Math.random() * 6, attackCd: 0 }; }
      else { m.prevX = m.x; m.prevY = m.y; m.tx = s.x; m.ty = s.y; m.hp = s.h; m.dir = s.d; }
      m.tx = s.x; m.ty = s.y;
      next.push(m);
    }
    Game.state.mobs = next;
  }

  function clientUpdate() {
    const mobs = Game.state.mobs, p = Game.state.player;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.attackCd > 0) m.attackCd--;
      if (m.hurt > 0) m.hurt--;
      // 補間移動
      if (m.tx != null) { m.prevX = m.x; m.prevY = m.y; m.x += (m.tx - m.x) * 0.4; m.y += (m.ty - m.y) * 0.4; }
      m.hopPhase = (m.hopPhase || 0) + 0.2;
      // 自分への接触ダメージ（敵対のみ）
      if (m.def.hostile && m.attackCd <= 0) {
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < m.def.size * 0.5 + 12) {
          if (Game.Survival.damage(m.def.dmg, m.def.name || 'mob') !== false) {
            if (m.def.inflict) for (const k in m.def.inflict) Game.Status.add(k, m.def.inflict[k]);
            inflictMobElement(m); // 火/氷属性の敵は接触で炎上/凍え
          }
          m.attackCd = 42;
        }
      }
    }
  }

  // ホスト: クライアントからの被ダメ要求
  function applyRemoteHit(id, dmg, x, y) {
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) if (mobs[i].id === id) { damageMob(mobs[i], dmg, x != null ? x : mobs[i].x - 10, y != null ? y : mobs[i].y); return; }
  }

  // クライアント: ホストから来た敵死亡ドロップを地面に生成
  function spawnNetDrops(x, y, items) {
    if (!items) return;
    for (let i = 0; i < items.length; i++) Game.state.drops.push({ id: items[i].id, count: items[i].count, roll: items[i].roll || null, x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14 });
  }

  // 友好NPC（謎の旅人）との対話
  function nearbyNPC(rangePx) {
    const p = Game.state.player; const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.npc && Math.hypot(m.x - p.x, m.y - p.y) < rangePx) return m;
    }
    return null;
  }
  const WANDER_LINES = [
    'よくぞ世界の狭間まで。これも縁、餞別を受け取りなさい。',
    'わしは二相のあわいを行き来する者。光も影も、いずれは還る。',
    '影に呑まれぬよう…光を持て。これを役立てるがよい。',
    'あんたの旅、見届けさせてもらうよ。ほら、土産だ。',
  ];
  function interactNPC(m) {
    if (!m.greeted) { m.greeted = true; Game.UI.toast('旅人：「' + WANDER_LINES[Math.floor(Math.random() * WANDER_LINES.length)] + '」'); }
    m.leaveTimer = 0; // 商談中は去らない
    Game.Audio.play('select');
    if (Game.UI.openTrade) Game.UI.openTrade();
  }

  function countType(type) {
    let n = 0; const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) if (mobs[i].type === type) n++;
    return n;
  }
  function hasMidboss() { const mobs = Game.state.mobs; for (let i = 0; i < mobs.length; i++) if (mobs[i].def && mobs[i].def.midboss) return true; return false; }

  // 影の祭壇からボス召喚
  function summonBoss(tx, ty) {
    if (Game.state.worldName !== 'shadow') { Game.UI.toast('影の世界でのみ顕現する'); return false; }
    if (countType('sovereign') > 0) { Game.UI.toast('既に影の主が顕現している'); return false; }
    if (Game.Inventory.count('shadow_crystal') < 3) { Game.UI.toast('影晶が3つ必要'); return false; }
    Game.Inventory.remove('shadow_crystal', 3);
    const TS = Game.CFG.TILE_SIZE;
    spawnMob('sovereign', tx * TS + TS / 2 + 90, ty * TS + TS / 2);
    Game.Render.flash('#7a30c0');
    Game.Audio.play('shift');
    Game.UI.toast('影の主が目を覚ます…！');
    Game.UI.refreshAll();
    return true;
  }

  function wander(m) {
    if (m.stateTimer <= 0) {
      m.wx = (Math.random() - 0.5);
      m.wy = (Math.random() - 0.5);
      m.stateTimer = 40 + Math.floor(Math.random() * 90);
      if (Math.random() < 0.4) { m.wx = 0; m.wy = 0; } // 休憩
    }
    if (m.wx || m.wy) moveMob(m, m.wx, m.wy, m.def.speed * 0.5);
  }

  // combat.js から呼ばれる
  function damageMob(m, dmg, fromX, fromY, crit) {
    // 元素反応: 粉砕(凍結/凍え+会心)。氷結中(iced)または凍え中の敵に会心が刺さると砕けて追加ダメージ。
    // 氷結を割ると更に大きく(氷漬け=完全に脆い)。freeze→crit のコンボの核心
    if (crit && m && ((m.iced || 0) > 0 || (m.dot && (m.dot.slow || 0) > 0))) {
      const wasIced = (m.iced || 0) > 0;
      dmg = Math.round(dmg * (wasIced ? 1.7 : 1.4)); if (m.dot) m.dot.slow = 0; m.iced = 0; m.chill = 0;
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '粉砕!', '#bfe4ff', true);
      if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elem_shatter', '元素反応「粉砕」！ 凍った敵に会心が刺さると砕けて追加ダメージ。まず凍らせて会心を狙え');
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, '#dff0ff', 12);
      if (Game.Audio) Game.Audio.play('shatter');
      Game.state.hitstop = Math.max(Game.state.hitstop || 0, 4); // 粉砕は最も重い一拍
    }
    // 弱点窓(大技回避後の隙): 被ダメ 1.6倍。回避→反撃の見返りを大きく
    if (m.vulnerable > 0) {
      dmg = Math.round(dmg * 1.6);
      if (Game.Render.spawnFloat && Game.state.tick % 3 === 0) Game.Render.spawnFloat(m.x + (Math.random() - 0.5) * 10, m.y - m.def.size * 0.7, 'WEAK!', '#ffd23a', true);
    }
    // 結界の精鋭: バリア展開中(周期150tickの先頭60tick)は被ダメ70%カット。展開の切れ目を狙え
    if (hasAffix(m, 'warded') && ((m.wardT || 0) % 150) < 60) {
      dmg = Math.max(1, Math.round(dmg * 0.3));
      if (Game.Render.spawnFloat && Game.state.tick % 4 === 0) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '結界', '#7fb8ff', false);
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, '#7fb8ff', 3);
      if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elite_warded', '結界の精鋭: バリア展開中はダメージが通らない。青い輪が消える切れ目を狙え');
    }
    m.hp -= dmg;
    m.hurt = crit ? 13 : 8; // クリは白フラッシュを長めに
    // ボスの激昂: HP30%以下で第二段階。攻撃が激化し赤く染まる(劇的な決着フェーズ)
    if (m.def.boss && !m.enraged && m.hp > 0 && m.hp <= m.maxHp * 0.3) {
      m.enraged = true; m.auraRGB = [255, 60, 60];
      if (Game.Render.flash) Game.Render.flash('rgba(200,30,30,0.22)');
      if (Game.Render.shake) Game.Render.shake(9);
      Game.Audio.play('event_horde'); Game.Audio.play('thunder');
      // 第二段階への転換をワンビートで劇化: 一瞬の静止＋BGMダック＋ライザー＋頭上表示
      Game.state.hitstop = Math.max(Game.state.hitstop || 0, 4);
      if (Game.Audio.cue) Game.Audio.cue('riser');
      if (Game.Audio.duckBGM) { Game.Audio.duckBGM(0.35); setTimeout(function () { Game.Audio.duckBGM(1); }, 1200); }
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size, '激昂!!', '#ff5a4a', true);
      if (Game.UI && Game.UI.toast) Game.UI.toast('⚠ ' + (m.def.name || 'ボス') + ' が激昂した！ 離れろ！');
      m.novaT = 42; m.novaR = 4.2; // 決死のノヴァ: 42tick後に半径4.2タイルの爆発(テレグラフ→離れれば回避)
    }
    // 棘鎧アフィックス: 被ダメの一定割合を反射
    if (hasAffix(m, 'thorns') && m.hp > 0) {
      const refl = Math.max(1, Math.round(dmg * Game.ELITE_AFFIXES.thorns.thorns));
      Game.Survival.damage(refl, 'thorns');
    }
    Game.Render.spawnBlood(m.x, m.y, crit ? 9 : 5);
    if (Game.Render.spawnFloat) {
      if (crit) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, dmg, '#ffd23a', true); // 会心: 大きい黄色数字
      else Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, dmg, '#ffe27a');
    }
    // 大ダメージ/ボス被弾でも軽くシェイク
    if (!crit && (m.def.boss || dmg >= 16)) Game.Render.shake(m.def.boss ? 5 : 4);
    // ヒットストップ: 打撃の重要度で2-4tick(会心>重打>通常)。軽打では発生させず乱発を防ぐ
    const hs = (crit && m.def.boss) ? 4 : crit ? 3 : (dmg >= 22 || m.def.boss) ? 2 : 0;
    if (hs) Game.state.hitstop = Math.max(Game.state.hitstop || 0, hs);
    const dx = m.x - fromX, dy = m.y - fromY, l = Math.hypot(dx, dy) || 1;
    // ノックバックの一貫性: 重量級ほど仰け反りにくい(ボス0.35x/大型0.6x)。クリは強調
    const kb = (crit ? 11 : 7) * (m.def.boss ? 0.35 : m.def.big ? 0.6 : 1);
    m.knockX = (dx / l) * kb; m.knockY = (dy / l) * kb;
    // 瞬影の精鋭: 被弾すると短距離テレポートで回り込む(3秒CD)。連打が通らず、範囲攻撃や置き撃ちで読む
    if (hasAffix(m, 'blink') && m.hp > 0 && (m.blinkCd || 0) <= 0) {
      const pl2 = Game.state.player;
      const base = Math.atan2(m.y - pl2.y, m.x - pl2.x);
      const sgn = Math.random() < 0.5 ? 1 : -1;
      // 候補3方向(側面→背面→逆側面)を順に試し、通れる場所へ瞬く(地形で不発になりにくい)
      const cands = [base + sgn * (Math.PI * 0.55 + Math.random() * 0.5), base + Math.PI, base - sgn * (Math.PI * 0.55 + Math.random() * 0.5)];
      for (let ci = 0; ci < cands.length; ci++) {
        const bx = pl2.x + Math.cos(cands[ci]) * 2.4 * TS, by = pl2.y + Math.sin(cands[ci]) * 2.4 * TS;
        if (!walkAt(bx, by, m)) continue;
        if (Game.Render.spawnParticles) { Game.Render.spawnParticles(m.x, m.y, '#b07fff', 8); Game.Render.spawnParticles(bx, by, '#d8b0ff', 8); }
        m.x = bx; m.y = by; m.knockX = 0; m.knockY = 0; m.blinkCd = 90;
        if (Game.Audio) Game.Audio.play('shift');
        if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('elite_blink', '瞬影の精鋭: 被弾すると背後へ瞬間移動する。振り向きざまの範囲攻撃や罠が有効');
        break;
      }
    }
    if (!m.def.hostile) m.fleeTimer = 180; // 動物は逃げる
    // 群れ連携(lite): 狼/蜘蛛/山賊などは仲間の被弾に呼応し、周囲の同族が索敵範囲を広げて駆けつける
    if (PACK_TYPES[m.type]) {
      const all = Game.state.mobs;
      for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o !== m && o.type === m.type && Math.hypot(o.x - m.x, o.y - m.y) < 9 * TS) o.alertT = 240;
      }
    }
    Game.Audio.play('hit');
    if (m.hp <= 0) killMob(m);
  }

  function killMob(m) {
    // 死亡時の炸裂(deathBurst): 至近距離のプレイヤーへAoEダメージ＋状態異常。点付けの危険
    if (m.def.deathBurst && !(Game.Net.isConnected() && !Game.Net.host)) {
      const db = m.def.deathBurst, p = Game.state.player;
      Game.Render.spawnParticles(m.x, m.y, m.def.color || '#9fe04a', 18);
      if (Game.Render.flash) Game.Render.flash('rgba(140,220,120,0.12)');
      if (Math.hypot(p.x - m.x, p.y - m.y) <= db.r * TS) {
        // 無敵(ロール等)中はダメージ不成立: 状態異常も付与しない(damage契約)
        if (Game.Survival.damage(db.dmg, m.def.name || 'mob') !== false) {
          if (db.status && Game.Status) for (const k in db.status) Game.Status.add(k, db.status[k]);
        }
      }
      Game.Audio.play('hit');
    }
    // 群れの怯え(世界の反応性): 動物が倒されると周囲の動物が一斉に逃げ出す
    if (!m.def.hostile && !m.def.npc) {
      const all = Game.state.mobs, R = 10 * TS;
      for (let i = 0; i < all.length; i++) { const o = all[i]; if (o === m || o.def.hostile || o.def.npc) continue; if (Math.hypot(o.x - m.x, o.y - m.y) <= R) o.fleeTimer = Math.max(o.fleeTimer || 0, 220); }
    }
    // 撃破ポーフ: 体の色＋白い飛沫で消滅を強調(ボスは専用ムービーがあるので控えめ)
    if (Game.Render.spawnParticles && !m.def.boss) {
      const sz = m.def.size || 12, n = Math.min(18, 6 + Math.round(sz / 2));
      Game.Render.spawnParticles(m.x, m.y, m.def.color || '#aaa', n);
      Game.Render.spawnParticles(m.x, m.y, '#ffffff', Math.round(n * 0.4));
    }
    const idx = Game.state.mobs.indexOf(m);
    if (idx >= 0) Game.state.mobs.splice(idx, 1);
    // 魔物図鑑: 撃破した種別と撃破数を記録（友好NPC除く）
    if (m.def && !m.def.npc) {
      if (!Game.state.bestiary) Game.state.bestiary = {};
      const firstSeen = !Game.state.bestiary[m.type];
      Game.state.bestiary[m.type] = (Game.state.bestiary[m.type] || 0) + 1;
      // 深夜個体は別項として記録(魔物図鑑に「月狂の〇〇」を追加、ドロップも別表示)
      if (m.nightAmped) Game.state.bestiary['night:' + m.type] = (Game.state.bestiary['night:' + m.type] || 0) + 1;
      // 記憶回廊トリガー: 金喰い初討伐 / 図鑑が20種に到達
      if (Game.Story) {
        if (m.type === 'gold_thief' && !Game.Story.seen('goldthief')) Game.Story.unlock('goldthief', true);
        if (m.type === 'shade_stalker' && !Game.Story.seen('shadewalk')) Game.Story.unlock('shadewalk', true);
        if (firstSeen && Object.keys(Game.state.bestiary).length >= 20 && !Game.Story.seen('bestiary')) Game.Story.unlock('bestiary', true);
      }
    }
    // 分裂(splitter): 倒すと小型の同種が2体飛び出す。何度か分裂して群れになる戦術的な敵
    if (m.def.split && !(Game.Net.isConnected() && !Game.Net.host)) {
      const gen = (m.splitGen || 0);
      if (gen < (m.def.split.max || 2) && Game.state.mobs.length < TUNE.MOB_CAP) {
        for (let sidx = 0; sidx < 2; sidx++) {
          const child = spawnMob(m.type, m.x + (sidx ? 10 : -10), m.y + (Math.random() - 0.5) * 8);
          if (child) {
            child.splitGen = gen + 1;
            const sc = Math.pow(0.68, gen + 1);
            child.sizeVar = (m.sizeVar || 1) * 0.72;
            child.maxHp = child.hp = Math.max(1, Math.round(child.maxHp * sc));
            child.dmg = Math.max(1, Math.round(child.dmg * (0.6 + gen * 0.1)));
            child.knockX = (sidx ? 3 : -3); child.knockY = (Math.random() - 0.5) * 3;
          }
        }
        if (Game.Render.spawnParticles) Game.Render.spawnParticles(m.x, m.y, m.def.color || '#8fd06a', 12);
      }
    }
    // 賞金首: 対象モブの討伐をカウント
    if (Game.Bounty && m.def && !m.def.npc) Game.Bounty.notifyKill(m.type);
    // ドロップを集約（ローカル生成＋マルチ配信用）
    const items = [];
    // ドロップ抽選: ザコは絞る(ユーザー指示)。ボス/中ボスは討伐報酬なので手厚く保証する。
    if (m.def.drops && m.def.drops.length) {
      if (m.def.boss || m.def.midboss) {
        // ボス/中ボス: 看板ドロップは信頼できる報酬。n[0]>0の確定素材/看板武器は落とし、n[0]===0の固有は高確率で抽選(pityも別途保証)
        m.def.drops.forEach(function (d) {
          if (d.n[0] > 0) { const n = Game.Utils.randInt(Math.random, d.n[0], d.n[1]); for (let k = 0; k < n; k++) items.push({ id: d.item, count: 1 }); }
          else if (Math.random() < 0.5) items.push({ id: d.item, count: 1 }); // 固有(n0=0)は50%(+3体毎pityで確定)
        });
      } else {
        // ザコ: ①ドロップ有無を抽選 → ②当たれば最大2つを重み付き抽選。レア(装備/固有)は重み1/10で滅多に出ない
        const dropGate = m.nightAmped ? 0.8 : 0.55;
        if (Math.random() < dropGate) {
          const pool = m.def.drops.map(function (d) {
            const it = Game.ITEMS[d.item];
            const rare = it && (it.tool || it.attack != null || (it.armor != null && it.slot) || it.relic || it.special || it.summonBoss);
            return { d: d, w: rare ? 0.1 : 1 };
          });
          let totalW = 0; for (let i = 0; i < pool.length; i++) totalW += pool[i].w;
          const slots = 1 + (Math.random() < (m.nightAmped ? 0.55 : 0.3) ? 1 : 0);
          for (let s = 0; s < slots; s++) {
            let r = Math.random() * totalW, e = pool[pool.length - 1];
            for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { e = pool[i]; break; } }
            const d = e.d;
            const cnt = d.n[0] === 0 ? 1 : (d.n[1] > 1 && Math.random() < 0.3 ? 2 : 1);
            for (let k = 0; k < cnt; k++) items.push({ id: d.item, count: 1 });
          }
        }
      }
    }
    const gear = Game.Loot.rollMobDrop(m.def, m.x, m.y, m.nightAmped ? 0.18 : 0);
    for (let g = 0; g < gear.length; g++) items.push({ id: gear[g].id, count: gear[g].count, roll: gear[g].roll });
    // 深夜限定の固有レアドロップ: 月光の欠片(夜間個体のみ)。集めて月光装備をクラフト
    if (m.nightAmped && Math.random() < (m.def.boss || m.def.midboss ? 0.9 : m.elite ? 0.5 : 0.14)) items.push({ id: 'moonshard', count: 1 });
    // ボスの固有ドロップを「狙って集められる」手段(ユーザー指示): 撃破を重ねると確定入手。
    // 3回討伐ごとに、そのボス固有の装備(n[0]=0の武器/防具/遺物)を1つ確定ドロップ。再召喚アイテムと合わせ周回可能
    if (m.def.boss || m.def.midboss) {
      const killNo = ((Game.state.bestiary && Game.state.bestiary[m.type]) || 0) + 1; // 今回で killNo 体目
      const uniques = (m.def.drops || []).filter(function (d) { const it = Game.ITEMS[d.item]; return d.n[0] === 0 && it && (it.tool || it.armor != null || it.relic); });
      if (uniques.length && killNo % 3 === 0) {
        const u = uniques[Math.floor(Math.random() * uniques.length)];
        if (!items.some(function (x) { return x.id === u.item; })) items.push({ id: u.item, count: 1 });
        if (Game.UI && Game.UI.toast) Game.UI.toast('討伐の褒賞（' + killNo + '体目）— 固有装備を確実に入手！');
      }
    }
    // 精鋭(elite): 確定レアドロップ
    if (m.elite && Game.Loot.rollEliteDrop) {
      const ed = Game.Loot.rollEliteDrop(m.def);
      for (let g = 0; g < ed.length; g++) items.push({ id: ed[g].id, count: ed[g].count, roll: ed[g].roll || null });
    }
    // 遺物(relic)ドロップ: ボス12% / 精鋭6%（チャンピオンは別途上乗せ）
    if (Game.RELIC_IDS && (m.def.boss || m.elite)) {
      const rc = m.def.boss ? 0.12 : 0.06;
      if (Math.random() < rc) items.push({ id: Game.RELIC_IDS[Math.floor(Math.random() * Game.RELIC_IDS.length)], count: 1 });
    }
    for (let g = 0; g < items.length; g++) {
      Game.state.drops.push({ id: items[g].id, count: items[g].count, roll: items[g].roll || null, x: m.x + (Math.random() - 0.5) * 14, y: m.y + (Math.random() - 0.5) * 14 });
    }
    // マルチ: ホストは全員にドロップを配信
    if (Game.Net.isConnected() && Game.Net.host) Game.Net.sendMobDeath(m.x, m.y, items);
    Game.Render.spawnParticles(m.x, m.y, m.def.color, m.def.boss ? 40 : 12);
    Game.Render.spawnBlood(m.x, m.y, m.def.boss ? 24 : 10);
    // 撃破ヒットストップ＋軽いシェイク(格の高い敵ほど長く/強く)
    Game.state.hitstop = Math.max(Game.state.hitstop || 0, (m.def.boss || m.champion) ? 4 : m.elite ? 3 : 2);
    if (Game.Render.shake) Game.Render.shake(m.def.boss ? 8 : m.def.big ? 5 : 3);
    // ボス撃破の決定的瞬間: 長い静止+白閃光+金の衝撃波リング+勝利の聖歌(コーラス)。一撃の重みを最大化
    if (m.def.boss) {
      Game.state.hitstop = Math.max(Game.state.hitstop || 0, 12);
      if (Game.Render.flash) Game.Render.flash('rgba(255,240,200,0.55)');
      if (Game.Render.shake) Game.Render.shake(14);
      if (Game.Render.spawnLevelRing) Game.Render.spawnLevelRing(m.x, m.y);
      if (Game.Audio && Game.Audio.cue) { Game.Audio.cue('boom'); Game.Audio.cue('choir'); }
    }
    const diffX = (Game.DIFFICULTIES[Game.state.difficulty] || {}).xpMult || 1; // hardの報酬: 経験値+20%
    Game.Player.gainXP(Math.round((m.def.xp || 1) * (m.xpMult || 1) * diffX * (1 + (Game.state.ngLevel || 0) * 0.2)) * (m.elite ? 3 : 1)); // 強い敵(NG)・精鋭・危険帯ほど経験値増
    // バーツ(通貨)獲得: 敵の格に応じて。精鋭/チャンピオン/ボス/危険帯ほど多い
    if (m.def.hostile) {
      const pl = Game.state.player;
      let bts = Math.max(1, Math.round((m.def.xp || 1) * (m.xpMult || 1) * 0.6 * (m.def.boss ? 1.6 : 1)));
      if (m.elite) bts *= 2; if (m.champion) bts *= 2;
      pl.bts = (pl.bts || 0) + bts;
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - (m.def.size || 12) * 0.5, '+' + bts + ' bts', '#ffd24a');
    }
    if (Game.Achievements && m.def.hostile) Game.Achievements.unlock('first_night');
    if (Game.Achievements && m.elite) { // 新精鋭の討伐実績
      if (hasAffix(m, 'warded')) Game.Achievements.unlock('ward_breaker');
      if (hasAffix(m, 'blink')) Game.Achievements.unlock('blink_hunter');
    }
    // 精鋭撃破演出＆実績
    if (m.elite) {
      const af = m.eliteAffix && Game.ELITE_AFFIXES[m.eliteAffix];
      const prefix = af ? af.name : '精鋭の';
      const auraC = m.champion ? '#ff5ac8' : (af ? af.aura : '#ffd86b');
      Game.Render.flash(auraC);
      Game.Render.spawnParticles(m.x, m.y, auraC, m.champion ? 44 : 22);
      Game.state.eliteKills = (Game.state.eliteKills || 0) + 1;
      if (Game.Achievements) { Game.Achievements.unlock('elite_hunter'); if (Game.state.eliteKills >= 25) Game.Achievements.unlock('elite_veteran'); }
      if (m.champion) {
        // チャンピオン: 確定で複数レア戦利品(高品質ギア2点＋宝珠＋低確率で書)を地面に生成
        const champDrops = [];
        if (Game.Loot.rollEliteDrop) { champDrops.push.apply(champDrops, Game.Loot.rollEliteDrop(m.def)); champDrops.push.apply(champDrops, Game.Loot.rollEliteDrop(m.def)); }
        champDrops.push({ id: 'xp_orb', count: 1 });
        if (Math.random() < 0.25) champDrops.push({ id: 'wisdom_tome', count: 1 });
        if (Math.random() < 0.22 && Game.RELIC_IDS) champDrops.push({ id: Game.RELIC_IDS[Math.floor(Math.random() * Game.RELIC_IDS.length)], count: 1 }); // 遺物
        if (Math.random() < 0.1) champDrops.push({ id: 'expand_pouch', count: 1 }); // 稀に拡張のポーチ
        for (let g = 0; g < champDrops.length; g++) Game.state.drops.push({ id: champDrops[g].id, count: champDrops[g].count, roll: champDrops[g].roll || null, x: m.x + (Math.random() - 0.5) * 22, y: m.y + (Math.random() - 0.5) * 22 });
        Game.Player.gainXP(Math.round((m.def.xp || 1) * 5)); // チャンピオンは追加経験値
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.7, 'CHAMPION撃破!!', '#ff8ad8', true);
        Game.UI.toast('★ ' + (m.championName || 'チャンピオン') + ' を討伐！ 財宝を手にした');
        Game.Audio.play('champion_die');
        Game.state.championKills = (Game.state.championKills || 0) + 1;
        if (Game.Achievements) { Game.Achievements.unlock('champion_slayer'); if (Game.state.championKills >= 10) Game.Achievements.unlock('champion_master'); }
      } else {
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '精鋭撃破!', '#ffd86b', true);
        Game.Audio.play('elite_die');
        Game.UI.toast(prefix + m.def.name + 'を討伐！ 戦利品を得た');
      }
      // 分裂アフィックス: 弱体な分身を2体生成
      if (hasAffix(m, 'splitting') && !m.isSplit) {
        const n = Game.ELITE_AFFIXES.splitting.split || 2;
        for (let k = 0; k < n; k++) {
          spawnMob(m.type, m.x + (Math.random() - 0.5) * 36, m.y + (Math.random() - 0.5) * 36);
          const c = Game.state.mobs[Game.state.mobs.length - 1];
          if (c && c.type === m.type) {
            c.elite = false; c.champion = false; c.eliteAffix = null; c.eliteAffix2 = null; c.eliteSpeedMult = 0; c.isSplit = true;
            c.maxHp = c.hp = Math.max(1, Math.round((m.def.hp || 4) * 0.4));
            c.dmg = Math.max(1, Math.round((m.def.dmg || 2) * 0.6));
          }
        }
      }
    }
    if (m.def.boss) {
      if (m.type === 'sovereign') {
        Game.Render.flash('#c060ff');
        Game.UI.toast('影の主を打ち倒した！ 影核を手にした');
        if (Game.Achievements) Game.Achievements.unlock('boss_slain');
      } else {
        Game.Render.flash('#ffcaa0');
        Game.UI.toast(m.def.name + 'を打ち倒した！');
        if (Game.Achievements) { Game.Achievements.unlock('dungeon_boss'); if (Game.BOSS_ACH && Game.BOSS_ACH[m.type]) Game.Achievements.unlock(Game.BOSS_ACH[m.type]); }
      }
      // 恒久報酬: ユニークボス初撃破で最大HP+5（applyEquipStatsがbossesDefeated*5を反映）
      const firstKill = Game.state.bestiary && Game.state.bestiary[m.type] === 1;
      Game.Player.applyEquipStats();
      if (firstKill) {
        const pl = Game.state.player; pl.health = Math.min(pl.maxHealth, pl.health + 5);
        Game.UI.toast('討伐の証を得た — 最大HP +5　称号「' + Game.Player.bossTitle() + '」');
      }
      // 終焉の鍵 解放ヒント: 鍵素材を落とす強敵を全て退けたら一度だけ案内(実績で既出判定)
      if (m.type !== 'endbringer' && Game.Achievements && !Game.Achievements.has('all_conquered')) {
        const be = Game.state.bestiary || {};
        if (be.hunger_beast && be.star_guardian && (be.sovereign || be.abyss_dragon)) {
          Game.Achievements.unlock('all_conquered');
          Game.UI.toast('強敵たちの力が集った——「終焉の鍵」を鍛えられる（付呪台: 影核3・星核2・虚の心臓1・金塊5）');
        }
      }
      // 刻片(記念の通貨的素材)をボス撃破で入手
      if (Game.Inventory) Game.Inventory.add('kokuhen', 1);
      if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('kokuhen_intro', '🔮 「刻片」を入手！ インベントリの「📖 記憶回廊」で刻片を使うと、世界の物語を読み解ける');
      // 節目イベント: ボス撃破で自動保存(進行保全)
      if (Game.Save) Game.Save.autosave('boss');
      // 物語ムービー: 節目のボスは初撃破で記憶回廊の章を解放＋シネマ再生(撃破outroの代わり)
      const STORY_BOSS = { sovereign: 'shadow_king', tomb_king: 'tomb_king', forge_titan: 'forge_titan', hunger_beast: 'hunger', crystal_queen: 'crystal_queen', abyss_dragon: 'abyss', star_guardian: 'star', twilight_colossus: 'twilight', swamp_lord: 'frontier', lava_lord: 'frontier', spore_queen: 'frontier', endbringer: 'endbringer' };
      const sid = STORY_BOSS[m.type];
      const playedStory = (sid && Game.Story && !Game.Story.seen(sid) && !(Game.Net.isConnected() && !Game.Net.host)) ? Game.Story.unlock(sid, true) : false;
      if (sid && !playedStory && Game.Story) Game.Story.unlock(sid, false); // 既見でも記録は保証
      // 撃破アニメムービー（物語を再生しない場合のみ通常outro）
      if (!playedStory && Game.Cutscene && Game.Cutscene.playBossOutro && !(Game.Net.isConnected() && !Game.Net.host)) {
        Game.state.paused = true;
        const bt = m.type;
        Game.Cutscene.playBossOutro(bt, function () { Game.state.paused = false; });
      }
    }
    // 連続撃破コンボ: 敵対モブを短時間で続けて倒すとカウント。節目でボーナス＋演出
    if (m.def.hostile && !m.def.npc) {
      const s = Game.state;
      s.combo = (s.combo || 0) + 1; s.comboT = 90; // 3秒以内に次を倒せば継続
      if (s.combo >= 3) {
        if (Game.UI.flashCombo) Game.UI.flashCombo(s.combo);
        if (Game.Audio.comboSound) Game.Audio.comboSound(s.combo);
        Game.Player.gainXP(Math.min(20, Math.round(s.combo * 0.6))); // 連撃ごとに少額の追加経験
      }
      if (s.combo > 0 && s.combo % 10 === 0) { // 10連ごとにボーナス(高連ほど豪華)
        Game.Player.gainXP(Math.min(80, s.combo * 1.5));
        const big = s.combo >= 20;
        if (Game.Render.flash) Game.Render.flash(big ? 'rgba(255,180,80,0.28)' : 'rgba(255,210,120,0.16)');
        if (big) { // 20連以上は豪華な払い出し
          if (Game.Render.shake) Game.Render.shake(6);
          if (Game.Render.spawnLevelRing) Game.Render.spawnLevelRing(Game.state.player.x, Game.state.player.y);
          Game.Audio.play('quest_done');
          Game.state.comboT = 110; // 高連はやや猶予延長で繋ぎやすく
        }
      }
    }
    // 撃破の手応え(インパクトフレーム): 格に応じた微小ヒットストップ＋大型は軽い揺れ。
    // 雑魚は1tickでスウォーム掃討を阻害せず、大型/精鋭ほど「決めた」感を強調。ボスは専用アウトロ演出に委譲。
    if (!m.def.boss) {
      const kfreeze = m.champion ? 4 : m.elite ? 3 : (m.def.big || m.def.midboss) ? 2 : 1;
      Game.state.hitstop = Math.max(Game.state.hitstop || 0, kfreeze);
      if (kfreeze >= 2 && Game.Render.shake) Game.Render.shake(kfreeze >= 3 ? 4 : 2);
    }
    Game.Audio.play('mobdie');
  }

  function draw(ctx, alpha) {
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      const x = m.prevX + (m.x - m.prevX) * alpha;
      let y = m.prevY + (m.y - m.prevY) * alpha;
      const s = Game.Camera.worldToScreen(x, y);
      // 画面外スキップ
      if (s.x < -40 || s.y < -40 || s.x > Game.view.w + 40 || s.y > Game.view.h + 40) continue;
      // ボス溜め攻撃のテレグラフ(着弾予告リング・地面に表示)
      if (m.slam != null && m.slamR) {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1;
        const rr = m.slamR * Game.CFG.TILE_SIZE * z;
        const prog = 1 - m.slam / (m.slamMax || 18);
        ctx.save();
        ctx.fillStyle = 'rgba(255,40,20,' + (0.1 + prog * 0.3).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,70,40,0.9)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // 設置爆撃のテレグラフ: 各爆発予定地に、満ちるほど濃くなる橙リング(移動して避ける)
      if (m.zones) {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1, TS2 = Game.CFG.TILE_SIZE;
        ctx.save();
        for (let zi = 0; zi < m.zones.length; zi++) {
          const zo = m.zones[zi]; if (zo.done) continue;
          const zs2 = Game.Camera.worldToScreen(zo.x, zo.y), R = (zo.r || 2.2) * TS2 * z, prog = 1 - zo.t / (zo.tmax || 34);
          ctx.strokeStyle = 'rgba(255,140,60,0.85)'; ctx.lineWidth = 2 * z;
          ctx.beginPath(); ctx.arc(zs2.x, zs2.y, R, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,120,50,' + (0.08 + prog * 0.28).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(zs2.x, zs2.y, R * Math.max(0.15, prog), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      // 跳躍の着地点予告(赤リング＋影)。跳んでくる先が一目で分かる
      if (m.leap) {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1, TS2 = Game.CFG.TILE_SIZE;
        const ls = Game.Camera.worldToScreen(m.leap.tx, m.leap.ty), R = (m.def.big ? 3.4 : 2.8) * TS2 * z;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(ls.x, ls.y, R * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,60,0.9)'; ctx.lineWidth = 2.5 * z;
        ctx.beginPath(); ctx.arc(ls.x, ls.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // 全方位弾のテレグラフ: ボス中心に脈動する黄リング(外へ広がるほど発射が近い)
      if (m.radial != null) {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1, prog = 1 - m.radial / (m.radialMax || 26);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,74,' + (0.4 + prog * 0.5).toFixed(3) + ')'; ctx.lineWidth = 2.5 * z;
        ctx.beginPath(); ctx.arc(s.x, s.y, (14 + prog * 46) * z, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // 突進の溜めテレグラフ: 実際に突っ込んでくる方向(プレイヤーへの実角度)へ、突進の全長ラインを表示。
      // 残り溜め時間が少ないほど明滅が速く濃くなる — 「どこへ避けるか」が正確に読める
      if (m.charge && m.charge.phase === 'windup') {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1;
        const pl3 = Game.state.player;
        const ang3 = Math.atan2(pl3.y - m.y, pl3.x - m.x);
        const ch3 = m.def.charge || {};
        const lenPx = Math.min(((ch3.dashSpeed || 6) * (ch3.dashTicks || 14)), 320) * z;
        const urg = Math.max(0, Math.min(1, 1 - m.charge.t / (ch3.windup || 20)));
        const blink = (Game.state.tick % Math.max(2, 8 - Math.round(urg * 6))) < Math.max(1, 4 - Math.round(urg * 3));
        ctx.save();
        ctx.strokeStyle = 'rgba(255,90,40,' + (blink ? 0.35 + urg * 0.55 : 0.22) + ')';
        ctx.lineWidth = (2.4 + urg * 1.6) * z; ctx.lineCap = 'round';
        ctx.setLineDash([8 * z, 6 * z]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(ang3) * lenPx, s.y + Math.sin(ang3) * lenPx); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,120,60,' + (0.6 + urg * 0.35) + ')';
        ctx.beginPath(); ctx.arc(s.x + Math.cos(ang3) * lenPx, s.y + Math.sin(ang3) * lenPx, (3 + urg * 2.5) * z, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const r = m.def.size * 0.5 * (m.champion ? 1.55 : m.elite ? 1.3 : 1) * (m.sizeVar || 1);
      const hop = (m.def.hop ? Math.abs(Math.sin(m.hopPhase)) * 5 : 0) + (m.leapZ || 0) * (Game.Camera.zoom ? Game.Camera.zoom() : 1);
      // 予兆(!マーク): 溜め/照準/突進構え中の敵の頭上に点滅警告。スマホでも一目で分かる
      const windup = m.slam != null || m.aim != null || m.radial != null || m.fuse != null || (m.charge && m.charge.phase === 'windup') || (m.leap && m.leap.phase === 'crouch');
      if (windup) {
        ctx.fillStyle = (Game.state.tick % 8) < 4 ? '#ffd24a' : '#ff7a3c';
        ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('!', s.x, s.y - r - hop - 14);
        ctx.textAlign = 'left';
      }
      ctx.save();
      // 決死ノヴァのテレグラフ: 爆発範囲を赤リングで予告し、内側が満ちるほど爆発が近い(離れれば回避)
      if (m.novaT > 0) {
        const z3 = Game.Camera.zoom ? Game.Camera.zoom() : 1, TS2 = Game.CFG.TILE_SIZE;
        const R = (m.novaR || 4) * TS2 * z3, prog = 1 - m.novaT / 42;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,70,40,0.9)'; ctx.lineWidth = 2.5 * z3;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, R, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,30,' + (0.06 + prog * 0.22).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, R * prog, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // 弱点窓(隙): 眩い黄色の脈動リング＋「!」で「今が攻めどき」を明示
      if (m.vulnerable > 0) {
        const z2 = Game.Camera.zoom ? Game.Camera.zoom() : 1;
        const pl = 0.5 + Math.sin(Game.state.tick * 0.4) * 0.5;
        ctx.strokeStyle = 'rgba(255,220,80,' + (0.5 + pl * 0.4).toFixed(3) + ')'; ctx.lineWidth = 3 * z2;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, r * (1.5 + pl * 0.25), 0, Math.PI * 2); ctx.stroke();
        // 残り時間アーク: 窓が閉じるまでの猶予が一目で分かる(全力を出すか離脱するかの判断材料)
        const vfrac = Math.max(0, Math.min(1, m.vulnerable / (m.vulnMax || 90)));
        ctx.strokeStyle = 'rgba(255,240,160,0.95)'; ctx.lineWidth = 2.2 * z2;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, r * 1.5 + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vfrac); ctx.stroke();
        ctx.fillStyle = '#ffe27a'; ctx.font = 'bold ' + Math.round(13 * z2) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('!', s.x, s.y - r - hop - 20); ctx.textAlign = 'left';
      }
      // 精鋭/ボスのオーラ: 脈動する発光リング(ボスは自色で威圧、精鋭は金色)
      if (m.elite || m.bountyBoss || m.def.boss) {
        m.auraPhase = (m.auraPhase || 0) + 0.08;
        const pulse = 0.5 + Math.sin(m.auraPhase) * 0.5;
        const ar = r * ((m.def.boss ? 1.9 : 1.7) + pulse * 0.3);
        const rgb = m.auraRGB || (m.def.boss ? hexToRgb(m.def.color || '#c060ff') : [255, 216, 107]);
        const cs = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
        const grd = ctx.createRadialGradient(s.x, s.y - hop, r * 0.6, s.x, s.y - hop, ar);
        grd.addColorStop(0, 'rgba(' + cs + ',0)');
        grd.addColorStop(0.65, 'rgba(' + cs + ',' + ((m.def.boss ? 0.16 : 0.18) + pulse * 0.13) + ')');
        grd.addColorStop(1, 'rgba(' + cs + ',0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, ar, 0, Math.PI * 2); ctx.fill();
        // 結界の精鋭: バリア展開中は青白い六角的な輪を明示(読み合いの視認性)
        if (hasAffix(m, 'warded') && ((m.wardT || 0) % 150) < 60) {
          ctx.strokeStyle = 'rgba(127,184,255,' + (0.55 + pulse * 0.3) + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(s.x, s.y - hop, r * 1.5, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = 'rgba(200,228,255,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(s.x, s.y - hop, r * 1.5 + 3, 0, Math.PI * 2); ctx.stroke();
        }
        // ボスは足元に重厚な影＋地面の魔法陣リング
        if (m.def.boss) {
          ctx.strokeStyle = 'rgba(' + cs + ',' + (0.3 + pulse * 0.3) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.x, s.y + r * 0.5, r * 1.4, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (m.def.ghost) ctx.globalAlpha = 0.7 + Math.sin(m.hopPhase * 0.5) * 0.15;
      ctx.translate(s.x, s.y - hop);
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, r + hop, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // アイドルの呼吸: ごく僅かな縦伸縮で生命感(足元基準でスクワッシュ&ストレッチ)
      // 跳ねるモブは着地時に潰れ・頂点で伸びる控えめなスクワッシュ&ストレッチを追加
      const breathe = 1 + Math.sin(m.hopPhase * 0.4 + (m.wobble || 0)) * 0.045 + (m.def.hop ? (hop * 0.2 - 0.5) * 0.09 : 0);
      ctx.translate(0, r); ctx.scale(2 - breathe, breathe); ctx.translate(0, -r);
      // 本体（形状バリエーション）。状態異常で色味、個体差で明暗
      let bodyCol = m.tint ? shadeHex(m.def.color, m.tint) : m.def.color;
      if (m.iced > 0) bodyCol = '#9fd0ee'; // 氷結中は氷色
      else if (m.dot) {
        if (m.dot.burn > 0 && Game.state.tick % 6 < 3) bodyCol = '#ff7a3a';
        else if (m.dot.poison > 0 && Game.state.tick % 12 < 6) bodyCol = '#7ad04a';
        else if (m.dot.slow > 0) bodyCol = '#8fd0ff';
      }
      if (windup && (Game.state.tick % 6) < 3) bodyCol = shadeHex(bodyCol, 55); // 溜め中は体が明滅(構えの視認)
      // 2トーン陰影+輪郭: 下側/肢を暗く・上部に小ハイライト、細い暗輪郭で地形から浮き立たせる(ボス/精鋭は太め)
      const hurtNow = m.hurt > 0;
      const litCol = hurtNow ? '#fff' : bodyCol;
      const dimCol = hurtNow ? '#fff' : shadeHex(bodyCol, -46);
      const hiCol = hurtNow ? '#fff' : shadeHex(bodyCol, 62);
      const oW = m.def.boss ? 2.2 : (m.elite || m.champion) ? 1.7 : 1.1;
      const oCol = 'rgba(18,14,26,0.45)';
      ctx.fillStyle = litCol;
      const shape = m.def.shape || defaultShape(m.type);
      let eyeY = -r * 0.3;
      if (shape === 'blob') {
        roundRect(ctx, -r, -r * 0.7, r * 2, r * 1.5, 6); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol; roundRect(ctx, -r * 0.92, r * 0.38, r * 1.84, r * 0.36, 5); ctx.fill();
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.38, -r * 0.32, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
      } else if (shape === 'spider') {
        ctx.strokeStyle = m.def.color; ctx.lineWidth = 2;
        for (let a = 0; a < 4; a++) { const ang = a * 0.5 + 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, Math.PI * 0.22, Math.PI * 0.78); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.35, r * 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
      } else if (shape === 'tall') {
        // 巨人系: 縦長の胴体＋頭＋肩
        roundRect(ctx, -r * 0.7, -r * 1.3, r * 1.4, r * 2.3, 5); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -r * 1.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dimCol; // 腕(肢側)と下胴を暗く
        ctx.fillRect(-r * 0.95, -r * 0.9, r * 0.35, r * 1.1); ctx.fillRect(r * 0.6, -r * 0.9, r * 0.35, r * 1.1);
        ctx.fillRect(-r * 0.62, r * 0.55, r * 1.24, r * 0.4);
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 1.38, r * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
        eyeY = -r * 1.3;
      } else if (shape === 'orb') {
        // 浮遊する眼
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, Math.PI * 0.25, Math.PI * 0.75); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
        const ex0 = m.dir === 'left' ? -r * 0.25 : m.dir === 'right' ? r * 0.25 : 0;
        ctx.fillStyle = '#c0203a'; ctx.beginPath(); ctx.arc(ex0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      } else if (shape === 'wisp') {
        // 揺らめく霊体
        ctx.beginPath(); ctx.moveTo(0, -r);
        for (let a = 1; a <= 8; a++) { const ang = a / 8 * Math.PI * 2; const rr = r * (a % 2 ? 0.78 : 1) * (1 + Math.sin(m.hopPhase + a) * 0.06); ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
      } else if (shape === 'spiky') {
        ctx.beginPath();
        for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2; const rr = a % 2 ? r * 0.55 : r * 1.15; const fn = a === 0 ? 'moveTo' : 'lineTo'; ctx[fn](Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.22, r * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
      } else if (shape === 'beast') {
        // 四足獣: 横長胴体＋脚＋耳＋尻尾。向きで頭の左右(脚は暗色で奥行き)
        const fx = m.dir === 'left' ? -1 : 1;
        ctx.fillStyle = dimCol;
        ctx.fillRect(-r * 0.8, r * 0.2, r * 0.3, r * 0.7); ctx.fillRect(r * 0.5, r * 0.2, r * 0.3, r * 0.7); // 後ろ脚
        ctx.fillRect(-r * 0.4, r * 0.3, r * 0.28, r * 0.6); ctx.fillRect(r * 0.15, r * 0.3, r * 0.28, r * 0.6); // 前脚
        ctx.fillStyle = litCol;
        roundRect(ctx, -r, -r * 0.55, r * 2, r * 1.1, r * 0.5); ctx.fill(); // 胴
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol; ctx.fillRect(-r * 0.8, r * 0.28, r * 1.6, r * 0.24); ctx.fillStyle = litCol; // 腹側の陰
        ctx.beginPath(); ctx.arc(fx * r * 0.85, -r * 0.35, r * 0.55, 0, Math.PI * 2); ctx.fill(); // 頭
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx * r * 0.7, -r * 0.8); ctx.lineTo(fx * r * 0.55, -r * 1.25); ctx.lineTo(fx * r * 1.0, -r * 0.85); ctx.closePath(); ctx.fill(); // 耳
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(fx * r * 0.72, -r * 0.52, r * 0.14, 0, Math.PI * 2); ctx.fill(); // 頭のハイライト
        ctx.strokeStyle = bodyCol; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-fx * r * 0.95, -r * 0.2); ctx.quadraticCurveTo(-fx * r * 1.5, -r * 0.4, -fx * r * 1.4, r * 0.2); ctx.stroke(); // 尻尾
        eyeY = -r * 0.45; ctx.fillStyle = litCol;
      } else if (shape === 'humanoid') {
        // 人型: 頭＋胴＋腕＋脚(肢は暗色で本体から分離して見せる)
        ctx.fillStyle = dimCol;
        ctx.fillRect(-r * 0.25, r * 0.35, r * 0.25, r * 0.7); ctx.fillRect(0, r * 0.35, r * 0.25, r * 0.7); // 脚
        ctx.fillStyle = litCol;
        roundRect(ctx, -r * 0.5, -r * 0.5, r, r * 1.0, 3); ctx.fill(); // 胴
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol;
        ctx.fillRect(-r * 0.75, -r * 0.4, r * 0.25, r * 0.85); ctx.fillRect(r * 0.5, -r * 0.4, r * 0.25, r * 0.85); // 腕
        ctx.fillStyle = litCol;
        ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.5, 0, Math.PI * 2); ctx.fill(); // 頭
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.14, -r * 0.9, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
        eyeY = -r * 0.85;
      } else if (shape === 'bird' || shape === 'bat') {
        // 翼を広げた飛行体(翼は暗色トーンで胴を際立たせる)
        const wf = shape === 'bat' ? 1.7 : 1.4, flap = Math.sin(m.hopPhase * 0.8) * r * 0.3;
        ctx.fillStyle = dimCol;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * wf, -r * 0.5 - flap, -r * wf * 1.1, r * 0.2); ctx.quadraticCurveTo(-r * 0.6, r * 0.1, 0, r * 0.3); ctx.closePath(); ctx.fill(); // 左翼
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * wf, -r * 0.5 - flap, r * wf * 1.1, r * 0.2); ctx.quadraticCurveTo(r * 0.6, r * 0.1, 0, r * 0.3); ctx.closePath(); ctx.fill(); // 右翼
        ctx.fillStyle = litCol;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); // 胴
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        eyeY = -r * 0.25;
      } else if (shape === 'serpent') {
        // 蛇/芋虫: くねる胴体の連結(尾側ほど暗く遠近感)
        const segs = 5;
        for (let sgi = segs; sgi >= 0; sgi--) {
          const off = sgi / segs; const sx = -off * r * 1.8; const sy = Math.sin(m.hopPhase + sgi * 0.8) * r * 0.4;
          ctx.fillStyle = sgi >= 3 ? dimCol : litCol;
          ctx.beginPath(); ctx.arc(sx, sy, r * (0.85 - off * 0.45), 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(r * 0.2, Math.sin(m.hopPhase) * r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill(); // 頭
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        eyeY = -r * 0.2;
      } else {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = oCol; ctx.lineWidth = oW; ctx.stroke();
        ctx.fillStyle = dimCol; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, Math.PI * 0.25, Math.PI * 0.75); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litCol;
      }
      // 種別ごとの特徴(角/枝角/耳/牙/トサカ/斑紋など)で形をより明確に差別化
      drawMobFeatures(ctx, m, r, bodyCol, shape);
      // ボスは型ごとの装具(角/肩当て/フード＋魔法球/光輪/砲身)でシルエットを明確に差別化
      if (m.def.boss) drawBossRegalia(ctx, m, r, litCol, dimCol, hiCol);
      // 氷結: 体を覆う半透明の氷塊＋白い輝きで「凍って動けない」を明示
      if (m.iced > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(190,228,255,0.42)';
        ctx.beginPath(); roundRect(ctx, -r * 1.15, -r * 1.3, r * 2.3, r * 2.5, r * 0.3); ctx.fill();
        ctx.strokeStyle = 'rgba(230,245,255,0.85)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 1.2); ctx.lineTo(-r * 0.2, r * 1.0); ctx.moveTo(r * 0.6, -r * 1.0); ctx.lineTo(r * 0.3, r * 1.1); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // 炎上: 頭上に揺らめく炎(氷結の氷塊と対の常時表示。燃えている敵が一目で分かる)
      if (m.dot && m.dot.burn > 0 && !(m.iced > 0)) {
        const tk = Game.state.tick;
        for (let k = 0; k < 3; k++) {
          const ph = tk * 0.35 + k * 2.1, sway = Math.sin(ph) * r * 0.2;
          const fx2 = (k - 1) * r * 0.42, fy2 = -r * 0.9, fh = r * (0.7 + 0.25 * Math.sin(ph * 1.4));
          ctx.fillStyle = k === 1 ? 'rgba(255,220,110,0.9)' : 'rgba(255,120,45,0.85)';
          ctx.beginPath(); ctx.moveTo(fx2 - r * 0.18, fy2); ctx.quadraticCurveTo(fx2 + sway, fy2 - fh * 0.6, fx2 + sway, fy2 - fh);
          ctx.quadraticCurveTo(fx2 - sway, fy2 - fh * 0.6, fx2 + r * 0.18, fy2); ctx.closePath(); ctx.fill();
        }
      }
      // 目（orbは独自描画済）
      if (shape !== 'orb') {
        ctx.fillStyle = m.def.hostile ? '#e33' : '#222';
        const ex = m.dir === 'left' ? -2 : m.dir === 'right' ? 2 : 0;
        ctx.fillRect(-3 + ex, eyeY, 2, 2); ctx.fillRect(2 + ex, eyeY, 2, 2);
      }
      // 深夜の高ぶり: 目を爛々と光らせる(加算発光で威圧)。宿主が居る間だけ
      if (m.glowEyes) {
        const ex = m.dir === 'left' ? -2 : m.dir === 'right' ? 2 : 0;
        const gy = (shape === 'orb') ? -r * 0.1 : eyeY;
        const pulse = 0.6 + Math.sin((Game.state.tick + (m.wobble || 0) * 9) * 0.2) * 0.4;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const eg = ctx.createRadialGradient(0, gy, 0, 0, gy, r * 0.9);
        eg.addColorStop(0, 'rgba(255,90,60,' + (0.5 * pulse).toFixed(3) + ')'); eg.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, gy, r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,150,120,' + (0.6 + pulse * 0.4).toFixed(3) + ')';
        ctx.fillRect(-3 + ex, gy - 0.5, 2.4, 2.4); ctx.fillRect(2 + ex, gy - 0.5, 2.4, 2.4);
        ctx.restore();
      }
      ctx.restore();
      // NPCマーカー
      if (m.def.npc) {
        ctx.fillStyle = '#ffe66b'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(m.traded ? '✓' : '!', s.x, s.y - r - hop - 8); ctx.textAlign = 'left';
      }
      // HPバー
      if (m.hp < m.maxHp && !m.def.npc) {
        const bw = m.def.size + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(s.x - bw / 2, s.y - r - hop - 9, bw, 4);
        ctx.fillStyle = m.def.hostile ? '#e44' : '#6c6';
        ctx.fillRect(s.x - bw / 2, s.y - r - hop - 9, bw * (m.hp / m.maxHp), 4);
      }
    }
  }

  // 種別ごとの識別特徴を本体に重ねる(原点=本体中心、向きは描画側で未回転)。形の差を明確化
  function drawMobFeatures(ctx, m, r, bodyCol, shape) {
    const t = m.type, dark = shadeHex(bodyCol, -60), fx = m.dir === 'left' ? -1 : 1; // shadeHexは加算式: 負値で暗色に
    const horn = '#e8e0c8', bone = '#dfd8c0';
    ctx.lineCap = 'round';
    // 角(ボア/ゴーレム/トロル/溶炉/巨像系)
    if (/boar|golem|troll|charger|forge_titan|twilight|tomb_king|ice_bear|salamander/.test(t)) {
      ctx.fillStyle = horn;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.7); ctx.lineTo(-r * 0.75, -r * 1.25); ctx.lineTo(-r * 0.3, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.7); ctx.lineTo(r * 0.75, -r * 1.25); ctx.lineTo(r * 0.3, -r * 0.85); ctx.closePath(); ctx.fill();
    }
    // 枝角(鹿)
    if (t === 'deer') {
      ctx.strokeStyle = bone; ctx.lineWidth = 1.6;
      [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.moveTo(sgn * r * 0.4, -r * 0.7); ctx.lineTo(sgn * r * 0.7, -r * 1.5);
        ctx.moveTo(sgn * r * 0.55, -r * 1.1); ctx.lineTo(sgn * r * 0.95, -r * 1.25); ctx.moveTo(sgn * r * 0.66, -r * 1.35); ctx.lineTo(sgn * r * 1.0, -r * 1.55); ctx.stroke(); });
    }
    // 長い耳(うさぎ) / 三角耳(狼/猪)
    if (t === 'rabbit') { ctx.fillStyle = bodyCol; [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.ellipse(sgn * r * 0.35, -r * 1.1, r * 0.18, r * 0.6, sgn * 0.2, 0, Math.PI * 2); ctx.fill(); }); }
    if (/wolf|frost_wolf|sheep|charger/.test(t)) { ctx.fillStyle = dark; [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.moveTo(sgn * r * 0.5, -r * 0.6); ctx.lineTo(sgn * r * 0.8, -r * 1.05); ctx.lineTo(sgn * r * 0.2, -r * 0.8); ctx.closePath(); ctx.fill(); }); }
    // 牙/キバ(蛇/サソリ/クモ/獣の口)
    if (/viper|serpent|wurm|spider|scorpion|leech|bog_horror|hunger/.test(t)) {
      ctx.fillStyle = bone; ctx.beginPath(); ctx.moveTo(fx * r * 0.5, r * 0.1); ctx.lineTo(fx * r * 0.75, r * 0.6); ctx.lineTo(fx * r * 0.35, r * 0.25); ctx.closePath(); ctx.fill();
    }
    // トサカ/背びれ(サラマンダー/竜/トカゲ/エンバー)
    if (/salamander|dragon|ember|lava|dune_serpent|astral/.test(t)) {
      ctx.fillStyle = shadeHex(bodyCol, 42); ctx.beginPath();
      for (let k = -1; k <= 1; k++) { ctx.moveTo(k * r * 0.4, -r * 0.7); ctx.lineTo(k * r * 0.4 + r * 0.12, -r * 1.15); ctx.lineTo(k * r * 0.4 + r * 0.24, -r * 0.75); }
      ctx.closePath(); ctx.fill();
    }
    // 甲冑のヘルム(呪鎧/スケルトン/賞金首)
    if (/cursed_armor|skeleton|bandit|wanted/.test(t)) {
      ctx.fillStyle = dark; ctx.fillRect(-r * 0.5, -r * 0.5, r, r * 0.3);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(-r * 0.3, -r * 0.42, r * 0.18, r * 0.12); ctx.fillRect(r * 0.12, -r * 0.42, r * 0.18, r * 0.12);
    }
    // 多眼(クモ/ゲイザー/胞子/虚空)
    if (/spider|gazer|spore|void_drone|watcher|hex_caster/.test(t)) {
      ctx.fillStyle = '#ffd24a'; [[-0.5, -0.2], [0.5, -0.2], [-0.25, -0.45], [0.25, -0.45]].forEach(p => { ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, r * 0.1, 0, Math.PI * 2); ctx.fill(); });
    }
    // 王冠(ボス級の王/女王/主)
    if (/sovereign|king|queen|lord|colossus|endbringer|guardian|titan/.test(t) && m.def.boss) {
      ctx.fillStyle = '#ffd24a'; const cy = -r * 1.15;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, cy + r * 0.3); ctx.lineTo(-r * 0.6, cy); ctx.lineTo(-r * 0.3, cy + r * 0.18); ctx.lineTo(0, cy - r * 0.18); ctx.lineTo(r * 0.3, cy + r * 0.18); ctx.lineTo(r * 0.6, cy); ctx.lineTo(r * 0.6, cy + r * 0.3); ctx.closePath(); ctx.fill();
    }
  }

  // ボスの型別装具: 攻撃モーションの差別化(radial/zone/leap)と対になる視覚的差別化。
  // 型が一目で分かる=どんな攻めが来るか予測できる(読み合いの土台)。
  function drawBossRegalia(ctx, m, r, litCol, dimCol, hiCol) {
    const arch = BOSS_ARCH[m.type] || 'bruiser';
    const t = Game.state.tick, oCol = 'rgba(18,14,26,0.5)';
    if (arch === 'berserker') {
      // 猛る大角＋肩の棘: 攻撃的なシルエット(跳躍叩きつけ型)
      ctx.fillStyle = '#9c2620'; ctx.strokeStyle = oCol; ctx.lineWidth = 1.5;
      [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.moveTo(sgn * r * 0.5, -r * 0.75); ctx.quadraticCurveTo(sgn * r * 1.35, -r * 1.25, sgn * r * 1.0, -r * 1.75); ctx.quadraticCurveTo(sgn * r * 0.88, -r * 1.15, sgn * r * 0.3, -r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = shadeHex(litCol, -28);
      [-1, 1].forEach(sgn => { for (let k = 0; k < 3; k++) { const sx = sgn * (r * 0.65 + k * r * 0.2); ctx.beginPath(); ctx.moveTo(sx, -r * 0.05); ctx.lineTo(sx + sgn * r * 0.06, -r * 0.7); ctx.lineTo(sx + sgn * r * 0.22, -r * 0.02); ctx.closePath(); ctx.fill(); } });
    } else if (arch === 'bruiser') {
      // 重厚な肩当て＋鉄輪: 鈍重で頑強なシルエット(溜め叩き型)
      ctx.strokeStyle = oCol; ctx.lineWidth = 2;
      [-1, 1].forEach(sgn => { ctx.fillStyle = shadeHex(dimCol, -8); ctx.beginPath(); ctx.ellipse(sgn * r * 0.98, -r * 0.12, r * 0.52, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = hiCol; ctx.beginPath(); ctx.arc(sgn * r * 0.98, -r * 0.26, r * 0.09, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#8a8f96'; ctx.fillRect(-r * 0.55, -r * 1.05, r * 1.1, r * 0.2); ctx.strokeRect(-r * 0.55, -r * 1.05, r * 1.1, r * 0.2);
    } else if (arch === 'caster') {
      // 尖ったフード＋周回する魔法球: 術者のシルエット(全方位弾/弾幕型)
      ctx.fillStyle = shadeHex(dimCol, -6); ctx.strokeStyle = oCol; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.45); ctx.lineTo(0, -r * 1.55); ctx.lineTo(r * 0.6, -r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      const rgb = hexToRgb(m.def.color || '#c060ff'), cs = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
      for (let k = 0; k < 3; k++) { const a = t * 0.05 + k * (Math.PI * 2 / 3), ox = Math.cos(a) * r * 1.5, oy = Math.sin(a) * r * 0.95 - r * 0.2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 0.5); g.addColorStop(0, 'rgba(' + cs + ',0.9)'); g.addColorStop(1, 'rgba(' + cs + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r * 0.5, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, r * 0.13, 0, 7); ctx.fill(); }
    } else if (arch === 'summoner') {
      // 頭上の光輪＋周回する眷属の魂: 召喚者のシルエット(設置爆撃/召喚型)
      ctx.strokeStyle = 'rgba(200,170,255,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -r * 1.28, r * 0.62, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = t * 0.04 + k * (Math.PI / 2), ox = Math.cos(a) * r * 1.4, oy = Math.sin(a) * r * 0.9;
        ctx.fillStyle = shadeHex(dimCol, -22); ctx.beginPath(); ctx.arc(ox, oy, r * 0.22, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(ox, oy, r * 0.06, 0, 7); ctx.fill(); }
    } else if (arch === 'artillery') {
      // 前方の砲身2門＋銃口の熱: 砲台のシルエット(遠距離砲撃型)
      const fdx = m.dir === 'left' ? -1 : m.dir === 'right' ? 1 : 0, fdy = m.dir === 'up' ? -1 : m.dir === 'down' ? 1 : 0;
      const bx = fdx || 0, by = (fdx || fdy) ? fdy : 1;
      ctx.save(); ctx.rotate(Math.atan2(by, bx));
      ctx.fillStyle = shadeHex(dimCol, -15); ctx.strokeStyle = oCol; ctx.lineWidth = 2;
      ctx.fillRect(r * 0.4, -r * 0.52, r * 0.95, r * 0.3); ctx.strokeRect(r * 0.4, -r * 0.52, r * 0.95, r * 0.3);
      ctx.fillRect(r * 0.4, r * 0.22, r * 0.95, r * 0.3); ctx.strokeRect(r * 0.4, r * 0.22, r * 0.95, r * 0.3);
      ctx.fillStyle = 'rgba(255,150,60,' + (0.55 + Math.sin(t * 0.2) * 0.3).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(r * 1.35, -r * 0.37, r * 0.11, 0, 7); ctx.arc(r * 1.35, r * 0.37, r * 0.11, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { list, update, draw, spawnMob, damageMob, killMob, applyDot, applyBleed, alertNoise, summonBoss, nearbyNPC, interactNPC, applyMobSnapshot, applyRemoteHit, spawnNetDrops, buildSnapshot };
})();
