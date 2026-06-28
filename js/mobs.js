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
    // ボス登場アニメムービー（種別ごと初回・ローカル再生）
    if (def.boss && Game.Cutscene && Game.Cutscene.playBossIntro && !(Game.Net.isConnected() && !Game.Net.host)) {
      if (!Game.state.bossSeen) Game.state.bossSeen = {};
      if (!Game.state.bossSeen[type] && !Game.Cutscene.isPlaying()) {
        Game.state.bossSeen[type] = 1;
        Game.state.paused = true;
        Game.Cutscene.playBossIntro(type, function () { Game.state.paused = false; });
      }
    }
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
        const pool = deep
          ? ['wraith', 'watcher', 'abyss_stalker', 'abyss_stalker', 'spider', 'hex_caster']
          : ['wraith', 'wraith', 'watcher', 'spider', 'hex_caster', 'gazer'];
        if (!type)
        type = pool[Math.floor(Math.random() * pool.length)];
      } else if (night && diff.spawnHostiles) {
        // 夜は敵対モブ（のんびりは出ない）。血の月は強敵寄り
        // 血の月の夜は地上ボス「黄昏の巨像」が稀出現(1体まで)
        if (Game.state.bloodMoon && Game.state.worldName === 'light' && Math.random() < 0.02 && countType('twilight_colossus') === 0) {
          type = 'twilight_colossus';
        } else {
          const pool = Game.state.bloodMoon
            ? ['zombie', 'zombie', 'skeleton', 'spider', 'leech', 'bandit', 'bat', 'gazer', 'troll', 'harpy']
            : ['zombie', 'skeleton', 'spider', 'slime', 'leech', 'bat', 'gazer', 'harpy'];
          type = pool[Math.floor(Math.random() * pool.length)];
        }
      } else {
        // 昼: 動物＋環境ごとの敵（砂漠=サソリ/呪術師, 雪原=白熊, 森=稀に猪/トロル/旅人）
        const diffH = diff.spawnHostiles;
        if (g === Game.TILE.GRASS || g === Game.TILE.FOREST) {
          if (Math.random() < 0.04 && countType('wanderer') === 0) type = 'wanderer';
          else if (diffH && g === Game.TILE.FOREST && Math.random() < 0.05) type = 'troll';
          else if (diffH && g === Game.TILE.FOREST && Math.random() < 0.12) type = 'mud_crawler';
          else if (diffH && Math.random() < 0.12) type = 'boar';
          else { const pool = ['rabbit', 'deer', 'sheep']; type = pool[Math.floor(Math.random() * pool.length)]; }
        } else if (g === Game.TILE.SAND && diffH && Math.random() < 0.5) {
          type = Math.random() < 0.3 ? 'dust_mage' : (Math.random() < 0.4 ? 'dune_serpent' : 'scorpion');
        } else if (g === Game.TILE.SNOW && diffH && Math.random() < 0.4) {
          type = Math.random() < 0.45 ? 'frost_wolf' : 'ice_bear';
        } else if (g === Game.TILE.STONE && Math.random() < 0.3) {
          type = 'slime';
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
          if (Game.World.isWalkable(ox, oy)) { spawnMob(type, ox * TS + TS / 2, oy * TS + TS / 2); spawned++; break; }
        }
      }
    }
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }

  function hasAffix(m, key) { return m.eliteAffix === key || m.eliteAffix2 === key; }

  function makeChampionName() {
    const N = Game.CHAMPION_NAMES || { title: ['名もなき'], name: ['強者'] };
    return N.title[Math.floor(Math.random() * N.title.length)] + N.name[Math.floor(Math.random() * N.name.length)];
  }

  function moveMob(m, dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    if (m.eliteSpeedMult) speed *= m.eliteSpeedMult; // 俊足アフィックス
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
        const aggro = (m.def.boss ? 22 : 13) * TS;
        // ボスは手下を召喚
        if (m.def.boss && m.attackCd <= 0 && Game.state.tick % 200 === 0) {
          const minion = m.def.summon || 'shadow_spawn';
          if (countType(minion) < 8) { for (let k = 0; k < 3; k++) spawnMob(minion, m.x + (Math.random() - 0.5) * 60, m.y + (Math.random() - 0.5) * 60); Game.Audio.play('shift'); }
        }
        const rg = m.def.ranged;
        // 遠距離魔法攻撃タイプ: 距離を取りつつ魔法弾を撃つ
        if (rg && distP < rg.range * TS && distP > (m.def.size * 0.5 + 14)) {
          if ((m.rangedCd || 0) <= 0) { Game.Projectiles.enemyShoot(m, rg.dmg, rg.kind, rg.status); m.rangedCd = rg.cd; }
          if (distP < rg.range * TS * 0.5) moveMob(m, -dxp, -dyp, m.def.speed * 0.8);      // 近すぎ→離れる
          else if (distP > rg.range * TS * 0.82) moveMob(m, dxp, dyp, m.def.speed * 0.8);  // 遠い→寄る
          m.dir = Math.abs(dxp) > Math.abs(dyp) ? (dxp < 0 ? 'left' : 'right') : (dyp < 0 ? 'up' : 'down');
        } else if (distP < aggro) {
          // 敵対: プレイヤーを追跡（逃げ切れるよう追跡速度を抑制）
          moveMob(m, dxp, dyp, m.def.speed * 0.82);
          // 接触攻撃
          if (distP < (m.def.size * 0.5 + 12) && m.attackCd <= 0) {
            Game.Survival.damage(m.dmg || m.def.dmg, 'mob');
            if (m.def.inflict) for (const k in m.def.inflict) Game.Status.add(k, m.def.inflict[k]);
            if (hasAffix(m, 'blazing')) Game.Status.add('burn', Game.ELITE_AFFIXES.blazing.burn); // 業火: 接触で炎上
            m.attackCd = m.def.boss ? 30 : 42;
            const kl = distP || 1;
            p.x += (dxp / kl) * (m.def.boss ? 12 : 6); p.y += (dyp / kl) * (m.def.boss ? 12 : 6);
          }
        } else {
          wander(m);
        }
      } else {
        // 動物: 攻撃されたら逃走、それ以外は徘徊
        if (m.fleeTimer > 0) {
          m.fleeTimer--;
          moveMob(m, -dxp, -dyp, m.def.speed * 1.3);
        } else {
          wander(m);
        }
      }
      m.hopPhase += 0.2;
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
          Game.Survival.damage(m.def.dmg, 'mob');
          if (m.def.inflict) for (const k in m.def.inflict) Game.Status.add(k, m.def.inflict[k]);
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
    const dx = m.x - fromX, dy = m.y - fromY, l = Math.hypot(dx, dy) || 1;
    const kb = crit ? 11 : 7; // クリはノックバック強調
    m.knockX = (dx / l) * kb; m.knockY = (dy / l) * kb;
    if (!m.def.hostile) m.fleeTimer = 180; // 動物は逃げる
    Game.Audio.play('hit');
    if (m.hp <= 0) killMob(m);
  }

  function killMob(m) {
    const idx = Game.state.mobs.indexOf(m);
    if (idx >= 0) Game.state.mobs.splice(idx, 1);
    // 魔物図鑑: 撃破した種別と撃破数を記録（友好NPC除く）
    if (m.def && !m.def.npc) { if (!Game.state.bestiary) Game.state.bestiary = {}; Game.state.bestiary[m.type] = (Game.state.bestiary[m.type] || 0) + 1; }
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
    // 撃破ヒットストップ風: 軽いシェイク(ボス/大型ほど強め)
    if (Game.Render.shake) Game.Render.shake(m.def.boss ? 8 : m.def.big ? 5 : 3);
    Game.Player.gainXP(Math.round((m.def.xp || 1) * (1 + (Game.state.ngLevel || 0) * 0.2)) * (m.elite ? 3 : 1)); // 強い敵(NG)・精鋭ほど経験値増
    if (Game.Achievements && m.def.hostile) Game.Achievements.unlock('first_night');
    // 精鋭撃破演出＆実績
    if (m.elite) {
      const af = m.eliteAffix && Game.ELITE_AFFIXES[m.eliteAffix];
      const prefix = af ? af.name : '精鋭の';
      const auraC = m.champion ? '#ff5ac8' : (af ? af.aura : '#ffd86b');
      Game.Render.flash(auraC);
      Game.Render.spawnParticles(m.x, m.y, auraC, m.champion ? 44 : 22);
      Game.state.eliteKills = (Game.state.eliteKills || 0) + 1;
      if (Game.Achievements) Game.Achievements.unlock('elite_hunter');
      if (m.champion) {
        // チャンピオン: 確定で複数レア戦利品(高品質ギア2点＋宝珠＋低確率で書)を地面に生成
        const champDrops = [];
        if (Game.Loot.rollEliteDrop) { champDrops.push.apply(champDrops, Game.Loot.rollEliteDrop(m.def)); champDrops.push.apply(champDrops, Game.Loot.rollEliteDrop(m.def)); }
        champDrops.push({ id: 'xp_orb', count: 1 });
        if (Math.random() < 0.25) champDrops.push({ id: 'wisdom_tome', count: 1 });
        if (Math.random() < 0.22 && Game.RELIC_IDS) champDrops.push({ id: Game.RELIC_IDS[Math.floor(Math.random() * Game.RELIC_IDS.length)], count: 1 }); // 遺物
        for (let g = 0; g < champDrops.length; g++) Game.state.drops.push({ id: champDrops[g].id, count: champDrops[g].count, roll: champDrops[g].roll || null, x: m.x + (Math.random() - 0.5) * 22, y: m.y + (Math.random() - 0.5) * 22 });
        Game.Player.gainXP(Math.round((m.def.xp || 1) * 5)); // チャンピオンは追加経験値
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.7, 'CHAMPION撃破!!', '#ff8ad8', true);
        Game.UI.toast('★ ' + (m.championName || 'チャンピオン') + ' を討伐！ 財宝を手にした');
        Game.state.championKills = (Game.state.championKills || 0) + 1;
        if (Game.Achievements) Game.Achievements.unlock('champion_slayer');
      } else {
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(m.x, m.y - m.def.size * 0.6, '精鋭撃破!', '#ffd86b', true);
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
      // 撃破アニメムービー（ローカル再生）
      if (Game.Cutscene && Game.Cutscene.playBossOutro && !(Game.Net.isConnected() && !Game.Net.host)) {
        Game.state.paused = true;
        const bt = m.type;
        Game.Cutscene.playBossOutro(bt, function () { Game.state.paused = false; });
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
      const r = m.def.size * 0.5 * (m.champion ? 1.55 : m.elite ? 1.3 : 1);
      const hop = m.def.hop ? Math.abs(Math.sin(m.hopPhase)) * 5 : 0;
      ctx.save();
      // 精鋭オーラ: 脈動する金色の発光リング
      if (m.elite || m.bountyBoss) {
        m.auraPhase = (m.auraPhase || 0) + 0.08;
        const pulse = 0.5 + Math.sin(m.auraPhase) * 0.5;
        const ar = r * (1.7 + pulse * 0.25);
        const rgb = m.auraRGB || [255, 216, 107];
        const cs = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
        const grd = ctx.createRadialGradient(s.x, s.y - hop, r * 0.6, s.x, s.y - hop, ar);
        grd.addColorStop(0, 'rgba(' + cs + ',0)');
        grd.addColorStop(0.7, 'rgba(' + cs + ',' + (0.18 + pulse * 0.14) + ')');
        grd.addColorStop(1, 'rgba(' + cs + ',0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(s.x, s.y - hop, ar, 0, Math.PI * 2); ctx.fill();
      }
      if (m.def.ghost) ctx.globalAlpha = 0.7 + Math.sin(m.hopPhase * 0.5) * 0.15;
      ctx.translate(s.x, s.y - hop);
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, r + hop, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // 本体（形状バリエーション）
      ctx.fillStyle = m.hurt > 0 ? '#fff' : m.def.color;
      const shape = m.def.shape || (m.type === 'slime' ? 'blob' : m.type === 'spider' ? 'spider' : 'round');
      let eyeY = -r * 0.3;
      if (shape === 'blob') {
        roundRect(ctx, -r, -r * 0.7, r * 2, r * 1.5, 6); ctx.fill();
      } else if (shape === 'spider') {
        ctx.strokeStyle = m.def.color; ctx.lineWidth = 2;
        for (let a = 0; a < 4; a++) { const ang = a * 0.5 + 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      } else if (shape === 'tall') {
        // 巨人系: 縦長の胴体＋頭＋肩
        roundRect(ctx, -r * 0.7, -r * 1.3, r * 1.4, r * 2.3, 5); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r * 1.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-r * 0.95, -r * 0.9, r * 0.35, r * 1.1); ctx.fillRect(r * 0.6, -r * 0.9, r * 0.35, r * 1.1);
        eyeY = -r * 1.3;
      } else if (shape === 'orb') {
        // 浮遊する眼
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
        const ex0 = m.dir === 'left' ? -r * 0.25 : m.dir === 'right' ? r * 0.25 : 0;
        ctx.fillStyle = '#c0203a'; ctx.beginPath(); ctx.arc(ex0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      } else if (shape === 'wisp') {
        // 揺らめく霊体
        ctx.beginPath(); ctx.moveTo(0, -r);
        for (let a = 1; a <= 8; a++) { const ang = a / 8 * Math.PI * 2; const rr = r * (a % 2 ? 0.78 : 1) * (1 + Math.sin(m.hopPhase + a) * 0.06); ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
      } else if (shape === 'spiky') {
        ctx.beginPath();
        for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2; const rr = a % 2 ? r * 0.55 : r * 1.15; const fn = a === 0 ? 'moveTo' : 'lineTo'; ctx[fn](Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      }
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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { list, update, draw, spawnMob, damageMob, killMob, summonBoss, nearbyNPC, interactNPC, applyMobSnapshot, applyRemoteHit, spawnNetDrops, buildSnapshot };
})();
