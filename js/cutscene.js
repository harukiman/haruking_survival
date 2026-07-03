// cutscene.js — はじめから時のアニメーション・オープニング（二相世界の神話）
window.Game = window.Game || {};

Game.Cutscene = (function () {
  let cv, ctx, raf, onDone, t0, skipBtn, playing = false, W = 0, H = 0, curScene = -1, shakeMag = 0, clickArmedAt = 0;
  let curScenes = null, curTotal = 0, bgCol = '#03040a', subduedMode = false, lastSc = null;
  let prevDraw = null, prevUntilE = 0, typeStart = 0, typeDone = false;
  let grainPat = null, vinGrad = null, holdTimer = 0, layoutCache = { t: '', w: 0, lines: [] };

  // ===== イージング =====
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // 再見時は粒子を半減(モバイル負荷/控えめ演出)
  function pn(n) { return subduedMode ? (n / 2) | 0 : n; }

  // タップ=文章即時表示→次シーン送り / 長押し600ms=全スキップ
  // (モバイルで「はじめから」タップが新規キャンバスへ貫通するのを clickArmedAt で防ぐ)
  function onPointerDown() {
    if (!playing || performance.now() < clickArmedAt) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { finish(); }, 600);
  }
  function onPointerUp() {
    clearTimeout(holdTimer);
    if (!playing || performance.now() < clickArmedAt) return;
    if (!typeDone) typeDone = true;
    else advanceScene();
  }
  function onPointerCancel() { clearTimeout(holdTimer); }
  function advanceScene() {
    if (!curScenes) { finish(); return; }
    let acc = 0;
    for (let i = 0; i <= curScene && i < curScenes.length; i++) acc += curScenes[i].d;
    if (acc >= curTotal - 1) { finish(); return; }
    t0 = performance.now() - acc;
  }

  const SCENES = [
    { d: 4400, draw: sceneUnified, text: 'かつて、世界はひとつだった。', onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('swell'); } },
    { d: 4600, draw: scenePrayers, text: '「永遠の昼」を願う者と、「安らぎの夜」を望む者。', onEnter: function () { Game.Audio.cue('choir'); } },
    { d: 2600, draw: sceneTension, text: 'ふたつの祈りは、譲らなかった——', shake: 0.35, onEnter: function () { Game.Audio.cue('riser'); } },
    { d: 4400, draw: sceneSplit, text: '相反する願いが、大地を引き裂いた。', shake: 1, onEnter: function () { Game.Audio.cue('impact'); Game.Audio.cue('crack'); } },
    { d: 4600, draw: sceneDescend, text: 'いま、あなたは世界の狭間に降り立つ——', shake: 0.2, onEnter: function () { Game.Audio.cue('shimmer'); } },
    { d: 5200, draw: sceneArrival, text: '名も故郷も持たぬまま、ひとりの旅人が、裂けた大地に舞い降りた。', shake: 0.15, onEnter: function () { Game.Audio.cineStart('somber'); Game.Audio.cue('shimmer'); } },
    { d: 5200, draw: sceneTitle, text: '', onEnter: function () { Game.Audio.cue('choir'); Game.Audio.cue('boom'); } },
  ];
  function play(cb) { runScenes(SCENES, cb, { bg: '#05070e', arm: 800 }); }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 周辺減光(サイズ依存なのでリサイズ時に再生成)
    vinGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vinGrad.addColorStop(0, 'rgba(0,0,0,0)'); vinGrad.addColorStop(1, 'rgba(0,0,0,0.34)');
    layoutCache = { t: '', w: 0, lines: [] };
  }

  function finish() {
    if (!playing) return;
    playing = false;
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (Game.Audio && Game.Audio.cineStop) Game.Audio.cineStop();
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    if (skipBtn && skipBtn.parentNode) skipBtn.parentNode.removeChild(skipBtn);
    curScenes = null; lastSc = null; prevDraw = null; grainPat = null;
    if (onDone) onDone();
  }

  // ===== フィルム的オーバーレイ(粒状ノイズ) =====
  function makeGrain() {
    const gc = document.createElement('canvas'); gc.width = gc.height = 96;
    const g = gc.getContext('2d'), img = g.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) { const v = 108 + Math.random() * 148 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    grainPat = ctx.createPattern(gc, 'repeat');
  }
  function drawFilmOverlay(now) {
    if (vinGrad) { ctx.fillStyle = vinGrad; ctx.fillRect(0, 0, W, H); }
    if (grainPat) {
      const ox = (now * 0.61 | 0) % 96, oy = (now * 0.37 | 0) % 96;
      ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
      ctx.translate(-ox, -oy); ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 96, H + 96);
      ctx.restore();
    }
  }
  // レターボックス(冒頭でせり出し、終盤でせり戻る)
  function drawLetterbox(e, total) {
    const lbMax = Math.round(H * 0.055);
    const kIn = easeOutCubic(clamp01(e / 700));
    const kOut = 1 - easeInOutCubic(clamp01((e - (total - 600)) / 600));
    const h = lbMax * kIn * kOut;
    if (h < 1) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  }

  // ===== 台詞: 行組みキャッシュ+タイプライタ表示 =====
  function layoutLines(txt, maxW) {
    if (layoutCache.t === txt && layoutCache.w === W) return layoutCache.lines;
    const out = [];
    txt.split('\n').forEach(function (para) {
      let cur = '';
      for (let i = 0; i < para.length; i++) {
        const ch = para[i];
        if (ctx.measureText(cur + ch).width > maxW && cur) {
          if (ch === '、' || ch === '。' || ch === '」' || ch === '—') { out.push(cur + ch); cur = ''; continue; } // 行頭禁則
          out.push(cur); cur = ch;
        } else cur += ch;
      }
      if (cur) out.push(cur);
    });
    layoutCache = { t: txt, w: W, lines: out };
    return out;
  }
  function drawText(txt, local, now) {
    const fs = W < 460 ? 16 : 22, lh = W < 460 ? 25 : 33;
    ctx.font = '500 ' + fs + 'px -apple-system,"Hiragino Sans",sans-serif';
    const lines = layoutLines(txt, W * 0.86);
    let totalChars = 0;
    for (let i = 0; i < lines.length; i++) totalChars += lines[i].length;
    let shown = totalChars;
    if (!typeDone) {
      shown = Math.max(0, Math.floor((now - typeStart - 260) / 32)); // 1文字32ms
      if (shown >= totalChars) { shown = totalChars; typeDone = true; }
    }
    let a = 1;
    if (local > 0.86) a = clamp01((1 - local) / 0.14);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#eef0ff';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
    ctx.textAlign = 'left';
    const startY = H * 0.80 - (lines.length - 1) * lh / 2;
    let used = 0;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i], vis = shown - used;
      used += ln.length;
      if (vis <= 0) break;
      const w = ctx.measureText(ln).width; // 全文幅基準で左寄せ→タイプ中も行が動かない
      ctx.fillText(vis >= ln.length ? ln : ln.slice(0, vis), W / 2 - w / 2, startY + i * lh);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // ===== シーン =====
  function sceneUnified(t, now) {
    // 平和な統一世界＋昇る陽
    const horizon = H * 0.62;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0c2348'); sky.addColorStop(1, '#1d4a7a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
    // 星（夜明け前の名残）
    for (let i = 0; i < 40; i++) { const x = (i * 71) % W, y = (i * 37) % (horizon * 0.7); ctx.globalAlpha = (1 - t) * (0.3 + (i % 3) * 0.2); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    // 陽
    const sy = horizon - 30 - t * 40;
    // ゴッドレイ（放射光）
    ctx.save(); ctx.translate(W / 2, sy); ctx.globalAlpha = 0.10 + t * 0.10;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6 + now * 0.0002); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26, -Math.max(W, H)); ctx.lineTo(26, -Math.max(W, H)); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(W / 2, sy, 8, W / 2, sy, 110);
    g.addColorStop(0, '#fff7da'); g.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, sy, 110, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(W / 2, sy, 26, 0, Math.PI * 2); ctx.fill();
    // 大地
    const gnd = ctx.createLinearGradient(0, horizon, 0, H);
    gnd.addColorStop(0, '#367f3f'); gnd.addColorStop(1, '#1f5a2a');
    ctx.fillStyle = gnd; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#3c9647';
    for (let i = 0; i < 7; i++) { const x = (i + 0.5) * W / 7; ctx.beginPath(); ctx.arc(x, horizon + 14, 18 + (i % 3) * 6, 0, Math.PI); ctx.fill(); }
  }

  function sceneTension(t, now) {
    // ふたつの天体が中央へ引き寄せられ、空が裂け始める緊張
    const horizon = H * 0.62;
    const red = t * 0.5;
    ctx.fillStyle = 'rgb(' + (14 + red * 80) + ',' + (20 + red * 10) + ',' + (44 - red * 20) + ')'; ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#23461f'; ctx.fillRect(0, horizon, W, H - horizon);
    const conv = t * W * 0.16;
    const lx = W * 0.30 + conv, rx = W * 0.70 - conv, cy = H * 0.34;
    const jit = t * 5;
    // 陽
    ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.arc(lx + (Math.random() - 0.5) * jit, cy + (Math.random() - 0.5) * jit, 24, 0, 7); ctx.fill();
    // 月
    ctx.fillStyle = '#cdd8ff'; ctx.beginPath(); ctx.arc(rx + (Math.random() - 0.5) * jit, cy + (Math.random() - 0.5) * jit, 24, 0, 7); ctx.fill();
    // 火花が中央に集まる
    ctx.fillStyle = 'rgba(255,200,120,' + (0.4 + t * 0.5) + ')';
    for (let i = 0; i < 40; i++) { const a = i * 0.6 + now * 0.004; const r = (1 - ((i * 0.05 + now * 0.0006) % 1)) * 140; ctx.fillRect(W / 2 + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2); }
    // 中央に光が凝縮
    const g = ctx.createRadialGradient(W / 2, cy, 2, W / 2, cy, 30 + t * 70); g.addColorStop(0, 'rgba(255,255,255,' + (0.5 + t * 0.5) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, cy, 100, 0, 7); ctx.fill();
  }

  // 旅人の降臨: 裂けた世界へ、ひとりの旅人が光の柱に導かれて降り立つ
  function sceneArrival(t, now) {
    const horizon = H * 0.72;
    // 夜明け前の空(深い藍→地平に微光)
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0a1024'); sky.addColorStop(0.7, '#16203e'); sky.addColorStop(1, '#3a3050');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
    // 星
    for (let i = 0; i < 50; i++) { const x = (i * 71) % W, y = (i * 37) % (horizon * 0.8); ctx.globalAlpha = 0.2 + Math.abs(Math.sin(now * 0.001 + i)) * 0.4; ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    // 大地(光と影で二分)
    ctx.fillStyle = '#27502c'; ctx.fillRect(0, horizon, W / 2, H - horizon);
    ctx.fillStyle = '#241a38'; ctx.fillRect(W / 2, horizon, W / 2, H - horizon);
    // 中央の裂け目(発光ライン)
    ctx.strokeStyle = 'rgba(190,150,255,' + (0.5 + Math.sin(now * 0.005) * 0.3) + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, horizon); for (let y = horizon; y < H; y += 12) ctx.lineTo(W / 2 + Math.sin(y * 0.3) * 6, y); ctx.stroke();
    // 天からの光の柱
    const bx = W / 2, by = horizon - 6;
    const beam = ctx.createLinearGradient(bx, 0, bx, by);
    beam.addColorStop(0, 'rgba(255,245,210,0)'); beam.addColorStop(1, 'rgba(255,245,210,' + (0.22 + t * 0.18) + ')');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(bx - 10, 0); ctx.lineTo(bx + 10, 0); ctx.lineTo(bx + 44, by); ctx.lineTo(bx - 44, by); ctx.closePath(); ctx.fill();
    // 降下する旅人のシルエット
    const land = Math.min(1, t / 0.8);
    const py = -30 + land * (by + 24);
    const glow = ctx.createRadialGradient(bx, py, 2, bx, py, 30); glow.addColorStop(0, 'rgba(255,250,230,0.9)'); glow.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(bx, py, 30, 0, 7); ctx.fill();
    ctx.fillStyle = '#10131e';
    ctx.beginPath(); ctx.ellipse(bx, py, 7, 11, 0, 0, Math.PI * 2); ctx.fill(); // 体
    ctx.beginPath(); ctx.arc(bx, py - 11, 4.5, 0, Math.PI * 2); ctx.fill(); // 頭
    // 着地の塵
    if (t > 0.8) { const k = (t - 0.8) / 0.2; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const rr = k * 60; ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = '#d8c89a'; ctx.fillRect(bx + Math.cos(a) * rr, by - 4 + Math.sin(a) * rr * 0.4, 2.5, 2.5); } ctx.globalAlpha = 1; }
  }

  function sceneTitle(t, now) {
    // タイトルロゴ reveal（光と影の半分背景＋星＋ロゴ）
    ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,210,100,0.06)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(150,90,220,0.08)'; ctx.fillRect(W / 2, 0, W / 2, H);
    // 上昇する塵
    for (let i = 0; i < 60; i++) { const x = (i * 89) % W; const y = (H - ((i * 53 + now * 0.04) % H)); ctx.globalAlpha = 0.25 + (i % 3) * 0.12; ctx.fillStyle = i % 2 ? '#ffe9a8' : '#bfa6ff'; ctx.fillRect(x, y, 1.6, 1.6); }
    ctx.globalAlpha = 1;
    // 中央のオーラ
    const cy = H * 0.42;
    const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
    const g = ctx.createRadialGradient(W / 2, cy, 6, W / 2, cy, 180); g.addColorStop(0, 'rgba(180,200,255,' + (0.18 + pulse * 0.12) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, cy, 180, 0, 7); ctx.fill();
    // ロゴ
    const a = Math.max(0, Math.min(1, t < 0.3 ? t / 0.3 : 1));
    const scale = 0.9 + a * 0.1;
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(scale, scale); ctx.globalAlpha = a; ctx.textAlign = 'center';
    const big = W < 460 ? 38 : 64;
    ctx.font = '800 ' + big + 'px -apple-system,"Hiragino Sans",sans-serif';
    ctx.shadowColor = '#7fa8ff'; ctx.shadowBlur = 24;
    const grad = ctx.createLinearGradient(-W / 2, 0, W / 2, 0); grad.addColorStop(0, '#ffe9a8'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(1, '#bfa6ff');
    ctx.fillStyle = grad; ctx.fillText('HARUKING', 0, -8); ctx.fillText('SURVIVAL', 0, big * 0.92 - 8);
    ctx.shadowBlur = 0; ctx.restore();
    // ロゴ確定の一拍: 一条の光がロゴ面を撫で、細い光輪がひとつ広がる
    const swp = (t - 0.30) / 0.26;
    if (swp > 0 && swp < 1) {
      const sx2 = -W * 0.35 + swp * W * 1.7;
      const sg2 = ctx.createLinearGradient(sx2 - 70, 0, sx2 + 70, 0);
      sg2.addColorStop(0, 'rgba(255,255,255,0)'); sg2.addColorStop(0.5, 'rgba(255,255,255,0.20)'); sg2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sg2; ctx.fillRect(sx2 - 70, cy - big * 1.5, 140, big * 2.8);
      ctx.restore();
    }
    const rng = (t - 0.28) / 0.5;
    if (rng > 0 && rng < 1) { ctx.strokeStyle = 'rgba(200,215,255,' + ((1 - rng) * 0.35).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, cy, 40 + rng * Math.min(W, H) * 0.55, 0, 7); ctx.stroke(); }
    // サブタイトル
    ctx.globalAlpha = Math.max(0, Math.min(1, (t - 0.35) / 0.3));
    ctx.fillStyle = '#cfd6ee'; ctx.font = (W < 460 ? 14 : 19) + 'px -apple-system,"Hiragino Sans",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('— 俯瞰型サンドボックスサバイバル —', W / 2, cy + (W < 460 ? 78 : 120));
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  function scenePrayers(t, now) {
    const horizon = H * 0.62;
    ctx.fillStyle = '#0e1f3e'; ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#2a5a32'; ctx.fillRect(0, horizon, W, H - horizon);
    // 左: 昼の祈り（陽）
    const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
    const lx = W * 0.28, ly = H * 0.34;
    const g1 = ctx.createRadialGradient(lx, ly, 5, lx, ly, 70 + pulse * 20);
    g1.addColorStop(0, '#fff3c0'); g1.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(lx, ly, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.arc(lx, ly, 22, 0, Math.PI * 2); ctx.fill();
    // 右: 夜の祈り（月）
    const rx = W * 0.72, ry = H * 0.34;
    const g2 = ctx.createRadialGradient(rx, ry, 5, rx, ry, 70 + (1 - pulse) * 20);
    g2.addColorStop(0, '#cfe0ff'); g2.addColorStop(1, 'rgba(120,150,220,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(rx, ry, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cdd8ff'; ctx.beginPath(); ctx.arc(rx, ry, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e1f3e'; ctx.beginPath(); ctx.arc(rx + 8, ry - 6, 20, 0, Math.PI * 2); ctx.fill();
    // 中央で引き合う線（振動）
    ctx.strokeStyle = 'rgba(220,220,255,' + (0.3 + t * 0.5) + ')'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = lx; x <= rx; x += 10) { const y = ly + Math.sin((x + now * 0.02) * 0.1) * (4 + t * 10); if (x === lx) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }

  function sceneSplit(t, now) {
    // 画面が割れて光と影に分かれる
    const gap = t * W * 0.5;
    // 左=光
    ctx.fillStyle = '#163a1f'; ctx.fillRect(0, 0, W / 2 - gap / 2, H);
    ctx.fillStyle = '#caa23a'; ctx.globalAlpha = 0.18; ctx.fillRect(0, 0, W / 2 - gap / 2, H); ctx.globalAlpha = 1;
    // 右=影
    ctx.fillStyle = '#241338'; ctx.fillRect(W / 2 + gap / 2, 0, W / 2 - gap / 2 + gap, H);
    // 中央の裂け目（虚無）
    const cg = ctx.createLinearGradient(W / 2 - gap / 2, 0, W / 2 + gap / 2, 0);
    cg.addColorStop(0, '#05070e'); cg.addColorStop(0.5, '#1a0a2a'); cg.addColorStop(1, '#05070e');
    ctx.fillStyle = cg; ctx.fillRect(W / 2 - gap / 2, 0, gap, H);
    // 稲妻状の亀裂
    ctx.strokeStyle = 'rgba(200,160,255,' + (0.6 - t * 0.3) + ')'; ctx.lineWidth = 2 + t * 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0);
    let y = 0, x = W / 2;
    while (y < H) { y += 24; x = W / 2 + (Math.sin(y * 0.3 + now * 0.001) * gap * 0.4); ctx.lineTo(x, y); }
    ctx.stroke();
    // 粒子
    ctx.fillStyle = 'rgba(200,170,255,0.7)';
    for (let i = 0; i < 30; i++) { const px = W / 2 + (Math.sin(i * 13.7 + now * 0.002) * gap * 0.6); const py = (i * 53 + now * 0.05) % H; ctx.fillRect(px, py, 2, 2); }
    // 引き裂きの瞬間の閃光
    if (t < 0.14) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - t / 0.14) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function sceneDescend(t, now) {
    // 左光・右影の世界に、プレイヤーが落ちてくる
    ctx.fillStyle = '#163a1f'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = '#241338'; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.fillStyle = 'rgba(255,210,100,0.10)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(150,90,220,0.12)'; ctx.fillRect(W / 2, 0, W / 2, H);
    // 光の柱
    const px = W / 2, py = -40 + t * (H * 0.55 + 40);
    const beam = ctx.createLinearGradient(px, 0, px, py + 30);
    beam.addColorStop(0, 'rgba(255,255,255,0)'); beam.addColorStop(1, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = beam; ctx.fillRect(px - 10, 0, 20, py + 30);
    // プレイヤー
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 12 + Math.sin(now * 0.01) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a78d6'; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(px, py - 3, 4.5, 0, Math.PI * 2); ctx.fill();
    // 着地の光輪
    if (t > 0.78) { const r = (t - 0.78) / 0.22 * 80; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - (t - 0.78) / 0.22) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, H * 0.55, r, 0, Math.PI * 2); ctx.stroke(); }
  }

  // ===== ロケット発射ムービー =====
  function playLaunch(toSpace, cb) {
    const scenes = toSpace ? [
      { d: 2600, draw: lcCountdown, text: '発射シーケンス…', onEnter: function () { Game.Audio.cineStart('heroic'); Game.Audio.cue('boom'); } },
      { d: 3200, draw: lcLiftoff, text: '点火——大地を蹴って、空へ', shake: 0.8, onEnter: function () { Game.Audio.cue('impact'); Game.Audio.cue('riser'); } },
      { d: 3400, draw: lcStars, text: '大気を抜け、星の海へ', onEnter: function () { Game.Audio.cue('shimmer'); Game.Audio.cue('swell'); } },
    ] : [
      { d: 2600, draw: lcReentry, text: '帰還——青き世界へ降りてゆく', onEnter: function () { Game.Audio.cineStart('mystic'); Game.Audio.cue('swell'); } },
    ];
    runScenes(scenes, cb);
  }

  // ===== ランドマーク発見ムービー =====
  const DISCOVERY = {
    dungeon:  { title: 'ダンジョン発見', sub: '魔物の巣が、闇の奥で蠢いている', col: '#e0644a', icon: '🏰', audio: 'boom' },
    vault:    { title: '共鳴遺跡 発見', sub: '光と影、ふたつの世界が呼応する', col: '#e3c24a', icon: '🌀', audio: 'shimmer' },
    stela:    { title: '古の石碑', sub: '失われた世界の記憶が刻まれている', col: '#b6a6f0', icon: '🗿', audio: 'choir' },
    treasure: { title: '秘宝の間', sub: '封印が解かれ、宝が姿を現す', col: '#ffd86b', icon: '💎', audio: 'shimmer' },
    cosmic:   { title: '星の遺物', sub: '宇宙の彼方、未知の宝が眠る', col: '#7fc8ff', icon: '✨', audio: 'swell' },
    boss:     { title: '強大な気配', sub: '空気が張り詰める——強敵が現れた', col: '#ff5a4a', icon: '💀', audio: 'impact' },
    altar:    { title: '古の祭壇', sub: '触れし者に、つかの間の祝福を', col: '#ffe27a', icon: '⛩️', audio: 'choir' },
  };
  function playDiscovery(kind, cb) {
    const d = DISCOVERY[kind] || DISCOVERY.dungeon;
    runScenes([{ d: 3400, draw: function (t, now) { scDiscovery(t, now, d); }, text: '', shake: kind === 'boss' ? 0.5 : 0.15, onEnter: function () { Game.Audio.cue(d.audio); } }], cb);
  }
  function scDiscovery(t, now, d) {
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.40;
    // 星屑の背景(瞬く)
    for (let i = 0; i < 60; i++) { const x = (i * 71) % W, y = (i * 53) % H; ctx.globalAlpha = 0.1 + Math.abs(Math.sin(now * 0.001 + i)) * 0.4; ctx.fillStyle = i % 4 ? '#cfe0ff' : d.col; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    // 立ち昇るきらめき(中央から)
    for (let i = 0; i < 18; i++) { const ph = (t * 1.2 + i * 0.13) % 1; const ang = i * 2.39996; const rad = ph * 150; const x = cx + Math.cos(ang) * rad * 0.7, y = cy + 30 - ph * 130 + Math.sin(ang) * 14; ctx.globalAlpha = (1 - ph) * 0.8; ctx.fillStyle = i % 2 ? '#fff' : d.col; ctx.fillRect(x, y, 2.2, 2.2); }
    ctx.globalAlpha = 1;
    // 広がる光輪
    for (let r = 0; r < 3; r++) { const rr = ((t * 1.4 + r * 0.33) % 1); ctx.strokeStyle = d.col; ctx.globalAlpha = (1 - rr) * 0.5; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr * Math.max(W, H) * 0.6, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // 出現の閃光(序盤)
    if (t < 0.2) { ctx.globalAlpha = (0.2 - t) / 0.2 * 0.6; ctx.fillStyle = d.col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // 中央グロー
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130); g.addColorStop(0, d.col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.45 + Math.sin(now * 0.006) * 0.2; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 130, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // アイコン
    const pop = t < 0.3 ? t / 0.3 : 1; ctx.textAlign = 'center'; ctx.font = (64 * pop) + 'px sans-serif'; ctx.fillText(d.icon, cx, cy + 24);
    // テキスト
    let a = t < 0.25 ? t / 0.25 : (t > 0.85 ? (1 - t) / 0.15 : 1); a = Math.max(0, Math.min(1, a));
    ctx.globalAlpha = a; ctx.fillStyle = d.col; ctx.font = 'bold ' + (W < 460 ? 24 : 34) + 'px -apple-system,"Hiragino Sans",sans-serif';
    ctx.shadowColor = d.col; ctx.shadowBlur = 16; ctx.fillText(d.title, cx, cy + 124); ctx.shadowBlur = 0;
    ctx.fillStyle = '#dfe2f0'; ctx.font = (W < 460 ? 13 : 17) + 'px -apple-system,"Hiragino Sans",sans-serif'; ctx.fillText(d.sub, cx, cy + 124 + (W < 460 ? 28 : 36));
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  // ===== ボス専用アニメムービー（登場/撃破）=====
  const BOSS = {
    sovereign:   { name: '影の主', col: '#9a40e0', sil: 'tall', intro: ['玉座の影が、ゆらりと起き上がる', '「光なき世界こそ、真の安寧——」'], outro: ['影の主は砕け、世界に深い罅が走った', '— 影核を、その手に —'] },
    hunger_beast:{ name: '飢餓の獣', col: '#c0204a', sil: 'beast', intro: ['深淵の底で、飢えが目を覚ます', '「喰らう…全てを、喰らい尽くす…」'], outro: ['獣は静かになり、虚の心臓が残された', '— 終わりなき渇望、断ち切れり —'] },
    tomb_king:   { name: '墳墓の王', col: '#e8c54a', sil: 'tall', intro: ['砂塵が渦巻き、古の王が蘇る', '「我が眠りを妨げし者よ、塵に還れ」'], outro: ['王は再び砂となり、黄金が零れ落ちた', '— 砂塵の大剣を継ぐ者よ —'] },
    forge_titan: { name: '溶炉の巨人', col: '#ff6a2a', sil: 'tall', intro: ['溶岩がうねり、鋼の巨体が形を成す', '「鋼となりて、砕け散れ」'], outro: ['巨人は崩れ、溶岩が冷えて鎮まった', '— 溶岩の戦槌、ここに —'] },
    star_guardian:{ name: '星の守護者', col: '#bfe0ff', sil: 'orb', intro: ['星々が集い、守護者が顕現する', '「星の理を乱す者を、われは許さぬ」'], outro: ['守護者は星屑となって、宙に還った', '— 星核の輝き、掌中に —'] },
    crystal_queen:{ name: '水晶の女王', col: '#c884f0', sil: 'tall', intro: ['水晶洞の奥、凍てつく玉座に女王が在す', '「砕けて散るがいい——美しき結晶となって」'], outro: ['女王は無数の煌めきとなって砕け散った', '— プリズムの刃を継ぐ者よ —'] },
    abyss_dragon:{ name: '深淵の竜', col: '#8a2fb0', sil: 'beast', intro: ['影の最果て、深淵が裂け、古竜が翼を広げる', '「ここから先は、二度と光を見ぬ——」'], outro: ['古竜は咆哮を残し、闇の彼方へ崩れ落ちた', '— 竜牙の大剣、その手に —'] },
    twilight_colossus:{ name: '黄昏の巨像', col: '#e0a050', sil: 'tall', intro: ['血の月の下、大地が震え、巨像が目覚める', '「滅びの刻だ——黄昏が、すべてを呑む」'], outro: ['巨像は轟音とともに崩れ、月光が鎮まった', '— 巨像の大剣、ここに —'] },
    wanted_boss: { name: '賞金首の大物', col: '#e0504a', sil: 'tall', intro: ['手配書の影が、ぬっと立ちはだかる', '「俺の首にかけた賞金、冥土の土産にくれてやる」'], outro: ['大物は膝をつき、奪った財宝が地に散らばった', '— 賞金、受け取るがいい —'] },
    swamp_lord:  { name: '沼の主', col: '#5a7a3a', sil: 'beast', intro: ['澱んだ沼が泡立ち、瘴気の巨躯がせり上がる', '「この沼に踏み入る者よ……朽ちて、肥やしとなれ」'], outro: ['主は泥へと還り、澱みに澄んだ水が戻った', '— 澱みの大鎌、その手に —'] },
    lava_lord:   { name: '溶岩の王', col: '#d8521f', sil: 'tall', intro: ['溶岩湖が沸き立ち、灼熱の王が立ち上がる', '「我が炉に挑むか。ならば灰も残すまい」'], outro: ['王は冷えて黒曜となり、静寂が戻った', '— 溶岩の大槌、ここに —'] },
    spore_queen: { name: '胞子の女王', col: '#9a6ad0', sil: 'beast', intro: ['菌糸の森がざわめき、胞子の女王が舞い降りる', '「この森に還りなさい……養分となって」'], outro: ['女王は胞子となって散り、森に静けさが戻った', '— 菌糸の大鎌、その手に —'] },
    endbringer:  { name: '終焉の王', col: '#d04a6a', sil: 'tall', intro: ['世界の罅という罅から、終焉が形を成す', '「裂けた世界よ、我が手で終わらせてやろう——」'], outro: ['終焉の王は光と影に還り、世界に静寂が訪れた', '— 終焉の剣を継ぐ者、それは新たな始まり —'] },
  };
  function drawBossSilhouette(d, cx, cy, sc, mode) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.fillStyle = mode === 'fall' || mode === 'win' ? shadeHex(d.col, 0.5) : d.col;
    const dk = shadeHex(d.col, 0.55), lt = shadeHex(d.col, 1.35);
    let eyeY = -36;
    if (d.sil === 'beast') {
      // 四足の獣: 低く構えた巨躯＋脚＋尾＋角＋牙
      ctx.fillStyle = dk; ctx.fillRect(-30, 8, 10, 26); ctx.fillRect(20, 8, 10, 26); ctx.fillRect(-14, 12, 9, 24); ctx.fillRect(6, 12, 9, 24); // 四肢
      ctx.fillStyle = d.col;
      ctx.beginPath(); ctx.ellipse(0, -2, 34, 22, 0, 0, Math.PI * 2); ctx.fill(); // 胴
      ctx.beginPath(); ctx.arc(28, -16, 18, 0, Math.PI * 2); ctx.fill(); // 頭(前方)
      // 角
      ctx.fillStyle = lt; ctx.beginPath(); ctx.moveTo(22, -30); ctx.lineTo(14, -52); ctx.lineTo(30, -34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(36, -30); ctx.lineTo(46, -50); ctx.lineTo(42, -28); ctx.closePath(); ctx.fill();
      // 尾
      ctx.strokeStyle = d.col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-30, -4); ctx.quadraticCurveTo(-58, -14, -50, 16); ctx.stroke();
      // 背の棘
      ctx.fillStyle = lt; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 14, -22); ctx.lineTo(k * 14 + 5, -40); ctx.lineTo(k * 14 + 10, -22); ctx.closePath(); ctx.fill(); }
      eyeY = -18; ctx.fillStyle = '#fff';
      ctx.shadowColor = d.col; ctx.shadowBlur = 16; ctx.fillRect(24, eyeY, 5, 4); ctx.fillRect(33, eyeY, 5, 4); ctx.shadowBlur = 0;
      ctx.restore(); return;
    } else if (d.sil === 'orb') {
      // 浮遊する眼＋周囲を巡る破片＋触手
      ctx.strokeStyle = d.col; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + cy * 0; ctx.beginPath(); ctx.moveTo(0, 0); const ex = Math.cos(a) * 52, ey = Math.sin(a) * 52; ctx.quadraticCurveTo(Math.cos(a + 0.5) * 30, Math.sin(a + 0.5) * 30, ex, ey); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 42); g.addColorStop(0, '#fff'); g.addColorStop(0.5, d.col); g.addColorStop(1, dk);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
      // 巡る破片
      ctx.fillStyle = lt; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const rr = 58; ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr); ctx.rotate(a); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
      // 縦の瞳
      ctx.fillStyle = mode === 'win' ? 'rgba(255,255,255,0.6)' : '#1a0010'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    } else {
      // 巨人/人型: 角・王冠・肩スパイク・マント・鉤爪で威圧的に
      ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(-30, -16); ctx.lineTo(-52, 40); ctx.lineTo(-18, 24); ctx.closePath(); ctx.fill(); // マント左
      ctx.beginPath(); ctx.moveTo(30, -16); ctx.lineTo(52, 40); ctx.lineTo(18, 24); ctx.closePath(); ctx.fill(); // マント右
      ctx.fillStyle = d.col;
      ctx.beginPath(); ctx.arc(0, -34, 15, 0, 7); ctx.fill(); // 頭
      ctx.beginPath(); ctx.moveTo(-26, -18); ctx.lineTo(26, -18); ctx.lineTo(20, 34); ctx.lineTo(-20, 34); ctx.closePath(); ctx.fill(); // 胴(台形)
      ctx.fillRect(-38, -16, 13, 40); ctx.fillRect(25, -16, 13, 40); // 腕
      ctx.fillRect(-18, 34, 14, 26); ctx.fillRect(4, 34, 14, 26); // 脚
      // 肩スパイク
      ctx.fillStyle = lt; [-30, 30].forEach(sx => { ctx.beginPath(); ctx.moveTo(sx - 8, -18); ctx.lineTo(sx, -36); ctx.lineTo(sx + 8, -18); ctx.closePath(); ctx.fill(); });
      // 角(頭の左右)
      ctx.beginPath(); ctx.moveTo(-12, -42); ctx.lineTo(-22, -62); ctx.lineTo(-6, -46); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, -42); ctx.lineTo(22, -62); ctx.lineTo(6, -46); ctx.closePath(); ctx.fill();
      // 鉤爪
      ctx.strokeStyle = lt; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      [-31, 31].forEach(hx => { for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(hx, 24); ctx.lineTo(hx + c * 4, 34); ctx.stroke(); } });
      eyeY = -38;
    }
    // 光る眼
    ctx.fillStyle = mode === 'win' ? 'rgba(255,255,255,0.6)' : '#fff';
    ctx.shadowColor = d.col; ctx.shadowBlur = 18;
    ctx.fillRect(-10, eyeY, 5, 5); ctx.fillRect(5, eyeY, 5, 5); ctx.shadowBlur = 0;
    ctx.restore();
  }
  function shadeHex(hex, f) { const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16) * f, g = parseInt(c.slice(2, 4), 16) * f, b = parseInt(c.slice(4, 6), 16) * f; return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
  function bossScene(t, now, d, mode) {
    // 暗い舞台＋テーマカラーのオーラ
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    bg.addColorStop(0, shadeHex(d.col, 0.28)); bg.addColorStop(1, '#05060c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 放射光
    ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.globalAlpha = 0.08 + (mode === 'name' ? 0.06 : 0);
    for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5 + now * 0.0003); ctx.fillStyle = d.col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, -Math.max(W, H)); ctx.lineTo(24, -Math.max(W, H)); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
    const cx = W / 2, cy = H * 0.42;
    let sc = (W < 460 ? 1.5 : 2.4), sy = cy;
    if (mode === 'rise') { sy = cy + (1 - t) * 60; ctx.globalAlpha = Math.min(1, t * 1.6); }
    else if (mode === 'fall') { sc *= (1 - t * 0.2); ctx.globalAlpha = 1 - t * 0.6; if (t > 0.3 && Math.random() < 0.5) ctx.translate((Math.random() - 0.5) * 8, 0); }
    else if (mode === 'win') { ctx.globalAlpha = Math.max(0, 0.5 - t * 0.5); }
    else if (mode === 'clash') { sc *= (1 + t * 0.35); sy = cy - t * 18; } // 開戦: 踏み込んで迫る
    drawBossSilhouette(d, cx, sy, sc, mode);
    ctx.globalAlpha = 1;
    // 開戦の咆哮: 斬撃の弧＋終端で白フラッシュ(→戦闘へ)
    if (mode === 'clash') {
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7 * (1 - t); ctx.globalAlpha = Math.max(0, 1 - t * 1.25); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, 70 + t * 160, -0.7, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 70 + t * 160, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); ctx.restore();
      // 衝撃の輪
      ctx.strokeStyle = d.col; ctx.globalAlpha = Math.max(0, 0.8 - t); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, t * 220, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      if (t > 0.72) { ctx.fillStyle = 'rgba(255,255,255,' + ((t - 0.72) / 0.28) * 0.9 + ')'; ctx.fillRect(0, 0, W, H); }
    }
    // 撃破時の砕け粒子/勝利の光
    if (mode === 'fall') { ctx.fillStyle = d.col; for (let i = 0; i < 30; i++) { const a = i * 0.7 + now * 0.004; const r = t * 160; ctx.globalAlpha = 1 - t; ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 3); } ctx.globalAlpha = 1; }
    if (mode === 'win') { const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 160); g.addColorStop(0, 'rgba(255,255,255,' + (0.3 + t * 0.4) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 160, 0, 7); ctx.fill(); }
    // 名前
    if (mode === 'name' || mode === 'rise') {
      const a = Math.max(0, Math.min(1, (t - 0.2) / 0.3));
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.fillStyle = d.col; ctx.shadowColor = d.col; ctx.shadowBlur = 20;
      ctx.font = '800 ' + (W < 460 ? 30 : 46) + 'px -apple-system,"Hiragino Sans",sans-serif';
      ctx.fillText(d.name, cx, H * 0.74); ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  }
  function playBossIntro(type, cb) {
    const d = BOSS[type] || BOSS.sovereign;
    runScenes([
      { d: 3300, draw: function (t, n) { bossScene(t, n, d, 'rise'); }, text: d.intro[0], shake: 0.35, onEnter: function () { Game.Audio.cineStart('tense'); Game.Audio.cue('boom'); } },
      { d: 3500, draw: function (t, n) { bossScene(t, n, d, 'name'); }, text: d.intro[1], shake: 0.15, onEnter: function () { Game.Audio.cue('riser'); } },
      { d: 2000, draw: function (t, n) { bossScene(t, n, d, 'clash'); }, text: '——いざ、尋常に。', shake: 0.6, onEnter: function () { Game.Audio.cue('impact'); Game.Audio.cue('boom'); } },
    ], cb);
  }
  function playBossOutro(type, cb) {
    const d = BOSS[type] || BOSS.sovereign;
    runScenes([
      { d: 3000, draw: function (t, n) { bossScene(t, n, d, 'fall'); }, text: d.outro[0], shake: 0.6, onEnter: function () { Game.Audio.cineStart('heroic'); Game.Audio.cue('impact'); } },
      { d: 3400, draw: function (t, n) { bossScene(t, n, d, 'win'); }, text: d.outro[1], onEnter: function () { Game.Audio.cue('choir'); Game.Audio.cue('shimmer'); } },
      { d: 2600, draw: function (t, n) { bossAftermath(t, n, d); }, text: '静寂が戻り、その力はあなたのものとなった。', onEnter: function () { Game.Audio.cue('swell'); } },
    ], cb);
  }
  // 撃破後の余韻: 静かな舞台に、得た力の輝きが残る
  function bossAftermath(t, now, d) {
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    bg.addColorStop(0, shadeHex(d.col, 0.18)); bg.addColorStop(1, '#04050a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.45;
    // 立ち昇る光の粒
    for (let i = 0; i < 40; i++) { const x = cx + Math.sin(i * 1.7 + now * 0.001) * (40 + (i % 5) * 14); const y = cy + 120 - ((i * 31 + now * 0.05) % 240); ctx.globalAlpha = 0.3 + (i % 3) * 0.2; ctx.fillStyle = i % 2 ? '#fff' : d.col; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
    // 中央の戦利の輝き
    const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 70 + pulse * 20); g.addColorStop(0, 'rgba(255,250,220,' + (0.5 + t * 0.4) + ')'); g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff7d8'; ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    const s = 7 + pulse * 2; ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore();
  }

  function runScenes(scenes, cb, opts) {
    opts = opts || {};
    playing = true; onDone = cb; curScene = -1; shakeMag = 0;
    // 各場面の表示時間を1.5倍に(文字を読む時間の確保, ユーザー指示 2026-07-02)。
    // シーン定数は共有オブジェクトなのでコピーしてから伸長(再生ごとの累積倍加を防止)
    curScenes = scenes.map(function (s) { const c = Object.assign({}, s); c.d = Math.round(s.d * 1.5); return c; });
    curTotal = curScenes.reduce(function (a, s) { return a + s.d; }, 0);
    bgCol = opts.bg || '#03040a'; subduedMode = !!opts.subdued;
    prevDraw = null; prevUntilE = 0; typeDone = false; lastSc = null;
    cv = document.createElement('canvas'); cv.id = 'cutscene-canvas';
    cv.style.cssText = 'position:absolute;inset:0;z-index:60;background:' + bgCol + ';touch-action:none';
    document.getElementById('app').appendChild(cv); ctx = cv.getContext('2d'); resize();
    makeGrain();
    window.addEventListener('resize', resize);
    skipBtn = document.createElement('button'); skipBtn.id = 'cutscene-skip'; skipBtn.textContent = 'スキップ ▶';
    skipBtn.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
    document.getElementById('app').appendChild(skipBtn);
    clickArmedAt = performance.now() + (opts.arm || 700);
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerCancel);
    t0 = performance.now();
    raf = requestAnimationFrame(sceneFrame);
  }
  function sceneFrame(now) {
    if (!playing || !curScenes) return;
    const total = curTotal, e = now - t0;
    if (e >= total) { finish(); return; }
    let acc = 0, sc = curScenes[0], local = 0, idx = 0;
    for (let i = 0; i < curScenes.length; i++) { if (e < acc + curScenes[i].d) { sc = curScenes[i]; local = (e - acc) / curScenes[i].d; idx = i; break; } acc += curScenes[i].d; }
    if (idx !== curScene) {
      if (lastSc && lastSc !== sc) { prevDraw = lastSc.draw; prevUntilE = e + 430; } // シーン間クロスフェード
      lastSc = sc; curScene = idx; shakeMag = sc.shake || 0;
      typeStart = now; typeDone = subduedMode; // 再見時はタイプ演出なしで即全文
      if (sc.onEnter) try { sc.onEnter(); } catch (er) {}
    }
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = bgCol; ctx.fillRect(0, 0, W, H);
    // カメラシェイク(シーン頭で強く→減衰)
    const sh = (Game.Settings && !Game.Settings.get('screenShake')) ? 0 : shakeMag * Math.max(0, 1 - local * 2.2) * 14;
    ctx.save();
    if (sh > 0.2) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    // ケンバーンズ(緩やかなズームイン)
    if (sc.kb !== false) { const z = 1 + 0.042 * easeInOutCubic(local); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); }
    sc.draw(local, now);
    if (prevDraw && e < prevUntilE) { ctx.globalAlpha = clamp01((prevUntilE - e) / 430); try { prevDraw(1, now); } catch (er) {} ctx.globalAlpha = 1; }
    else if (prevDraw) prevDraw = null;
    ctx.restore();
    drawLetterbox(e, total);
    drawFilmOverlay(now);
    if (sc.text) drawText(sc.text, local, now);
    if (e < 500) { ctx.fillStyle = 'rgba(3,4,10,' + (1 - e / 500) + ')'; ctx.fillRect(0, 0, W, H); }
    if (e > total - 650) { ctx.fillStyle = 'rgba(3,4,10,' + clamp01((e - (total - 650)) / 650) + ')'; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(sceneFrame);
  }
  function starsBg(now, n) {
    for (let i = 0; i < n; i++) { const x = (i * 53) % W, y = (i * 97 + now * 0.05) % H; ctx.globalAlpha = 0.5 + (i % 3) * 0.2; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1.5, 1.5); }
    ctx.globalAlpha = 1;
  }
  function lcCountdown(t, now) {
    ctx.fillStyle = '#0a1830'; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    drawRocket(W / 2, H * 0.62, 1.4, 0);
    const n = 3 - Math.floor(t * 3);
    ctx.fillStyle = '#ffe9a0'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = 1 - (t * 3 % 1); ctx.fillText(n > 0 ? n : 'GO', W / 2, H * 0.35); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  function lcLiftoff(t, now) {
    ctx.fillStyle = '#0a1830'; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    const ry = H * 0.62 - t * H * 0.5;
    // 噴煙
    for (let i = 0; i < 24; i++) { ctx.globalAlpha = (1 - t) * 0.6; ctx.fillStyle = i % 2 ? '#ffb04a' : '#fff'; const px = W / 2 + (Math.sin(i * 9 + now * 0.01) * 30 * t); ctx.beginPath(); ctx.arc(px, ry + 40 + i * 5, 8 - i * 0.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawRocket(W / 2, ry, 1.4 + t * 0.4, t);
  }
  function lcStars(t, now) {
    starsBg(now, 120);
    // 星雲のたなびき(紫～青のグラデ帯)で宇宙の幻想性
    for (let i = 0; i < 3; i++) {
      const ny = H * (0.2 + i * 0.22) + Math.sin(now * 0.0004 + i) * 20;
      const ng = ctx.createRadialGradient(W * (0.3 + i * 0.25), ny, 10, W * (0.3 + i * 0.25), ny, 180);
      ng.addColorStop(0, i % 2 ? 'rgba(150,90,220,0.16)' : 'rgba(90,140,230,0.14)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(W * (0.3 + i * 0.25), ny, 180, 0, 7); ctx.fill();
    }
    drawRocket(W / 2, H * (0.55 - t * 0.1), 1.2 - t * 0.4, 1);
    // 惑星が小さくなる＋大気のグロー
    const cyE = H + 120 - t * 80, er = Math.max(0, 70 * (1 - t * 0.7));
    const atmo = ctx.createRadialGradient(W / 2, cyE, er + 50, W / 2, cyE, er + 78);
    atmo.addColorStop(0, 'rgba(120,200,255,0.4)'); atmo.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = atmo; ctx.beginPath(); ctx.arc(W / 2, cyE, er + 78, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f6fb0'; ctx.beginPath(); ctx.arc(W / 2, cyE, er + 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#3c9647'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(W / 2 - 20, cyE - 10, er, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  function lcReentry(t, now) {
    starsBg(now, 60);
    const g = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, 200); g.addColorStop(0, '#2f6fb0'); g.addColorStop(1, 'rgba(47,111,176,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H * 0.7 + t * 100, 220, 0, 7); ctx.fill();
    drawRocket(W / 2, H * 0.3 + t * H * 0.3, 1.0, 0.6);
  }
  function drawRocket(x, y, sc, flame) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = '#e6e8f0'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(11, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0444a'; ctx.beginPath(); ctx.moveTo(-11, 14); ctx.lineTo(-20, 26); ctx.lineTo(-6, 14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11, 14); ctx.lineTo(20, 26); ctx.lineTo(6, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.arc(0, -10, 5, 0, 7); ctx.fill();
    if (flame > 0) { ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.moveTo(-7, 14); ctx.lineTo(0, 14 + 30 * flame * (0.7 + Math.random() * 0.6)); ctx.lineTo(7, 14); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // 物語ムービー: テーマ色＋象徴アイコン＋漂う光のシネマティック背景。textはrunScenesが描画
  function scStory(t, now, d) {
    const cx = W / 2, cy = H / 2, mn = Math.min(W, H), accent = d.col2 || '#cfe0ff';
    // 奥行きのある背景グラデ
    const g = ctx.createRadialGradient(cx, cy * 0.92, 20, cx, cy, Math.max(W, H) * 0.78);
    g.addColorStop(0, d.col || '#2a2440'); g.addColorStop(0.6, shadeColCS(d.col || '#2a2440', -40)); g.addColorStop(1, '#03040a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    // 回転する光芒(ゆっくり回るライトレイ)
    ctx.globalCompositeOperation = 'lighter';
    const rays = 10, rot = now * 0.00012;
    for (let i = 0; i < rays; i++) {
      const ang = rot + i * (Math.PI * 2 / rays);
      ctx.globalAlpha = 0.04 + 0.03 * Math.sin(now * 0.0015 + i);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang - 0.06) * mn, cy + Math.sin(ang - 0.06) * mn);
      ctx.lineTo(cx + Math.cos(ang + 0.06) * mn, cy + Math.sin(ang + 0.06) * mn);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 中央の象徴: 入場でせり上がり、淡く脈動＋発光ハロー
    if (d.icon) {
      const rise = (1 - Math.min(1, t * 2.2)) * mn * 0.08; // 序盤せり上がり
      const pulse = 1 + 0.04 * Math.sin(now * 0.003);
      const iy = cy - 24 + rise;
      ctx.globalAlpha = 0.16; ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, iy, mn * 0.26 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.14 + 0.05 * Math.sin(now * 0.003);
      ctx.font = 'bold ' + Math.floor(mn * 0.46 * pulse) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff'; ctx.fillText(d.icon, cx, iy);
    }
    ctx.globalAlpha = 1;
    // 2層パララックスの塵(奥=遅く小さい / 手前=速く大きい)
    for (let layer = 0; layer < 2; layer++) {
      const sp = layer ? 0.00045 : 0.0002, sz = layer ? 2.4 : 1.4, n = pn(layer ? 26 : 40);
      for (let i = 0; i < n; i++) {
        const a = now * sp + i * 0.7 + layer * 3;
        const rx = (cx + Math.cos(a + i) * (70 + i * 8) + W) % W;
        const ry = (H - ((i * 53 + now * (layer ? 0.012 : 0.005)) % (H + 40))) ;
        ctx.globalAlpha = (layer ? 0.10 : 0.06) * (0.5 + 0.5 * Math.sin(now * 0.002 + i));
        ctx.fillStyle = accent; ctx.fillRect(rx, ry, sz, sz);
      }
    }
    // 周辺減光ヴィネット(シネマ感)
    const vg = ctx.createRadialGradient(cx, cy, mn * 0.35, cx, cy, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.globalAlpha = 1; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // 色を明暗(cutscene内ローカル)
  function shadeColCS(hex, amt) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
    const cl = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v; };
    const r = cl(parseInt(hex.slice(1, 3), 16) + amt), g = cl(parseInt(hex.slice(3, 5), 16) + amt), b = cl(parseInt(hex.slice(5, 7), 16) + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  // ===== 断章「刻む者」専用シーン(色彩設計: 追憶セピア→火影→夜藍→黎明金) =====
  function drawStela(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h + w * 0.4);
    ctx.quadraticCurveTo(x, y - h - w * 0.22, x + w / 2, y - h + w * 0.4);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath(); ctx.fill();
  }
  // 膝をつく石工のシルエット。armAng で槌腕をキーフレーム駆動、bow で俯き
  function drawMason(x, y, s, armAng, bow) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#120e14'; ctx.strokeStyle = '#120e14'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(2, 16, 13, 7, 0, 0, Math.PI * 2); ctx.fill(); // 畳んだ脚
    ctx.beginPath(); ctx.ellipse(0, 2, 10, 14, -0.18 - bow * 0.2, 0, Math.PI * 2); ctx.fill(); // 前傾の胴
    ctx.beginPath(); ctx.arc(-7 - bow * 3, -13 + bow * 3, 6, 0, Math.PI * 2); ctx.fill(); // 俯く頭
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-17, 3); ctx.stroke(); // 鑿を支える腕
    ctx.save(); ctx.translate(1, -7); ctx.rotate(armAng);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-13, -7); ctx.stroke(); // 槌の腕
    ctx.fillRect(-18, -12, 8, 8); ctx.restore(); // 槌頭
    ctx.restore();
  }
  function scChrDusk(t, now) {
    const hz = H * 0.66, pan = easeInOutCubic(t) * 26; // ゆっくり横パン
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#33261a'); sky.addColorStop(0.7, '#5a3c22'); sky.addColorStop(1, '#8a5a2c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    // 低い夕陽とハロー
    const sx = W * 0.24 - pan * 0.4, sy = hz - 26;
    const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    g.addColorStop(0, 'rgba(255,214,140,0.85)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 120, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd88e'; ctx.beginPath(); ctx.arc(sx, sy, 18, 0, 7); ctx.fill();
    // 遠景の尾根(視差: 遅)
    ctx.fillStyle = '#241a10';
    ctx.beginPath(); ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += 24) ctx.lineTo(x, hz - 14 - Math.abs(Math.sin((x + pan * 0.5) * 0.013)) * 34);
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    // 地面
    const gnd = ctx.createLinearGradient(0, hz, 0, H);
    gnd.addColorStop(0, '#3a2a16'); gnd.addColorStop(1, '#191009');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 未刻の碑と、こうべを垂れる石工(残照の逆光でシルエットを浮かべる)
    const bx = W * 0.62 - pan, by = H * 0.73; // 台詞帯(下部)と重ならぬ高さ
    const bl = ctx.createRadialGradient(bx - 40, by - 30, 6, bx - 40, by - 30, 130);
    bl.addColorStop(0, 'rgba(255,196,130,0.30)'); bl.addColorStop(1, 'rgba(255,196,130,0)');
    ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(bx - 40, by - 30, 130, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bx + 4, by + 4, 40, 8, 0, 0, 7); ctx.fill();
    drawStela(bx, by, 40, 92, '#d8cbb2');
    drawMason(bx - 66, by - 12, 1.6, -0.5, 1);
    // 漂う塵(セピアの光片)
    for (let i = 0; i < pn(34); i++) {
      const x = (i * 97 + now * 0.014 * (1 + i % 3)) % (W + 20) - 10;
      const y = hz - 130 + ((i * 61) % 190) + Math.sin(now * 0.0011 + i) * 8;
      ctx.globalAlpha = 0.10 + 0.12 * Math.abs(Math.sin(now * 0.0009 + i * 1.7));
      ctx.fillStyle = '#ffd9a0'; ctx.fillRect(x, y, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
  }
  function scChrCarve(t, now) {
    ctx.fillStyle = '#150e12'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.42, by = H * 0.72;
    // 上手からの光条
    const lg = ctx.createLinearGradient(0, 0, W * 0.5, H * 0.75);
    lg.addColorStop(0, 'rgba(255,190,120,0.20)'); lg.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(-40, -20); ctx.lineTo(W * 0.34, -20); ctx.lineTo(W * 0.72, by + 30); ctx.lineTo(W * 0.10, by + 30); ctx.closePath(); ctx.fill();
    // 大きな碑
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx, by + 6, 66, 11, 0, 0, 7); ctx.fill();
    drawStela(cx, by, 84, 190, '#3f3648');
    // 刻まれてゆく文字(刻線が増える)
    const carved = Math.floor(easeOutCubic(t) * 16);
    ctx.strokeStyle = 'rgba(255,196,120,0.75)'; ctx.lineWidth = 2; ctx.shadowColor = '#ffb060'; ctx.shadowBlur = 6;
    for (let i = 0; i < carved; i++) {
      const gx = cx - 16 + (i % 2) * 26, gy = by - 152 + (i >> 1) * 17;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 8, gy + 5); ctx.lineTo(gx + 2, gy + 11); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // 石工: 槌のキーフレーム(構え→振り下ろし→戻り)。焚き火色の光だまりで逆光に
    const cyc = (now * 0.0016) % 1;
    const flick = 0.16 + 0.05 * Math.abs(Math.sin(now * 0.006));
    const fp = ctx.createRadialGradient(cx + 96, by - 20, 8, cx + 96, by - 20, 150);
    fp.addColorStop(0, 'rgba(255,160,90,' + flick + ')'); fp.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = fp; ctx.beginPath(); ctx.arc(cx + 96, by - 20, 150, 0, 7); ctx.fill();
    const armAng = cyc < 0.55 ? -1.1 * easeInOutCubic(cyc / 0.55) : -1.1 + 1.5 * easeOutCubic((cyc - 0.55) / 0.45);
    drawMason(cx + 92, by - 16, 2.3, armAng, 0.3);
    // 打点の火花(振り下ろし直後)
    if (cyc > 0.55 && cyc < 0.85) {
      const k = (cyc - 0.55) / 0.3;
      ctx.fillStyle = '#ffd9a0'; ctx.globalAlpha = (1 - k) * 0.9;
      for (let i = 0; i < 7; i++) {
        const a = -2.2 + i * 0.42, r = 4 + k * 26;
        ctx.fillRect(cx + 44 + Math.cos(a) * r, by - 16 + Math.sin(a) * r, 2.2, 2.2);
      }
      ctx.globalAlpha = 1;
    }
    // 立ち昇る火の粉
    for (let i = 0; i < pn(22); i++) {
      const x = cx + 30 + Math.sin(i * 2.3 + now * 0.0013) * (18 + (i % 4) * 10);
      const y = by - ((i * 47 + now * 0.05) % (H * 0.62));
      ctx.globalAlpha = 0.14 + 0.2 * Math.abs(Math.sin(now * 0.002 + i));
      ctx.fillStyle = i % 3 ? '#ff9a50' : '#ffd9a0'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function scChrStones(t, now) {
    const hz = H * 0.68;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#060a18'); sky.addColorStop(1, '#12203c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    // 星
    for (let i = 0; i < pn(46); i++) { const x = (i * 83) % W, y = (i * 41) % (hz * 0.9); ctx.globalAlpha = 0.2 + Math.abs(Math.sin(now * 0.0012 + i)) * 0.5; ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    // 月
    const mx = W * 0.78, my = H * 0.16;
    const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 90); mg.addColorStop(0, 'rgba(200,220,255,0.5)'); mg.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 90, 0, 7); ctx.fill();
    ctx.fillStyle = '#dce6ff'; ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#0d1730'; ctx.beginPath(); ctx.arc(mx + 6, my - 5, 14, 0, 7); ctx.fill();
    // 地面
    ctx.fillStyle = '#0a1020'; ctx.fillRect(0, hz, W, H - hz);
    // 立ち並ぶ碑(3層の視差、ゆっくり寄る)
    const pan = easeInOutCubic(t) * 18;
    for (let layer = 0; layer < 3; layer++) {
      const depth = 1 - layer * 0.28, n = 5 + layer * 2;
      const yBase = hz + 22 + layer * (H - hz) * 0.26;
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * W + (i % 2 ? 14 : -10) - pan * depth;
        drawStela(x, yBase, 16 * depth + 6, (44 + (i * 13) % 22) * depth + 14, layer === 2 ? '#1c2740' : '#131c30');
      }
    }
    // 中央前面: まだ白い碑(淡く脈動)
    const bx = W * 0.5 - pan * 0.2, by = H * 0.88;
    const pulse = 0.5 + Math.sin(now * 0.0022) * 0.5;
    const wg = ctx.createRadialGradient(bx, by - 50, 4, bx, by - 50, 90);
    wg.addColorStop(0, 'rgba(235,240,255,' + (0.16 + pulse * 0.12) + ')'); wg.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(bx, by - 50, 90, 0, 7); ctx.fill();
    drawStela(bx, by, 42, 100, '#e6e0d2');
    // 蛍のような光
    for (let i = 0; i < pn(16); i++) {
      const x = (i * 137 + Math.sin(now * 0.0007 + i * 2) * 30 + W) % W;
      const y = hz + 10 + ((i * 53) % (H - hz - 20)) + Math.sin(now * 0.0013 + i) * 10;
      ctx.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(now * 0.0018 + i * 1.3));
      ctx.fillStyle = '#bfe0ff'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function scChrDawn(t, now) {
    const hz = H * 0.70, k = easeInOutCubic(t);
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1a2244'); sky.addColorStop(0.55, '#4a3a4a'); sky.addColorStop(1, '#d08a3c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    // 昇る陽と光芒
    const sy = hz + 26 - k * 60, sx = W * 0.5;
    ctx.save(); ctx.translate(sx, sy); ctx.globalAlpha = 0.07 + k * 0.08;
    for (let i = 0; i < 11; i++) { ctx.rotate(Math.PI * 2 / 11 + now * 0.00016); ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -Math.max(W, H)); ctx.lineTo(22, -Math.max(W, H)); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, 150);
    g.addColorStop(0, 'rgba(255,236,180,0.9)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 150, 0, 7); ctx.fill();
    // 地面(朝焼けの照り返し)
    const gnd = ctx.createLinearGradient(0, hz, 0, H);
    gnd.addColorStop(0, '#6a4526'); gnd.addColorStop(1, '#241610');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 白い碑(中央)
    const bx = W * 0.56, by = H * 0.84;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(bx + 5, by + 4, 42, 8, 0, 0, 7); ctx.fill();
    drawStela(bx, by, 44, 104, '#efe8d8');
    // 旅人が歩み寄る(歩行キーフレーム)
    const walk = clamp01(t * 1.5), px = W * 0.12 + (bx - 74 - W * 0.12) * easeInOutCubic(walk);
    const step = walk < 1 ? Math.sin(now * 0.012) * 4 : 0;
    ctx.fillStyle = '#141018';
    ctx.beginPath(); ctx.ellipse(px, by - 26, 8, 13, 0, 0, 7); ctx.fill(); // 胴
    ctx.beginPath(); ctx.arc(px + 2, by - 43, 5.5, 0, 7); ctx.fill(); // 頭
    ctx.strokeStyle = '#141018'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 3, by - 14); ctx.lineTo(px - 6 - step * 0.6, by); ctx.stroke(); // 脚
    ctx.beginPath(); ctx.moveTo(px + 3, by - 14); ctx.lineTo(px + 6 + step * 0.6, by); ctx.stroke();
    // 終盤、碑へ手を伸ばし、指先と碑が呼応して光る
    const reach = clamp01((t - 0.72) / 0.2);
    ctx.beginPath(); ctx.moveTo(px + 4, by - 32); ctx.lineTo(px + 18 + reach * 10, by - 32 - reach * 14); ctx.stroke();
    if (reach > 0) {
      const rg = ctx.createRadialGradient(bx, by - 60, 2, bx, by - 60, 60 + reach * 50);
      rg.addColorStop(0, 'rgba(255,244,210,' + (0.25 + reach * 0.45) + ')'); rg.addColorStop(1, 'rgba(255,244,210,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by - 60, 110, 0, 7); ctx.fill();
    }
    // 立ち昇る光の粒
    for (let i = 0; i < pn(26); i++) {
      const x = bx + Math.sin(i * 1.9 + now * 0.001) * (26 + (i % 5) * 12);
      const y = by - ((i * 37 + now * 0.04) % (H * 0.5));
      ctx.globalAlpha = 0.15 + 0.25 * Math.abs(Math.sin(now * 0.0016 + i));
      ctx.fillStyle = i % 2 ? '#fff3d0' : '#ffd9a0'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // ===== 断章「最初の影渡り」専用シーン(色彩設計: 過露出の白緑→鏡面の翠と墨→裏返りの深紫→無彩スレート) =====
  // 横向きに立ち、境へ腕を伸ばす人影。dir=向き(1右/-1左)、reach=腕の持ち上げ0-1
  function drawReacher(x, y, s, col, dir, reach, now) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, -22, 9, 16, 0.06, 0, Math.PI * 2); ctx.fill(); // 胴
    ctx.beginPath(); ctx.arc(3, -42, 6, 0, Math.PI * 2); ctx.fill(); // 頭(やや前傾)
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-7, 0); ctx.stroke(); // 後脚
    ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(7, 0); ctx.stroke(); // 前脚
    ctx.lineWidth = 4;
    const ax = 8 + reach * 21, ay = -28 + reach * -7 + Math.sin(now * 0.002) * 1.5;
    ctx.beginPath(); ctx.moveTo(2, -28); ctx.lineTo(ax, ay); ctx.stroke(); // 境へ伸ばす腕
    ctx.restore();
  }
  // 歩く人影(dir=進行方向)。step で脚を振る
  function drawWalkerFig(x, y, s, col, dir, step) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, -24, 8, 14, 0.12, 0, Math.PI * 2); ctx.fill(); // 前傾の胴
    ctx.beginPath(); ctx.arc(4, -42, 5.5, 0, Math.PI * 2); ctx.fill(); // 頭
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(-1, -12); ctx.lineTo(-4 - step, 0); ctx.stroke(); // 脚(振り)
    ctx.beginPath(); ctx.moveTo(3, -12); ctx.lineTo(6 + step, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -30); ctx.lineTo(7 + step * 0.4, -20); ctx.stroke(); // 腕
    ctx.restore();
  }
  function scSwMeadow(t, now) {
    const hz = H * 0.66, k = easeInOutCubic(t);
    // 過露出ぎみの光相の空(冷たい白緑) — セピアの追憶とは対極の明るさ
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#9fc8b0'); sky.addColorStop(0.7, '#d4ecd8'); sky.addColorStop(1, '#f0f7e8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    // 高い白陽
    const sxx = W * 0.28, syy = H * 0.16;
    const sg = ctx.createRadialGradient(sxx, syy, 4, sxx, syy, 110);
    sg.addColorStop(0, 'rgba(255,255,248,0.9)'); sg.addColorStop(1, 'rgba(255,255,248,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sxx, syy, 110, 0, 7); ctx.fill();
    // 草原(下ほど沈めて台詞の地にする)
    const gnd = ctx.createLinearGradient(0, hz, 0, H);
    gnd.addColorStop(0, '#8fbe8a'); gnd.addColorStop(0.5, '#4c8050'); gnd.addColorStop(1, '#203e28');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 遠くに立つ「境」— 呼吸する翠青の縫い目
    const bx = W * 0.76, puls = 0.5 + Math.sin(now * 0.0035) * 0.5;
    const bg2 = ctx.createRadialGradient(bx, hz - 40, 4, bx, hz - 40, 120);
    bg2.addColorStop(0, 'rgba(160,240,220,' + (0.16 + puls * 0.10) + ')'); bg2.addColorStop(1, 'rgba(160,240,220,0)');
    ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bx, hz - 40, 120, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(170,244,224,' + (0.45 + puls * 0.4) + ')'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#a0f0dc'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(bx, H * 0.10);
    for (let y = H * 0.10; y <= hz + 34; y += 14) ctx.lineTo(bx + Math.sin(y * 0.05 + now * 0.001) * 4, y);
    ctx.stroke(); ctx.shadowBlur = 0;
    // 渡り手: 境へ歩む(足元に淡い長影)
    const px = W * 0.16 + (bx - 64 - W * 0.16) * k, gy = hz + 30;
    const step = Math.sin(now * 0.011) * 4;
    ctx.fillStyle = 'rgba(20,30,26,0.22)'; ctx.beginPath(); ctx.ellipse(px - 24, gy + 2, 34, 6, 0, 0, 7); ctx.fill();
    drawWalkerFig(px, gy, 1.7, '#152019', 1, step);
    // 漂う綿毛(白い種)
    for (let i = 0; i < pn(24); i++) {
      const x = (i * 103 + now * 0.02 * (1 + i % 3)) % (W + 16) - 8;
      const y = H * 0.18 + ((i * 67) % (hz - H * 0.14)) + Math.sin(now * 0.0012 + i) * 10;
      ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(now * 0.001 + i * 1.9));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function scSwMirror(t, now) {
    const cx = W / 2, my = H * 0.44;
    // 左=光の岸(翠白) / 右=裏の岸(墨紫) — 一枚布の表と裏
    const lg = ctx.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#c4e0c8'); lg.addColorStop(1, '#42654a');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, cx, H);
    const rg2 = ctx.createLinearGradient(0, 0, 0, H); rg2.addColorStop(0, '#171028'); rg2.addColorStop(1, '#090612');
    ctx.fillStyle = rg2; ctx.fillRect(cx, 0, W - cx, H);
    // 裏の岸にだけ星が出ている
    for (let i = 0; i < pn(26); i++) { const x = cx + 14 + (i * 61) % (W - cx - 20), y = (i * 47) % (H * 0.8); ctx.globalAlpha = 0.2 + Math.abs(Math.sin(now * 0.0012 + i)) * 0.5; ctx.fillStyle = '#cfd8ff'; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    // 境の縫い目(鏡面)
    const puls = 0.5 + Math.sin(now * 0.004) * 0.5;
    const smg = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0);
    smg.addColorStop(0, 'rgba(160,232,224,0)'); smg.addColorStop(0.5, 'rgba(200,255,244,' + (0.16 + puls * 0.10) + ')'); smg.addColorStop(1, 'rgba(160,232,224,0)');
    ctx.fillStyle = smg; ctx.fillRect(cx - 26, 0, 52, H);
    ctx.strokeStyle = 'rgba(190,255,238,' + (0.5 + puls * 0.35) + ')'; ctx.lineWidth = 2;
    ctx.shadowColor = '#a0f0dc'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke(); ctx.shadowBlur = 0;
    // ふたつの人影: こちらの黒い影と、向こうの白い「同じ指」
    const reach = easeOutCubic(clamp01(t * 1.5)), gy = H * 0.62;
    ctx.fillStyle = 'rgba(10,16,12,0.25)'; ctx.beginPath(); ctx.ellipse(cx - 62, gy + 2, 26, 5, 0, 0, 7); ctx.fill();
    drawReacher(cx - 62, gy, 2.0, '#101a14', 1, reach, now); // 指先が縫い目でほぼ触れ合う距離
    drawReacher(cx + 62, gy, 2.0, '#d8e8e0', -1, reach, now);
    // 触れた刹那: 指先の波紋と小さな閃き
    const touch = clamp01((t - 0.62) / 0.38);
    if (touch > 0) {
      const ty = gy - 70;
      for (let r = 0; r < 3; r++) {
        const ph = (touch * 1.3 + r * 0.3) % 1;
        ctx.strokeStyle = r % 2 ? 'rgba(200,255,240,' + (1 - ph) * 0.5 + ')' : 'rgba(190,170,255,' + (1 - ph) * 0.4 + ')';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, ty, 6 + ph * 130, 0, 7); ctx.stroke();
      }
      if (touch < 0.14) { ctx.fillStyle = 'rgba(240,255,250,' + (1 - touch / 0.14) * 0.5 + ')'; ctx.fillRect(0, 0, W, H); }
    }
  }
  function scSwCross(t, now) {
    // 裏返った直後の世界(深い紫墨)。左端に光の岸が細く残る
    ctx.fillStyle = '#100822'; ctx.fillRect(0, 0, W, H);
    const seamX = W * 0.26, hz = H * 0.70, k = easeInOutCubic(t);
    const lg = ctx.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#b2d4b8'); lg.addColorStop(1, '#3c6048');
    ctx.globalAlpha = 0.9 - t * 0.35; ctx.fillStyle = lg; ctx.fillRect(0, 0, seamX, H); ctx.globalAlpha = 1;
    // 境
    const puls = 0.5 + Math.sin(now * 0.004) * 0.5;
    ctx.strokeStyle = 'rgba(190,255,238,' + (0.4 + puls * 0.3) + ')'; ctx.lineWidth = 2;
    ctx.shadowColor = '#a0f0dc'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(seamX, 0); ctx.lineTo(seamX, H); ctx.stroke(); ctx.shadowBlur = 0;
    // 裏世界の空と、鏡めいた地面
    for (let i = 0; i < pn(28); i++) { const x = seamX + 10 + (i * 71) % (W - seamX - 16), y = (i * 43) % (hz * 0.85); ctx.globalAlpha = 0.16 + Math.abs(Math.sin(now * 0.001 + i)) * 0.4; ctx.fillStyle = '#c8c0ff'; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = 1;
    const gnd = ctx.createLinearGradient(0, hz, 0, H); gnd.addColorStop(0, '#1c1132'); gnd.addColorStop(1, '#0a0616');
    ctx.fillStyle = gnd; ctx.fillRect(seamX, hz, W - seamX, H - hz);
    // 残された半身: 光の岸に立ち尽くす淡い影(輪郭が薄れてゆく)
    const gx = seamX * 0.52, gy = hz + 22;
    ctx.globalAlpha = 0.85 - t * 0.45;
    drawWalkerFig(gx, gy, 1.7, '#e8f2e4', 1, 0);
    ctx.globalAlpha = 1;
    // 半身から渡り手へ、境を越えて流れる光の糸
    const px = seamX + 46 + (W * 0.70 - seamX - 46) * k;
    for (let i = 0; i < pn(16); i++) {
      const ph = ((now * 0.00022 + i * 0.09) % 1);
      const mx = gx + (px - gx) * ph, myy = gy - 30 - Math.sin(ph * Math.PI) * 46;
      ctx.globalAlpha = (1 - Math.abs(ph - 0.5) * 1.4) * 0.55;
      ctx.fillStyle = ph < 0.5 ? '#d8f0dc' : '#c0b0ff'; ctx.fillRect(mx, myy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // 渡り手は闇を歩み去る——淡い紫の逆光でシルエットを浮かべ、足元の鏡面に逆さの己を映して
    const step = Math.sin(now * 0.011) * 4;
    const wg2 = ctx.createRadialGradient(px, gy - 44, 4, px, gy - 44, 88);
    wg2.addColorStop(0, 'rgba(140,110,220,0.26)'); wg2.addColorStop(1, 'rgba(140,110,220,0)');
    ctx.fillStyle = wg2; ctx.beginPath(); ctx.arc(px, gy - 44, 88, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(px, gy); ctx.scale(1, -1); ctx.globalAlpha = 0.16;
    drawWalkerFig(0, 0, 1.9, '#b0a0e0', 1, step); ctx.restore(); ctx.globalAlpha = 1;
    drawWalkerFig(px, gy, 1.9, '#0c0a14', 1, step);
    ctx.strokeStyle = 'rgba(150,220,255,0.35)'; ctx.lineWidth = 1.5; // 頭部に微かな翠青のリムライト
    ctx.beginPath(); ctx.arc(px + 7.6, gy - 80, 12, -2.6, -0.7); ctx.stroke();
  }
  function scSwPrice(t, now) {
    // ほぼ無彩のスレート — 代償の静けさ
    const hz = H * 0.64;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1c1a24'); sky.addColorStop(1, '#2e2c3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    const gnd = ctx.createLinearGradient(0, hz, 0, H); gnd.addColorStop(0, '#141220'); gnd.addColorStop(1, '#0a0910');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 地平の彼方: 境の残光と、解けてゆく半身
    const fxx = W * 0.80;
    ctx.strokeStyle = 'rgba(160,220,210,' + (0.22 + Math.sin(now * 0.003) * 0.08) + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fxx, hz - 90); ctx.lineTo(fxx, hz + 8); ctx.stroke();
    ctx.globalAlpha = 0.5 * (1 - t * 0.8);
    drawWalkerFig(fxx - 16, hz + 6, 1.0, '#cfd8d4', -1, 0);
    ctx.globalAlpha = 1;
    for (let i = 0; i < pn(14); i++) { // 半身は光の粒になって空へ
      const x = fxx - 16 + Math.sin(i * 2.1 + now * 0.001) * 14;
      const y = hz - ((i * 31 + now * 0.03) % (H * 0.4));
      ctx.globalAlpha = 0.12 + 0.2 * Math.abs(Math.sin(now * 0.0015 + i));
      ctx.fillStyle = '#d8e8e0'; ctx.fillRect(x, y, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
    // 渡り手は立ち止まる
    const px = W * 0.32, gy = hz + 40;
    drawWalkerFig(px, gy, 2.0, '#0e0c14', 1, 0);
    // 影は右へ長く伸び——その頭だけが、こちらを見上げている
    ctx.save(); ctx.translate(px, gy); ctx.transform(1, 0, -1.9, 0.32, 0, 0); ctx.globalAlpha = 0.5;
    drawWalkerFig(0, 0, 2.0, '#04040a', 1, 0); ctx.restore(); ctx.globalAlpha = 1;
    const shx = px + 82, shy = gy + 15; // 影の頭(体の向きと逆に、わずかに起きている)
    ctx.fillStyle = 'rgba(4,4,10,0.6)'; ctx.beginPath(); ctx.ellipse(shx, shy, 9, 6, -0.5, 0, 7); ctx.fill();
    if (t > 0.45) { // 影の眼(ごく淡く)
      const blink = 0.14 + 0.12 * Math.abs(Math.sin(now * 0.0012));
      ctx.fillStyle = 'rgba(160,220,214,' + blink + ')'; ctx.fillRect(shx - 4, shy - 2, 2.4, 1.6); ctx.fillRect(shx + 2, shy - 2, 2.4, 1.6);
    }
    // 一粒だけ色が残る——翠青の残り火
    const ey = gy - 62 + Math.sin(now * 0.0016) * 8, ex = px + 26;
    const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, 26);
    eg.addColorStop(0, 'rgba(150,230,220,0.7)'); eg.addColorStop(1, 'rgba(150,230,220,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#d0f4ea'; ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
    // 無彩の塵
    for (let i = 0; i < pn(18); i++) {
      const x = (i * 97 + now * 0.008) % W, y = (i * 59) % H;
      ctx.globalAlpha = 0.05 + 0.06 * Math.abs(Math.sin(now * 0.001 + i));
      ctx.fillStyle = '#c8c8d4'; ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 断章「二人の祈り手」専用シーン(色彩設計: 灰紅の余燼→金と藍の対峙→白の縫合→緑青の薄明) =====
  // 膝をつき、手を組んで祈る人影
  function drawPrayerFig(x, y, s, dir, col, sway) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); ctx.rotate(sway || 0);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, 6, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); // 畳んだ脚
    ctx.beginPath(); ctx.ellipse(1, -10, 8, 13, 0.16, 0, Math.PI * 2); ctx.fill(); // 前傾の胴
    ctx.beginPath(); ctx.arc(6, -24, 5.5, 0, Math.PI * 2); ctx.fill(); // 俯く頭
    ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(11, -18); ctx.stroke(); // 組んだ手
    ctx.restore();
  }
  function scPrAsh(t, now) {
    const hz = H * 0.68;
    // 残照の灰紅
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#221a1e'); sky.addColorStop(0.7, '#38282a'); sky.addColorStop(1, '#553630');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    const gnd = ctx.createLinearGradient(0, hz, 0, H); gnd.addColorStop(0, '#191214'); gnd.addColorStop(1, '#0d090b');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 灰の起伏
    ctx.fillStyle = '#150f11';
    for (let i = 0; i < 6; i++) { const x = (i + 0.5) * W / 6; ctx.beginPath(); ctx.arc(x, hz + 12, 20 + (i % 3) * 8, 0, Math.PI); ctx.fill(); }
    // 王の斃れた浅い窪み(微かな熾)
    const cxx = W / 2;
    const cg = ctx.createRadialGradient(cxx, hz + 16, 4, cxx, hz + 16, 90);
    cg.addColorStop(0, 'rgba(200,110,90,0.14)'); cg.addColorStop(1, 'rgba(200,110,90,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cxx, hz + 16, 90, 30, 0, 0, 7); ctx.fill();
    // 降りしきる灰
    for (let i = 0; i < pn(34); i++) {
      const x = (i * 89 + Math.sin(now * 0.0006 + i) * 24 + W) % W;
      const y = ((i * 53 + now * 0.028 * (1 + i % 3)) % (H + 20)) - 10;
      ctx.globalAlpha = 0.12 + (i % 3) * 0.08;
      ctx.fillStyle = i % 5 ? '#b8b0ac' : '#d8a090'; ctx.fillRect(x, y, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
    // ふたつの小さな灯: 金と藍、互い違いに脈打ちながら寄り添う
    const bob = Math.sin(now * 0.0016) * 6;
    const p1 = 0.5 + Math.sin(now * 0.002) * 0.4, p2 = 0.5 + Math.sin(now * 0.002 + Math.PI) * 0.4;
    const y1 = hz - 8 + bob, y2 = hz - 8 - bob;
    const g1 = ctx.createRadialGradient(cxx - 34, y1, 2, cxx - 34, y1, 44);
    g1.addColorStop(0, 'rgba(255,216,140,' + (0.35 + p1 * 0.3) + ')'); g1.addColorStop(1, 'rgba(255,216,140,0)');
    ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cxx - 34, y1, 44, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe2a0'; ctx.fillRect(cxx - 36, y1 - 2, 4, 4);
    const g2 = ctx.createRadialGradient(cxx + 34, y2, 2, cxx + 34, y2, 44);
    g2.addColorStop(0, 'rgba(150,170,255,' + (0.35 + p2 * 0.3) + ')'); g2.addColorStop(1, 'rgba(150,170,255,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cxx + 34, y2, 44, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0ccff'; ctx.fillRect(cxx + 32, y2 - 2, 4, 4);
    // 灯の下の照り返し
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(cxx - 34, hz + 18, 30, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9fb0ff'; ctx.beginPath(); ctx.ellipse(cxx + 34, hz + 18, 30, 6, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function scPrTwo(t, now) {
    const cx = W / 2;
    // ひとつの空が、すでに割れかけている——左は最後の金昏、右は先んじる藍夜
    const warm = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    warm.addColorStop(0, '#3a2a1c'); warm.addColorStop(0.6, '#7a4a26'); warm.addColorStop(1, '#cc8848');
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H * 0.72);
    const cool = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0);
    cool.addColorStop(0, 'rgba(14,16,50,0)'); cool.addColorStop(1, 'rgba(14,16,50,0.94)');
    ctx.fillStyle = cool; ctx.fillRect(cx - 90, 0, W - cx + 90, H * 0.72);
    // 右の空にだけ星
    for (let i = 0; i < pn(24); i++) { const x = cx + 50 + (i * 67) % (W - cx - 56), y = (i * 41) % (H * 0.5); ctx.globalAlpha = 0.25 + Math.abs(Math.sin(now * 0.0012 + i)) * 0.5; ctx.fillStyle = '#cfd8ff'; ctx.fillRect(x, y, 1.5, 1.5); }
    ctx.globalAlpha = 1;
    // 左の低い夕陽 / 右の細い月
    const sg = ctx.createRadialGradient(W * 0.14, H * 0.56, 4, W * 0.14, H * 0.56, 110);
    sg.addColorStop(0, 'rgba(255,214,140,0.75)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W * 0.14, H * 0.56, 110, 0, 7); ctx.fill();
    ctx.fillStyle = '#dce6ff'; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.16, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#0f1234'; ctx.beginPath(); ctx.arc(W * 0.86 + 5, H * 0.16 - 4, 10.5, 0, 7); ctx.fill();
    // 丘
    ctx.fillStyle = '#150f0c';
    ctx.beginPath(); ctx.moveTo(0, H * 0.74);
    ctx.quadraticCurveTo(cx, H * 0.44, W, H * 0.74); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 背中合わせの祈り手(ゆっくり息づく)
    const sway = Math.sin(now * 0.0018) * 0.03, top = H * 0.585;
    drawPrayerFig(cx - 15, top, 2.0, -1, '#0c0906', sway);
    drawPrayerFig(cx + 15, top, 2.0, 1, '#0c0906', -sway);
    // 縁光(左は金、右は藍)
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,206,130,0.5)'; ctx.beginPath(); ctx.arc(cx - 27, top - 48, 12, 1.8, 3.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,170,255,0.5)'; ctx.beginPath(); ctx.arc(cx + 27, top - 48, 12, -0.5, 1.3); ctx.stroke();
    // それぞれの祈りが、細い光片となって昇る
    for (let i = 0; i < pn(12); i++) {
      const side = i % 2 ? 1 : -1, ph = ((now * 0.00018 + i * 0.17) % 1);
      const x = cx + side * (26 + (i % 4) * 8) + Math.sin(ph * 6 + i) * 6;
      const y = top - 40 - ph * H * 0.34;
      ctx.globalAlpha = (1 - ph) * 0.55;
      ctx.fillStyle = side > 0 ? '#b0c0ff' : '#ffd9a0'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function scPrOne(t, now) {
    // 無明の空間 — ふたつの残像が歩み寄り、ひとつに重なる
    const cx = W / 2, cy = H * 0.46;
    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#241c30'); bg.addColorStop(1, '#080610');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const k = easeInOutCubic(clamp01(t * 1.25)), off = (1 - k) * W * 0.22;
    const merge = clamp01((t - 0.62) / 0.38);
    // 左右の色の帳(重なるほど退いてゆく)
    ctx.globalAlpha = 0.14 * (1 - k); ctx.fillStyle = '#ffca80'; ctx.fillRect(0, 0, cx, H);
    ctx.fillStyle = '#8090ff'; ctx.fillRect(cx, 0, W - cx, H); ctx.globalAlpha = 1;
    // 双方から中心へ吸い寄せられる光片
    for (let i = 0; i < pn(20); i++) {
      const side = i % 2 ? 1 : -1, ph = ((now * 0.00028 + i * 0.11) % 1);
      const x = cx + side * (W * 0.42) * (1 - ph), y = cy + Math.sin(i * 2.7) * H * 0.24 * (1 - ph);
      ctx.globalAlpha = ph * 0.5;
      ctx.fillStyle = side > 0 ? '#b0c0ff' : '#ffd9a0'; ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // 金の祈り手と藍の祈り手(加算合成で、重なった処が白へ)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 - merge * 0.6;
    drawPrayerFig(cx - off - 8, cy + 44, 2.4, -1, 'rgba(255,190,110,0.75)', Math.sin(now * 0.0018) * 0.02);
    drawPrayerFig(cx + off + 8, cy + 44, 2.4, 1, 'rgba(120,140,255,0.75)', -Math.sin(now * 0.0018) * 0.02);
    ctx.restore(); ctx.globalAlpha = 1;
    // 重なった刹那——ひとりの祈り手と、体を貫く白の縫い目
    if (merge > 0) {
      const hg = ctx.createRadialGradient(cx, cy + 10, 4, cx, cy + 10, 130 + merge * 60);
      hg.addColorStop(0, 'rgba(255,248,230,' + (0.20 + merge * 0.25) + ')'); hg.addColorStop(1, 'rgba(255,248,230,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy + 10, 200, 0, 7); ctx.fill();
      ctx.globalAlpha = merge * 0.95;
      drawPrayerFig(cx - 1, cy + 44, 2.4, -1, '#efe8da', 0);
      drawPrayerFig(cx + 1, cy + 44, 2.4, 1, '#efe8da', 0);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,246,' + (0.5 + Math.sin(now * 0.006) * 0.2) + ')'; ctx.lineWidth = 2;
      ctx.shadowColor = '#fff6d8'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(cx, cy - 78); ctx.lineTo(cx, cy + 66); ctx.stroke(); ctx.shadowBlur = 0;
      const ring = (merge * 1.1) % 1;
      ctx.strokeStyle = 'rgba(255,244,210,' + (1 - ring) * 0.35 + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy + 6, 20 + ring * 170, 0, 7); ctx.stroke();
    }
  }
  function scPrQuiet(t, now) {
    const hz = H * 0.70, k = easeInOutCubic(t);
    // 緑青の薄明 — 灰の野に、最初の色が還る
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0c211e'); sky.addColorStop(0.6, '#26504a'); sky.addColorStop(1, '#6f9c80');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    const dg = ctx.createRadialGradient(W * 0.55, hz, 6, W * 0.55, hz, 160);
    dg.addColorStop(0, 'rgba(200,240,210,0.30)'); dg.addColorStop(1, 'rgba(200,240,210,0)');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(W * 0.55, hz, 160, 0, 7); ctx.fill();
    const gnd = ctx.createLinearGradient(0, hz, 0, H); gnd.addColorStop(0, '#16211b'); gnd.addColorStop(1, '#0a0f0b');
    ctx.fillStyle = gnd; ctx.fillRect(0, hz, W, H - hz);
    // 灰の野に、小さな芽の煌めき
    for (let i = 0; i < pn(20); i++) {
      const x = (i * 83) % W, y = hz + 8 + (i * 29) % (H - hz - 16);
      ctx.globalAlpha = 0.15 + 0.35 * Math.abs(Math.sin(now * 0.0014 + i * 1.7));
      ctx.fillStyle = i % 3 ? '#9fd8b0' : '#e8ffe0'; ctx.fillRect(x, y, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
    // ふたつの灯が螺旋を描いて昇り、高みでひとつに
    const cxx = W * 0.55, y0 = hz - 6, rise = k * H * 0.52;
    const sep = (1 - k) * 42 + 5, ang = now * 0.003;
    const yA = y0 - rise, xA = cxx + Math.cos(ang) * sep, xB = cxx - Math.cos(ang) * sep;
    const mg2 = clamp01((t - 0.78) / 0.22);
    if (mg2 < 1) {
      const ga = ctx.createRadialGradient(xA, yA, 2, xA, yA, 30);
      ga.addColorStop(0, 'rgba(255,216,140,' + (0.6 - mg2 * 0.4) + ')'); ga.addColorStop(1, 'rgba(255,216,140,0)');
      ctx.fillStyle = ga; ctx.beginPath(); ctx.arc(xA, yA, 30, 0, 7); ctx.fill();
      const gb = ctx.createRadialGradient(xB, yA + 8, 2, xB, yA + 8, 30);
      gb.addColorStop(0, 'rgba(150,170,255,' + (0.6 - mg2 * 0.4) + ')'); gb.addColorStop(1, 'rgba(150,170,255,0)');
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(xB, yA + 8, 30, 0, 7); ctx.fill();
    }
    if (mg2 > 0) { // 合一の白緑のひかり
      const gm = ctx.createRadialGradient(cxx, yA, 2, cxx, yA, 46 + mg2 * 24);
      gm.addColorStop(0, 'rgba(230,255,238,' + (0.5 + mg2 * 0.35) + ')'); gm.addColorStop(1, 'rgba(230,255,238,0)');
      ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(cxx, yA, 70, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(230,255,238,' + (1 - mg2) * 0.4 + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cxx, yA, 8 + mg2 * 90, 0, 7); ctx.stroke();
    }
    // 昇った跡に残る光の尾
    for (let i = 0; i < pn(14); i++) {
      const ph = i / 14, ty = y0 - rise * ph, sp = (1 - k * ph) * 42 + 5;
      const tx = cxx + Math.cos(ang - ph * 2.2) * sp * (i % 2 ? 1 : -1);
      ctx.globalAlpha = 0.10 + ph * 0.18;
      ctx.fillStyle = i % 2 ? '#b0c0ff' : '#ffd9a0'; ctx.fillRect(tx, ty, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
    // 見送る旅人(左下、静かに)
    drawWalkerFig(W * 0.18, hz + 34, 1.8, '#0b120d', 1, 0);
  }

  // ===== 空島 到達/帰還ムービー(固有) — 白金と青碧の色彩設計 =====
  function skyBg(top, mid, bot) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function cloudBlob(x, y, s, a) { ctx.globalAlpha = a; ctx.fillStyle = '#eef5fb'; for (let i = 0; i < 5; i++) { const ox = (i - 2) * s * 0.5, oy = Math.sin(i * 1.7) * s * 0.18; ctx.beginPath(); ctx.ellipse(x + ox, y + oy, s * 0.5, s * 0.34, 0, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  // 祭壇の風が渦を巻いて立ちのぼる
  function scSkyAltar(t, now) {
    const hz = H * 0.7;
    skyBg('#b7a26a', '#d9c98f', '#8a7a5a'); // 夕映えの高地
    ctx.fillStyle = '#2a2418'; ctx.fillRect(0, hz, W, H - hz); // 大地
    // 祭壇(石)
    const cx = W / 2; ctx.fillStyle = '#4a4636'; ctx.fillRect(cx - 26, hz - 34, 52, 40); ctx.fillStyle = '#5c5844'; ctx.fillRect(cx - 32, hz - 8, 64, 12);
    // 渦巻く風(白い弧が上昇しながら回る)
    ctx.strokeStyle = 'rgba(245,248,235,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const p = ((now * 0.0009 + i / 7) % 1);
      const yy = hz - 20 - p * (hz - 40) * (0.4 + t * 0.9);
      const rad = (1 - p) * 40 + 6, a0 = now * 0.004 + i;
      ctx.globalAlpha = (1 - p) * 0.8 * Math.min(1, t * 1.5);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a0) * rad * 0.4, yy, rad, a0, a0 + 2.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawWalkerFig(cx, hz + 4, 1.7, '#0d0b06', 1, 0); // 祭壇の傍らの旅人
  }
  // 雲を貫いて昇る
  function scSkyAscend(t, now) {
    skyBg('#7fb8dc', '#a9d4ec', '#dfeef8');
    // 下へ流れる雲の筋(=上昇のパララックス)
    for (let i = 0; i < 10; i++) {
      const sp = 0.06 + (i % 3) * 0.03;
      const yy = ((i * 90 + now * sp * (1 + t * 2)) % (H + 120)) - 60;
      cloudBlob((i * 71 % W), yy, 70 + (i % 3) * 26, 0.5);
    }
    // 上昇する小さな人影(中心、少しずつ上へ)
    const fy = H * (0.8 - t * 0.5);
    ctx.globalAlpha = 1; drawWalkerFig(W / 2, fy, 1.5 + t * 0.5, '#20303c', 1, 0);
    // 光条
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now * 0.005); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2 - 60, H); ctx.lineTo(W / 2 + 60, H); ctx.fill(); ctx.globalAlpha = 1;
  }
  // 雲海のうえに浮島の群れがひらける
  function scSkyReveal(t, now) {
    skyBg('#8fd0e8', '#bfe8f2', '#eaf7fb');
    // 太陽グロー
    const sg = ctx.createRadialGradient(W * 0.72, H * 0.28, 4, W * 0.72, H * 0.28, 140);
    sg.addColorStop(0, 'rgba(255,250,220,0.9)'); sg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // 雲海
    for (let i = 0; i < 8; i++) cloudBlob((i * 97 + (now * 0.01) % W) % W, H * 0.72 + (i % 2) * 26, 90, 0.7);
    // 浮島(手前ほど大きく、tで迫り上がる)
    const isl = [[0.3, 0.5, 1], [0.6, 0.42, 0.8], [0.8, 0.6, 1.2], [0.15, 0.66, 0.9]];
    for (let i = 0; i < isl.length; i++) {
      const ix = isl[i][0] * W, iy = isl[i][1] * H + (1 - t) * 60, sc = isl[i][2];
      ctx.fillStyle = '#2f7d47'; ctx.beginPath(); ctx.ellipse(ix, iy, 34 * sc, 10 * sc, 0, 0, Math.PI * 2); ctx.fill(); // 草地の天面
      ctx.fillStyle = '#8a7150'; ctx.beginPath(); ctx.moveTo(ix - 30 * sc, iy); ctx.lineTo(ix + 30 * sc, iy); ctx.lineTo(ix, iy + 34 * sc); ctx.fill(); // 岩の底
      ctx.fillStyle = '#d8ecdf'; ctx.fillRect(ix - 3 * sc, iy - 20 * sc, 6 * sc, 20 * sc); // 風化した柱
    }
  }
  // 帰還: 雲の切れ間から緑の大地が近づく
  function scSkyDescend(t, now) {
    skyBg('#a9d4ec', '#cfe6f2', '#dfeed8');
    for (let i = 0; i < 10; i++) { const yy = ((i * 80 - now * (0.08 + t * 0.16)) % (H + 120) + H + 120) % (H + 120) - 60; cloudBlob((i * 83 % W), yy, 74, 0.5); }
    // 下方に迫る緑地
    const gy = H * (1.15 - t * 0.5); ctx.fillStyle = '#3a7d3a'; ctx.beginPath(); ctx.ellipse(W / 2, gy + 120, W * 0.9, 130, 0, 0, Math.PI * 2); ctx.fill();
    drawWalkerFig(W / 2, H * (0.3 + t * 0.4), 1.5, '#20303c', 1, 0);
  }

  function playSkyArrival(cb) {
    runScenes([
      { d: 3000, draw: scSkyAltar, text: '風の祭壇に立つと、渦が足もとから立ちのぼった。', onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('mystic'); try { Game.Audio.play('portal'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('riser'); } },
      { d: 3000, draw: scSkyAscend, text: '雲を貫いて、からだが空へと運ばれてゆく。', shake: 0.25, onEnter: function () { if (Game.Audio.cue) Game.Audio.cue('swell'); } },
      { d: 3400, draw: scSkyReveal, text: '——雲海のうえに、浮島の群れがひらけた。', onEnter: function () { try { Game.Audio.play('portal_arrive'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('shimmer'); } },
    ], cb);
  }
  function playSkyReturn(cb) {
    runScenes([
      { d: 2800, draw: scSkyDescend, text: '雲の切れ間から、緑の大地が近づいてくる。', onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('mystic'); try { Game.Audio.play('portal'); } catch (e) {} } },
    ], cb, { subdued: true });
  }

  // ===== 古代都市 到達/帰還ムービー(固有) — 砂金と苔翠、荘厳と郷愁の色彩 =====
  function ruinBg(top, mid, bot) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function pillar(x, base, h, w, col) { ctx.fillStyle = col; ctx.fillRect(x - w / 2, base - h, w, h); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + w / 2 - 3, base - h, 3, h); ctx.fillStyle = col; ctx.fillRect(x - w / 2 - 4, base - h - 6, w + 8, 6); }
  // 門がひらく
  function scRuinGate(t, now) {
    ruinBg('#6a5e3e', '#9a865a', '#3a3020');
    ctx.fillStyle = '#241d10'; ctx.fillRect(0, H * 0.72, W, H); // 大地
    const cx = W / 2, base = H * 0.72;
    // 石の枠門
    pillar(cx - 46, base, 150, 22, '#8a8270'); pillar(cx + 46, base, 150, 22, '#8a8270');
    ctx.fillStyle = '#9a9480'; ctx.fillRect(cx - 62, base - 156, 124, 18); // 楣
    // 門内の琥珀光(tで満ちる)
    const gg = ctx.createLinearGradient(0, base - 150, 0, base); gg.addColorStop(0, 'rgba(240,224,150,' + (0.2 + t * 0.6) + ')'); gg.addColorStop(1, 'rgba(216,192,120,0.1)');
    ctx.fillStyle = gg; ctx.fillRect(cx - 34, base - 148, 68, 148);
    // 紋様の明滅
    ctx.strokeStyle = 'rgba(216,192,120,' + (0.5 + 0.4 * Math.sin(now * 0.006)) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, base - 74, 26, 0, Math.PI * 2); ctx.stroke();
    drawWalkerFig(cx, base + 4, 1.7, '#0d0a04', 1, 0);
  }
  // 沈黙の大路をゆく
  function scRuinStreet(t, now) {
    ruinBg('#8a7a52', '#b8a878', '#5a5038');
    // 遠近の列柱(両側、tで奥へ流れる)
    for (let i = 0; i < 6; i++) {
      const p = ((i / 6 + now * 0.00008 * (1 + t)) % 1);
      const sc = 0.3 + p * 1.4, yy = H * 0.5 + p * H * 0.4;
      pillar(W / 2 - (30 + p * 240), yy, 60 * sc, 12 * sc, '#a89f7e');
      pillar(W / 2 + (30 + p * 240), yy, 60 * sc, 12 * sc, '#a89f7e');
    }
    // 苔むした石畳の道(中央)
    ctx.fillStyle = '#6a6244'; ctx.beginPath(); ctx.moveTo(W / 2 - 30, H); ctx.lineTo(W / 2 + 30, H); ctx.lineTo(W / 2 + 8, H * 0.5); ctx.lineTo(W / 2 - 8, H * 0.5); ctx.fill();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#3a5a2a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W / 2 + (Math.sin(i * 2) * 20), H * 0.6 + i * 30, 4, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
    drawWalkerFig(W / 2, H * 0.86, 1.6, '#20180c', 1, (now * 0.004 | 0) % 2 ? 2 : -2);
  }
  // 都市の全景がひらける
  function scRuinReveal(t, now) {
    ruinBg('#9a8a5a', '#c8b884', '#6a5e3e');
    // 陽光
    const sg = ctx.createRadialGradient(W * 0.28, H * 0.24, 4, W * 0.28, H * 0.24, 150);
    sg.addColorStop(0, 'rgba(255,244,200,0.9)'); sg.addColorStop(1, 'rgba(255,244,200,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // 都市のスカイライン(崩れた尖塔と円蓋)
    const base = H * 0.72; ctx.fillStyle = '#7a6f4c';
    for (let i = 0; i < 7; i++) { const bx = (i + 0.5) * W / 7, bh = 40 + ((i * 37) % 60) * (0.5 + t * 0.6); ctx.fillRect(bx - 16, base - bh, 32, bh); if (i % 2) { ctx.beginPath(); ctx.arc(bx, base - bh, 16, Math.PI, 0); ctx.fill(); } }
    // 手前の列柱
    pillar(W * 0.2, base + 20, 90, 16, '#b0a884'); pillar(W * 0.8, base + 20, 90, 16, '#b0a884');
    ctx.fillStyle = '#2e2716'; ctx.fillRect(0, base + 18, W, H); // 手前の地面
    // 水濠のきらめき
    ctx.fillStyle = 'rgba(90,120,150,0.4)'; ctx.fillRect(0, base + 12, W, 8);
  }
  // 帰還: 門をくぐり大地へ戻る
  function scRuinReturn(t, now) {
    ruinBg('#b8a878', '#cfc196', '#7a8a5a');
    const cx = W / 2, base = H * 0.7; pillar(cx - 44, base, 140, 20, '#a8a290'); pillar(cx + 44, base, 140, 20, '#a8a290');
    ctx.fillStyle = 'rgba(160,208,180,' + (0.3 + t * 0.4) + ')'; ctx.fillRect(cx - 32, base - 138, 64, 138);
    ctx.fillStyle = '#2e3418'; ctx.fillRect(0, base + 2, W, H);
    drawWalkerFig(cx, base + 4, 1.5 + t * 0.4, '#20180c', 1, 0);
  }

  function playRuinArrival(cb) {
    runScenes([
      { d: 3000, draw: scRuinGate, text: '古の鍵をかざすと、門の紋様が金に燃えた。', onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('mystic'); try { Game.Audio.play('portal'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('boom'); } },
      { d: 3200, draw: scRuinStreet, text: '誰もいない大路を、苔と沈黙だけが埋めている。', onEnter: function () { try { Game.Audio.play('ancient_hum'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('choir'); } },
      { d: 3400, draw: scRuinReveal, text: '——沈黙の都市が、崩れた尖塔ごとひらけた。', onEnter: function () { try { Game.Audio.play('portal_arrive'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('swell'); } },
    ], cb);
  }
  function playRuinReturn(cb) {
    runScenes([
      { d: 2800, draw: scRuinReturn, text: '門をくぐると、見慣れた大地の匂いが戻ってきた。', onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('mystic'); try { Game.Audio.play('portal'); } catch (e) {} } },
    ], cb, { subdued: true });
  }

  // ===== 狭間 到達/帰還ムービー(固有) — 紫と青碧の不穏なあわい =====
  function riftBg2() { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0614'); g.addColorStop(0.5, '#241038'); g.addColorStop(1, '#08040e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // 裂け目がひらく
  function scRiftOpen(t, now) {
    riftBg2();
    const cx = W / 2, cy = H / 2;
    // 縦に裂ける虚空(tで広がる)
    const wdt = 6 + t * 90;
    const rg = ctx.createLinearGradient(cx - wdt, 0, cx + wdt, 0); rg.addColorStop(0, '#0a0614'); rg.addColorStop(0.5, '#b088e8'); rg.addColorStop(1, '#0a0614');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.5); ctx.lineTo(cx + wdt, cy); ctx.lineTo(cx, cy + H * 0.5); ctx.lineTo(cx - wdt, cy); ctx.fill();
    ctx.strokeStyle = 'rgba(120,232,220,' + (0.5 + 0.4 * Math.sin(now * 0.008)) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.5); ctx.lineTo(cx, cy + H * 0.5); ctx.stroke();
    // 吸い込まれる粒子
    ctx.fillStyle = 'rgba(200,160,255,0.8)';
    for (let i = 0; i < 20; i++) { const a = i * 0.9 + now * 0.003; const r = (1 - ((i * 0.05 + now * 0.0009) % 1)) * 160; ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 2, 2); }
    drawWalkerFig(cx, cy + H * 0.4, 1.5, '#1a1030', 1, 0);
  }
  // あわいを落ちてゆく
  function scRiftFall(t, now) {
    riftBg2();
    // 上へ流れる割れた足場の影(=落下)
    ctx.fillStyle = 'rgba(122,90,168,0.5)';
    for (let i = 0; i < 8; i++) { const yy = ((i * 120 - now * (0.14 + t * 0.2)) % (H + 120) + H + 120) % (H + 120) - 60; const xx = (i * 71) % W; ctx.save(); ctx.translate(xx, yy); ctx.rotate(i); ctx.fillRect(-18, -6, 36, 12); ctx.restore(); }
    ctx.fillStyle = 'rgba(232,208,255,0.7)'; for (let i = 0; i < 14; i++) { const yy = ((i * 60 - now * 0.3) % H + H) % H; ctx.fillRect((i * 53) % W, yy, 1.5, 6); } // 流れる光条
    const fy = H * (0.3 + t * 0.4); ctx.save(); ctx.translate(W / 2, fy); ctx.rotate(Math.sin(now * 0.004) * 0.3); drawWalkerFig(0, 0, 1.5, '#241840', 1, 0); ctx.restore();
  }
  // あわいがひらける
  function scRiftReveal(t, now) {
    riftBg2();
    // 宙に浮く割れた足場群
    const plats = [[0.3, 0.55, 1], [0.62, 0.45, 0.9], [0.8, 0.62, 1.1], [0.16, 0.66, 0.85], [0.5, 0.7, 1.2]];
    for (let i = 0; i < plats.length; i++) {
      const ix = plats[i][0] * W, iy = plats[i][1] * H + (1 - t) * 50, sc = plats[i][2];
      ctx.fillStyle = '#3a2a52'; ctx.beginPath(); ctx.ellipse(ix, iy, 32 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.moveTo(ix - 28 * sc, iy); ctx.lineTo(ix + 28 * sc, iy); ctx.lineTo(ix, iy + 30 * sc); ctx.fill();
      ctx.fillStyle = '#a888e0'; ctx.beginPath(); ctx.moveTo(ix, iy - 18 * sc); ctx.lineTo(ix + 3 * sc, iy - 4 * sc); ctx.lineTo(ix - 3 * sc, iy - 4 * sc); ctx.fill(); // 尖晶
    }
    // 遠くの巨大な裂け目
    ctx.strokeStyle = 'rgba(176,136,232,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.72, 0); ctx.lineTo(W * 0.76, H); ctx.stroke();
    ctx.fillStyle = 'rgba(120,232,220,0.15)'; ctx.fillRect(0, 0, W, H);
  }
  function scRiftReturn(t, now) {
    riftBg2();
    const cx = W / 2, cy = H / 2, wdt = 90 - t * 84;
    const rg = ctx.createLinearGradient(cx - wdt - 1, 0, cx + wdt + 1, 0); rg.addColorStop(0, '#0a0614'); rg.addColorStop(0.5, '#7fd8c0'); rg.addColorStop(1, '#0a0614');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.5); ctx.lineTo(cx + wdt + 1, cy); ctx.lineTo(cx, cy + H * 0.5); ctx.lineTo(cx - wdt - 1, cy); ctx.fill();
    drawWalkerFig(cx, cy + H * 0.35, 1.5 + t * 0.3, '#241840', 1, 0);
  }

  function playRiftArrival(cb) {
    runScenes([
      { d: 3000, draw: scRiftOpen, text: '虚ろな鍵をかざすと、空間が縦に裂けた。', shake: 0.3, onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('liminal'); try { Game.Audio.play('portal'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('crack'); } },
      { d: 3200, draw: scRiftFall, text: '光でも影でもない、あわいを落ちてゆく。', shake: 0.2, onEnter: function () { if (Game.Audio.cue) Game.Audio.cue('riser'); } },
      { d: 3400, draw: scRiftReveal, text: '——世界の隙間に、割れた足場が浮かんでいた。', onEnter: function () { try { Game.Audio.play('portal_arrive'); } catch (e) {} if (Game.Audio.cue) Game.Audio.cue('shimmer'); } },
    ], cb);
  }
  function playRiftReturn(cb) {
    runScenes([
      { d: 2800, draw: scRiftReturn, text: '裂け目が閉じ、影の大地の冷気が戻ってきた。', onEnter: function () { if (Game.Audio.cineStart) Game.Audio.cineStart('liminal'); try { Game.Audio.play('portal'); } catch (e) {} } },
    ], cb, { subdued: true });
  }

  // 断章データ(story.js)の fx キー → 専用描画。汎用章は scStory
  const STORYFX = {
    chr_dusk: scChrDusk, chr_carve: scChrCarve, chr_stones: scChrStones, chr_dawn: scChrDawn,
    sw_meadow: scSwMeadow, sw_mirror: scSwMirror, sw_cross: scSwCross, sw_price: scSwPrice,
    pr_ash: scPrAsh, pr_two: scPrTwo, pr_one: scPrOne, pr_quiet: scPrQuiet,
  };

  function playStory(frag, cb, opts) {
    if (!frag || !frag.scenes || !frag.scenes.length) { if (cb) cb(); return; }
    const subdued = !!(opts && opts.subdued); // 再見: 短縮+控えめ演出
    // 章ごとに哀愁/神秘のBGMを選ぶ(再会・統合は高揚、終章は神秘)
    const mood = (frag.id === 'reunion' || frag.id === 'endbringer') ? 'heroic' : (/star|abyss|phase|traveler|cycle|firstwalker/.test(frag.id || '') ? 'mystic' : 'somber');
    const scenes = frag.scenes.map(function (s, i) {
      const fx = s.fx && STORYFX[s.fx];
      return {
        d: Math.round((s.d || 4800) * (subdued ? 0.6 : 1)),
        draw: fx ? function (t, now) { fx(t, now); } : function (t, now) { scStory(t, now, s); },
        text: s.text, shake: 0.05,
        onEnter: function () { if (i === 0 && Game.Audio.cineStart) Game.Audio.cineStart(mood); if (s.audio && Game.Audio.cue) Game.Audio.cue(s.audio); }
      };
    });
    runScenes(scenes, cb, { subdued: subdued });
  }
  return { play, playLaunch, playDiscovery, playBossIntro, playBossOutro, playStory, playSkyArrival, playSkyReturn, playRuinArrival, playRuinReturn, playRiftArrival, playRiftReturn, skip: finish, isPlaying: function () { return playing; } };
})();
