// combat.js — プレイヤーの近接攻撃
window.Game = window.Game || {};

Game.Combat = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 敵対モブが近接の間合いに居るか(コンボ中の採掘フォールバック防止用)
  function hostileInRange(p, rangePx) {
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m.def.hostile) continue;
      if (Math.hypot(m.x - p.x, m.y - p.y) <= rangePx + m.def.size * 0.5) return true;
    }
    return false;
  }

  // 攻撃入力時に呼ぶ。命中したら true（採掘より優先）
  function tryAttack() {
    const p = Game.state.player;
    const rangePx = Game.TUNE.ATTACK_RANGE * TS;
    if (p.attackCd > 0) {
      // 先行入力バッファ: CD残り~200ms(6tick)以内の入力は予約し、CD明けに自動発動(コンボが途切れない)
      if (p.attackCd <= 6) p.attackBuf = true;
      // 敵が間合いに居る間は true を返し、採掘へフォールバックさせない(連打中の入力食い/誤採掘防止)
      return hostileInRange(p, rangePx);
    }
    const mobs = Game.state.mobs;
    // 飛ぶ斬撃などの projectile 武器: 標的の有無に関わらず発射
    const _slot = Game.Inventory.selectedSlot(), _def = _slot && Game.ITEMS[_slot.id];
    // 流星召喚武器（流星の杖）: 範囲内の最寄り敵の頭上へ流星を落とす。敵が居なければ向いた先へ
    if (_def && _def.strike) {
      const stk = _def.strike;
      const reach = (stk.range || 9) * TS;
      let bm = null, bd = Infinity;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= reach && d < bd) { bd = d; bm = m; } }
      let tx2, ty2;
      if (bm) { tx2 = bm.x; ty2 = bm.y; }
      else { let dx2 = 0, dy2 = 0; if (p.dir === 'up') dy2 = -1; else if (p.dir === 'down') dy2 = 1; else if (p.dir === 'left') dx2 = -1; else dx2 = 1; tx2 = p.x + dx2 * 4 * TS; ty2 = p.y + dy2 * 4 * TS; }
      Game.Projectiles.callMeteor(tx2, ty2, Game.Player.effAttack(stk.dmg), stk.radius);
      if (_def.wsfx) Game.Audio.play(_def.wsfx); else Game.Audio.play('swing');
      Game.Render.spawnSlash(p.x, p.y, p.dir, '#ffb24a');
      p.attackCd = stk.cd || Game.Player.attackCooldown();
      return true;
    }
    // 渦召喚武器（渦の杖）: 範囲内最寄り敵の位置に渦を生む。無標的なら向いた先
    if (_def && _def.vortex) {
      const vx = _def.vortex;
      const reach = (vx.range || 8) * TS;
      let bm = null, bd = Infinity;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= reach && d < bd) { bd = d; bm = m; } }
      let tx2, ty2;
      if (bm) { tx2 = bm.x; ty2 = bm.y; }
      else { let dx2 = 0, dy2 = 0; if (p.dir === 'up') dy2 = -1; else if (p.dir === 'down') dy2 = 1; else if (p.dir === 'left') dx2 = -1; else dx2 = 1; tx2 = p.x + dx2 * 4 * TS; ty2 = p.y + dy2 * 4 * TS; }
      Game.Projectiles.callVortex(tx2, ty2, Game.Player.effAttack(vx.dmg), vx.radius, vx.dur);
      Game.Audio.play('whirl');
      Game.Render.spawnSlash(p.x, p.y, p.dir, '#b66ad0');
      p.attackCd = vx.cd || Game.Player.attackCooldown();
      return true;
    }
    let projFired = false;
    if (_def && _def.proj) {
      const pj = _def.proj;
      Game.Projectiles.fire(Game.Player.effAttack(pj.dmg || (Game.Loot.stats(_slot).atk)), pj.kind, { count: pj.count, spread: pj.spread, pierce: pj.pierce, chain: pj.chain, boomerang: pj.boomerang, speed: pj.speed, big: pj.big });
      if (_def.wsfx) Game.Audio.play(_def.wsfx);
      Game.Render.spawnSlash(p.x, p.y, p.dir, pj.kind === 'chain' ? '#fff07a' : pj.kind === 'pierce' ? '#7fe0ff' : '#cfefff');
      projFired = true;
    }
    // 向きベクトル
    let fx = 0, fy = 0;
    if (p.dir === 'up') fy = -1; else if (p.dir === 'down') fy = 1;
    else if (p.dir === 'left') fx = -1; else fx = 1;

    let best = null, bestD = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.friendly) continue; // 友好NPCは攻撃しない
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > rangePx + m.def.size * 0.5) continue;
      // 前方180°以内（または至近）
      const dot = (dx * fx + dy * fy);
      if (d > 14 && dot < 0) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) {
      // 近接標的が無くても、飛ぶ斬撃等は撃ったのでクールダウンを消費
      if (projFired) { p.attackCd = (_def.proj.cd) || Game.Player.attackCooldown(); Game.Audio.play('swing'); return true; }
      return false;
    }

    const slot = Game.Inventory.selectedSlot();
    const st = Game.Loot.stats(slot);
    // 武器ダメージにレベル/STR/スキル補正（同じ装備でもレベルで±）
    let dmg = Game.Player.effAttack(st.atk > 0 ? st.atk : 1);
    const baseDmg = dmg; // 特殊効果のスケール基準(会心補正前)
    // 会心（クリティカル）: 基礎8% ＋ スキル ＋ 装備affix。クリ時 1.8x。パッシブ「集中」は確定会心
    const critCh = (Game.TUNE.BASE_CRIT || 0.08) + Game.Player.skillBonus().crit + (st.crit || 0) + (Game.Player.setBonus().crit || 0);
    const focusCrit = Game.Player.focusArmed && Game.Player.focusArmed();
    const isCrit = focusCrit || Math.random() < critCh;
    if (isCrit) { dmg = Math.round(dmg * (Game.TUNE.CRIT_MULT || 1.8)); Game.Render.shake(7); Game.Audio.play('crit'); }
    if (focusCrit) Game.Player.consumeFocus();
    // 範囲攻撃: スキル「旋風斬り」 or 範囲武器(大剣/戦鎚)は範囲内の敵すべてに当てる
    const wdef = slot && Game.ITEMS[slot.id];
    const aoe = Game.Player.skillFlag('aoe') || (wdef && wdef.aoe);
    if (isCrit && Game.Render.spawnFloat) Game.Render.spawnFloat(best.x, best.y - 22, '会心!', '#ff5a4a', true);
    const targets = [];
    if (aoe) {
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; if (Math.hypot(m.x - p.x, m.y - p.y) <= rangePx + m.def.size * 0.5) targets.push(m); }
    } else targets.push(best);
    // アタックの踏み込み(ランジ): 標的方向へ少し踏み込み、当てた手応えを出す(壁は尊重)
    if (best) {
      const ldx = best.x - p.x, ldy = best.y - p.y, ll = Math.hypot(ldx, ldy) || 1;
      const step = Math.min(6, ll * 0.22), nx = p.x + ldx / ll * step, ny = p.y + ldy / ll * step;
      if (Game.World.isWalkable(Math.floor(nx / TS), Math.floor(ny / TS))) { p.x = nx; p.y = ny; }
    }
    const canDirect = !(Game.Net.isConnected() && !Game.Net.host); // マルチのゲスト中は直接ダメージ不可
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (!canDirect) { Game.Net.sendHit(tg.id, dmg, p.x, p.y); Game.Render.spawnBlood(tg.x, tg.y, 4); }
      else Game.Mobs.damageMob(tg, dmg, p.x, p.y, isCrit);
      // 命中スパーク(打撃の手応え): 接触点に白い火花。会心は強め
      if (Game.Render.spawnImpact) Game.Render.spawnImpact((p.x + tg.x) / 2, (p.y + tg.y) / 2, isCrit ? '#fff0a0' : '#ffffff');
    }
    // 上位武器の特殊効果(雷鳴/残光/衝撃波/吸命/纏い)。ホスト/ソロのみ(ゲストはダメージ権限なし)
    let kills = 0;
    if (canDirect) {
      for (let i = 0; i < targets.length; i++) if (targets[i].hp <= 0) kills++;
      runSpecial(p, wdef, slot, targets, best, baseDmg, kills, rangePx);
    }
    // 吸血（装備のvampiric＋スキル lifesteal）
    let ls = (st.lifesteal || 0) + Game.Player.skillBonus().lifesteal + (Game.Player.setBonus().lifesteal || 0);
    if (ls > 0 && p.health < p.maxHealth) {
      p.health = Math.min(p.maxHealth, p.health + Math.max(1, Math.round(dmg * ls)));
      Game.UI.refreshStats();
    }
    p.attackCd = (projFired && _def.proj.cd) ? _def.proj.cd : Game.Player.attackCooldown();
    Game.Render.spawnSlash(p.x, p.y, p.dir, st.atk >= 8 ? '#ffd86b' : '#ffffff');
    Game.Audio.play('swing');
    return true;
  }

  // ===== 上位近接武器の特殊効果(data-driven: ITEMS[].special) =====
  // 初回発動は盛大に・以降は控えめに(セッション毎リセット)
  const PROC_SEEN = {};
  function procFx(x, y, sp) {
    const first = !PROC_SEEN[sp.name]; PROC_SEEN[sp.name] = 1;
    const col = sp.color || '#ffe27a';
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(x, y - 26, sp.name, col, first);
    if (first) {
      Game.Render.spawnParticles(x, y, col, 16);
      if (Game.Render.flash) Game.Render.flash('rgba(255,240,200,0.10)');
    }
  }

  // 敵対モブを近い順に最大 n 体(除外集合あり)
  function nearestHostiles(px, py, reachPx, n) {
    const out = [];
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.friendly || m.def.npc || m.hp <= 0) continue;
      const d = Math.hypot(m.x - px, m.y - py);
      if (d <= reachPx) out.push([d, m]);
    }
    out.sort(function (a, b) { return a[0] - b[0]; });
    return out.slice(0, n).map(function (e) { return e[1]; });
  }

  function runSpecial(p, wdef, slot, targets, best, baseDmg, kills, rangePx) {
    const sp = wdef && wdef.special;
    if (!sp) return;
    const now = Game.state.tick;
    // 纏い(brand): CDなし。命中した敵全員に既存DoTを付与(炎上/凍え/毒)。演出は控えめ
    if (sp.type === 'brand') {
      for (let i = 0; i < targets.length; i++) {
        if (targets[i].hp <= 0) continue;
        Game.Mobs.applyDot(targets[i], sp.dot);
        Game.Render.spawnParticles(targets[i].x, targets[i].y, sp.color || '#ff7a3a', 3);
      }
      if (!PROC_SEEN[sp.name] && targets.length) procFx(best.x, best.y, sp);
      return;
    }
    // 吸命(reap): 撃破時のみ。小回復＋緑の粒子。短CDで多重撃破の暴発を防ぐ
    if (sp.type === 'reap') {
      if (!p.spCd) p.spCd = {};
      const rk = 'reap:' + slot.id;
      if (kills > 0 && (p.spCd[rk] || 0) <= now) {
        p.spCd[rk] = now + (sp.cd || 30);
        const heal = Math.max(2, Math.round(p.maxHealth * (sp.healPct || 0.03)));
        if (p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + heal);
        procFx(p.x, p.y, sp);
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 14, '+' + heal, '#8fe06a');
        Game.Render.spawnParticles(p.x, p.y, '#8fe06a', 6);
        Game.Audio.play('eat');
        Game.UI.refreshStats();
      }
      return;
    }
    // 以降はCD制(雷鳴/残光/衝撃波)
    if (!p.spCd) p.spCd = {};
    const key = sp.type + ':' + slot.id;
    if ((p.spCd[key] || 0) > now) return;
    if (sp.type === 'thunder') {
      // 周囲の敵 最大count体に天雷(武器攻撃力の pct 倍)
      const victims = nearestHostiles(p.x, p.y, 6 * TS, sp.count || 2);
      if (!victims.length) return;
      p.spCd[key] = now + (sp.cd || 90);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.5)));
      for (let i = 0; i < victims.length; i++) {
        const m = victims[i];
        Game.Render.spawnLightning(m.x + (Math.random() - 0.5) * 20, m.y - 170, m.x, m.y);
        Game.Render.spawnImpact(m.x, m.y, sp.color || '#ffe27a');
        Game.Mobs.damageMob(m, d, p.x, p.y, false);
      }
      Game.Audio.play('thunder');
      procFx(victims[0].x, victims[0].y, sp);
    } else if (sp.type === 'shock') {
      // 自分中心の衝撃波リング(半径 r タイル)。dot 指定があれば併せて付与
      p.spCd[key] = now + (sp.cd || 75);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.45)));
      const rr = (sp.r || 2.2) * TS;
      const victims = nearestHostiles(p.x, p.y, rr, 99);
      Game.Render.spawnImpact(p.x, p.y, sp.color || '#ffd86b');
      Game.Render.spawnParticles(p.x, p.y, sp.color || '#ffd86b', 12);
      Game.Render.shake(5);
      for (let i = 0; i < victims.length; i++) {
        const m = victims[i];
        Game.Mobs.damageMob(m, d, p.x, p.y, false);
        if (sp.dot) Game.Mobs.applyDot(m, sp.dot);
      }
      Game.Audio.play('boom_sfx');
      procFx(p.x, p.y, sp);
    } else if (sp.type === 'nova') {
      // 新星: 命中した敵を中心に元素の爆発。周囲へ pct 倍ダメージ＋DoT。標的に炸裂
      if (!best) return;
      p.spCd[key] = now + (sp.cd || 80);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.5)));
      const rr = (sp.r || 2.0) * TS;
      const victims = nearestHostiles(best.x, best.y, rr, 99);
      const col = sp.color || '#9fd8ff';
      Game.Render.spawnImpact(best.x, best.y, col);
      Game.Render.spawnParticles(best.x, best.y, col, 16);
      if (Game.Render.flash) Game.Render.flash('rgba(160,216,255,0.14)');
      for (let i = 0; i < victims.length; i++) { const m = victims[i]; if (m === best) continue; Game.Mobs.damageMob(m, d, best.x, best.y, false); if (sp.dot) Game.Mobs.applyDot(m, sp.dot); }
      if (sp.dot) Game.Mobs.applyDot(best, sp.dot);
      Game.Audio.play('boom_sfx');
      procFx(best.x, best.y, sp);
    } else if (sp.type === 'echo') {
      // 残光: 本命中の後、遅延した追撃を hits 回(それぞれ pct 倍)。player.update が消化
      if (!best || best.hp <= 0) return;
      p.spCd[key] = now + (sp.cd || 60);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.4)));
      if (!p.echoQ) p.echoQ = [];
      const hits = sp.hits || 2;
      for (let i = 1; i <= hits; i++) p.echoQ.push({ t: now + i * 4, m: best, d: d, color: sp.color || '#ffe9f0' });
      procFx(best.x, best.y, sp);
    }
  }

  return { tryAttack };
})();
