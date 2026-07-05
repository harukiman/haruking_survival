// save.js — LocalStorage 保存/読込（seed + 差分 + インベントリ + stats）
window.Game = window.Game || {};

Game.Save = (function () {
  const KEY = Game.CFG.SAVE_KEY;
  // 複数セーブスロット(複数人が別々のデータで遊べる)。スロット0=従来キー(既存セーブ互換)
  const SLOTS = 3;
  let curSlot = 0;
  try { curSlot = Math.max(0, Math.min(SLOTS - 1, parseInt(localStorage.getItem(KEY + '_cur') || '0', 10) || 0)); } catch (e) {}
  function slotKey(i) { return i > 0 ? KEY + '_' + i : KEY; }
  function setSlot(i) { curSlot = Math.max(0, Math.min(SLOTS - 1, i | 0)); try { localStorage.setItem(KEY + '_cur', String(curSlot)); } catch (e) {} }
  function currentSlot() { return curSlot; }
  function slotCount() { return SLOTS; }
  function slotName(i) { try { return localStorage.getItem(KEY + '_name_' + i) || ('枠' + (i + 1)); } catch (e) { return '枠' + (i + 1); } }
  function setSlotName(i, name) { try { name = (name || '').trim().slice(0, 16); if (name) localStorage.setItem(KEY + '_name_' + i, name); else localStorage.removeItem(KEY + '_name_' + i); } catch (e) {} }
  function slotInfo(i) {
    try { const raw = localStorage.getItem(slotKey(i)); const base = { name: slotName(i) }; if (!raw) return Object.assign(base, { exists: false }); const d = JSON.parse(raw);
      return Object.assign(base, { exists: true, level: (d.player && d.player.level) || 1, diff: d.difficulty || 'normal', ng: d.ngLevel || 0 }); }
    catch (e) { return { exists: false, name: slotName(i) }; }
  }

  function dumpWorld(w) {
    const deltas = {}, tileData = {};
    w.modifiedTiles.forEach(function (v, k) { deltas[k] = v; });
    w.tileData.forEach(function (v, k) { tileData[k] = v; });
    return {
      deltas: deltas,
      tileData: tileData,
      drops: w.drops.map(function (d) { return { id: d.id, count: d.count, x: d.x, y: d.y, roll: d.roll || null, m: d.manual ? 1 : 0 }; }),
    };
  }

  function serialize() {
    // データ喪失防止: コントローラで「持ち上げ中」のアイテムはスロットがnull化されている。
    // セーブ前にインベントリへ戻す(戻さないと保存に含まれず消滅する)
    try { if (Game.UI && Game.UI.isHoldingItem && Game.UI.isHoldingItem()) Game.UI.padGrabReturn(); } catch (e) {}
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
        baseMaxHealth: p.baseMaxHealth, status: p.status || {}, mp: p.mp, maxMp: p.maxMp,
        str: p.str || 0, vit: p.vit || 0, dex: p.dex || 0, skillPoints: p.skillPoints || 0, skills: p.skills || {},
        mags: p.mags || {}, loadouts: p.loadouts || null,
        fuel: p.fuel || {}, vehDur: p.vehDur || {}, vehGuns: p.vehGuns || {}, missileMode: p.missileMode || 'homing', vehicle: p.vehicle || null,
      },
      ngLevel: s.ngLevel || 0,
      tips: s._tips || {},
      fallout: s.fallout || [],
      difficulty: s.difficulty || 'normal',
      deathSpot: s.deathSpot || null,
      grazeCount: s.grazeCount || 0, deliverDone: s.deliverDone || 0, achMilestones: s.achMilestones || {},
      zoom: s.zoom || 1,
      inventory: s.inventory.map(function (sl) { return sl ? { id: sl.id, count: sl.count, roll: sl.roll || null, dur: sl.dur, durMax: sl.durMax } : null; }),
    };
  }

  function save() {
    try {
      const key = slotKey(curSlot);
      const payload = JSON.stringify(serialize());
      // 1世代バックアップ: 書き込み前の現行セーブを _bak に退避(破損・不正データ時のフォールバック)
      try { const prev = localStorage.getItem(key); if (prev) localStorage.setItem(key + '_bak', prev); } catch (eb) {}
      localStorage.setItem(key, payload);
      return true;
    } catch (e) {
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      // 容量超過は自動回復を試みる: 全世界の自然ドロップ(手で捨てた品以外)を破棄して1回だけ再保存
      if (quota && !save._retrying) {
        try {
          save._retrying = true;
          let pruned = 0;
          const ws = Game.state.worlds || {};
          for (const k in ws) { const arr = ws[k] && ws[k].drops; if (!arr) continue; for (let i = arr.length - 1; i >= 0; i--) { if (!arr[i].manual) { arr.splice(i, 1); pruned++; } } }
          const ok = save();
          save._retrying = false;
          if (ok) { if (Game.UI && Game.UI.toast) Game.UI.toast('⚠ セーブ容量が上限のため、地面の自然ドロップ' + pruned + '個を整理して保存しました'); return true; }
        } catch (e3) { save._retrying = false; }
      }
      // 失敗を黙殺しない(無言で進捗が保存されない事故の防止)。30秒に1回まで警告
      try {
        const now = Date.now();
        if (!save._warnT || now - save._warnT > 30000) {
          save._warnT = now;
          if (Game.UI && Game.UI.toast) Game.UI.toast(quota ? '⚠ セーブ容量が上限に達しています！' : '⚠ セーブに失敗しました');
        }
      } catch (e2) {}
      return false;
    }
  }

  // イベント駆動オートセーブ: 短時間の連発をスロットルし、控えめなインジケータを表示。
  // reason==='force' でスロットルを無視。
  // ⑱ MPゲストも自分の進捗(レベル/インベントリ/スキル/所持世界のコピー)を保存する。
  // 次回「つづきから」で自分のスロットに、共有世界のコピー＋育てたキャラで再開できる。
  let lastAuto = 0;
  function autosave(reason) {
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    if (reason !== 'force' && (t - lastAuto) < 4000) return false; // 4秒スロットル(イベント連発対策)
    lastAuto = t;
    const ok = save();
    if (ok && Game.UI && Game.UI.flashSave) Game.UI.flashSave(reason);
    return ok;
  }

  function hasSave() {
    try { return !!localStorage.getItem(slotKey(curSlot)); } catch (e) { return false; }
  }

  function load() {
    const key = slotKey(curSlot);
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // 破損セーブ: バックアップ世代へフォールバック(直前の正常な状態で復帰)
      try {
        const bak = localStorage.getItem(key + '_bak');
        if (bak) { const d = JSON.parse(bak); if (Game.UI && Game.UI.toast) setTimeout(function () { try { Game.UI.toast('⚠ セーブが破損していたため、直前のバックアップから復元しました'); } catch (e2) {} }, 1500); return d; }
      } catch (e3) {}
      return null;
    }
    return null;
  }

  function clear() {
    try { localStorage.removeItem(slotKey(curSlot)); } catch (e) {}
  }

  return { serialize, save, autosave, load, hasSave, clear, setSlot, currentSlot, slotCount, slotInfo, slotName, setSlotName };
})();
