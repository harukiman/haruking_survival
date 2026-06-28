// save.js — LocalStorage 保存/読込（seed + 差分 + インベントリ + stats）
window.Game = window.Game || {};

Game.Save = (function () {
  const KEY = Game.CFG.SAVE_KEY;

  function serialize() {
    const s = Game.state;
    const p = s.player;
    const deltas = {};
    s.modifiedTiles.forEach(function (v, k) { deltas[k] = v; });
    return {
      v: 1,
      seed: s.seed,
      tick: s.tick,
      spawn: s.spawn,
      player: {
        x: p.x, y: p.y, dir: p.dir,
        health: p.health, maxHealth: p.maxHealth,
        hunger: p.hunger, maxHunger: p.maxHunger,
        hotbarIndex: p.hotbarIndex,
      },
      inventory: s.inventory.map(function (sl) { return sl ? { id: sl.id, count: sl.count } : null; }),
      drops: s.drops.map(function (d) { return { id: d.id, count: d.count, x: d.x, y: d.y }; }),
      deltas: deltas,
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(serialize()));
      return true;
    } catch (e) { return false; }
  }

  function hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  return { serialize, save, load, hasSave, clear };
})();
