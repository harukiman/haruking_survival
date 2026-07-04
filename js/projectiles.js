// projectiles.js — 弾（銃）の投射物
window.Game = window.Game || {};

Game.Projectiles = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 弾種→色(描画と発射閃光で共用)
  const KIND_COLOR = {
    fire: '#ff7a3c', frost: '#9fd8ff', hex: '#c060ff', venom: '#9fe04a', tracer: '#ffd24a',
    rocket: '#ff7a3c', slash: '#cfefff', pierce: '#7fe0ff', laser: '#7fe0ff', chain: '#fff07a',
    boomerang: '#caa86a', bullet: '#ffe9a0',
  };

  function spawn(x, y, vx, vy, dmg, kind, hostile, status, explosive) {
    if (!Game.state.projectiles) Game.state.projectiles = [];
    const pr = { x: x, y: y, prevX: x, prevY: y, vx: vx, vy: vy, life: 70, dmg: dmg, kind: kind || 'bullet', hostile: !!hostile, status: status || null, explosive: explosive || 0 };
    Game.state.projectiles.push(pr);
    return pr;
  }

  // 敵の遠距離攻撃: プレイヤー方向へ魔法弾を放つ
  // ボスの弾幕: プレイヤー方向へ扇状に count 発。回避を要する読み合い攻撃
  function enemyVolley(m, dmg, kind, count, spread) {
    const p = Game.state.player;
    const dx = p.x - m.x, dy = p.y - m.y, base = Math.atan2(dy, dx);
    const sp = 5.8, k = kind || 'hex', n = count || 5, half = spread || 0.6;
    const st = k === 'fire' ? { burn: 120 } : k === 'venom' ? { poison: 150 } : null; // 属性で状態異常を付与
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i / (n - 1) - 0.5) * half * 2 : 0);
      spawn(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14, Math.cos(a) * sp, Math.sin(a) * sp, dmg, k, true, st);
    }
    Game.Render.spawnParticles(m.x, m.y, KIND_COLOR[k] || '#c060ff', 8);
    Game.Audio.play('beam');
  }
  function enemyShoot(m, dmg, kind, status) {
    const p = Game.state.player;
    let dx = p.x - m.x, dy = p.y - m.y; const len = Math.hypot(dx, dy) || 1;
    const sp = 6.2;
    const k = kind || 'hex';
    spawn(m.x + dx / len * 12, m.y + dy / len * 12, dx / len * sp, dy / len * sp, dmg, k, true, status);
    // 発射閃光: 弾の出所を明確化(不意打ち感の軽減)＋弾種で音を変える
    Game.Render.spawnParticles(m.x + dx / len * 12, m.y + dy / len * 12, KIND_COLOR[k] || '#c060ff', 3);
    Game.Audio.play(k === 'hex' || k === 'frost' || k === 'venom' ? 'beam' : 'gun');
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
      if (opts.crit) pr.crit = true;
      if (opts.impact) pr.icol = opts.impact; // 口径別の着弾スパーク色(演出のみ)
      if (opts.pierce || kind === 'slash' || kind === 'pierce' || kind === 'laser') { pr.pierce = true; pr.hits = {}; }
      if (opts.chain || kind === 'chain') { pr.chain = opts.chain || 3; }
      if (opts.boomerang || kind === 'boomerang') { pr.boomerang = true; pr.pierce = true; pr.hits = {}; pr.ox = p.x; pr.oy = p.y; pr.life = 140; pr.spin = 0; }
      if (opts.big || kind === 'slash') pr.big = opts.big || (kind === 'slash');
      if (kind === 'slash') pr.life = 26;
      if (kind === 'pierce' || kind === 'laser') pr.life = 40;
    }
  }

  // 遠距離攻撃でオブジェクトに蓄積ダメージ。HPに達したら破壊(ドロップ)
  function damageObject(tx, ty, o, meta, dmg, wx, wy) {
    if (!Game.state.objDmg) Game.state.objDmg = {};
    const key = tx + ',' + ty, rec = Game.state.objDmg[key];
    const acc = (rec && rec.o === o ? rec.dmg : 0) + dmg;
    const col = (Game.ITEMS[meta.drops && meta.drops[0] && meta.drops[0].item] || {}).color || '#caa86a';
    Game.Render.spawnParticles(wx, wy, col, 4); // 削れる破片
    if (acc >= meta.hp) { delete Game.state.objDmg[key]; if (Game.Player.breakBlock) Game.Player.breakBlock(tx, ty, o, meta); }
    else Game.state.objDmg[key] = { o: o, dmg: acc };
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
  function explode(x, y, radiusTiles, dmg, kind) {
    const mobs = Game.state.mobs, r = radiusTiles * TS;
    for (let m = 0; m < mobs.length; m++) {
      const mo = mobs[m]; if (mo.def.friendly) continue;
      if (Math.hypot(mo.x - x, mo.y - y) <= r) {
        if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, Math.round(dmg * 0.7), x, y);
        else { Game.Mobs.damageMob(mo, Math.round(dmg * 0.7), x, y); if (kind && Game.Mobs.applyDot) Game.Mobs.applyDot(mo, kind); }
      }
    }
    if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(x, y, 13 + radiusTiles, 180); // 爆発音で周囲の敵を引き寄せる
    Game.Render.spawnParticles(x, y, '#ff8a3c', 24);
    Game.Render.spawnParticles(x, y, '#ffe27a', 16);
    Game.Render.spawnParticles(x, y, '#57504a', 10); // 破片(デブリ)が飛び散る
    Game.Render.spawnParticles(x, y, '#2e2a26', 6);  // 黒煙
    if (Game.Render.spawnImpact) Game.Render.spawnImpact(x, y, '#ffb060'); // 爆心のスパーク
    if (Game.Render.flash) Game.Render.flash('rgba(255,160,80,0.35)');
    if (Game.Render.shake) Game.Render.shake(Math.min(12, 5 + radiusTiles * 2)); // 爆発で画面が揺れる
    Game.Audio.play('boom_sfx');
  }

  // 流星召喚（流星の杖など）: 標的点の頭上から流星が落ち、着弾で範囲爆発
  const strikes = [];
  function callMeteor(tx, ty, dmg, radiusTiles) {
    const dur = 22 + Math.floor(Math.random() * 8);
    const sx = tx - (180 + Math.random() * 60), sy = ty - (440 + Math.random() * 80);
    strikes.push({ lx: tx, ly: ty, x: sx, y: sy, vx: (tx - sx) / dur, vy: (ty - sy) / dur, life: dur, dmg: dmg, radius: radiusTiles || 2.2 });
  }
  function updateStrikes() {
    for (let i = strikes.length - 1; i >= 0; i--) {
      const m = strikes[i]; m.x += m.vx; m.y += m.vy; m.life--;
      if (m.life <= 0) {
        explode(m.lx, m.ly, m.radius, m.dmg, 'fire');
        if (Game.Render.shake) Game.Render.shake(8);
        strikes.splice(i, 1);
      }
    }
  }
  function drawStrikes(ctx) {
    for (let i = 0; i < strikes.length; i++) {
      const m = strikes[i];
      const head = Game.Camera.worldToScreen(m.x, m.y);
      const tail = Game.Camera.worldToScreen(m.x - m.vx * 6, m.y - m.vy * 6);
      const tg = Game.Camera.worldToScreen(m.lx, m.ly);
      // 着弾予告リング
      ctx.strokeStyle = 'rgba(255,120,60,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, m.radius * TS, 0, Math.PI * 2); ctx.stroke();
      // 流星本体＋尾
      ctx.strokeStyle = 'rgba(255,180,90,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,120,0.3)'; ctx.beginPath(); ctx.arc(head.x, head.y, 9, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 渦召喚（渦の杖など）: 標的点に渦を生み、範囲内の敵を中心へ引き寄せつつ周期的に小ダメージ
  const vortices = [];
  function callVortex(tx, ty, dmg, radiusTiles, dur) {
    vortices.push({ x: tx, y: ty, radius: (radiusTiles || 3) * TS, dmg: dmg || 6, life: dur || 60, maxLife: dur || 60, tk: 0 });
  }
  function updateVortices() {
    const mobs = Game.state.mobs;
    for (let i = vortices.length - 1; i >= 0; i--) {
      const v = vortices[i]; v.life--; v.tk++;
      for (let m = 0; m < mobs.length; m++) {
        const mo = mobs[m]; if (mo.def.friendly || mo.def.boss) continue; // ボスは引き寄せ耐性
        const dx = v.x - mo.x, dy = v.y - mo.y, d = Math.hypot(dx, dy);
        if (d <= v.radius && d > 4) { mo.knockX = (dx / d) * 2.6; mo.knockY = (dy / d) * 2.6; } // 中心へ引き寄せ(壁尊重のknock経由)
      }
      if (v.tk % 10 === 0) { // 周期ダメージ
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m]; if (mo.def.friendly) continue;
          if (Math.hypot(v.x - mo.x, v.y - mo.y) <= v.radius) {
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, v.dmg, v.x, v.y);
            else Game.Mobs.damageMob(mo, v.dmg, v.x, v.y);
          }
        }
      }
      Game.Render.spawnParticles(v.x + (Math.random() - 0.5) * v.radius, v.y + (Math.random() - 0.5) * v.radius, '#b66ad0', 1);
      if (v.life <= 0) vortices.splice(i, 1);
    }
  }
  function drawVortices(ctx) {
    for (let i = 0; i < vortices.length; i++) {
      const v = vortices[i]; const s = Game.Camera.worldToScreen(v.x, v.y);
      const z = Game.Camera.zoom ? Game.Camera.zoom() : 1;
      const t = Game.state.tick;
      ctx.save();
      ctx.strokeStyle = 'rgba(160,90,210,0.55)'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const rad = v.radius * z * (0.35 + k * 0.3);
        const a = t * 0.15 + k * 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, rad, a, a + Math.PI * 1.4); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(180,110,230,0.25)'; ctx.beginPath(); ctx.arc(s.x, s.y, 5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function update() {
    updateStrikes();
    updateVortices();
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
      if (meta && meta.solid && !pr.pierce && !pr.boomerang) {
        if (pr.explosive) explode(pr.x, pr.y, pr.explosive, pr.dmg, pr.kind);
        // 遠距離攻撃で自然オブジェクト(木/石/鉱石など)を破壊できる。設置物/チェストは誤破壊しない
        const breakable = !pr.hostile && meta.mineable && meta.hp != null && o < 100 && o !== Game.OBJ.CHEST && o !== Game.OBJ.TREASURE_CHEST && o !== Game.OBJ.SEAL_WALL;
        if (breakable) damageObject(tx, ty, o, meta, pr.explosive ? pr.dmg * 3 : pr.dmg, pr.x, pr.y);
        else { Game.Render.spawnParticles(pr.x, pr.y, '#caa86a', 3); if (Game.Render.spawnImpact && !pr.hostile) Game.Render.spawnImpact(pr.x, pr.y, pr.icol || '#c9cdd6'); }
        arr.splice(i, 1); continue;
      }
      let hit = false;
      if (pr.hostile) {
        if (Math.hypot(pl.x - pr.x, pl.y - pr.y) < 13) {
          if (Game.Survival.damage(pr.dmg, 'mob') !== false) {
            if (pr.status && Game.Status) for (const k in pr.status) Game.Status.add(k, pr.status[k]);
            if (Game.Render.spawnHitDir) Game.Render.spawnHitDir(pr.prevX, pr.prevY); // 飛来方向を表示
            Game.Render.spawnBlood(pl.x, pl.y, 4); hit = true;
          } else {
            // 無敵中は弾をすり抜ける(消費しない・被弾演出/状態異常なし)。淡い残光のみ
            Game.Render.spawnParticles(pl.x, pl.y, '#bfe8ff', 2);
          }
        }
      } else if (pr.pierce) {
        // 貫通/斬撃/ブーメラン: 範囲内の未命中の敵すべてに当て、消えない
        const reach = pr.big ? 16 : 8;
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m]; if (mo.def.friendly || (pr.hits && pr.hits[mo.id])) continue;
          if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + reach) {
            pr.hits[mo.id] = 1;
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y); else { Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y, pr.crit); if (Game.Mobs.applyDot) Game.Mobs.applyDot(mo, pr.kind); }
          }
        }
      } else {
        // 単発: 最初の敵に命中。連鎖弾は飛び移る
        for (let m = 0; m < mobs.length; m++) {
          const mo = mobs[m]; if (mo.def.friendly) continue;
          if (Math.hypot(mo.x - pr.x, mo.y - pr.y) < mo.def.size * 0.5 + 6) {
            if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mo.id, pr.dmg, pr.x, pr.y); else { Game.Mobs.damageMob(mo, pr.dmg, pr.x, pr.y, pr.crit); if (Game.Mobs.applyDot) Game.Mobs.applyDot(mo, pr.kind); }
            if (pr.chain) { const hs = {}; hs[mo.id] = 1; chainTo(mo.x, mo.y, Math.round(pr.dmg * 0.8), pr.chain, hs); }
            if (Game.Render.spawnImpact) Game.Render.spawnImpact(pr.x, pr.y, pr.icol || (pr.kind === 'laser' || pr.kind === 'pierce' ? '#9fd8ff' : '#ffd86a'));
            hit = true; break;
          }
        }
      }
      if (hit && pr.explosive) explode(pr.x, pr.y, pr.explosive, pr.dmg, pr.kind);
      if (hit || pr.life <= 0) arr.splice(i, 1);
    }
  }

  function draw(ctx) {
    drawStrikes(ctx);
    drawVortices(ctx);
    const arr = Game.state.projectiles;
    if (!arr || !arr.length) return;
    for (let i = 0; i < arr.length; i++) {
      const pr = arr[i];
      const s = Game.Camera.worldToScreen(pr.x, pr.y);
      const ps = Game.Camera.worldToScreen(pr.prevX, pr.prevY);
      const col = KIND_COLOR[pr.kind] || '#ffe9a0';
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
      // 敵弾はやや太く描き、スマホ画面でも視認しやすく(回避猶予の公平性)
      ctx.strokeStyle = col; ctx.lineWidth = pr.hostile ? 5 : pr.kind === 'tracer' ? 2.5 : pr.kind === 'bullet' ? 3 : 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#fff7d8'; ctx.beginPath(); ctx.arc(s.x, s.y, pr.hostile ? 3.5 : pr.kind === 'bullet' || pr.kind === 'tracer' ? 2.2 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { spawn, fire, enemyShoot, enemyVolley, update, draw, explode, callMeteor, callVortex, aimAngle: aimDir };
})();
