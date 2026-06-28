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
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > rangePx + m.def.size * 0.5) continue;
      // 前方180°以内（または至近）
      const dot = (dx * fx + dy * fy);
      if (d > 14 && dot < 0) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) return false;

    const sel = Game.Inventory.selectedItemDef();
    const dmg = (sel && sel.attack) ? sel.attack : 1; // 素手=1
    Game.Mobs.damageMob(best, dmg, p.x, p.y);
    p.attackCd = Game.TUNE.ATTACK_COOLDOWN;
    Game.Audio.play('swing');
    return true;
  }

  return { tryAttack };
})();
