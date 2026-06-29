// events.js — 動的ワールドイベント。emergent な「常に何かが起きる」サンドボックス演出
//   流星群(夜): 星のかけらが降る / 物資投下(昼): 補給物資のクレートが落ちてくる
window.Game = window.Game || {};

Game.Events = (function () {
  const SHOWER_DUR = 30 * 22;      // 流星群の継続(約22秒)
  const COOLDOWN = 30 * 100;       // イベント間の最短間隔(約100秒)
  const LAND_EVERY = 130;          // 落下流星の間隔tick→1回で約5発
  const MAX_LAND = 6;

  const SUPPLY = ['bandage', 'cooked_meat', 'bread', 'torch', 'antidote'];

  let cd = 30 * 35;
  let active = null;

  function reset() { cd = 30 * 35; active = null; }
  function current() { return active; }

  function update() {
    const s = Game.state; if (!s || s.paused) return;
    if (active) { active.type === 'meteor' ? tickMeteor(s) : tickSupply(s); return; }
    if (cd > 0) { cd--; return; }
    if (s.worldName === 'light' && !s.bloodMoon && Game.DayNight) {
      const night = Game.DayNight.isNight();
      if (night && Math.random() < 0.02) startMeteor();
      else if (!night && Math.random() < 0.015) startSupply();
      else cd = 30 * 10;           // 不発なら少し待って再抽選
    } else {
      cd = 30 * 6;
    }
  }

  // ---- 流星群 ----
  function startMeteor() {
    active = { type: 'meteor', t: SHOWER_DUR, meteors: [], landed: 0, sinceLand: 0 };
    if (Game.UI) Game.UI.toast('☄️ 流星群だ！ 降り注ぐ星のかけらを集めよう');
    if (Game.Audio) Game.Audio.play('shift');
  }

  function spawnMeteor(land) {
    const p = Game.state.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = land ? (120 + Math.random() * 240) : (60 + Math.random() * 420);
    const lx = p.x + Math.cos(ang) * dist;
    const ly = p.y + Math.sin(ang) * dist;
    const dur = 30 + Math.floor(Math.random() * 16);
    const sx = lx - (220 + Math.random() * 160);
    const sy = ly - (560 + Math.random() * 220);
    return { x: sx, y: sy, lx: lx, ly: ly, vx: (lx - sx) / dur, vy: (ly - sy) / dur, life: dur, land: !!land };
  }

  function tickMeteor(s) {
    const a = active; a.t--; a.sinceLand++;
    if (s.tick % 11 === 0) a.meteors.push(spawnMeteor(false));
    if (a.sinceLand >= LAND_EVERY && a.landed < MAX_LAND && a.t > 30) { a.meteors.push(spawnMeteor(true)); a.sinceLand = 0; }
    for (let i = a.meteors.length - 1; i >= 0; i--) {
      const m = a.meteors[i]; m.x += m.vx; m.y += m.vy; m.life--;
      if (m.life <= 0) { if (m.land) { meteorImpact(m); a.landed++; } a.meteors.splice(i, 1); }
    }
    if (a.t <= 0) { if (Game.UI) Game.UI.toast('流星群が去った…'); active = null; cd = COOLDOWN; }
  }

  function meteorImpact(m) {
    const R = Game.Render;
    if (R) { R.spawnParticles(m.lx, m.ly, '#ffd86b', 16); R.spawnParticles(m.lx, m.ly, '#fff4c0', 8); if (R.shake) R.shake(7); }
    if (Game.Audio) Game.Audio.play('thunder');
    const drops = Game.state.drops;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) drops.push({ id: 'star_metal', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Math.random() < 0.15) drops.push({ id: 'star_core', count: 1, x: m.lx + (Math.random() - 0.5) * 18, y: m.ly + (Math.random() - 0.5) * 18 });
    if (Math.random() < 0.3) drops.push({ id: 'gold_bar', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Game.Achievements) Game.Achievements.unlock('stargazer');
  }

  // ---- 物資投下 ----
  function startSupply() {
    active = { type: 'supply', t: 30 * 14, crates: [], spawned: 0, toSpawn: 2 + Math.floor(Math.random() * 2), sinceSpawn: 999 };
    if (Game.UI) Game.UI.toast('📦 物資が投下された！ 落下地点へ急げ');
    if (Game.Audio) Game.Audio.play('shift');
  }

  function spawnCrate() {
    const p = Game.state.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 220;
    const lx = p.x + Math.cos(ang) * dist;
    const ly = p.y + Math.sin(ang) * dist;
    const dur = 42 + Math.floor(Math.random() * 16);
    return { x: lx, y: ly - 520, lx: lx, ly: ly, vy: 520 / dur, life: dur };
  }

  function tickSupply(s) {
    const a = active; a.t--; a.sinceSpawn++;
    if (a.spawned < a.toSpawn && a.sinceSpawn >= 60) { a.crates.push(spawnCrate()); a.spawned++; a.sinceSpawn = 0; }
    for (let i = a.crates.length - 1; i >= 0; i--) {
      const c = a.crates[i]; c.y += c.vy; c.life--;
      if (c.life <= 0) { supplyLand(c); a.crates.splice(i, 1); }
    }
    if (a.t <= 0 && a.crates.length === 0) { active = null; cd = COOLDOWN; }
  }

  function supplyLand(c) {
    const R = Game.Render;
    if (R) { R.spawnParticles(c.lx, c.ly, '#caa86a', 12); if (R.shake) R.shake(4); }
    if (Game.Audio) Game.Audio.play('place');
    const drops = Game.state.drops;
    const n = 2 + Math.floor(Math.random() * 3); // 2〜4
    for (let k = 0; k < n; k++) { const id = SUPPLY[Math.floor(Math.random() * SUPPLY.length)]; drops.push({ id: id, count: 1, x: c.lx + (Math.random() - 0.5) * 26, y: c.ly + (Math.random() - 0.5) * 26 }); }
    if (Math.random() < 0.5) drops.push({ id: 'gold_bar', count: 1, x: c.lx + (Math.random() - 0.5) * 18, y: c.ly + (Math.random() - 0.5) * 18 });
    if (Math.random() < 0.2) drops.push({ id: 'bomb', count: 1, x: c.lx + (Math.random() - 0.5) * 18, y: c.ly + (Math.random() - 0.5) * 18 });
    if (Game.Achievements) Game.Achievements.unlock('scavenger');
  }

  // ---- 描画 ----
  // 報酬地点(着弾流星/クレート)へ誘導: 画面内=脈動リング, 画面外=端の矢印
  function drawGuide(ctx, cam, v, wx, wy, color) {
    const s = cam.worldToScreen(wx, wy);
    const margin = 30;
    if (s.x >= margin && s.x <= v.w - margin && s.y >= margin && s.y <= v.h - margin) {
      const pulse = 3 + Math.sin(Game.state.tick * 0.2) * 2;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10 + pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      const cx = v.w / 2, cy = v.h / 2; const dx = s.x - cx, dy = s.y - cy;
      const ex = v.w / 2 - margin, ey = v.h / 2 - margin;
      const scale = Math.min(ex / Math.max(Math.abs(dx), 1), ey / Math.max(Math.abs(dy), 1));
      const ax = cx + dx * scale, ay = cy + dy * scale; const ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function draw(ctx) {
    if (!active) return;
    const cam = Game.Camera;
    ctx.save();
    if (active.type === 'meteor') {
      for (let i = 0; i < active.meteors.length; i++) {
        const m = active.meteors[i];
        const head = cam.worldToScreen(m.x, m.y);
        const tail = cam.worldToScreen(m.x - m.vx * 7, m.y - m.vy * 7);
        ctx.strokeStyle = 'rgba(255,232,160,0.55)'; ctx.lineWidth = m.land ? 3 : 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
        ctx.fillStyle = m.land ? '#fff' : '#ffe9a0';
        ctx.beginPath(); ctx.arc(head.x, head.y, m.land ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill();
        if (m.land) { ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill(); }
      }
    } else {
      for (let i = 0; i < active.crates.length; i++) {
        const c = active.crates[i];
        const s = cam.worldToScreen(c.x, c.y);
        // パラシュート
        ctx.fillStyle = 'rgba(220,210,180,0.9)';
        ctx.beginPath(); ctx.arc(s.x, s.y - 22, 13, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(120,110,90,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 22); ctx.lineTo(s.x - 6, s.y - 6); ctx.moveTo(s.x + 12, s.y - 22); ctx.lineTo(s.x + 6, s.y - 6); ctx.stroke();
        // クレート
        ctx.fillStyle = '#9c6b3f'; ctx.fillRect(s.x - 7, s.y - 7, 14, 14);
        ctx.strokeStyle = '#5e3f23'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 7, s.y - 7, 14, 14);
        ctx.beginPath(); ctx.moveTo(s.x - 7, s.y); ctx.lineTo(s.x + 7, s.y); ctx.moveTo(s.x, s.y - 7); ctx.lineTo(s.x, s.y + 7); ctx.stroke();
      }
    }

    // 誘導マーカー: 報酬地点へ
    const v = Game.view;
    const gcol = active.type === 'meteor' ? '#ffe27a' : '#caa86a';
    const targets = active.type === 'meteor' ? active.meteors.filter(function (m) { return m.land; }) : active.crates;
    for (let i = 0; i < targets.length; i++) drawGuide(ctx, cam, v, targets[i].lx, targets[i].ly, gcol);

    // 上部バナー: イベント名＋残り時間
    const secs = Math.max(0, Math.ceil(active.t / 30));
    const label = (active.type === 'meteor' ? '☄️ 流星群' : '📦 物資投下') + '  残り ' + secs + 's';
    ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width; const bw = tw + 28, bx = v.w / 2 - bw / 2, by = 6;
    ctx.fillStyle = 'rgba(12,18,28,0.66)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 26, 8); ctx.fill(); } else ctx.fillRect(bx, by, bw, 26);
    ctx.fillStyle = gcol; ctx.fillText(label, v.w / 2, by + 13);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  return { update, draw, reset, current };
})();
