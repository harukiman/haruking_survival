// projectiles.js — 弾（銃）の投射物
window.Game = window.Game || {};

Game.Projectiles = (function () {
  const TS = Game.CFG.TILE_SIZE;

  function spawn(x, y, vx, vy, dmg) {
    if (!Game.state.projectiles) Game.state.projectiles = [];
    Game.state.projectiles.push({ x: x, y: y, prevX: x, prevY: y, vx: vx, vy: vy, life: 55, dmg: dmg });
  }

  // プレイヤーから発射（カーソル/向き方向）
  function fire(dmg) {
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
    const len = Math.hypot(dx, dy) || 1;
    const sp = 9;
    spawn(p.x + dx / len * 14, p.y + dy / len * 14, dx / len * sp, dy / len * sp, dmg);
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
      if (meta && meta.solid) { Game.Render.spawnParticles(pr.x, pr.y, '#caa86a', 3); arr.splice(i, 1); continue; }
      // 敵命中
      let hit = false;
      for (let m = 0; m < mobs.length; m++) {
        const mo = mobs[m];
        if (mo.def.friendly) continue;
        if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + 6) {
          if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y);
          else Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y);
          hit = true; break;
        }
      }
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
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#fff7d8'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { spawn, fire, update, draw };
})();
