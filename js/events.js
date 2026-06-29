// events.js — 動的ワールドイベント（流星群など）。emergent な「常に何かが起きる」サンドボックス演出
window.Game = window.Game || {};

Game.Events = (function () {
  const SHOWER_DUR = 30 * 22;      // 流星群の継続(約22秒)
  const COOLDOWN = 30 * 100;       // イベント間の最短間隔(約100秒)
  const LAND_EVERY = 130;          // 落下流星の間隔tick(約4.3秒)→1回の流星群で約5発
  const MAX_LAND = 6;              // 1回の流星群での落下上限

  let cd = 30 * 35;                // 初回までの猶予
  let active = null;               // { type, t, meteors:[], landed }

  function reset() { cd = 30 * 35; active = null; }
  function current() { return active; }

  function update() {
    const s = Game.state; if (!s || s.paused) return;
    if (active) { tickActive(s); return; }
    if (cd > 0) { cd--; return; }
    // 流星群は地上(光の世界)の夜のみ。血の月の夜は荒天演出が被るので避ける
    if (s.worldName === 'light' && Game.DayNight && Game.DayNight.isNight() && !s.bloodMoon) {
      if (Math.random() < 0.02) startShower();
      else cd = 30 * 10;           // 不発なら少し待って再抽選
    } else {
      cd = 30 * 6;
    }
  }

  function startShower() {
    active = { type: 'meteor', t: SHOWER_DUR, meteors: [], landed: 0, sinceLand: 0 };
    if (Game.UI) Game.UI.toast('☄️ 流星群だ！ 降り注ぐ星のかけらを集めよう');
    if (Game.Audio) Game.Audio.play('shift');
  }

  function spawnMeteor(land) {
    const p = Game.state.player;
    // 着弾点はプレイヤー周辺(視界内)。装飾流星は適当な近傍
    const ang = Math.random() * Math.PI * 2;
    const dist = land ? (120 + Math.random() * 240) : (60 + Math.random() * 420);
    const lx = p.x + Math.cos(ang) * dist;
    const ly = p.y + Math.sin(ang) * dist;
    const dur = 30 + Math.floor(Math.random() * 16);
    // 上空(左上寄り)から斜めに落下
    const sx = lx - (220 + Math.random() * 160);
    const sy = ly - (560 + Math.random() * 220);
    return { x: sx, y: sy, lx: lx, ly: ly, vx: (lx - sx) / dur, vy: (ly - sy) / dur, life: dur, land: !!land };
  }

  function tickActive(s) {
    const a = active; a.t--; a.sinceLand++;
    // 装飾の流れ星(着弾しない)を頻繁に
    if (s.tick % 11 === 0) a.meteors.push(spawnMeteor(false));
    // 一定間隔で着弾流星(報酬付き)
    if (a.sinceLand >= LAND_EVERY && a.landed < MAX_LAND && a.t > 30) {
      a.meteors.push(spawnMeteor(true)); a.sinceLand = 0;
    }
    for (let i = a.meteors.length - 1; i >= 0; i--) {
      const m = a.meteors[i]; m.x += m.vx; m.y += m.vy; m.life--;
      if (m.life <= 0) {
        if (m.land) { impact(m); a.landed++; }
        a.meteors.splice(i, 1);
      }
    }
    if (a.t <= 0) {
      if (Game.UI) Game.UI.toast('流星群が去った…');
      active = null; cd = COOLDOWN;
    }
  }

  function impact(m) {
    const R = Game.Render;
    if (R) { R.spawnParticles(m.lx, m.ly, '#ffd86b', 16); R.spawnParticles(m.lx, m.ly, '#fff4c0', 8); if (R.shake) R.shake(7); }
    if (Game.Audio) Game.Audio.play('thunder');
    // 報酬: 星鋼を中心に、稀に星核。地上では入手困難な宇宙素材を流星群で得られる
    const drops = Game.state.drops;
    const n = 1 + Math.floor(Math.random() * 2);   // 星鋼1〜2
    for (let k = 0; k < n; k++) drops.push({ id: 'star_metal', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Math.random() < 0.15) drops.push({ id: 'star_core', count: 1, x: m.lx + (Math.random() - 0.5) * 18, y: m.ly + (Math.random() - 0.5) * 18 });
    if (Math.random() < 0.3) drops.push({ id: 'gold_bar', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Game.Achievements) Game.Achievements.unlock('stargazer');
  }

  function draw(ctx) {
    if (!active) return;
    const cam = Game.Camera;
    ctx.save();
    for (let i = 0; i < active.meteors.length; i++) {
      const m = active.meteors[i];
      const head = cam.worldToScreen(m.x, m.y);
      const tail = cam.worldToScreen(m.x - m.vx * 7, m.y - m.vy * 7);
      // 尾(グラデ風に2本)
      ctx.strokeStyle = 'rgba(255,232,160,0.55)'; ctx.lineWidth = m.land ? 3 : 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      // 頭(発光)
      ctx.fillStyle = m.land ? '#fff' : '#ffe9a0';
      ctx.beginPath(); ctx.arc(head.x, head.y, m.land ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill();
      if (m.land) { ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  return { update, draw, reset, current };
})();
