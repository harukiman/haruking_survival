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
      discovered: s.discovered || {},
      bossSeen: s.bossSeen || {},
      bestiary: s.bestiary || {},
      storySeen: s.storySeen || {},
      eliteKills: s.eliteKills || 0,
      championKills: s.championKills || 0,
      bounty: s.bounty || null,
      bountyDone: s.bountyDone || 0,
      visitedBiomes: s.visitedBiomes || {},
      questIndex: s.questIndex || 0,
      questDone: s.questDone || {},
      waypoints: s.waypoints || [],
      explored: s.explored || {},
      mapMarks: s.mapMarks || [],
      reunified: !!s.reunified,
      worlds: { light: dumpWorld(s.worlds.light), shadow: dumpWorld(s.worlds.shadow), space: dumpWorld(s.worlds.space) },
      player: {
        x: p.x, y: p.y, dir: p.dir,
        health: p.health, maxHealth: p.maxHealth,
        hunger: p.hunger, maxHunger: p.maxHunger,
        hotbarIndex: p.hotbarIndex,
        xp: p.xp, level: p.level, xpNext: p.xpNext, bts: p.bts || 0, armor: p.armor, accessory: p.accessory || null, accessory2: p.accessory2 || null, offhand: p.offhand || null,
        baseMaxHealth: p.baseMaxHealth, status: p.status || {},
        str: p.str || 0, vit: p.vit || 0, dex: p.dex || 0, skillPoints: p.skillPoints || 0, skills: p.skills || {},
        mags: p.mags || {}, loadouts: p.loadouts || null,
        fuel: p.fuel || {}, vehDur: p.vehDur || {},
      },
      ngLevel: s.ngLevel || 0,
      difficulty: s.difficulty || 'normal',
      zoom: s.zoom || 1,
      inventory: s.inventory.map(function (sl) { return sl ? { id: sl.id, count: sl.count, roll: sl.roll || null } : null; }),
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(serialize()));
      return true;
    } catch (e) { return false; }
  }

  // イベント駆動オートセーブ: ネット参加者(非ホスト)は保存せず、短時間の連発をスロットルし、
  // 控えめなインジケータを表示する。reason==='force' でスロットルを無視。
  let lastAuto = 0;
  function autosave(reason) {
    if (Game.Net && Game.Net.isConnected && Game.Net.isConnected() && !Game.Net.host) return false; // ゲストはホスト世界を保存しない
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    if (reason !== 'force' && (t - lastAuto) < 4000) return false; // 4秒スロットル(イベント連発対策)
    lastAuto = t;
    const ok = save();
    if (ok && Game.UI && Game.UI.flashSave) Game.UI.flashSave(reason);
    return ok;
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

  return { serialize, save, autosave, load, hasSave, clear };
})();
