// cutscene.js — はじめから時のアニメーション・オープニング（二相世界の神話）
window.Game = window.Game || {};

Game.Cutscene = (function () {
  let cv, ctx, raf, onDone, t0, skipBtn, playing = false, W = 0, H = 0;

  const SCENES = [
    { d: 3600, draw: sceneUnified, text: 'かつて、世界はひとつだった。' },
    { d: 4200, draw: scenePrayers, text: '「永遠の昼」を願う者と、「安らぎの夜」を望む者。' },
    { d: 4200, draw: sceneSplit, text: '相反するふたつの祈りが、大地を引き裂いた。' },
    { d: 4000, draw: sceneDescend, text: 'いま、あなたは世界の狭間に降り立つ——' },
  ];
  const TOTAL = SCENES.reduce(function (a, s) { return a + s.d; }, 0);

  function play(cb) {
    onDone = cb; playing = true;
    cv = document.createElement('canvas');
    cv.id = 'cutscene-canvas';
    cv.style.cssText = 'position:absolute;inset:0;z-index:60;background:#05070e;touch-action:none';
    document.getElementById('app').appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    skipBtn = document.createElement('button');
    skipBtn.id = 'cutscene-skip'; skipBtn.textContent = 'スキップ ▶';
    skipBtn.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
    document.getElementById('app').appendChild(skipBtn);
    cv.addEventListener('click', finish);
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    if (!playing) return;
    let e = now - t0;
    if (e >= TOTAL) { finish(); return; }
    // 現在シーン
    let acc = 0, sc = SCENES[0], local = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (e < acc + SCENES[i].d) { sc = SCENES[i]; local = (e - acc) / SCENES[i].d; break; }
      acc += SCENES[i].d;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070e'; ctx.fillRect(0, 0, W, H);
    sc.draw(local, now);
    drawText(sc.text, local);
    // 全体フェードイン/アウト
    if (e < 600) { ctx.fillStyle = 'rgba(5,7,14,' + (1 - e / 600) + ')'; ctx.fillRect(0, 0, W, H); }
    if (e > TOTAL - 700) { ctx.fillStyle = 'rgba(5,7,14,' + ((e - (TOTAL - 700)) / 700) + ')'; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    if (skipBtn && skipBtn.parentNode) skipBtn.parentNode.removeChild(skipBtn);
    if (onDone) onDone();
  }

  function drawText(txt, local) {
    let a = 1;
    if (local < 0.15) a = local / 0.15;
    else if (local > 0.85) a = (1 - local) / 0.15;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = '#eef0ff';
    ctx.font = (W < 460 ? 16 : 22) + 'px -apple-system,"Hiragino Sans",sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
    wrapText(txt, W / 2, H * 0.82, W * 0.86, (W < 460 ? 24 : 32));
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  function wrapText(text, cx, cy, maxW, lh) {
    const parts = text.split('、');
    let lines = [], cur = '';
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i] + (i < parts.length - 1 ? '、' : '');
      if (ctx.measureText(cur + seg).width > maxW && cur) { lines.push(cur); cur = seg; }
      else cur += seg;
    }
    if (cur) lines.push(cur);
    const startY = cy - (lines.length - 1) * lh / 2;
    lines.forEach(function (ln, i) { ctx.fillText(ln, cx, startY + i * lh); });
  }

  // ===== シーン =====
  function sceneUnified(t, now) {
    // 平和な統一世界＋昇る陽
    const horizon = H * 0.62;
    ctx.fillStyle = '#11305a'; ctx.fillRect(0, 0, W, horizon);
    // 陽
    const sy = horizon - 30 - t * 40;
    const g = ctx.createRadialGradient(W / 2, sy, 8, W / 2, sy, 90);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, sy, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(W / 2, sy, 26, 0, Math.PI * 2); ctx.fill();
    // 大地
    ctx.fillStyle = '#2f7d3a'; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#3c9647';
    for (let i = 0; i < 7; i++) { const x = (i + 0.5) * W / 7; ctx.beginPath(); ctx.arc(x, horizon + 14, 18 + (i % 3) * 6, 0, Math.PI); ctx.fill(); }
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

  return { play, isPlaying: function () { return playing; } };
})();
