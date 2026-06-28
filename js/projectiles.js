// projectiles.js — 弾（銃）の投射物
window.Game = window.Game || {};

Game.Projectiles = (function () {
  const TS = Game.CFG.TILE_SIZE;

  function spawn(x, y, vx, vy, dmg, kind, hostile, status, explosive) {
    if (!Game.state.projectiles) Game.state.projectiles = [];
    const pr = { x: x, y: y, prevX: x, prevY: y, vx: vx, vy: vy, life: 70, dmg: dmg, kind: kind || 'bullet', hostile: !!hostile, status: status || null, explosive: explosive || 0 };
    Game.state.projectiles.push(pr);
    return pr;
  }

  // 敵の遠距離攻撃: プレイヤー方向へ魔法弾を放つ
  function enemyShoot(m, dmg, kind, status) {
    const p = Game.state.player;
    let dx = p.x - m.x, dy = p.y - m.y; const len = Math.hypot(dx, dy) || 1;
    const sp = 6.2;
    spawn(m.x + dx / len * 12, m.y + dy / len * 12, dx / len * sp, dy / len * sp, dmg, kind || 'hex', true, status);
    Game.Audio.play('gun');
  }

  // 発射方向（カーソル/向き）の単位ベクトル
  function aimDir() {
    const p = Game.state.player; let dx = 0, dy = 0; const it = Game.Input.intent;
    if (it.usePointer && it.mouseTile) { dx = (it.mouseTile.tx * TS + TS / 2) - p.x; dy = (it.mouseTile.ty * TS + TS / 2) - p.y; }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { const d = p.dir; if (d === 'up') dy = -1; else if (d === 'down') dy = 1; else if (d === 'left') dx = -1; else dx = 1; }
    return Math.atan2(dy, dx);
  }
  // プレイヤーから発射。kind: bullet/tracer/rocket/fire/frost/slash/pierce/laser/chain/boomerang
  // opts: spread/explosive/speed/count/pierce/chain/boomerang/big
  function fire(dmg, kind, opts) {
    opts = opts || {};
    const p = Game.state.player;
    const baseAng = aimDir();
    const count = opts.count || 1;
    const defSp = kind === 'bullet' || kind === 'tracer' || !kind ? 9 : kind === 'rocket' ? 6 : kind === 'pierce' || kind === 'laser' ? 13 : kind === 'slash' ? 8.5 : kind === 'boomerang' ? 7 : 7;
    const sp = opts.speed || defSp;
    for (let i = 0; i < count; i++) {
      let spr = 0;
      if (opts.spread) spr = count > 1 ? (i / (count - 1) - 0.5) * opts.spread : (Math.random() - 0.5) * opts.spread;
      const ang = baseAng + spr;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const pr = spawn(p.x + ux * 14, p.y + uy * 14, ux * sp, uy * sp, dmg, kind, false, null, opts.explosive || 0);
      pr.ang = ang;
      if (opts.pierce || kind === 'slash' || kind === 'pierce' || kind === 'laser') { pr.pierce = true; pr.hits = {}; }
      if (opts.chain || kind === 'chain') { pr.chain = opts.chain || 3; }
      if (opts.boomerang || kind === 'boomerang') { pr.boomerang = true; pr.pierce = true; pr.hits = {}; pr.ox = p.x; pr.oy = p.y; pr.life = 140; pr.spin = 0; }
      if (opts.big || kind === 'slash') pr.big = opts.big || (kind === 'slash');
      if (kind === 'slash') pr.life = 26;
      if (kind === 'pierce' || kind === 'laser') pr.life = 40;
    }
  }

  // 連鎖（雷）: 命中点から近傍の敵へ飛び移ってダメージ
  function chainTo(x, y, dmg, jumps, hitSet) {
    const mobs = Game.state.mobs; let fx = x, fy = y, left = jumps;
    while (left-- > 0) {
      let best = null, bd = 6 * TS;
      for (let i = 0; i < mobs.length; i++) { const mo = mobs[i]; if (mo.def.friendly || hitSet[mo.id]) continue; const d = Math.hypot(mo.x - fx, mo.y - fy); if (d < bd) { bd = d; best = mo; } }
      if (!best) break;
      hitSet[best.id] = 1;
      if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(best.id, dmg, fx, fy); else Game.Mobs.damageMob(best, dmg, fx, fy);
      if (Game.Render.spawnLightning) Game.Render.spawnLightning(fx, fy, best.x, best.y);
      fx = best.x; fy = best.y;
    }
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
    const pl = Game.state.player;
    for (let i = arr.length - 1; i >= 0; i--) {
      const pr = arr[i];
      pr.prevX = pr.x; pr.prevY = pr.y;
      if (pr.spin != null) pr.spin += 0.5;
      // ブーメラン: 一定距離で反転しプレイヤーへ戻る
      if (pr.boomerang) {
        if (!pr.returning && Math.hypot(pr.x - pr.ox, pr.y - pr.oy) > 5.5 * TS) pr.returning = true;
        if (pr.returning) { const dx = pl.x - pr.x, dy = pl.y - pr.y, l = Math.hypot(dx, dy) || 1; const sp = Math.hypot(pr.vx, pr.vy); pr.vx = dx / l * sp; pr.vy = dy / l * sp; if (l < 18) { arr.splice(i, 1); continue; } }
      }
      pr.x += pr.vx; pr.y += pr.vy; pr.life--;
      // 壁（solid）に当たれば消滅（貫通/ブーメランは壁を無視）
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
      const o = Game.World.objAt(tx, ty), meta = Game.OBJ_META[o];
      if (meta && meta.solid && !pr.pierce && !pr.boomerang) { if (pr.explosive) explode(pr.x, pr.y, pr.explosive, pr.dmg); else Game.Render.spawnParticles(pr.x, pr.y, '#caa86a', 3); arr.splice(i, 1); continue; }
      let hit = false;
      if (pr.hostile) {
        if (Math.hypot(pl.x - pr.x, pl.y - pr.y) < 13) {
          Game.Survival.damage(pr.dmg, 'mob');
          if (pr.status && Game.Status) for (const k in pr.status) Game.Status.add(k, pr.status[k]);
          Game.Render.spawnBlood(pl.x, pl.y, 4); hit = true;
        }
      } else if (pr.pierce) {
        // 貫通/斬撃/ブーメラン: 範囲内の未命中の敵すべてに当て、消えない
        const reach = pr.big ? 16 : 8;
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m]; if (mo.def.friendly || (pr.hits && pr.hits[mo.id])) continue;
          if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + reach) {
            pr.hits[mo.id] = 1;
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y); else Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y);
          }
        }
      } else {
        // 単発: 最初の敵に命中。連鎖弾は飛び移る
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m]; if (mo.def.friendly) continue;
          if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + 6) {
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y); else Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y);
            if (pr.chain) { const hs = {}; hs[mo.id] = 1; chainTo(mo.x, mo.y, Math.round(pr.dmg * 0.8), pr.chain, hs); }
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
      const col = pr.kind === 'fire' ? '#ff7a3c' : pr.kind === 'frost' ? '#9fd8ff' : pr.kind === 'hex' ? '#c060ff' : pr.kind === 'venom' ? '#9fe04a' : pr.kind === 'tracer' ? '#ffd24a' : pr.kind === 'rocket' ? '#ff7a3c' : pr.kind === 'slash' ? '#cfefff' : pr.kind === 'pierce' || pr.kind === 'laser' ? '#7fe0ff' : pr.kind === 'chain' ? '#fff07a' : pr.kind === 'boomerang' ? '#caa86a' : '#ffe9a0';
      const z = Game.Camera.zoom ? Game.Camera.zoom() : 1;
      if (pr.kind === 'slash') {
        // 飛ぶ斬撃: 進行方向に直交する三日月
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((pr.ang || 0) + Math.PI / 2);
        ctx.strokeStyle = pr.big ? '#ffe9a0' : col; ctx.lineWidth = (pr.big ? 6 : 4) * z; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, (pr.big ? 16 : 11) * z, -0.9, 0.9); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.lineWidth = (pr.big ? 12 : 8) * z; ctx.stroke(); ctx.globalAlpha = 1; ctx.restore(); continue;
      }
      if (pr.kind === 'boomerang') {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(pr.spin || 0);
        ctx.fillStyle = col; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
        ctx.fillRect(-9 * z, -3 * z, 18 * z, 6 * z); ctx.fillRect(-3 * z, -9 * z, 6 * z, 18 * z); ctx.restore(); continue;
      }
      if (pr.kind === 'pierce' || pr.kind === 'laser') {
        ctx.strokeStyle = col; ctx.lineWidth = 6 * z; ctx.lineCap = 'round'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 2.5 * z; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke(); continue;
      }
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
