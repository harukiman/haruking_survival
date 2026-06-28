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
    if (!best) return false;

    const slot = Game.Inventory.selectedSlot();
    const st = Game.Loot.stats(slot);
    const dmg = st.atk > 0 ? st.atk : 1; // 素手=1
    if (Game.Net.isConnected() && !Game.Net.host) {
      Game.Net.sendHit(best.id, dmg, p.x, p.y); // クライアントはホストに被ダメ要求
      Game.Render.spawnBlood(best.x, best.y, 4); // 手応えの演出
    } else {
      Game.Mobs.damageMob(best, dmg, p.x, p.y);
    }
    // 吸血
    if (st.lifesteal > 0 && p.health < p.maxHealth) {
      p.health = Math.min(p.maxHealth, p.health + Math.max(1, Math.round(dmg * st.lifesteal)));
      Game.UI.refreshStats();
    }
    p.attackCd = Game.TUNE.ATTACK_COOLDOWN;
    Game.Render.spawnSlash(p.x, p.y, p.dir, st.atk >= 8 ? '#ffd86b' : '#ffffff');
    Game.Audio.play('swing');
    return true;
  }

  return { tryAttack };
})();
