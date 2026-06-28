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
    const groundSet = Game.state.worldName === 'shadow' ? Game.Tiles.groundShadow : Game.Tiles.ground;
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
    ctx.fillStyle = '#0c1320';
    ctx.fillRect(0, 0, v.w, v.h);

    Game.Camera.follow(alpha);

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
        ctx.drawImage(ch.cache, Math.round(s.x), Math.round(s.y));
      }
    }

    Game.Farming.drawCrops(ctx);
    drawPhantoms(ctx);
    drawTargetHighlight(ctx);
    drawMiningCrack(ctx);
    drawDrops(ctx);
    Game.Mobs.draw(ctx, alpha);
    drawPlayer(ctx, alpha);
    drawParticles(ctx);
    Game.Lighting.drawOverlay(ctx);
    drawWeather(ctx);
    drawFlash(ctx);
  }

  // 世界シフト時の画面フラッシュ
  let flashColor = null, flashT = 0;
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

  function drawWeather(ctx) {
    const w = Game.state.weather;
    if (!w || w.type === 'clear') return;
    const v = Game.view;
    const snow = w.type === 'snow';
    ctx.save();
    ctx.strokeStyle = snow ? 'rgba(255,255,255,0.7)' : 'rgba(150,180,220,0.5)';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    const t = Game.state.tick;
    for (let i = 0; i < 90; i++) {
      const x = (i * 137 + t * (snow ? 1.2 : 7)) % (v.w + 40) - 20;
      const y = (i * 89 + t * (snow ? 3 : 13)) % (v.h + 40) - 20;
      if (snow) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
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
        ctx.globalAlpha = alpha * (0.6 + Math.sin(Game.state.tick * 0.1 + tx) * 0.25);
        ctx.drawImage(atlas, Math.round(s.x), Math.round(s.y));
      }
    }
    ctx.restore();
  }

  function drawTargetHighlight(ctx) {
    const t = Game.Player.targetTile();
    if (!t) return;
    const s = Game.Camera.worldToScreen(t.tx * TS, t.ty * TS);
    ctx.strokeStyle = t.valid ? 'rgba(255,255,255,0.7)' : 'rgba(255,80,80,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, TS - 2, TS - 2);
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

  function drawPlayer(ctx, alpha) {
    const p = Game.state.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    const s = Game.Camera.worldToScreen(px, py);
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

  return { draw, buildChunkCache, spawnParticles, flash };
})();
