// render.js — 描画統括（チャンクキャッシュblit＋カリング＋エンティティ）
window.Game = window.Game || {};

Game.Render = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const CS = Game.CFG.CHUNK_SIZE;
  const CHUNK_PX = CS * TS;

  function buildChunkCache(ch) {
    if (!ch.cache) {
      ch.cache = document.createElement('canvas');
      ch.cache.width = CHUNK_PX; ch.cache.height = CHUNK_PX;
    }
    const x = ch.cache.getContext('2d');
    x.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
    const wn = Game.state.worldName;
    const groundSet = wn === 'shadow' ? Game.Tiles.groundShadow : wn === 'space' ? Game.Tiles.groundSpace : Game.Tiles.ground;
    for (let ly = 0; ly < CS; ly++) {
      for (let lx = 0; lx < CS; lx++) {
        const i = ly * CS + lx;
        const g = ch.ground[i];
        const ga = groundSet[g];
        if (ga) x.drawImage(ga, lx * TS, ly * TS);
        const o = ch.object[i];
        if (o !== Game.OBJ.NONE) {
          const meta = Game.OBJ_META[o];
          if (meta && meta.phantom) continue; // 幻影は動的描画（正気度依存）
          const oa = Game.Tiles.obj[o];
          if (oa) x.drawImage(oa, lx * TS, ly * TS);
        }
      }
    }
    ch.dirty = false;
  }

  function draw(alpha) {
    const ctx = Game.ctx;
    const v = Game.view;
    ctx.clearRect(0, 0, v.w, v.h);
    ctx.fillStyle = Game.state.worldName === 'space' ? '#03040a' : '#0c1320';
    ctx.fillRect(0, 0, v.w, v.h);
    if (Game.state.worldName === 'space') drawStars(ctx);

    Game.Camera.follow(alpha);

    // 画面シェイク（設定 screenShake 尊重）: camera にフレーム限定オフセットを加える
    if (Game.Settings && Game.Settings.get('screenShake') === false) shakeAmt = 0;
    if (shakeAmt > 0.3) {
      Game.state.camera.x += (Math.random() * 2 - 1) * shakeAmt;
      Game.state.camera.y += (Math.random() * 2 - 1) * shakeAmt;
      shakeAmt *= 0.84;
    } else shakeAmt = 0;

    // 可視チャンクを blit
    const range = Game.Camera.visibleTileRange();
    const ccx0 = Game.World.toChunkCoord(range.tx0);
    const ccy0 = Game.World.toChunkCoord(range.ty0);
    const ccx1 = Game.World.toChunkCoord(range.tx1);
    const ccy1 = Game.World.toChunkCoord(range.ty1);
    for (let cy = ccy0; cy <= ccy1; cy++) {
      for (let cx = ccx0; cx <= ccx1; cx++) {
        const ch = Game.World.getChunk(cx, cy);
        if (ch.dirty || !ch.cache) buildChunkCache(ch);
        const s = Game.Camera.worldToScreen(cx * CHUNK_PX, cy * CHUNK_PX);
        const z = Game.Camera.zoom();
        if (z === 1) ctx.drawImage(ch.cache, Math.round(s.x), Math.round(s.y));
        else ctx.drawImage(ch.cache, s.x, s.y, CHUNK_PX * z, CHUNK_PX * z);
      }
    }

    Game.Farming.drawCrops(ctx);
    drawPhantoms(ctx);
    drawTargetHighlight(ctx);
    drawMiningCrack(ctx);
    drawDrops(ctx);
    Game.Mobs.draw(ctx, alpha);
    drawPeers(ctx);
    drawPlayer(ctx, alpha);
    drawSlashes(ctx);
    Game.Projectiles.draw(ctx);
    drawParticles(ctx);
    drawBolts(ctx);
    drawFloaters(ctx);
    Game.Lighting.drawOverlay(ctx);
    drawWeather(ctx);
    drawAmbient(ctx);
    drawCursor(ctx);
    drawDanger(ctx);
    drawFlash(ctx);
  }

  // 環境アンビエントパーティクル（蛍/葉/砂塵/影の粒子）。軽量・低透明度
  function drawAmbient(ctx) {
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    const s = Game.state; if (!s || s.paused) return;
    const v = Game.view, w = v.w, h = v.h, t = s.tick, world = s.worldName;
    const TS = Game.CFG.TILE_SIZE, p = s.player;
    const g = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
    const night = Game.DayNight.isNight();
    ctx.save();
    if (world === 'shadow') {
      ctx.fillStyle = '#b478e6';
      for (let i = 0; i < 12; i++) { const x = (i * 97 + t * 0.3) % w; const y = h - ((i * 53 + t * 0.5) % h); ctx.globalAlpha = 0.14 + (i % 3) * 0.06; ctx.fillRect(x, y, 2, 2); }
    } else if (world !== 'space') {
      if (g === Game.TILE.SAND) {
        ctx.fillStyle = '#d2be8c';
        for (let i = 0; i < 10; i++) { const x = (i * 131 + t * 1.3) % (w + 40) - 20; const y = (i * 71 + Math.sin(t * 0.02 + i) * 20) % h; ctx.globalAlpha = 0.1; ctx.fillRect(x, y, 4, 1.5); }
      } else if (night && (g === Game.TILE.GRASS || g === Game.TILE.FOREST)) {
        for (let i = 0; i < 9; i++) { const ph = t * 0.02 + i * 1.3; const x = ((i * 123) % w + Math.sin(ph) * 16 + w) % w; const y = ((i * 87) % h + Math.cos(ph * 0.8) * 14 + h) % h; const gl = 0.3 + Math.sin(t * 0.08 + i) * 0.3; ctx.globalAlpha = Math.max(0, gl) * 0.65; ctx.fillStyle = '#caff7a'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      } else if (g === Game.TILE.FOREST) {
        ctx.fillStyle = '#8ab450';
        for (let i = 0; i < 8; i++) { const x = ((i * 149 + Math.sin(t * 0.02 + i) * 30) % w + w) % w; const y = (i * 61 + t * 0.8) % h; ctx.globalAlpha = 0.22; ctx.fillRect(x, y, 3, 3); }
      } else if (g === Game.TILE.SWAMP) {
        // 立ち上る瘴気（緑のもや・ゆらめき）
        ctx.fillStyle = '#6a8a3a';
        for (let i = 0; i < 7; i++) { const x = ((i * 113 + Math.sin(t * 0.015 + i) * 24) % w + w) % w; const y = h - ((i * 67 + t * 0.6) % (h + 30)); ctx.globalAlpha = 0.1; ctx.fillRect(x, y, 5, 5); }
        // 漂う光胞子（明滅）
        for (let i = 0; i < 6; i++) { const ph = t * 0.025 + i * 1.7; const x = ((i * 151) % w + Math.sin(ph) * 18 + w) % w; const y = h - ((i * 91 + t * 0.4) % (h + 20)); const gl = 0.4 + Math.sin(t * 0.1 + i) * 0.35; ctx.globalAlpha = Math.max(0, gl) * 0.5; ctx.fillStyle = '#aef07a'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  // 低HP危険ヴィネット＋被弾フィードバック
  let hurtT = 0;
  function hurtFlash() { hurtT = 12; }
  function drawDanger(ctx) {
    const s = Game.state; if (!s || s.paused) return;
    const p = s.player; if (!p) return;
    const warnOn = !(Game.Settings && Game.Settings.get('lowHpWarn') === false);
    const ratio = p.maxHealth ? p.health / p.maxHealth : 1;
    let intensity = 0;
    if (warnOn && ratio < 0.3 && p.health > 0) { const pulse = 0.5 + Math.sin(s.tick * 0.15) * 0.5; intensity = (1 - ratio / 0.3) * (0.38 + pulse * 0.34); }
    if (hurtT > 0) { intensity = Math.max(intensity, hurtT / 12 * 0.5); hurtT--; }
    if (intensity <= 0.01) return;
    const v = Game.view, w = v.w, h = v.h;
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.30, w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, 'rgba(170,20,30,0)'); g.addColorStop(1, 'rgba(180,20,32,' + Math.min(0.78, intensity) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }

  // ゲームパッド選択カーソル
  function drawCursor(ctx) {
    const c = Game.Input && Game.Input.cursor;
    if (!c || !c.active) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x - 14, c.y); ctx.lineTo(c.x - 4, c.y); ctx.moveTo(c.x + 4, c.y); ctx.lineTo(c.x + 14, c.y);
    ctx.moveTo(c.x, c.y - 14); ctx.lineTo(c.x, c.y - 4); ctx.moveTo(c.x, c.y + 4); ctx.lineTo(c.x, c.y + 14); ctx.stroke();
    ctx.restore();
  }

  // 世界シフト時の画面フラッシュ
  let flashColor = null, flashT = 0;
  let shakeAmt = 0;
  function shake(amt) {
    if (Game.Settings && Game.Settings.get('screenShake') === false) return;
    shakeAmt = Math.min(16, Math.max(shakeAmt, amt));
  }
  function flash(color) { flashColor = color; flashT = 22; }
  function drawFlash(ctx) {
    if (flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = (flashT / 22) * 0.85;
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, Game.view.w, Game.view.h);
    ctx.restore();
    flashT--;
  }

  // 宇宙の星空（カメラに緩やかに連動）
  function drawStars(ctx) {
    const v = Game.view, cx = Game.state.camera.x, cy = Game.state.camera.y;
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const sx = ((i * 137.5 - cx * 0.2) % (v.w + 20) + v.w + 20) % (v.w + 20) - 10;
      const sy = ((i * 91.3 - cy * 0.2) % (v.h + 20) + v.h + 20) % (v.h + 20) - 10;
      const tw = 0.4 + Math.abs(Math.sin((Game.state.tick + i * 20) * 0.05)) * 0.6;
      ctx.globalAlpha = tw; ctx.fillStyle = i % 7 === 0 ? '#aee0ff' : '#ffffff';
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.restore();
  }

  function drawWeather(ctx) {
    const w = Game.state.weather;
    if (!w || w.type === 'clear') return;
    const v = Game.view;
    const type = w.type;
    const snow = type === 'snow' || type === 'blizzard';
    const sand = type === 'sandstorm';
    const t = Game.state.tick;
    ctx.save();
    // 砂嵐/吹雪は視界を覆うヴェール（砂嵐は砂地でも分かるよう濃いめのオレンジ褐色）
    if (sand) { ctx.fillStyle = 'rgba(188,128,52,0.34)'; ctx.fillRect(0, 0, v.w, v.h); }
    else if (type === 'blizzard') { ctx.fillStyle = 'rgba(235,242,250,0.22)'; ctx.fillRect(0, 0, v.w, v.h); }
    const count = sand ? 210 : (type === 'blizzard') ? 170 : 90;
    ctx.strokeStyle = sand ? 'rgba(120,82,34,0.7)' : snow ? 'rgba(255,255,255,0.8)' : 'rgba(150,180,220,0.5)';
    ctx.fillStyle = sand ? 'rgba(150,104,46,0.75)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = sand ? 1.6 : 1;
    const sx = sand ? 16 : type === 'blizzard' ? 5 : snow ? 1.2 : 7;
    const sy = sand ? 4 : type === 'blizzard' ? 6 : snow ? 3 : 13;
    for (let i = 0; i < count; i++) {
      const x = (i * 137 + t * sx) % (v.w + 40) - 20;
      const y = (i * 89 + t * sy) % (v.h + 40) - 20;
      if (sand) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 20, y + 3); ctx.stroke(); }
      else if (snow) { ctx.beginPath(); ctx.arc(x, y, type === 'blizzard' ? 2 : 1.6, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 9); ctx.stroke(); }
    }
    ctx.restore();
  }

  // 幻影鉱脈: 正気度が低いほどはっきり見える（狂気の視界）
  function drawPhantoms(ctx) {
    const sanity = Game.state.sanity;
    if (sanity >= 40) return;
    const alpha = (40 - sanity) / 40; // 0..1
    const atlas = Game.Tiles.obj[Game.OBJ.PHANTOM_ORE];
    if (!atlas) return;
    const range = Game.Camera.visibleTileRange();
    ctx.save();
    for (let ty = range.ty0; ty <= range.ty1; ty++) {
      for (let tx = range.tx0; tx <= range.tx1; tx++) {
        if (Game.World.objAt(tx, ty) !== Game.OBJ.PHANTOM_ORE) continue;
        const s = Game.Camera.worldToScreen(tx * TS, ty * TS);
        const z = Game.Camera.zoom();
        ctx.globalAlpha = alpha * (0.6 + Math.sin(Game.state.tick * 0.1 + tx) * 0.25);
        ctx.drawImage(atlas, s.x, s.y, TS * z, TS * z);
      }
    }
    ctx.restore();
  }

  function drawTargetHighlight(ctx) {
    const t = Game.Player.targetTile();
    if (!t) return;
    const s = Game.Camera.worldToScreen(t.tx * TS, t.ty * TS);
    const z = Game.Camera.zoom();
    ctx.strokeStyle = t.valid ? 'rgba(255,255,255,0.7)' : 'rgba(255,80,80,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, TS * z - 2, TS * z - 2);
  }

  function drawMiningCrack(ctx) {
    const m = Game.Player.mining;
    if (!m.active || m.progress <= 0) return;
    const meta = Game.OBJ_META[m.obj];
    if (!meta) return;
    const frac = Game.Utils.clamp(m.progress / meta.hp, 0, 1);
    const s = Game.Camera.worldToScreen(m.tx * TS, m.ty * TS);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    const n = Math.floor(frac * 5);
    for (let i = 0; i < n; i++) {
      const yy = s.y + 4 + i * 5;
      ctx.beginPath();
      ctx.moveTo(s.x + 4, yy);
      ctx.lineTo(s.x + TS - 4, yy + 3);
      ctx.stroke();
    }
  }

  function drawDrops(ctx) {
    const drops = Game.state.drops;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const s = Game.Camera.worldToScreen(d.x, d.y);
      const item = Game.ITEMS[d.id];
      ctx.fillStyle = (item && item.color) || '#fff';
      const bob = Math.sin((Game.state.tick + i * 7) * 0.15) * 2;
      ctx.fillRect(s.x - 5, s.y - 5 + bob, 10, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(s.x - 5, s.y - 5 + bob, 10, 10);
    }
  }

  // 他プレイヤー（マルチプレイ）
  function drawPeers(ctx) {
    if (!Game.Net || !Game.Net.isConnected()) return;
    const peers = Game.Net.getPeers();
    for (const id in peers) {
      const pe = peers[id];
      if (!pe || pe.world !== Game.state.worldName || pe.x == null) continue;
      // 補間でなめらかに（リアルタイム描画）
      if (pe.tx != null) { pe.x += (pe.tx - pe.x) * 0.3; pe.y += (pe.ty - pe.y) * 0.3; }
      const s = Game.Camera.worldToScreen(pe.x, pe.y);
      if (s.x < -30 || s.y < -30 || s.x > Game.view.w + 30 || s.y > Game.view.h + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3fd07a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath(); ctx.arc(s.x, s.y - 3, 5, 0, Math.PI * 2); ctx.fill();
      if (pe.name) {
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x - 24, s.y - 26, 48, 12);
        ctx.fillStyle = '#cfe6b0'; ctx.fillText(pe.name, s.x, s.y - 17);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawPlayer(ctx, alpha) {
    const p = Game.state.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    const s = Game.Camera.worldToScreen(px, py);
    // 乗り物
    if (p.vehicle) drawVehicle(ctx, s.x, s.y, p.vehicle, p.dir);
    // 体
    ctx.fillStyle = '#3a78d6';
    ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(s.x, s.y - 3, 5, 0, Math.PI * 2); ctx.fill();
    // 向きマーカー
    const dir = p.dir;
    let dx = 0, dy = 0;
    if (dir === 'up') dy = -1; else if (dir === 'down') dy = 1;
    else if (dir === 'left') dx = -1; else if (dir === 'right') dx = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x + dx * 8 - 2, s.y + dy * 8 - 2, 4, 4);
    if (p.invuln > 0 && (Game.state.tick % 6) < 3) {
      ctx.strokeStyle = 'rgba(255,0,0,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawVehicle(ctx, x, y, type, dir) {
    ctx.save();
    if (type === 'car') {
      ctx.fillStyle = '#c0444a'; roundRectC(ctx, x - 16, y - 4, 32, 18, 5); ctx.fill();
      ctx.fillStyle = '#88c0e0'; ctx.fillRect(x - 9, y - 1, 18, 7);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 10, y + 14, 4, 0, 7); ctx.arc(x + 10, y + 14, 4, 0, 7); ctx.fill();
    } else if (type === 'boat') {
      ctx.fillStyle = '#9c6b3f'; ctx.beginPath(); ctx.ellipse(x, y + 8, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 16, y + 4, 32, 4);
    } else if (type === 'carpet') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 22, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
      const wob = Math.sin(Game.state.tick * 0.2) * 2;
      ctx.fillStyle = '#c0407a'; roundRectC(ctx, x - 18, y + 4 + wob, 36, 12, 3); ctx.fill();
      ctx.fillStyle = '#ffd86b'; ctx.fillRect(x - 16, y + 6 + wob, 32, 2); ctx.fillRect(x - 16, y + 12 + wob, 32, 2);
      ctx.fillStyle = '#7fd0ff'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 7 - 1, y + 8 + wob, 2, 2);
    } else if (type === 'plane') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 24, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); // 影（飛行）
      ctx.fillStyle = '#8a96c0'; ctx.fillRect(x - 22, y - 2, 44, 6); // 翼
      ctx.fillStyle = '#aab4d8'; roundRectC(ctx, x - 7, y - 14, 14, 30, 6); ctx.fill();
      ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x - 4, y - 10, 8, 6);
    }
    ctx.restore();
  }
  function roundRectC(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // パーティクル（採掘デブリ等）
  const particles = [];
  function spawnParticles(wx, wy, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: wx, y: wy,
        vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
        life: 18, color: color,
      });
    }
  }
  const slashes = [];
  function spawnSlash(wx, wy, dir, color) {
    let a = 0;
    if (dir === 'up') a = -Math.PI / 2; else if (dir === 'down') a = Math.PI / 2; else if (dir === 'left') a = Math.PI; else a = 0;
    slashes.push({ x: wx, y: wy, a: a, life: 8, color: color || '#ffffff' });
  }
  function drawSlashes(ctx) {
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i]; s.life--;
      if (s.life <= 0) { slashes.splice(i, 1); continue; }
      const sc = Game.Camera.worldToScreen(s.x, s.y);
      const z = Game.Camera.zoom();
      const prog = 1 - s.life / 8;
      ctx.save();
      ctx.globalAlpha = (s.life / 8) * 0.9;
      ctx.strokeStyle = s.color; ctx.lineWidth = 3;
      ctx.beginPath();
      const r = 26 * z;
      ctx.arc(sc.x + Math.cos(s.a) * 16 * z, sc.y + Math.sin(s.a) * 16 * z, r, s.a - 1.1 + prog * 1.4, s.a + 0.3 + prog * 1.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function spawnBlood(wx, wy, n) {
    const cols = ['#a01a28', '#c0303a', '#7a1420'];
    for (let i = 0; i < n; i++) {
      particles.push({ x: wx, y: wy, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 16 + Math.random() * 10, color: cols[Math.floor(Math.random() * cols.length)] });
    }
  }

  function drawParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const s = Game.Camera.worldToScreen(p.x, p.y);
      ctx.globalAlpha = p.life / 18;
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }
  }

  // 連鎖雷（chain武器）
  const bolts = [];
  function spawnLightning(x1, y1, x2, y2) { bolts.push({ x1: x1, y1: y1, x2: x2, y2: y2, life: 8 }); }
  function drawBolts(ctx) {
    if (!bolts.length) return;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life--;
      if (b.life <= 0) { bolts.splice(i, 1); continue; }
      const a = Game.Camera.worldToScreen(b.x1, b.y1), c = Game.Camera.worldToScreen(b.x2, b.y2);
      ctx.globalAlpha = b.life / 8; ctx.strokeStyle = '#fff07a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      const seg = 4; for (let k = 1; k < seg; k++) { const t = k / seg; ctx.lineTo(a.x + (c.x - a.x) * t + (Math.random() - 0.5) * 10, a.y + (c.y - a.y) * t + (Math.random() - 0.5) * 10); }
      ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // 浮遊コンバットテキスト（ダメージ/回復/レベルアップ）
  const floaters = [];
  function spawnFloat(wx, wy, text, color, big) {
    if (Game.Settings && !Game.Settings.get('dmgNumbers')) return;
    floaters.push({ x: wx + (Math.random() - 0.5) * 8, y: wy, vy: -0.7, life: big ? 60 : 38, max: big ? 60 : 38, text: '' + text, color: color || '#fff', big: !!big });
  }
  function drawFloaters(ctx) {
    if (!floaters.length) return;
    const z = Game.Camera.zoom();
    ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.y += f.vy; f.life--;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      const s = Game.Camera.worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.5));
      ctx.font = '700 ' + Math.round((f.big ? 20 : 13) * z) + 'px -apple-system,sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, s.x, s.y); ctx.fillStyle = f.color; ctx.fillText(f.text, s.x, s.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  return { draw, buildChunkCache, spawnParticles, spawnBlood, spawnSlash, spawnFloat, spawnLightning, flash, hurtFlash, shake };
})();
