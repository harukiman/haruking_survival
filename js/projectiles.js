// projectiles.js — 弾（銃）の投射物
window.Game = window.Game || {};

Game.Projectiles = (function () {
  const TS = Game.CFG.TILE_SIZE;

  function spawn(x, y, vx, vy, dmg, kind, hostile, status, explosive) {
    if (!Game.state.projectiles) Game.state.projectiles = [];
    Game.state.projectiles.push({ x: x, y: y, prevX: x, prevY: y, vx: vx, vy: vy, life: 70, dmg: dmg, kind: kind || 'bullet', hostile: !!hostile, status: status || null, explosive: explosive || 0 });
  }

  // 敵の遠距離攻撃: プレイヤー方向へ魔法弾を放つ
  function enemyShoot(m, dmg, kind, status) {
    const p = Game.state.player;
    let dx = p.x - m.x, dy = p.y - m.y; const len = Math.hypot(dx, dy) || 1;
    const sp = 6.2;
    spawn(m.x + dx / len * 12, m.y + dy / len * 12, dx / len * sp, dy / len * sp, dmg, kind || 'hex', true, status);
    Game.Audio.play('gun');
  }

  // プレイヤーから発射（カーソル/向き方向）。kind: bullet/tracer/rocket/fire/frost。opts: spread/explosive/speed
  function fire(dmg, kind, opts) {
    opts = opts || {};
    const p = Game.state.player;
    let dx = 0, dy = 0;
    const it = Game.Input.intent;
    if (it.usePointer && it.mouseTile) {
      dx = (it.mouseTile.tx * TS + TS / 2) - p.x;
      dy = (it.mouseTile.ty * TS + TS / 2) - p.y;
    }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      const d = p.dir;
      if (d === 'up') dy = -1; else if (d === 'down') dy = 1; else if (d === 'left') dx = -1; else dx = 1;
    }
    let ang = Math.atan2(dy, dx) + (opts.spread || 0);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const sp = opts.speed || (kind === 'bullet' || kind === 'tracer' || !kind ? 9 : kind === 'rocket' ? 6 : 7);
    spawn(p.x + ux * 14, p.y + uy * 14, ux * sp, uy * sp, dmg, kind, false, null, opts.explosive || 0);
  }

  // 爆発: 範囲内の敵にダメージ＋演出
  function explode(x, y, radiusTiles, dmg) {
    const mobs = Game.state.mobs, r = radiusTiles * TS;
    for (let m = 0; m < mobs.length; m++) {
      const mo = mobs[m]; if (mo.def.friendly) continue;
      if (Math.hypot(mo.x - x, mo.y - y) <= r) {
        if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, Math.round(dmg * 0.7), x, y);
        else Game.Mobs.damageMob(mo, Math.round(dmg * 0.7), x, y);
      }
    }
    Game.Render.spawnParticles(x, y, '#ff8a3c', 24);
    Game.Render.spawnParticles(x, y, '#ffe27a', 16);
    if (Game.Render.flash) Game.Render.flash('rgba(255,160,80,0.35)');
    Game.Audio.play('boom_sfx');
  }

  function update() {
    const arr = Game.state.projectiles;
    if (!arr || !arr.length) return;
    const mobs = Game.state.mobs;
    for (let i = arr.length - 1; i >= 0; i--) {
      const pr = arr[i];
      pr.prevX = pr.x; pr.prevY = pr.y;
      pr.x += pr.vx; pr.y += pr.vy; pr.life--;
      // 壁（solid）に当たれば消滅
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
      const o = Game.World.objAt(tx, ty), meta = Game.OBJ_META[o];
      if (meta && meta.solid) { if (pr.explosive) explode(pr.x, pr.y, pr.explosive, pr.dmg); else Game.Render.spawnParticles(pr.x, pr.y, '#caa86a', 3); arr.splice(i, 1); continue; }
      let hit = false;
      if (pr.hostile) {
        // 敵弾: プレイヤーに命中
        const pl = Game.state.player;
        if (Math.hypot(pl.x - pr.x, pl.y - pr.y) < 13) {
          Game.Survival.damage(pr.dmg, 'mob');
          if (pr.status && Game.Status) for (const k in pr.status) Game.Status.add(k, pr.status[k]);
          Game.Render.spawnBlood(pl.x, pl.y, 4);
          hit = true;
        }
      } else {
        // 自弾: 敵に命中
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m];
          if (mo.def.friendly) continue;
          if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + 6) {
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y);
            else Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y);
            hit = true; break;
          }
        }
      }
      if (hit && pr.explosive) explode(pr.x, pr.y, pr.explosive, pr.dmg);
      if (hit || pr.life <= 0) arr.splice(i, 1);
    }
  }

  function draw(ctx) {
    const arr = Game.state.projectiles;
    if (!arr || !arr.length) return;
    for (let i = 0; i < arr.length; i++) {
      const pr = arr[i];
      const s = Game.Camera.worldToScreen(pr.x, pr.y);
      const ps = Game.Camera.worldToScreen(pr.prevX, pr.prevY);
      const col = pr.kind === 'fire' ? '#ff7a3c' : pr.kind === 'frost' ? '#9fd8ff' : pr.kind === 'hex' ? '#c060ff' : pr.kind === 'venom' ? '#9fe04a' : pr.kind === 'tracer' ? '#ffd24a' : pr.kind === 'rocket' ? '#ff7a3c' : '#ffe9a0';
      if (pr.kind === 'rocket') {
        // ロケット弾: 煙の尾＋本体
        ctx.strokeStyle = 'rgba(180,180,190,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.arc(ps.x, ps.y, 3, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.strokeStyle = col; ctx.lineWidth = pr.kind === 'tracer' ? 2.5 : pr.kind === 'bullet' ? 3 : 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#fff7d8'; ctx.beginPath(); ctx.arc(s.x, s.y, pr.kind === 'bullet' || pr.kind === 'tracer' ? 2.2 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { spawn, fire, enemyShoot, update, draw };
})();
