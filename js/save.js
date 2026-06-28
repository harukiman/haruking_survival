// save.js — LocalStorage 保存/読込（seed + 差分 + インベントリ + stats）
window.Game = window.Game || {};

Game.Save = (function () {
  const KEY = Game.CFG.SAVE_KEY;

  function dumpWorld(w) {
    const deltas = {}, tileData = {};
    w.modifiedTiles.forEach(function (v, k) { deltas[k] = v; });
    w.tileData.forEach(function (v, k) { tileData[k] = v; });
    return {
      deltas: deltas,
      tileData: tileData,
      drops: w.drops.map(function (d) { return { id: d.id, count: d.count, x: d.x, y: d.y, roll: d.roll || null }; }),
    };
  }

  function serialize() {
    const s = Game.state;
    const p = s.player;
    return {
      v: 4,
      seed: s.seed,
      tick: s.tick,
      spawn: s.spawn,
      weather: s.weather,
      worldName: s.worldName,
      sanity: s.sanity,
      hasShifted: s.hasShifted,
      achievements: s.achievements || {},
      lore: s.lore || {},
      riftBank: s.riftBank || null,
      resonated: s.resonated || {},
      questIndex: s.questIndex || 0,
      questDone: s.questDone || {},
      reunified: !!s.reunified,
      worlds: { light: dumpWorld(s.worlds.light), shadow: dumpWorld(s.worlds.shadow) },
      player: {
        x: p.x, y: p.y, dir: p.dir,
        health: p.health, maxHealth: p.maxHealth,
        hunger: p.hunger, maxHunger: p.maxHunger,
        hotbarIndex: p.hotbarIndex,
        xp: p.xp, level: p.level, xpNext: p.xpNext, armor: p.armor,
        baseMaxHealth: p.baseMaxHealth, status: p.status || {},
      },
      ngLevel: s.ngLevel || 0,
      difficulty: s.difficulty || 'normal',
      inventory: s.inventory.map(function (sl) { return sl ? { id: sl.id, count: sl.count, roll: sl.roll || null } : null; }),
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
