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
    const pal = wn === 'shadow' ? Game.SHADOW_TILE_COLOR : wn === 'space' ? Game.SPACE_TILE_COLOR : Game.TILE_COLOR;
    for (let ly = 0; ly < CS; ly++) {
      for (let lx = 0; lx < CS; lx++) {
        const i = ly * CS + lx;
        const g = ch.ground[i];
        const ga = groundSet[g];
        if (ga) x.drawImage(ga, lx * TS, ly * TS);
        blendTileEdges(x, ch, lx, ly, g, pal); // biome境界のにじみ(ベイク=毎フレーム負荷ゼロ)
        const o = ch.object[i];
        if (o !== Game.OBJ.NONE) {
          const meta = Game.OBJ_META[o];
          if (meta && meta.phantom) continue; // 幻影は動的描画（正気度依存）
          const oa = Game.Tiles.obj[o];
          if (oa) x.drawImage(oa, lx * TS, ly * TS);
        } else if (wn !== 'space') {
          decorateGround(x, g, (ch.cx * CS + lx), (ch.cy * CS + ly), lx * TS, ly * TS); // 空きタイルに地面装飾をベイク
        }
      }
    }
    ch.dirty = false;
  }

  // 隣接タイルの色を低アルファの帯で重ね、biome の継ぎ目を柔らかくする（チャンクキャッシュにベイク）
  function blendTileEdges(x, ch, lx, ly, g, pal) {
    const wtx = ch.cx * CS + lx, wty = ch.cy * CS + ly;
    const px = lx * TS, py = ly * TS;
    let n;
    n = Game.World.groundAt(wtx, wty - 1);
    if (n !== g && pal[n]) { x.globalAlpha = 0.20; x.fillStyle = pal[n]; x.fillRect(px, py, TS, 5); x.globalAlpha = 0.14; x.fillRect(px, py, TS, 2); }
    n = Game.World.groundAt(wtx, wty + 1);
    if (n !== g && pal[n]) { x.globalAlpha = 0.20; x.fillStyle = pal[n]; x.fillRect(px, py + TS - 5, TS, 5); x.globalAlpha = 0.14; x.fillRect(px, py + TS - 2, TS, 2); }
    n = Game.World.groundAt(wtx - 1, wty);
    if (n !== g && pal[n]) { x.globalAlpha = 0.20; x.fillStyle = pal[n]; x.fillRect(px, py, 5, TS); x.globalAlpha = 0.14; x.fillRect(px, py, 2, TS); }
    n = Game.World.groundAt(wtx + 1, wty);
    if (n !== g && pal[n]) { x.globalAlpha = 0.20; x.fillStyle = pal[n]; x.fillRect(px + TS - 5, py, 5, TS); x.globalAlpha = 0.14; x.fillRect(px + TS - 2, py, 2, TS); }
    x.globalAlpha = 1;
  }

  // 地面の小装飾(花/小石/ひび/きらめき)を決定論的に描く。チャンクキャッシュに一度だけ焼く=毎フレーム負荷ゼロ
  function decorateGround(x, g, wtx, wty, px, py) {
    let h = (wtx * 73856093) ^ (wty * 19349663); h = (h ^ (h >>> 13)) >>> 0;
    if ((h % 100) >= 14) return; // 約14%のタイルだけ装飾
    const T = Game.TILE;
    const ox = px + 5 + (h % 7) * 3, oy = py + 6 + ((h >> 3) % 7) * 3; // タイル内のばらつき
    if (g === T.GRASS || g === T.FOREST || g === T.BLOOM) {
      const variant = (h >> 6) % 5;
      if (variant === 0 && g !== T.FOREST) { // 花
        const cols = ['#e8d24a', '#e87a9a', '#d8d8e8', '#e0843c', '#b86ad0'];
        x.fillStyle = '#3a6f2e'; x.fillRect(ox, oy, 1, 4); // 茎
        x.fillStyle = cols[(h >> 9) % cols.length]; x.beginPath(); x.arc(ox + 0.5, oy, 2.1, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff3b0'; x.fillRect(ox, oy - 0.5, 1, 1);
      } else { // 草の房
        x.strokeStyle = g === T.FOREST ? '#2c6322' : '#3c7a30'; x.lineWidth = 1;
        for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(ox + k * 2, oy + 4); x.lineTo(ox + k * 2 + k, oy); x.stroke(); }
      }
    } else if (g === T.SAND) { // 小石/砂紋
      x.fillStyle = ((h >> 6) & 1) ? 'rgba(120,108,80,0.5)' : 'rgba(160,148,110,0.5)';
      x.beginPath(); x.arc(ox, oy, 1.6, 0, Math.PI * 2); x.fill();
    } else if (g === T.STONE || g === T.DIRT) { // ひび/小石
      x.strokeStyle = g === T.STONE ? 'rgba(60,64,70,0.6)' : 'rgba(90,60,40,0.5)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(ox - 2, oy - 1); x.lineTo(ox + 1, oy + 1); x.lineTo(ox + 3, oy); x.stroke();
    } else if (g === T.SNOW) { // 氷のきらめき
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(ox, oy, 1.4, 1.4); x.fillRect(ox + 2, oy + 2, 1, 1);
    }
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

    drawWaterShimmer(ctx);
    drawWindSweep(ctx);
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
    drawImpacts(ctx);
    drawMuzzles(ctx);
    drawLevelRings(ctx);
    drawFloaters(ctx);
    Game.Lighting.drawOverlay(ctx);
    drawNightSky(ctx);
    Game.Events.draw(ctx);
    drawWeather(ctx);
    drawAmbient(ctx);
    drawBossVignette(ctx);
    drawCursor(ctx);
    drawDanger(ctx);
    drawHitDir(ctx);
    drawHomeCompass(ctx);
    drawFlash(ctx);
  }

  // 帰路コンパス: 拠点(spawn/ベッド)が遠いとき、画面端に方向矢印＋距離。広大な世界で迷子防止
  function drawHomeCompass(ctx) {
    if (Game.Settings && Game.Settings.get('homeCompass') === false) return;
    const st = Game.state; if (!st || st.paused) return;
    if (st.worldName !== 'light' || !st.spawn) return; // 拠点は光の世界
    const TS = Game.CFG.TILE_SIZE, p = st.player;
    const hx = st.spawn.tx * TS + TS / 2, hy = st.spawn.ty * TS + TS / 2;
    const dx = hx - p.x, dy = hy - p.y;
    const distTiles = Math.hypot(dx, dy) / TS;
    if (distTiles < 18) return; // 近ければ非表示
    const v = Game.view, sc = Game.Camera.worldToScreen(hx, hy), margin = 34;
    ctx.save();
    if (sc.x >= margin && sc.x <= v.w - margin && sc.y >= margin && sc.y <= v.h - margin) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#7fe0a0'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      const cx = v.w / 2, cy = v.h / 2, ddx = sc.x - cx, ddy = sc.y - cy;
      const ex = v.w / 2 - margin, ey = v.h / 2 - margin;
      const scale = Math.min(ex / Math.max(Math.abs(ddx), 1), ey / Math.max(Math.abs(ddy), 1));
      const ax = cx + ddx * scale, ay = cy + ddy * scale, ang = Math.atan2(ddy, ddx);
      ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#7fe0a0'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-ang);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#cdeede'; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('拠点 ' + Math.round(distTiles), 0, -14);
    }
    ctx.restore();
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
      // 漂う影のウィスプ(大小・ゆらめき・淡い光)
      for (let i = 0; i < 16; i++) {
        const ph = t * 0.012 + i * 0.9;
        const x = ((i * 137 + Math.sin(ph) * 40) % (w + 60) + w + 60) % (w + 60) - 30;
        const y = h - ((i * 53 + t * (0.3 + (i % 3) * 0.15)) % (h + 40));
        const sz = 1.5 + (i % 4) * 0.8; const gl = 0.5 + Math.sin(t * 0.05 + i) * 0.5;
        ctx.globalAlpha = (0.1 + gl * 0.12);
        ctx.fillStyle = i % 3 === 0 ? '#c884f0' : '#7a4fb0';
        ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
      }
      // 不穏な脈動ヴィネット(画面の縁が影に侵される)
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.72);
      const vp = 0.22 + Math.sin(t * 0.03) * 0.06;
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,6,34,' + vp.toFixed(3) + ')');
      ctx.globalAlpha = 1; ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
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
      } else if (g === Game.TILE.VOLCANIC) {
        // うっすら熱気（赤みのもや・ゆらめき上昇）
        ctx.fillStyle = '#8a2a14';
        for (let i = 0; i < 6; i++) { const x = ((i * 119 + Math.sin(t * 0.02 + i) * 26) % w + w) % w; const y = h - ((i * 73 + t * 0.7) % (h + 30)); ctx.globalAlpha = 0.08; ctx.fillRect(x, y, 6, 6); }
        // 舞い上がる火の粉（オレンジ〜赤・明滅）
        for (let i = 0; i < 8; i++) { const ph = t * 0.03 + i * 1.3; const x = ((i * 137) % w + Math.sin(ph) * 14 + w) % w; const y = h - ((i * 83 + t * 0.9) % (h + 20)); const gl = 0.5 + Math.sin(t * 0.13 + i) * 0.4; ctx.globalAlpha = Math.max(0, gl) * 0.6; ctx.fillStyle = i % 3 === 0 ? '#ffd24a' : '#ff6a2a'; ctx.fillRect(x, y, 2, 2); }
      } else if (g === Game.TILE.MUSHROOM) {
        // ふわふわ漂う発光胞子（青紫〜水色・上下浮遊・明滅）
        for (let i = 0; i < 9; i++) {
          const ph = t * 0.02 + i * 0.9;
          const x = ((i * 127) % w + Math.sin(ph) * 22 + w) % w;
          const y = ((i * 97) % h + Math.cos(ph * 0.7) * 18 + h) % h;
          const gl = 0.4 + Math.sin(t * 0.06 + i) * 0.4;
          ctx.globalAlpha = Math.max(0, gl) * 0.55;
          ctx.fillStyle = i % 2 === 0 ? '#9fb0ff' : '#a6f0e0';
          ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      } else if (g === Game.TILE.BLOOM) {
        // 舞う花びら（横に流れ、ふわり上下）
        const cols = ['#ff9ec4', '#ffe07a', '#ffffff', '#c79ae6'];
        for (let i = 0; i < 8; i++) {
          const x = ((i * 141 + t * 0.9) % (w + 30)) - 15;
          const y = ((i * 83) % h + Math.sin(t * 0.03 + i) * 16 + h) % h;
          ctx.globalAlpha = 0.5; ctx.fillStyle = cols[i % cols.length];
          ctx.fillRect(x, y, 3, 2);
        }
      }
      // 日中の蝶（明るい biome の生命感・羽ばたきアニメ）
      if (!night && (g === Game.TILE.GRASS || g === Game.TILE.FOREST || g === Game.TILE.BLOOM)) {
        const bc = ['#ffd24a', '#ff8ad8', '#7fd0ff', '#ffffff'];
        for (let i = 0; i < 4; i++) {
          const bx = ((i * 173 + t * 0.6) % (w + 30)) - 15;
          const by = ((i * 101) % h + Math.sin(t * 0.05 + i * 2) * 22 + h) % h;
          const flap = Math.sin(t * 0.4 + i) > 0 ? 2.4 : 0.8;
          ctx.globalAlpha = 0.62; ctx.fillStyle = bc[i % bc.length];
          ctx.fillRect(bx - flap, by, flap, 2); ctx.fillRect(bx + 1, by, flap, 2);
        }
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  // 低HP危険ヴィネット＋被弾フィードバック
  let hurtT = 0;
  function hurtFlash() { hurtT = 12; }
  // 被ダメージ方向インジケータ: 攻撃元へ向かう赤い弧を画面端に出し、画面外の脅威を知らせる
  const hitDirs = [];
  function spawnHitDir(wx, wy) {
    const p = Game.state.player; if (!p) return;
    hitDirs.push({ ang: Math.atan2(wy - p.y, wx - p.x), life: 26, max: 26 });
    if (hitDirs.length > 6) hitDirs.shift();
  }
  function drawHitDir(ctx) {
    if (!hitDirs.length) return;
    const cx = Game.view.w / 2, cy = Game.view.h / 2, rad = Math.min(cx, cy) * 0.82;
    for (let i = hitDirs.length - 1; i >= 0; i--) {
      const d = hitDirs[i]; d.life--;
      if (d.life <= 0) { hitDirs.splice(i, 1); continue; }
      const a = d.life / d.max;
      ctx.save(); ctx.globalAlpha = a * 0.7; ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, rad, d.ang - 0.34, d.ang + 0.34); ctx.stroke();
      ctx.globalAlpha = a * 0.35; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, rad, d.ang - 0.28, d.ang + 0.28); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
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

  // ボス戦の臨場感: ボス存在中、画面端にテーマ色の脈動ヴィネット
  function drawBossVignette(ctx) {
    const s = Game.state; if (!s || s.paused) return;
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    const mobs = s.mobs; let boss = null;
    for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def && m.def.boss) { if (!boss || m.maxHp > boss.maxHp) boss = m; } }
    if (!boss) return;
    const col = boss.def.color || '#c83040';
    const r = parseInt(col.substr(1, 2), 16) || 200, gc = parseInt(col.substr(3, 2), 16) || 48, bc = parseInt(col.substr(5, 2), 16) || 64;
    const pulse = 0.5 + Math.sin(s.tick * 0.08) * 0.5;
    const a = 0.1 + pulse * 0.12;
    const v = Game.view, w = v.w, hh = v.h;
    ctx.save();
    const grd = ctx.createRadialGradient(w / 2, hh / 2, Math.min(w, hh) * 0.42, w / 2, hh / 2, Math.max(w, hh) * 0.66);
    grd.addColorStop(0, 'rgba(' + r + ',' + gc + ',' + bc + ',0)');
    grd.addColorStop(1, 'rgba(' + r + ',' + gc + ',' + bc + ',' + a.toFixed(3) + ')');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, hh); ctx.restore();
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
  // 地上の夜空: 上部に瞬く星＋稀に流れ星（光世界・夜・晴/霧のみ）
  function drawNightSky(ctx) {
    const s = Game.state; if (!s || s.paused || s.worldName !== 'light') return;
    if (!Game.DayNight.isNight()) return;
    const wt = s.weather && s.weather.type;
    if (wt && wt !== 'clear' && wt !== 'fog') return; // 雨/雪/砂嵐/吹雪では非表示
    const v = Game.view, w = v.w, h = v.h, t = s.tick;
    const dark = (Game.Lighting && Game.Lighting.ambientDarkness) ? Game.Lighting.ambientDarkness() : 0.6;
    const baseA = Math.min(0.85, Math.max(0, dark)) * (wt === 'fog' ? 0.4 : 1);
    if (baseA < 0.05) return;
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const sx = (i * 149.3) % w;
      const sy = (i * 73.1) % (h * 0.55);
      const tw = 0.3 + Math.abs(Math.sin((t + i * 30) * 0.04)) * 0.7;
      ctx.globalAlpha = baseA * tw * 0.7;
      ctx.fillStyle = i % 6 === 0 ? '#cfe0ff' : '#ffffff';
      const sz = i % 5 === 0 ? 2 : 1; ctx.fillRect(sx, sy, sz, sz);
    }
    const ph = t % 900; // 稀に流れ星
    if (ph < 40) { const pr = ph / 40, sxs = w * 0.15 + pr * w * 0.7, sys = h * 0.08 + pr * h * 0.22;
      ctx.globalAlpha = (1 - pr) * baseA * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sxs, sys); ctx.lineTo(sxs - 18, sys - 7); ctx.stroke();
    }
    ctx.restore();
  }

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
    const storm = type === 'storm';
    const t = Game.state.tick;
    ctx.save();
    // 霧: 薄い灰白のもや＋ゆっくり流れる層＋周辺の視界低下（控えめ）
    if (type === 'fog') {
      ctx.fillStyle = 'rgba(202,208,216,0.15)'; ctx.fillRect(0, 0, v.w, v.h);
      ctx.fillStyle = 'rgba(212,216,224,0.09)';
      for (let i = 0; i < 4; i++) { const y = ((i * v.h / 4 + t * 0.3) % (v.h + 80)) - 40; ctx.fillRect(0, y, v.w, 34); }
      const grd = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.62);
      grd.addColorStop(0, 'rgba(190,196,206,0)'); grd.addColorStop(1, 'rgba(190,196,206,0.28)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
      ctx.restore(); return;
    }
    // 砂嵐/吹雪は視界を覆うヴェール（砂嵐は砂地でも分かるよう濃いめのオレンジ褐色）
    if (sand) { ctx.fillStyle = 'rgba(188,128,52,0.34)'; ctx.fillRect(0, 0, v.w, v.h); }
    else if (type === 'blizzard') { ctx.fillStyle = 'rgba(235,242,250,0.22)'; ctx.fillRect(0, 0, v.w, v.h); }
    else if (storm) { ctx.fillStyle = 'rgba(18,22,40,0.30)'; ctx.fillRect(0, 0, v.w, v.h); } // 雷雨: 暗い空のヴェール
    const count = sand ? 210 : (type === 'blizzard') ? 170 : storm ? 160 : 90;
    ctx.strokeStyle = sand ? 'rgba(120,82,34,0.7)' : snow ? 'rgba(255,255,255,0.8)' : storm ? 'rgba(170,195,235,0.6)' : 'rgba(150,180,220,0.5)';
    ctx.fillStyle = sand ? 'rgba(150,104,46,0.75)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = sand ? 1.6 : 1;
    const sx = sand ? 16 : type === 'blizzard' ? 5 : snow ? 1.2 : storm ? 9 : 7;
    const sy = sand ? 4 : type === 'blizzard' ? 6 : snow ? 3 : storm ? 16 : 13;
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
  // 水面のきらめき＋鉱石のきらめき: 可視範囲を1パスで走査(間引き＋上限で低負荷)
  const oreSparkleCol = {
    [Game.OBJ.COAL_ORE]: '#e8f0ff', [Game.OBJ.IRON_ORE]: '#ffd9b0', [Game.OBJ.GOLD_ORE]: '#ffe27a',
    [Game.OBJ.LUMEN_ORE]: '#fff3c0', [Game.OBJ.STAR_ORE]: '#aee0ff', [Game.OBJ.SHADOW_CRYSTAL]: '#d8b0ff',
  };
  function drawWaterShimmer(ctx) {
    const s = Game.state; if (!s || s.paused || s.worldName === 'space') return;
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    const range = Game.Camera.visibleTileRange(), t = s.tick, z = Game.Camera.zoom();
    ctx.save(); ctx.lineWidth = Math.max(1, z);
    let drawn = 0, sparks = 0;
    for (let ty = range.ty0; ty <= range.ty1 && (drawn < 60 || sparks < 24); ty++) {
      for (let tx = range.tx0; tx <= range.tx1; tx++) {
        // 鉱石のきらめき: 周期的に4点星が明滅（決定論的な位相）
        if (sparks < 24) {
          const o = Game.World.objAt(tx, ty);
          const col = oreSparkleCol[o];
          if (col) {
            const cyc = (t + ((tx * 31 + ty * 17) % 97) * 3) % 110;
            if (cyc < 16) {
              const k = Math.sin((cyc / 16) * Math.PI); // 0→1→0
              const sc = Game.Camera.worldToScreen(tx * TS, ty * TS);
              const ox = (6 + (tx * 13 + ty * 7) % 18) * z, oy = (6 + (tx * 5 + ty * 11) % 16) * z;
              ctx.globalAlpha = k * 0.9; ctx.fillStyle = col;
              const l = (2 + k * 2.6) * z;
              ctx.fillRect(sc.x + ox - l, sc.y + oy - 0.7 * z, l * 2, 1.4 * z);
              ctx.fillRect(sc.x + ox - 0.7 * z, sc.y + oy - l, 1.4 * z, l * 2);
              sparks++;
            }
          }
        }
        // 水面のゆらめく波線
        if (drawn < 60 && ((tx * 7 + ty * 13) & 3) === 0) {
          const g = Game.World.groundAt(tx, ty);
          if (g === Game.TILE.WATER || g === Game.TILE.DEEP_WATER) {
            const ph = t * 0.05 + tx * 0.7 + ty * 0.5;
            ctx.globalAlpha = 0.1 + Math.abs(Math.sin(ph)) * 0.18;
            ctx.strokeStyle = '#dff0ff';
            const sc = Game.Camera.worldToScreen(tx * TS, ty * TS);
            const yy = sc.y + (TS * 0.5 + Math.sin(ph) * 3) * z;
            ctx.beginPath(); ctx.moveTo(sc.x + 4 * z, yy); ctx.lineTo(sc.x + (TS - 4) * z, yy); ctx.stroke();
            drawn++;
          }
        }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // 風のそよぎ: 淡い光の帯が斜めに流れ、草原の草が揺れている印象を作る（O(1)/frame）
  let windBand = null;
  function drawWindSweep(ctx) {
    const s = Game.state; if (!s || s.paused || s.worldName !== 'light') return;
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    if (!windBand) {
      windBand = document.createElement('canvas'); windBand.width = 160; windBand.height = 8;
      const bx = windBand.getContext('2d');
      const g = bx.createLinearGradient(0, 0, 160, 0);
      g.addColorStop(0, 'rgba(255,255,238,0)'); g.addColorStop(0.5, 'rgba(255,255,238,0.55)'); g.addColorStop(1, 'rgba(255,255,238,0)');
      bx.fillStyle = g; bx.fillRect(0, 0, 160, 8);
    }
    const v = Game.view, t = s.tick, L = v.w + v.h;
    ctx.save(); ctx.rotate(-0.35);
    for (let i = 0; i < 2; i++) {
      const off = ((t * (1.1 + i * 0.5) + i * 620) % (L + 640)) - 320;
      ctx.globalAlpha = 0.045;
      ctx.drawImage(windBand, off - v.h * 0.4, -v.h * 0.5, 130 + i * 70, L * 1.7);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

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

  // ドロップ演出: グロー/光柱はスプライト化してキャッシュ（ホットループでの勾配生成を排除）
  const dropGlowCache = {};
  function glowSprite(col) {
    let c = dropGlowCache[col];
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 48;
      const g2 = c.getContext('2d');
      const gr = g2.createRadialGradient(24, 24, 2, 24, 24, 24);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, 48, 48);
      dropGlowCache[col] = c;
    }
    return c;
  }
  const dropBeamCache = {};
  function beamSprite(col) {
    let c = dropBeamCache[col];
    if (!c) {
      c = document.createElement('canvas'); c.width = 24; c.height = 96;
      const g2 = c.getContext('2d');
      const gr = g2.createLinearGradient(0, 0, 0, 96);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col);
      g2.fillStyle = gr;
      g2.beginPath(); g2.moveTo(2, 96); g2.lineTo(22, 96); g2.lineTo(16, 0); g2.lineTo(8, 0); g2.closePath(); g2.fill();
      dropBeamCache[col] = c;
    }
    return c;
  }
  // 拾得バースト: 前フレームに存在した drop が消えた=拾得。レアリティに応じ、初回のみ盛大に
  let prevDrops = new Set();
  const pickupSeen = { 0: 0, 1: 0, 2: 0, 3: 0 };
  function spawnPickupBurst(d) {
    const r = d.roll ? d.roll.rarity : 0;
    const item = Game.ITEMS[d.id];
    const col = d.roll && Game.Loot.rarityColor ? Game.Loot.rarityColor(d) : (item && item.color) || '#fff';
    pickupSeen[r] = (pickupSeen[r] || 0) + 1;
    const lavish = r >= 1 && pickupSeen[r] <= 2; // 初回(と2回目)のみ盛大、以降は控えめ
    let n = 3 + r * 3;
    if (lavish) n += 6 + r * 5;
    spawnParticles(d.x, d.y - 4, col, n);
    if (lavish) {
      spawnImpact(d.x, d.y - 6, col);
      if (r >= 2) spawnParticles(d.x, d.y - 4, '#ffffff', 4 + r * 2);
      if (r >= 3) spawnLevelRing(d.x, d.y);
    }
  }
  function drawDrops(ctx) {
    const drops = Game.state.drops; const z = Game.Camera.zoom(); const t = Game.state.tick;
    const v = Game.view;
    const cur = new Set();
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      cur.add(d);
      const s = Game.Camera.worldToScreen(d.x, d.y);
      if (s.x < -40 || s.y < -50 || s.x > v.w + 40 || s.y > v.h + 40) continue; // 画面外はスキップ
      const item = Game.ITEMS[d.id];
      const bob = Math.sin((t + i * 7) * 0.15) * 2;
      const rot = d.roll ? Math.sin((t + i * 11) * 0.06) * 0.22 : 0; // 装備品はゆっくり左右に揺れる
      // 足元のソフトシャドウ（浮遊感）
      ctx.globalAlpha = 0.20 - bob * 0.02;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 8 * z, (6 - bob * 0.6) * z, 2.4 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // レア装備(roll)は希少度色で発光。レア以上は光柱。金塊/刻片など高価品も金色グロー
      const rarity = d.roll ? d.roll.rarity : -1;
      const precious = rarity < 0 && (d.id === 'gold_bar' || d.id === 'kokuhen' || (item && item.relic));
      if (rarity >= 0 || precious) {
        const col = rarity >= 0 ? Game.Loot.rarityColor(d) : '#ffd24a';
        const pulse = 0.5 + Math.sin(t * 0.12 + i) * 0.5;
        // 光柱（レア以上/高価品のみ）
        if (rarity >= 1 || precious) {
          ctx.globalAlpha = 0.18 + pulse * 0.14;
          ctx.drawImage(beamSprite(col), s.x - 6 * z, s.y - 46 * z, 12 * z, 50 * z);
        }
        // 地面のグロー
        ctx.globalAlpha = (0.28 + pulse * 0.22) * (rarity >= 1 || precious ? 1 : 0.6);
        ctx.drawImage(glowSprite(col), s.x - 16 * z, s.y + bob - 16 * z, 32 * z, 32 * z);
        ctx.globalAlpha = 1;
        // きらめき
        if ((t + i * 13) % 30 < 4) { ctx.fillStyle = '#fff'; const sx = s.x + Math.cos(i + t * 0.1) * 8 * z, sy = s.y - 6 + Math.sin(i + t * 0.1) * 8 * z + bob; ctx.fillRect(sx - 1, sy - 1, 2, 2); }
        ctx.save(); ctx.translate(s.x, s.y + bob); ctx.rotate(rot);
        if (rarity >= 1 || precious) { ctx.shadowColor = col; ctx.shadowBlur = 8 * z; }
        ctx.fillStyle = col; ctx.fillRect(-5 * z, -5 * z, 10 * z, 10 * z);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-5 * z, -5 * z, 10 * z, 3 * z); // 上面ハイライト
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(-5 * z, -5 * z, 10 * z, 10 * z);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(s.x, s.y + bob); ctx.rotate(rot);
        ctx.fillStyle = (item && item.color) || '#fff';
        ctx.fillRect(-5 * z, -5 * z, 10 * z, 10 * z);
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-5 * z, -5 * z, 10 * z, 3 * z);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(-5 * z, -5 * z, 10 * z, 10 * z);
        ctx.restore();
      }
    }
    // 拾得検知: 前フレームにあって今無い drop（プレイヤー近傍のみ=ワールド切替の誤検知除外）
    if (prevDrops.size) {
      const p = Game.state.player;
      prevDrops.forEach(function (d) {
        if (cur.has(d)) return;
        const dx = d.x - p.x, dy = d.y - p.y;
        if (dx * dx + dy * dy > 3600) return; // 60px以内で消えたもののみ
        spawnPickupBurst(d);
      });
    }
    prevDrops = cur;
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
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      // 自プレイヤーと同じ人型(仲間は緑の体で識別)
      drawCharacter(ctx, s.x, s.y, s.y, '#3fa86a', pe.dir || 'down', 0, true, '#3a2a1a');
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
    // 歩行の上下動(移動中のみ)
    const moved = Math.hypot(p.x - p.prevX, p.y - p.prevY);
    const bob = (!p.vehicle && moved > 0.25) ? Math.abs(Math.sin(Game.state.tick * 0.35)) * 2.5 : 0;
    // 足元の影(モブと統一・乗り物中は描かない)
    if (!p.vehicle) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    const by = s.y - bob;
    // 装備で体の色を変える(防具チェスト)。未装備は旅人の青マント
    const arm = p.armor && p.armor.chest;
    const bodyCol = arm ? (Game.ITEMS[arm.id || arm] && Game.ITEMS[arm.id || arm].color) || '#5a6a8a' : '#3a78d6';
    const swing = moved > 0.25 ? Math.sin(Game.state.tick * 0.35) * 2 : 0; // 手足の振り
    drawCharacter(ctx, s.x, by, s.y, bodyCol, p.dir, p.vehicle ? 0 : swing, !p.vehicle, '#5a3f2a');
    // 手に持つ武器/道具を簡易表示(向き or 照準方向へ)
    if (!p.vehicle) drawHeldItem(ctx, s.x, by, p);
    if (p.invuln > 0 && (Game.state.tick % 6) < 3) {
      ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, by - 1, 13, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // 手に持つアイテムの簡易描画(銃=黒い銃身/剣=刃/道具=柄)。照準方向へ向ける
  function drawHeldItem(ctx, sx, by, p) {
    const sl = Game.Inventory.selectedSlot(); if (!sl) return;
    const def = Game.ITEMS[sl.id]; if (!def) return;
    const isGun = def.tool === 'gun', isMelee = def.attack != null, isStaff = def.tool === 'staff', isTool = def.tool === 'pickaxe' || def.tool === 'axe' || def.tool === 'hoe', isThrow = !!def.throw;
    if (!(isGun || isMelee || isStaff || isTool || isThrow)) return;
    // 角度: 銃/杖は照準方向、近接/道具は向きで左右
    let ang;
    if ((isGun || isStaff) && Game.Projectiles && Game.Projectiles.aimAngle) ang = Game.Projectiles.aimAngle();
    else ang = p.dir === 'left' ? Math.PI : p.dir === 'up' ? -Math.PI / 2 : p.dir === 'down' ? Math.PI / 2 : 0;
    const hx = sx + Math.cos(ang) * 6, hy = by + 1 + Math.sin(ang) * 3; // 手の位置
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const col = def.color || '#888';
    if (isGun) { ctx.fillStyle = '#1a1a1e'; ctx.fillRect(0, -2, 12, 4); ctx.fillStyle = col; ctx.fillRect(1, -1.5, 4, 3); }
    else if (isMelee) { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(0, 0); ctx.stroke(); }
    else if (isStaff) { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(12, 0, 2.6, 0, Math.PI * 2); ctx.fill(); }
    else if (isThrow) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(7, 0, 3, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.fillStyle = col; ctx.fillRect(7, -2.5, 4, 3); } // 道具
    ctx.restore();
  }
  // 人型キャラ描画(プレイヤー/他プレイヤー共通)。脚はfootY基準、bodyは by 基準
  function drawCharacter(ctx, sx, by, footY, bodyCol, dir, swing, withLegs, hairCol) {
    let dx = 0;
    if (dir === 'left') dx = -1; else if (dir === 'right') dx = 1;
    const outline = 'rgba(10,16,30,0.85)';
    ctx.lineCap = 'round';
    if (withLegs) {
      ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - 3, by + 6); ctx.lineTo(sx - 3 + swing * 0.6, footY + 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 3, by + 6); ctx.lineTo(sx + 3 - swing * 0.6, footY + 9); ctx.stroke();
      ctx.fillStyle = bodyCol;
      roundRectR(ctx, sx - 7, by - 4, 14, 13, 5); ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = 2; ctx.beginPath(); roundRectR(ctx, sx - 7, by - 4, 14, 13, 5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; roundRectR(ctx, sx - 6, by - 3, 12, 4, 2); ctx.fill();
      ctx.strokeStyle = bodyCol; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - 6, by - 1); ctx.lineTo(sx - 8, by + 5 + swing * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 6, by - 1); ctx.lineTo(sx + 8, by + 5 - swing * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(sx, by - 8, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(sx, by - 8, 5.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = hairCol || '#5a3f2a'; ctx.beginPath(); ctx.arc(sx, by - 9.5, 5.2, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#222';
    if (dir === 'down') { ctx.fillRect(sx - 2.5, by - 8, 1.6, 1.8); ctx.fillRect(sx + 1, by - 8, 1.6, 1.8); }
    else if (dir === 'up') { /* 後ろ向き */ }
    else { ctx.fillRect(sx + dx * 2.2 - 0.8, by - 8, 1.8, 1.8); }
  }
  function roundRectR(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
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
  // マズルフラッシュ(銃口の閃光)。FPS的な発砲手応えを補強
  const muzzles = [];
  function spawnMuzzle(wx, wy, ang, color, scale) { muzzles.push({ x: wx, y: wy, ang: ang, life: 5, max: 5, col: color || '#ffe06a', sc: scale || 1 }); }
  // レベルアップの光輪(広がる金色のリング)
  const lvRings = [];
  function spawnLevelRing(wx, wy) { lvRings.push({ x: wx, y: wy, life: 26, max: 26 }); }
  function drawLevelRings(ctx) {
    if (!lvRings.length) return;
    const z = Game.Camera.zoom();
    for (let i = lvRings.length - 1; i >= 0; i--) {
      const r = lvRings[i]; r.life--;
      if (r.life <= 0) { lvRings.splice(i, 1); continue; }
      const s = Game.Camera.worldToScreen(r.x, r.y); const k = 1 - r.life / r.max;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3 * z * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(s.x, s.y, (8 + k * 46) * z, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * z;
      ctx.beginPath(); ctx.arc(s.x, s.y, (4 + k * 30) * z, 0, Math.PI * 2); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // 着弾スパーク(弾が敵/壁に当たった瞬間の火花)
  const impacts = [];
  function spawnImpact(wx, wy, color) {
    const n = 5; const arr = [];
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6; arr.push({ a: a, sp: sp }); }
    impacts.push({ x: wx, y: wy, life: 6, max: 6, col: color || '#ffd86a', sp: arr });
  }
  function drawImpacts(ctx) {
    if (!impacts.length) return;
    const z = Game.Camera.zoom();
    for (let i = impacts.length - 1; i >= 0; i--) {
      const m = impacts[i]; m.life--;
      if (m.life <= 0) { impacts.splice(i, 1); continue; }
      const s = Game.Camera.worldToScreen(m.x, m.y); const a = m.life / m.max;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = m.col; ctx.lineWidth = 1.6 * z; ctx.lineCap = 'round';
      const grow = (1 - a) * 11 * z;
      for (let k = 0; k < m.sp.length; k++) { const sp = m.sp[k]; const ox = Math.cos(sp.a) * grow * sp.sp, oy = Math.sin(sp.a) * grow * sp.sp; ctx.beginPath(); ctx.moveTo(s.x + ox * 0.4, s.y + oy * 0.4); ctx.lineTo(s.x + ox, s.y + oy); ctx.stroke(); }
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * z * a, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  function drawMuzzles(ctx) {
    if (!muzzles.length) return;
    const z = Game.Camera.zoom();
    for (let i = muzzles.length - 1; i >= 0; i--) {
      const m = muzzles[i]; m.life--;
      if (m.life <= 0) { muzzles.splice(i, 1); continue; }
      const s = Game.Camera.worldToScreen(m.x, m.y);
      const a = m.life / m.max, len = (10 + (1 - a) * 8) * z * m.sc, w = 5 * z * m.sc * a;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(m.ang); ctx.globalAlpha = a;
      // 中心グロー
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, m.col); g.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, len * 0.7, 0, Math.PI * 2); ctx.fill();
      // 星形の閃光
      ctx.fillStyle = m.col; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const ka = k / 8 * Math.PI * 2; const rr = (k % 2 ? len * 0.35 : len) ; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(ka) * rr, Math.sin(ka) * rr * 0.6); }
      ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
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

  return { draw, buildChunkCache, spawnParticles, spawnBlood, spawnSlash, spawnFloat, spawnLightning, spawnMuzzle, spawnImpact, spawnLevelRing, spawnHitDir, flash, hurtFlash, shake };
})();
