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

    // 正気度（影世界で減少・光の護符/光源で緩和、光世界で回復）
    const T = Game.TUNE;
    if (Game.state.worldName === 'shadow') {
      let drain = T.SANITY_DRAIN;
      let immune = false;
      for (const k in p.armor) { const id = p.armor[k]; if (id && Game.ITEMS[id]) { if (Game.ITEMS[id].immuneSanity) immune = true; else if (Game.ITEMS[id].lumen) drain *= 0.4; } }
      if (immune) drain = 0;
      if (nearLight()) drain *= 0.3;
      Game.state.sanity = Math.max(0, Game.state.sanity - drain);
      if (Game.state.sanity < 10 && Game.Achievements) Game.Achievements.unlock('deep_sanity');
      if (Game.state.sanity <= 0 && p.health > 0 && Game.state.tick % 50 === 0) damage(2, 'sanity');
    } else if (Game.state.sanity < T.SANITY_MAX) {
      Game.state.sanity = Math.min(T.SANITY_MAX, Game.state.sanity + 0.06);
    }
    if (Game.state.tick % 15 === 0) Game.UI.refreshStats();
  }

  function nearLight() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (Game.LIGHT_LEVEL[Game.World.objAt(ptx + dx, pty + dy)]) return true;
    }
    return false;
  }

  function eat(amount) {
    const p = Game.state.player;
    p.hunger = Math.min(p.maxHunger, p.hunger + amount);
    Game.UI.refreshStats();
  }

  function damage(amount, source) {
    const p = Game.state.player;
    const physical = source !== 'starve' && source !== 'sanity';
    if (p.invuln > 0 && physical) return;
    // 防具で軽減（飢餓・正気崩壊は無視）
    if (physical) {
      const armor = Game.Player.totalArmor();
      amount = Math.max(1, amount - armor);
    }
    p.health -= amount;
    if (physical) { p.invuln = 30; Game.Audio.play('hurt'); }
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
