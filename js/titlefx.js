// titlefx.js — タイトル画面の生きた背景演出 + コントローラ操作
// ゲーム本編の決定論には一切触れない純演出。title-screen が可視の間だけ rAF 稼働。
(function () {
  'use strict';
  const Game = window.Game = window.Game || {};

  // ---- 安定した擬似乱数(星の配置などが毎フレーム再生成されないように一度だけ) ----
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  let canvas, ctx, W = 0, H = 0, dpr = 1, raf = 0, t0 = 0, running = false;
  let stars = [], ridges = [], trees = [], motes = [], shoot = null, shootTimer = 3;

  function build() {
    const rnd = mulberry(1337);
    // 星: 影(右)側ほど密。twinkle 位相を持たせる
    stars = [];
    for (let i = 0; i < 150; i++) {
      const x = rnd(), y = rnd() * 0.62;
      const shadowBias = 0.5 + x * 0.5; // 右ほど出やすい
      if (rnd() > shadowBias * 0.85) continue;
      stars.push({ x: x, y: y, r: 0.4 + rnd() * 1.5, ph: rnd() * 6.28, sp: 0.6 + rnd() * 2.2, warm: x < 0.5 });
    }
    // 稜線: 3レイヤー(奥=淡, 手前=濃)。sin合成で自然な山影
    ridges = [];
    const cols = ['#1a2740', '#141d33', '#0d1424'];
    for (let l = 0; l < 3; l++) {
      const pts = [];
      const base = 0.58 + l * 0.11;
      const amp = 0.10 - l * 0.02;
      const f1 = 1.2 + l * 0.7, f2 = 2.8 + l * 1.3, ph = rnd() * 6.28;
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        const yy = base - (Math.sin(u * 6.28 * f1 + ph) * amp + Math.sin(u * 6.28 * f2 + ph * 2) * amp * 0.4) - (rnd() - 0.5) * 0.01;
        pts.push(yy);
      }
      ridges.push({ pts: pts, col: cols[l], drift: (l + 1) * 0.004, y: base });
    }
    // 手前の木シルエット
    trees = [];
    for (let i = 0; i < 9; i++) trees.push({ x: rnd(), h: 0.05 + rnd() * 0.05, w: 0.012 + rnd() * 0.01 });
    // 浮遊する光/影の粒子
    motes = [];
    for (let i = 0; i < 34; i++) motes.push({ x: rnd(), y: rnd(), r: 0.6 + rnd() * 1.8, sp: 0.004 + rnd() * 0.012, ph: rnd() * 6.28, warm: rnd() < 0.5 });
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time) {
    if (!ctx) return;
    const t = time * 0.001;
    // 昼夜のゆっくりした呼吸(0=夜寄り 1=薄明)
    const cyc = 0.5 + 0.5 * Math.sin(t * 0.05);
    ctx.clearRect(0, 0, W, H);

    // ---- 空: 光(左/緑金) と 影(右/紫藍) の二相グラデ ----
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgb(${10 + cyc * 18},${16 + cyc * 26},${34 + cyc * 20})`);
    g.addColorStop(0.5, `rgb(${18 + cyc * 10},${14 + cyc * 8},${40 + cyc * 12})`);
    g.addColorStop(1, `rgb(${16 + cyc * 6},${10 + cyc * 4},${30 + cyc * 10})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 光側のグロー(左上, 緑金)と影側のグロー(右下, 紫)
    const glowL = ctx.createRadialGradient(W * 0.24, H * 0.30, 0, W * 0.24, H * 0.30, W * 0.5);
    glowL.addColorStop(0, `rgba(110,200,120,${0.16 + cyc * 0.10})`); glowL.addColorStop(1, 'rgba(110,200,120,0)');
    ctx.fillStyle = glowL; ctx.fillRect(0, 0, W, H);
    const glowR = ctx.createRadialGradient(W * 0.80, H * 0.68, 0, W * 0.80, H * 0.68, W * 0.5);
    glowR.addColorStop(0, 'rgba(150,90,220,0.16)'); glowR.addColorStop(1, 'rgba(150,90,220,0)');
    ctx.fillStyle = glowR; ctx.fillRect(0, 0, W, H);

    // ---- 天体: 二相の月(光=金, 影=紫) ----
    const moonX = W * (0.72 + Math.sin(t * 0.03) * 0.02), moonY = H * 0.20, mr = Math.min(W, H) * 0.075;
    const halo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, mr * 3.2);
    halo.addColorStop(0, 'rgba(232,197,120,0.22)'); halo.addColorStop(0.5, 'rgba(150,110,220,0.10)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(moonX, moonY, mr * 3.2, 0, 6.2832); ctx.fill();
    const mg = ctx.createLinearGradient(moonX - mr, moonY, moonX + mr, moonY);
    mg.addColorStop(0, '#f6e6b0'); mg.addColorStop(0.55, '#e8c86a'); mg.addColorStop(1, '#9a7ad8');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(moonX, moonY, mr, 0, 6.2832); ctx.fill();

    // ---- 星 + またたき ----
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * s.sp + s.ph));
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = s.warm ? '#ffe9b0' : '#cfe0ff';
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- オーロラのリボン(影側に流れる) ----
    for (let a = 0; a < 2; a++) {
      const baseY = H * (0.16 + a * 0.09);
      const hue = a === 0 ? '110,220,150' : '160,110,230';
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, x = u * W;
        const y = baseY + Math.sin(u * 6.28 * 1.5 + t * 0.4 + a) * 16 + Math.sin(u * 6.28 * 3 + t * 0.7) * 7;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 20 + 8 * Math.sin(t * 0.5 + a);
      ctx.strokeStyle = `rgba(${hue},0.06)`;
      ctx.stroke();
    }

    // ---- 流れ星 ----
    shootTimer -= 0.016;
    if (!shoot && shootTimer <= 0) { shoot = { x: 0.2 + Math.random() * 0.5, y: 0.05 + Math.random() * 0.25, life: 1 }; }
    if (shoot) {
      shoot.life -= 0.02; shoot.x += 0.012; shoot.y += 0.006;
      const sx = shoot.x * W, sy = shoot.y * H;
      const tg = ctx.createLinearGradient(sx - 60, sy - 30, sx, sy);
      tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, `rgba(255,250,220,${Math.max(0, shoot.life)})`);
      ctx.strokeStyle = tg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 60, sy - 30); ctx.lineTo(sx, sy); ctx.stroke();
      if (shoot.life <= 0) { shoot = null; shootTimer = 4 + Math.random() * 7; }
    }

    // ---- 稜線(パララックス) ----
    for (let l = 0; l < ridges.length; l++) {
      const r = ridges[l], off = Math.sin(t * r.drift * 6) * 8;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i < r.pts.length; i++) { const x = (i / (r.pts.length - 1)) * W + off; ctx.lineTo(x, r.pts[i] * H); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = r.col; ctx.fill();
    }

    // ---- 前景の木シルエット ----
    ctx.fillStyle = '#080d18';
    const groundY = ridges[2].y * H + 0.09 * H;
    ctx.fillRect(0, groundY, W, H - groundY);
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i], x = tr.x * W, w = tr.w * W, h = tr.h * H;
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x - w, groundY - h * 0.4); ctx.lineTo(x, groundY - h);
      ctx.lineTo(x + w, groundY - h * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 1, groundY - h * 0.4, 2, h * 0.4);
    }

    // ---- 浮遊粒子 ----
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.y -= m.sp * 0.6; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      const fx = (m.x + Math.sin(t * 0.5 + m.ph) * 0.01) * W, fy = m.y * H;
      const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + m.ph));
      ctx.globalAlpha = a; ctx.fillStyle = m.warm ? '#ffe6a0' : '#c9a8ff';
      ctx.beginPath(); ctx.arc(fx, fy, m.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- 周辺減光(vignette) ----
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ===== コントローラでタイトル操作 =====
  const padPrev = {};
  function padEdge(gp, i) { const p = gp.buttons[i] && gp.buttons[i].pressed; const e = p && !padPrev[i]; padPrev[i] = p; return e; }
  let axLatch = 0;
  function focusables() {
    const box = document.querySelector('#title-screen .title-box'); if (!box) return [];
    const sel = '#btn-continue:not([disabled]), #btn-new, .diff-btn, #btn-host, #btn-join, .title-acc > summary';
    return Array.prototype.slice.call(box.querySelectorAll(sel)).filter(function (el) {
      return el.offsetParent !== null; // 非表示(details閉時の中身)は除外
    });
  }
  let focusIdx = -1;
  function setFocus(idx) {
    const list = focusables(); if (!list.length) return;
    document.querySelectorAll('#title-screen .pad-focus').forEach(function (e) { e.classList.remove('pad-focus'); });
    focusIdx = ((idx % list.length) + list.length) % list.length;
    const el = list[focusIdx]; el.classList.add('pad-focus');
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  function moveFocus(dir) {
    const list = focusables(); if (!list.length) return;
    if (focusIdx < 0) { setFocus(0); return; }
    setFocus(focusIdx + dir);
  }
  function activateFocus() {
    const list = focusables(); if (focusIdx < 0 || focusIdx >= list.length) { setFocus(0); return; }
    const el = list[focusIdx];
    if (Game.Audio && Game.Audio.startBGM) { try { Game.Audio.startBGM('title'); } catch (e) {} }
    el.click();
    // details を開いたら中身が焦点候補に加わる。リストがずれないよう再取得
    setTimeout(function () { const l2 = focusables(); if (focusIdx >= l2.length) setFocus(0); }, 30);
  }

  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (let i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) return;
    document.body.classList.add('has-pad');
    if (focusIdx < 0) setFocus(0);
    // dpad 上下 + 左スティック縦
    const ay = gp.axes[1] || 0;
    let navDir = 0;
    if (padEdge(gp, 12)) navDir = -1;      // ↑
    else if (padEdge(gp, 13)) navDir = 1;  // ↓
    // diff行など横並びは左右でも移動
    else if (padEdge(gp, 14)) navDir = -1; // ←
    else if (padEdge(gp, 15)) navDir = 1;  // →
    if (navDir) { moveFocus(navDir); axLatch = 0; }
    else if (Math.abs(ay) > 0.55) { if (axLatch <= 0) { moveFocus(ay < 0 ? -1 : 1); axLatch = 9; } else axLatch--; }
    else axLatch = 0;
    // ✕(0)=決定 / OPTIONS(9)=はじめる / ◯(1)=details閉じる
    if (padEdge(gp, 0)) activateFocus();
    if (padEdge(gp, 9)) { const nb = document.getElementById('btn-new'); if (nb) { if (Game.Audio) try { Game.Audio.startBGM('title'); } catch (e) {} nb.click(); } }
    if (padEdge(gp, 1)) { document.querySelectorAll('#title-screen .title-acc[open]').forEach(function (d) { d.removeAttribute('open'); }); }
    // prev 更新漏れ防止
    for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = gp.buttons[i] && gp.buttons[i].pressed;
  }

  let padAccum = 0;
  function loop(time) {
    if (!running) return;
    if (!t0) t0 = time;
    draw(time);
    padAccum += 1; if (padAccum >= 3) { padAccum = 0; try { pollPad(); } catch (e) {} } // ~20Hz
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    canvas = document.getElementById('title-fx'); if (!canvas) return;
    ctx = canvas.getContext('2d');
    build(); resize();
    running = true; t0 = 0; raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    document.querySelectorAll('#title-screen .pad-focus').forEach(function (e) { e.classList.remove('pad-focus'); });
  }

  window.addEventListener('resize', resize);
  document.addEventListener('DOMContentLoaded', function () {
    const ts = document.getElementById('title-screen');
    if (!ts) return;
    if (!ts.classList.contains('hidden')) start();
    // タイトルの表示/非表示に追従(ゲーム開始で hidden → stop, タイトルへ戻ると start)
    const mo = new MutationObserver(function () {
      if (ts.classList.contains('hidden')) stop(); else start();
    });
    mo.observe(ts, { attributes: true, attributeFilter: ['class'] });
  });

  Game.TitleFX = { start: start, stop: stop };
})();
