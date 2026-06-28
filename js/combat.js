// combat.js — プレイヤーの近接攻撃
window.Game = window.Game || {};

Game.Combat = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 攻撃入力時に呼ぶ。命中したら true（採掘より優先）
  function tryAttack() {
    const p = Game.state.player;
    if (p.attackCd > 0) return false;
    const mobs = Game.state.mobs;
    const rangePx = Game.TUNE.ATTACK_RANGE * TS;
    // 飛ぶ斬撃などの projectile 武器: 標的の有無に関わらず発射
    const _slot = Game.Inventory.selectedSlot(), _def = _slot && Game.ITEMS[_slot.id];
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
    // 会心（クリティカル）
    const critCh = Game.Player.skillBonus().crit;
    const isCrit = critCh > 0 && Math.random() < critCh;
    if (isCrit) dmg = Math.round(dmg * 2);
    // 範囲攻撃: スキル「旋風斬り」 or 範囲武器(大剣/戦鎚)は範囲内の敵すべてに当てる
    const wdef = slot && Game.ITEMS[slot.id];
    const aoe = Game.Player.skillFlag('aoe') || (wdef && wdef.aoe);
    if (isCrit && Game.Render.spawnFloat) Game.Render.spawnFloat(best.x, best.y - 18, 'CRIT!', '#ff5a4a', true);
    const targets = [];
    if (aoe) {
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; if (Math.hypot(m.x - p.x, m.y - p.y) <= rangePx + m.def.size * 0.5) targets.push(m); }
    } else targets.push(best);
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (Game.Net.isConnected() && !Game.Net.host) { Game.Net.sendHit(tg.id, dmg, p.x, p.y); Game.Render.spawnBlood(tg.x, tg.y, 4); }
      else Game.Mobs.damageMob(tg, dmg, p.x, p.y);
    }
    // 吸血（装備のvampiric＋スキル lifesteal）
    let ls = (st.lifesteal || 0) + Game.Player.skillBonus().lifesteal;
    if (ls > 0 && p.health < p.maxHealth) {
      p.health = Math.min(p.maxHealth, p.health + Math.max(1, Math.round(dmg * ls)));
      Game.UI.refreshStats();
    }
    p.attackCd = (projFired && _def.proj.cd) ? _def.proj.cd : Game.Player.attackCooldown();
    Game.Render.spawnSlash(p.x, p.y, p.dir, st.atk >= 8 ? '#ffd86b' : '#ffffff');
    Game.Audio.play('swing');
    return true;
  }

  return { tryAttack };
})();
