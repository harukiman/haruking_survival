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
    Game.state.mobs.push({
      type: type, def: def,
      x: wx, y: wy, prevX: wx, prevY: wy,
      hp: hp, maxHp: hp, dmg: Math.round(def.dmg * dmgMult),
      vx: 0, vy: 0, dir: 'down',
      state: 'wander', stateTimer: 0, attackCd: 0,
      hurt: 0, fleeTimer: 0, hopPhase: Math.random() * 6,
      knockX: 0, knockY: 0,
    });
  }

  // 周辺の空き walkable タイルを探してスポーン
  function trySpawn() {
    if (Game.state.mobs.length >= TUNE.MOB_CAP) return;
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
        const pool = Game.World.inDepths()
          ? ['wraith', 'watcher', 'abyss_stalker', 'abyss_stalker', 'spider']
          : ['wraith', 'wraith', 'watcher', 'spider'];
        type = pool[Math.floor(Math.random() * pool.length)];
      } else if (night && diff.spawnHostiles) {
        // 夜は敵対モブ（のんびりは出ない）。血の月は強敵寄り
        const pool = Game.state.bloodMoon
          ? ['zombie', 'zombie', 'skeleton', 'spider', 'leech']
          : ['zombie', 'skeleton', 'spider', 'slime', 'leech'];
        type = pool[Math.floor(Math.random() * pool.length)];
      } else {
        // 昼は動物（草地/森）。稀に謎の旅人
        if (g === Game.TILE.GRASS || g === Game.TILE.FOREST) {
          if (Math.random() < 0.04 && countType('wanderer') === 0) type = 'wanderer';
          else { const pool = ['rabbit', 'deer', 'sheep']; type = pool[Math.floor(Math.random() * pool.length)]; }
        } else if (g === Game.TILE.STONE && Math.random() < 0.3) {
          type = 'slime';
        }
      }
      if (type) { spawnMob(type, wx, wy); return; }
    }
  }

  function moveMob(m, dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
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
    const mobs = Game.state.mobs;
    const p = Game.state.player;

    if (Game.state.tick % TUNE.SPAWN_INTERVAL === 0) { trySpawn(); if (Game.state.bloodMoon) { trySpawn(); trySpawn(); } }

    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      m.prevX = m.x; m.prevY = m.y;
      if (m.hurt > 0) m.hurt--;
      if (m.attackCd > 0) m.attackCd--;
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

      if (m.def.hostile) {
        const aggro = (m.def.boss ? 22 : 13) * TS;
        // ボスは手下を召喚
        if (m.def.boss && m.attackCd <= 0 && Game.state.tick % 200 === 0 && countType('shadow_spawn') < 8) {
          for (let k = 0; k < 3; k++) spawnMob('shadow_spawn', m.x + (Math.random() - 0.5) * 60, m.y + (Math.random() - 0.5) * 60);
          Game.Audio.play('shift');
        }
        // 敵対: プレイヤーを追跡
        if (distP < aggro) {
          moveMob(m, dxp, dyp, m.def.speed);
          // 接触攻撃
          if (distP < (m.def.size * 0.5 + 12) && m.attackCd <= 0) {
            Game.Survival.damage(m.dmg || m.def.dmg, 'mob');
            if (m.def.inflict) for (const k in m.def.inflict) Game.Status.add(k, m.def.inflict[k]);
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
    if (m.traded) { Game.UI.toast('旅人：「達者でな」'); return; }
    m.traded = true;
    const gifts = ['bandage', 'antidote', 'apple', 'lumen', 'torch', 'cooked_meat', 'iron'];
    const gift = gifts[Math.floor(Math.random() * gifts.length)];
    const n = 1 + Math.floor(Math.random() * 2);
    Game.Inventory.add(gift, n);
    Game.UI.toast('旅人：「' + WANDER_LINES[Math.floor(Math.random() * WANDER_LINES.length)] + '」（' + Game.ITEMS[gift].name + '×' + n + '）');
    Game.Audio.play('craft');
    m.fleeTimer = 0; m.leaveTimer = 200; // 少ししたら去る
    Game.UI.refreshAll();
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
  function damageMob(m, dmg, fromX, fromY) {
    m.hp -= dmg;
    m.hurt = 8;
    Game.Render.spawnBlood(m.x, m.y, 5);
    const dx = m.x - fromX, dy = m.y - fromY, l = Math.hypot(dx, dy) || 1;
    m.knockX = (dx / l) * 7; m.knockY = (dy / l) * 7;
    if (!m.def.hostile) m.fleeTimer = 180; // 動物は逃げる
    Game.Audio.play('hit');
    if (m.hp <= 0) killMob(m);
  }

  function killMob(m) {
    const idx = Game.state.mobs.indexOf(m);
    if (idx >= 0) Game.state.mobs.splice(idx, 1);
    // ドロップ
    if (m.def.drops) {
      m.def.drops.forEach(function (d) {
        const n = Game.Utils.randInt(Math.random, d.n[0], d.n[1]);
        for (let k = 0; k < n; k++) {
          Game.state.drops.push({ id: d.item, count: 1, x: m.x + (Math.random() - 0.5) * 14, y: m.y + (Math.random() - 0.5) * 14 });
        }
      });
    }
    // ハクスラ: rolled装備ドロップ
    const gear = Game.Loot.rollMobDrop(m.def, m.x, m.y);
    for (let g = 0; g < gear.length; g++) Game.state.drops.push(gear[g]);
    Game.Render.spawnParticles(m.x, m.y, m.def.color, m.def.boss ? 40 : 10);
    Game.Render.spawnBlood(m.x, m.y, m.def.boss ? 24 : 8);
    Game.Player.gainXP(m.def.xp || 1);
    if (Game.Achievements && m.def.hostile) Game.Achievements.unlock('first_night');
    if (m.def.boss) {
      Game.Render.flash('#c060ff');
      Game.UI.toast('影の主を打ち倒した！ 影核を手にした');
      if (Game.Achievements) Game.Achievements.unlock('boss_slain');
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
      const r = m.def.size * 0.5;
      const hop = m.def.hop ? Math.abs(Math.sin(m.hopPhase)) * 5 : 0;
      ctx.save();
      if (m.def.ghost) ctx.globalAlpha = 0.7 + Math.sin(m.hopPhase * 0.5) * 0.15;
      ctx.translate(s.x, s.y - hop);
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, r + hop, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // 本体
      ctx.fillStyle = m.hurt > 0 ? '#fff' : m.def.color;
      if (m.type === 'slime') {
        roundRect(ctx, -r, -r * 0.7, r * 2, r * 1.5, 5); ctx.fill();
      } else if (m.type === 'spider') {
        ctx.strokeStyle = m.def.color; ctx.lineWidth = 2;
        for (let a = 0; a < 4; a++) { const ang = a * 0.5 + 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(ang) * r * 1.6, Math.sin(ang) * r); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      }
      // 目
      if (m.type !== 'slime' || true) {
        ctx.fillStyle = m.def.hostile ? '#e33' : '#222';
        const ex = m.dir === 'left' ? -2 : m.dir === 'right' ? 2 : 0;
        ctx.fillRect(-3 + ex, -r * 0.3, 2, 2); ctx.fillRect(2 + ex, -r * 0.3, 2, 2);
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

  return { list, update, draw, spawnMob, damageMob, killMob, summonBoss, nearbyNPC, interactNPC };
})();
