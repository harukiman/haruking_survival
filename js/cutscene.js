// cutscene.js — はじめから時のアニメーション・オープニング（二相世界の神話）
window.Game = window.Game || {};

Game.Cutscene = (function () {
  let cv, ctx, raf, onDone, t0, skipBtn, playing = false, W = 0, H = 0, curScene = -1, shakeMag = 0, clickArmedAt = 0;
  // モバイルで「はじめから」タップが新規キャンバスへ貫通し即スキップされるのを防ぐ
  function canvasClick() { if (performance.now() >= clickArmedAt) finish(); }

  const SCENES = [
    { d: 4400, draw: sceneUnified, text: 'かつて、世界はひとつだった。', onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('swell'); } },
    { d: 4600, draw: scenePrayers, text: '「永遠の昼」を願う者と、「安らぎの夜」を望む者。', onEnter: function () { Game.Audio.cue('choir'); } },
    { d: 2600, draw: sceneTension, text: 'ふたつの祈りは、譲らなかった——', shake: 0.35, onEnter: function () { Game.Audio.cue('riser'); } },
    { d: 4400, draw: sceneSplit, text: '相反する願いが、大地を引き裂いた。', shake: 1, onEnter: function () { Game.Audio.cue('impact'); Game.Audio.cue('crack'); } },
    { d: 4200, draw: sceneDescend, text: 'いま、あなたは世界の狭間に降り立つ——', shake: 0.2, onEnter: function () { Game.Audio.cue('shimmer'); } },
    { d: 4600, draw: sceneTitle, text: '', onEnter: function () { Game.Audio.cue('choir'); Game.Audio.cue('boom'); } },
  ];
  const TOTAL = SCENES.reduce(function (a, s) { return a + s.d; }, 0);

  function play(cb) {
    onDone = cb; playing = true; curScene = -1; shakeMag = 0;
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
    clickArmedAt = performance.now() + 800;
    cv.addEventListener('click', canvasClick);
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
    let acc = 0, sc = SCENES[0], local = 0, idx = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (e < acc + SCENES[i].d) { sc = SCENES[i]; local = (e - acc) / SCENES[i].d; idx = i; break; }
      acc += SCENES[i].d;
    }
    if (idx !== curScene) { curScene = idx; shakeMag = sc.shake || 0; if (sc.onEnter) try { sc.onEnter(); } catch (er) {} }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070e'; ctx.fillRect(0, 0, W, H);
    // カメラシェイク（シーン頭で強く→減衰）
    const decay = Math.max(0, 1 - local * 2.2);
    const sh = (Game.Settings && !Game.Settings.get('screenShake')) ? 0 : shakeMag * decay * 14;
    ctx.save();
    if (sh > 0.2) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    sc.draw(local, now);
    ctx.restore();
    if (sc.text) drawText(sc.text, local);
    // 全体フェードイン/アウト
    if (e < 600) { ctx.fillStyle = 'rgba(5,7,14,' + (1 - e / 600) + ')'; ctx.fillRect(0, 0, W, H); }
    if (e > TOTAL - 900) { ctx.fillStyle = 'rgba(5,7,14,' + ((e - (TOTAL - 900)) / 900) + ')'; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (Game.Audio && Game.Audio.cineStop) Game.Audio.cineStop();
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
      { d: 2600, draw: lcCountdown, text: '発射シーケンス…', onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('boom'); } },
      { d: 3200, draw: lcLiftoff, text: '点火——大地を蹴って、空へ', shake: 0.8, onEnter: function () { Game.Audio.cue('impact'); Game.Audio.cue('riser'); } },
      { d: 3400, draw: lcStars, text: '大気を抜け、星の海へ', onEnter: function () { Game.Audio.cue('shimmer'); Game.Audio.cue('swell'); } },
    ] : [
      { d: 2600, draw: lcReentry, text: '帰還——青き世界へ降りてゆく', onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('swell'); } },
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
  };
  function playDiscovery(kind, cb) {
    const d = DISCOVERY[kind] || DISCOVERY.dungeon;
    runScenes([{ d: 3400, draw: function (t, now) { scDiscovery(t, now, d); }, text: '', shake: kind === 'boss' ? 0.5 : 0.15, onEnter: function () { Game.Audio.cue(d.audio); } }], cb);
  }
  function scDiscovery(t, now, d) {
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.40;
    // 広がる光輪
    for (let r = 0; r < 3; r++) { const rr = ((t * 1.4 + r * 0.33) % 1); ctx.strokeStyle = d.col; ctx.globalAlpha = (1 - rr) * 0.5; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr * Math.max(W, H) * 0.6, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
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
  };
  function drawBossSilhouette(d, cx, cy, sc, mode) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.fillStyle = mode === 'fall' || mode === 'win' ? shadeHex(d.col, 0.5) : d.col;
    if (d.sil === 'beast') {
      ctx.beginPath(); ctx.moveTo(0, -30);
      for (let a = 0; a <= 12; a++) { const ang = a / 12 * Math.PI * 2; const r = 34 * (a % 2 ? 0.7 : 1); ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r * 0.8 + 6); }
      ctx.closePath(); ctx.fill();
    } else if (d.sil === 'orb') {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, '#fff'); g.addColorStop(0.5, d.col); g.addColorStop(1, shadeHex(d.col, 0.4));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.fill();
    } else {
      // 巨人/人型シルエット
      ctx.beginPath(); ctx.arc(0, -34, 16, 0, 7); ctx.fill(); // 頭
      ctx.fillRect(-22, -20, 44, 50); // 胴
      ctx.fillRect(-34, -16, 12, 38); ctx.fillRect(22, -16, 12, 38); // 腕
      ctx.fillRect(-18, 30, 14, 28); ctx.fillRect(4, 30, 14, 28); // 脚
    }
    // 光る眼
    ctx.fillStyle = mode === 'win' ? 'rgba(255,255,255,0.6)' : '#fff';
    ctx.shadowColor = d.col; ctx.shadowBlur = 16;
    ctx.fillRect(-10, -36, 5, 5); ctx.fillRect(5, -36, 5, 5); ctx.shadowBlur = 0;
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
    drawBossSilhouette(d, cx, sy, sc, mode);
    ctx.globalAlpha = 1;
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
      { d: 2800, draw: function (t, n) { bossScene(t, n, d, 'rise'); }, text: d.intro[0], shake: 0.35, onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('boom'); } },
      { d: 3000, draw: function (t, n) { bossScene(t, n, d, 'name'); }, text: d.intro[1], shake: 0.15, onEnter: function () { Game.Audio.cue('riser'); } },
    ], cb);
  }
  function playBossOutro(type, cb) {
    const d = BOSS[type] || BOSS.sovereign;
    runScenes([
      { d: 2600, draw: function (t, n) { bossScene(t, n, d, 'fall'); }, text: d.outro[0], shake: 0.6, onEnter: function () { Game.Audio.cineStart(); Game.Audio.cue('impact'); } },
      { d: 2800, draw: function (t, n) { bossScene(t, n, d, 'win'); }, text: d.outro[1], onEnter: function () { Game.Audio.cue('choir'); Game.Audio.cue('shimmer'); } },
    ], cb);
  }

  function runScenes(scenes, cb) {
    playing = true; onDone = cb; curScene = -1; shakeMag = 0;
    cv = document.createElement('canvas'); cv.id = 'cutscene-canvas';
    cv.style.cssText = 'position:absolute;inset:0;z-index:60;background:#03040a;touch-action:none';
    document.getElementById('app').appendChild(cv); ctx = cv.getContext('2d'); resize();
    window.addEventListener('resize', resize);
    skipBtn = document.createElement('button'); skipBtn.id = 'cutscene-skip'; skipBtn.textContent = 'スキップ ▶';
    skipBtn.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
    document.getElementById('app').appendChild(skipBtn);
    clickArmedAt = performance.now() + 700;
    cv.addEventListener('click', canvasClick);
    const total = scenes.reduce(function (a, s) { return a + s.d; }, 0);
    t0 = performance.now();
    (function loop(now) {
      if (!playing) return;
      const e = now - t0; if (e >= total) { finish(); return; }
      let acc = 0, sc = scenes[0], local = 0, idx = 0;
      for (let i = 0; i < scenes.length; i++) { if (e < acc + scenes[i].d) { sc = scenes[i]; local = (e - acc) / scenes[i].d; idx = i; break; } acc += scenes[i].d; }
      if (idx !== curScene) { curScene = idx; shakeMag = sc.shake || 0; if (sc.onEnter) try { sc.onEnter(); } catch (er) {} }
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, W, H);
      const sh = (Game.Settings && !Game.Settings.get('screenShake')) ? 0 : shakeMag * Math.max(0, 1 - local * 2.2) * 14;
      ctx.save();
      if (sh > 0.2) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      sc.draw(local, now);
      ctx.restore();
      if (sc.text) drawText(sc.text, local);
      if (e < 500) { ctx.fillStyle = 'rgba(3,4,10,' + (1 - e / 500) + ')'; ctx.fillRect(0, 0, W, H); }
      if (e > total - 600) { ctx.fillStyle = 'rgba(3,4,10,' + ((e - (total - 600)) / 600) + ')'; ctx.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(loop);
    })(t0);
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
    drawRocket(W / 2, H * (0.55 - t * 0.1), 1.2 - t * 0.4, 1);
    // 地球が小さくなる
    const er = Math.max(0, 70 * (1 - t * 0.7)); ctx.fillStyle = '#2f6fb0'; ctx.beginPath(); ctx.arc(W / 2, H + 120 - t * 80, er + 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#3c9647'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(W / 2 - 20, H + 110 - t * 80, er, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
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

  return { play, playLaunch, playDiscovery, playBossIntro, playBossOutro, isPlaying: function () { return playing; } };
})();
