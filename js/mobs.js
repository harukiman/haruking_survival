// mobs.js — モブAI・スポーン・描画・戦闘連携
window.Game = window.Game || {};

Game.Mobs = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const TUNE = Game.TUNE;

  function list() { return Game.state.mobs; }

  function spawnMob(type, wx, wy) {
    const def = Game.MOBS[type];
    if (!def) return;
    const diff = Game.DIFFICULTIES[Game.state.difficulty] || Game.DIFFICULTIES.normal;
    const mult = 1 + (Game.state.ngLevel || 0) * Game.TUNE.NG_HP_PER;
    const hp = Math.round(def.hp * mult);
    const dmgMult = mult * (diff.dmgMult != null ? diff.dmgMult : 1);
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
      sizeVar: 0.86 + Math.random() * 0.30,          // 0.86〜1.16
      tint: Math.round((Math.random() - 0.5) * 38),  // 色の明暗揺らぎ -19〜+19
      moveStyle: pickMoveStyle(type, def),
      wobble: Math.random() * 6,
    };
    // 精鋭(elite)抽選: 非ボスの敵対モブが低確率で精鋭化（HP/攻撃UP・発光オーラ・確定レアドロップ）
    if (!def.boss && def.hostile && Math.random() < (TUNE.ELITE_CHANCE || 0.04)) {
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
      // チャンピオン: 精鋭の上位レア。2つ目のアフィックス＋固有名＋追加強化＋専用カラー
      if (ak.length && Math.random() < (TUNE.CHAMPION_CHANCE || 0.08)) {
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
      let type = null;
      if (shadowWorld) {
        if (!diff.spawnHostiles) continue; // のんびり: 影世界でも敵なし
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
        // 夜は敵対モブ（のんびりは出ない）。血の月は強敵寄り
        // 血の月の夜は地上ボス「黄昏の巨像」が稀出現(1体まで)
        if (Game.state.bloodMoon && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('twilight_colossus') === 0) {
          type = 'twilight_colossus';
        } else if (g === Game.TILE.SWAMP && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('swamp_lord') === 0) {
          type = 'swamp_lord'; // 夜の毒の沼地に沼の主が稀出現
        } else if (g === Game.TILE.VOLCANIC && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('lava_lord') === 0) {
          type = 'lava_lord'; // 火山地帯に溶岩の王が稀出現
        } else if (g === Game.TILE.MUSHROOM && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('spore_queen') === 0) {
          type = 'spore_queen'; // キノコの森に胞子の女王が稀出現
        } else if (Math.random() < (Game.state.bloodMoon ? 0.03 : 0.015) && !hasMidboss()) {
          // 中ボス(ランクD)が夜に稀出現。1体まで
          const mb = ['dire_alpha', 'stone_warden', 'broodmother'];
          type = mb[Math.floor(Math.random() * mb.length)];
        } else {
          const pool = Game.state.bloodMoon
            ? ['zombie', 'zombie', 'skeleton', 'spider', 'leech', 'bandit', 'bat', 'gazer', 'troll', 'harpy', 'viper', 'charger']
            : ['zombie', 'skeleton', 'spider', 'slime', 'leech', 'bat', 'gazer', 'harpy', 'viper', 'charger'];
          type = pool[Math.floor(Math.random() * pool.length)];
        }
      } else {
        // 昼: 動物＋環境ごとの敵（砂漠=サソリ/呪術師, 雪原=白熊, 森=稀に猪/トロル/旅人）
        const diffH = diff.spawnHostiles;
        if (g === Game.TILE.GRASS || g === Game.TILE.FOREST || g === Game.TILE.BLOOM) {
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
        } else if (g === Game.TILE.STONE && Math.random() < 0.3) {
          type = 'slime';
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
        let pool;
        if (spObj === Game.OBJ.BANDIT_SPAWNER) { pool = ['bandit', 'bandit', 'bandit', 'skeleton']; } // 略奪者の野営地
        else if (Game.state.worldName === 'space') { pool = (Math.random() < 0.04 && countType('star_guardian') === 0) ? ['star_guardian'] : ['void_drone', 'void_drone', 'astral_serpent', 'void_jelly']; }
        else if (Game.state.worldName === 'shadow') pool = ['wraith', 'watcher', 'hex_caster', 'gazer'];
        else if (g === Game.TILE.SNOW) pool = ['frost_wisp', 'frost_wisp', 'cursed_armor', 'ice_bear'];
        else if (g === Game.TILE.SAND) pool = ['scorpion', 'scorpion', 'dust_mage', 'cursed_armor', 'golem'];
        else pool = ['zombie', 'skeleton', 'spider', 'cursed_armor', 'golem', 'ember_imp', 'bog_horror'];
        // テーマ別ダンジョンボス（稀・1体まで）
        let type = null;
        if (Game.state.worldName === 'light' && spObj !== Game.OBJ.BANDIT_SPAWNER) {
          if (g === Game.TILE.SAND && Math.random() < 0.03 && countType('tomb_king') === 0) type = 'tomb_king';
          else if (g === Game.TILE.STONE && Math.random() < 0.03 && countType('forge_titan') === 0) type = 'forge_titan';
          else if (g === Game.TILE.SNOW && Math.random() < 0.03 && countType('crystal_queen') === 0) type = 'crystal_queen';
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
  function applyDot(m, kind) {
    if (!m || !m.def || m.def.npc) return;
    const e = KIND_DOT[kind]; if (!e) return;
    m.dot = m.dot || {}; m.dot[e[0]] = Math.max(m.dot[e[0]] || 0, e[1]);
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
    if (m.dot && m.dot.slow > 0) speed *= 0.55; // 凍えで鈍足
    dx /= len; dy /= len;
    if (Math.abs(dx) > Math.abs(dy)) m.dir = dx < 0 ? 'left' : 'right';
    else m.dir = dy < 0 ? 'up' : 'down';
    const nx = m.x + dx * speed;
    if (walkAt(nx, m.y, m)) m.x = nx;
    const ny = m.y + dy * speed;
    if (walkAt(m.x, ny, m)) m.y = ny;
  }

  function walkAt(wx, wy, m) {
    const r = m.def.size * 0.5;
    const pts = [[wx - r, wy - r], [wx + r, wy - r], [wx - r, wy + r], [wx + r, wy + r]];
    for (let i = 0; i < pts.length; i++) {
      if (!Game.World.isWalkable(Math.floor(pts[i][0] / TS), Math.floor(pts[i][1] / TS))) return false;
    }
    return true;
  }

  function update() {
    // コンボ継続タイマー: 時間切れでリセット
    if (Game.state.comboT > 0) { Game.state.comboT--; if (Game.state.comboT === 0) Game.state.combo = 0; }
    // マルチ: クライアントは敵を simulate せずホストの配信を描画＋自分への接触判定
    if (Game.Net.isConnected() && !Game.Net.host) { clientUpdate(); return; }

    const mobs = Game.state.mobs;
    const p = Game.state.player;

    if (Game.state.tick % TUNE.SPAWN_INTERVAL === 0) { trySpawn(); if (Game.state.bloodMoon) trySpawn(); }
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
        if (m.dot.slow > 0) m.dot.slow--;
        if (Game.state.tick % 20 === 0 && ((m.dot.burn || 0) > 0 || (m.dot.poison || 0) > 0)) {
          const d = ((m.dot.burn || 0) > 0 ? 2 : 0) + ((m.dot.poison || 0) > 0 ? 1 : 0);
          m.hp -= d; m.hurt = Math.max(m.hurt, 2);
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.5, d, m.dot.burn > 0 ? '#ff8a4a' : '#9fe04a');
          if (m.hp <= 0) { killMob(m); continue; }
        }
        if (m.dot.burn > 0) m.dot.burn--;
        if (m.dot.poison > 0) m.dot.poison--;
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

      // 遠すぎたら消滅
      if (distP > TUNE.DESPAWN_TILES * TS) { mobs.splice(i, 1); continue; }

      // 精鋭アフィックス: 再生(不死) — 毎秒 最大HPの一定割合を回復
      if (hasAffix(m, 'regened') && m.hp < m.maxHp && Game.state.tick % 30 === 0) {
        const af = Game.ELITE_AFFIXES.regened;
        m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * af.regenPct)));
      }

      if (m.def.hostile) {
        let aggro = (m.def.boss ? 22 : 13) * TS;
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
        if ((m.def.boss || (m.def.midboss && m.def.summon)) && m.attackCd <= 0 && Game.state.tick % (m.enraged ? 120 : 200) === 0) {
          const minion = m.def.summon || 'shadow_spawn';
          const cap = m.def.boss ? 8 : 4, n = m.def.boss ? 3 : 2;
          if (countType(minion) < cap) { for (let k = 0; k < n; k++) spawnMob(minion, m.x + (Math.random() - 0.5) * 60, m.y + (Math.random() - 0.5) * 60); Game.Audio.play('shift'); }
        }
        // ボスの溜め叩きつけ攻撃: テレグラフ(着弾予告)→範囲ダメージ。全ボスに戦闘の駆け引きを付与
        if (m.def.boss) {
          if (m.slam != null) {
            m.slam--;
            if (m.slam <= 0) {
              const R = (m.slamR || 2.4) * TS;
              if (distP <= R && Game.Survival.damage(Math.round((m.dmg || m.def.dmg) * 1.6), m.def.name || 'mob') !== false) {
                const kl = distP || 1; p.x += (dxp / kl) * 18; p.y += (dyp / kl) * 18;
              }
              Game.Render.spawnParticles(m.x, m.y, '#ff7a3c', 26);
              if (Game.Render.shake) Game.Render.shake(10);
              Game.Audio.play('boom_sfx');
              m.slam = null; m.slamCd = m.enraged ? 90 : 150;
            }
            m.hopPhase += 0.2; continue; // 溜め中は移動・他攻撃しない(回避猶予)
          }
          if ((m.slamCd || 0) > 0) m.slamCd--;
          else if (distP < 6 * TS && Math.random() < (m.enraged ? 0.06 : 0.035)) { m.slam = m.enraged ? 14 : 18; m.slamMax = m.slam; m.slamR = (m.def.big ? 3 : 2.4); Game.Audio.play('whirl'); }
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
              if (hasAffix(m, 'blazing')) Game.Status.add('burn', Game.ELITE_AFFIXES.blazing.burn); // 業火: 接触で炎上
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
      if (Game.UI && Game.UI.toast) Game.UI.toast('⚠ ' + (m.def.name || 'ボス') + ' が激昂した！');
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
      // 記憶回廊トリガー: 金喰い初討伐 / 図鑑が20種に到達
      if (Game.Story) {
        if (m.type === 'gold_thief' && !Game.Story.seen('goldthief')) Game.Story.unlock('goldthief', true);
        if (m.type === 'shade_stalker' && !Game.Story.seen('shadewalk')) Game.Story.unlock('shadewalk', true);
        if (firstSeen && Object.keys(Game.state.bestiary).length >= 20 && !Game.Story.seen('bestiary')) Game.Story.unlock('bestiary', true);
      }
    }
    // 賞金首: 対象モブの討伐をカウント
    if (Game.Bounty && m.def && !m.def.npc) Game.Bounty.notifyKill(m.type);
    // ドロップを集約（ローカル生成＋マルチ配信用）
    const items = [];
    if (m.def.drops) {
      m.def.drops.forEach(function (d) {
        const n = Game.Utils.randInt(Math.random, d.n[0], d.n[1]);
        for (let k = 0; k < n; k++) items.push({ id: d.item, count: 1 });
      });
    }
    const gear = Game.Loot.rollMobDrop(m.def, m.x, m.y);
    for (let g = 0; g < gear.length; g++) items.push({ id: gear[g].id, count: gear[g].count, roll: gear[g].roll });
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
    Game.Player.gainXP(Math.round((m.def.xp || 1) * (1 + (Game.state.ngLevel || 0) * 0.2)) * (m.elite ? 3 : 1)); // 強い敵(NG)・精鋭ほど経験値増
    // バーツ(通貨)獲得: 敵の格に応じて。精鋭/チャンピオン/ボスほど多い
    if (m.def.hostile) {
      const pl = Game.state.player;
      let bts = Math.max(1, Math.round((m.def.xp || 1) * 0.6 * (m.def.boss ? 1.6 : 1)));
      if (m.elite) bts *= 2; if (m.champion) bts *= 2;
      pl.bts = (pl.bts || 0) + bts;
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - (m.def.size || 12) * 0.5, '+' + bts + ' bts', '#ffd24a');
    }
    if (Game.Achievements && m.def.hostile) Game.Achievements.unlock('first_night');
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
      if (s.combo >= 3) { if (Game.UI.flashCombo) Game.UI.flashCombo(s.combo); if (Game.Audio.comboSound) Game.Audio.comboSound(s.combo); }
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
      // 突進の溜めテレグラフ(向き矢印)
      if (m.charge && m.charge.phase === 'windup') {
        const z = Game.Camera.zoom ? Game.Camera.zoom() : 1;
        let ax = 0, ay = 0; if (m.dir === 'up') ay = -1; else if (m.dir === 'down') ay = 1; else if (m.dir === 'left') ax = -1; else ax = 1;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,90,40,0.85)'; ctx.lineWidth = 3 * z; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + ax * 34 * z, s.y + ay * 34 * z); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,60,0.9)';
        ctx.beginPath(); ctx.arc(s.x + ax * 34 * z, s.y + ay * 34 * z, 4 * z, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const r = m.def.size * 0.5 * (m.champion ? 1.55 : m.elite ? 1.3 : 1) * (m.sizeVar || 1);
      const hop = m.def.hop ? Math.abs(Math.sin(m.hopPhase)) * 5 : 0;
      // 予兆(!マーク): 溜め/照準/突進構え中の敵の頭上に点滅警告。スマホでも一目で分かる
      const windup = m.slam != null || m.aim != null || (m.charge && m.charge.phase === 'windup');
      if (windup) {
        ctx.fillStyle = (Game.state.tick % 8) < 4 ? '#ffd24a' : '#ff7a3c';
        ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('!', s.x, s.y - r - hop - 14);
        ctx.textAlign = 'left';
      }
      ctx.save();
      // 精鋭/ボスのオーラ: 脈動する発光リング(ボスは自色で威圧、精鋭は金色)
      if (m.elite || m.bountyBoss || m.def.boss) {
        m.auraPhase = (m.auraPhase || 0) + 0.08;
        const pulse = 0.5 + Math.sin(m.auraPhase) * 0.5;
        const ar = r * ((m.def.boss ? 1.9 : 1.7) + pulse * 0.3);
        const rgb = m.auraRGB || (m.def.boss ? hexToRgb(m.def.color || '#c060ff') : [255, 216, 107]);
        const cs = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
        const grd = ctx.createRadialGradient(s.x, s.y - hop, r * 0.6, s.x, s.y - hop, ar);
        grd.addColorStop(0, 'rgba(' + cs + ',0)');
        grd.addColorStop(0.65, 'rgba(' + cs + ',' + ((m.def.boss ? 0.24 : 0.18) + pulse * 0.16) + ')');
        grd.addColorStop(1, 'rgba(' + cs + ',0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, ar, 0, Math.PI * 2); ctx.fill();
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
      if (m.dot) {
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
      // 目（orbは独自描画済）
      if (shape !== 'orb') {
        ctx.fillStyle = m.def.hostile ? '#e33' : '#222';
        const ex = m.dir === 'left' ? -2 : m.dir === 'right' ? 2 : 0;
        ctx.fillRect(-3 + ex, eyeY, 2, 2); ctx.fillRect(2 + ex, eyeY, 2, 2);
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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { list, update, draw, spawnMob, damageMob, killMob, applyDot, summonBoss, nearbyNPC, interactNPC, applyMobSnapshot, applyRemoteHit, spawnNetDrops, buildSnapshot };
})();
