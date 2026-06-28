// survival.js — HP/空腹・回復/餓死・ダメージ・死亡/リスポーン
window.Game = window.Game || {};

Game.Survival = (function () {
  function update() {
    const p = Game.state.player;

    // 空腹減少（移動/採掘でやや速く）
    p.hungerTimer++;
    const moving = Game.Input.intent.dx !== 0 || Game.Input.intent.dy !== 0 || Game.Player.mining.active;
    const drainEvery = moving ? 110 : 170;
    if (p.hungerTimer >= drainEvery) {
      p.hungerTimer = 0;
      if (p.hunger > 0) { p.hunger--; Game.UI.refreshStats(); }
    }

    // 回復 or 餓死
    p.regenTimer++;
    if (p.regenTimer >= 60) {
      p.regenTimer = 0;
      if (p.hunger > 70 && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + 1);
        Game.UI.refreshStats();
      } else if (p.hunger <= 0 && p.health > 0) {
        damage(1, 'starve');
      }
    }
  }

  function eat(amount) {
    const p = Game.state.player;
    p.hunger = Math.min(p.maxHunger, p.hunger + amount);
    Game.UI.refreshStats();
  }

  function damage(amount, source) {
    const p = Game.state.player;
    if (p.invuln > 0 && source !== 'starve') return;
    p.health -= amount;
    if (source !== 'starve') { p.invuln = 30; Game.Audio.play('hurt'); }
    if (p.health <= 0) { p.health = 0; die(); }
    Game.UI.refreshStats();
  }

  function die() {
    const p = Game.state.player;
    Game.UI.toast('力尽きた…リスポーンします');
    // 所持品の一部をその場にドロップ
    const TS = Game.CFG.TILE_SIZE;
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) {
      if (s[i] && Math.random() < 0.5) {
        Game.state.drops.push({ id: s[i].id, count: s[i].count, x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30 });
        s[i] = null;
      }
    }
    p.health = p.maxHealth; p.hunger = Math.max(40, p.hunger);
    p.invuln = 60;
    Game.Player.spawnAt(Game.state.spawn.tx, Game.state.spawn.ty);
    Game.UI.refreshAll();
  }

  return { update, eat, damage, die };
})();
