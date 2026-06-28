// loot.js — ハクスラ戦利品（レアリティ＋ランダムaffix）
window.Game = window.Game || {};

Game.Loot = (function () {
  const RARITY = [
    { name: 'コモン', color: '#cfd6e0' },        // 0
    { name: 'レア', color: '#5a9fe0' },          // 1
    { name: 'エピック', color: '#b060e8' },      // 2
    { name: 'レジェンダリー', color: '#ff9a3c' },// 3
  ];
  const WEAPON_AFFIXES = [
    { key: 'sharp', name: '鋭利な', atk: [1, 2] },
    { key: 'brutal', name: '残虐な', atk: [2, 4] },
    { key: 'keen', name: '鋭敏な', atk: [1, 3] },
    { key: 'vampiric', name: '吸血の', life: [0.08, 0.2] },
  ];
  const ARMOR_AFFIXES = [
    { key: 'sturdy', name: '頑強な', arm: [1, 2] },
    { key: 'guardian', name: '守護の', arm: [2, 3] },
    { key: 'vital', name: '生命の', hp: [6, 16] },
    { key: 'warded', name: '護られし', sanity: true },
  ];

  function rr(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function isWeapon(d) { return d && d.attack != null; }
  function isArmor(d) { return d && d.armor != null && d.slot; }
  function rollable(id) { const d = Game.ITEMS[id]; return isWeapon(d) || isArmor(d); }

  function rollRarity(bonus) {
    const r = Math.random() - (bonus || 0);
    // バランス調整: コモン多め・高レアは稀に（インフレ防止）
    if (r > 0.42) return 0;   // コモン 約58%（affixなし）
    if (r > 0.13) return 1;   // レア 約29%
    if (r > 0.03) return 2;   // エピック 約10%
    return 3;                 // レジェンダリー 約3%
  }

  function roll(id, bonus) {
    if (!rollable(id)) return null;
    return rollAt(id, rollRarity(bonus));
  }

  // 指定レアリティで affix を生成
  function rollAt(id, rarity) {
    const def = Game.ITEMS[id];
    if (!rollable(id)) return null;
    const pool = isWeapon(def) ? WEAPON_AFFIXES : ARMOR_AFFIXES;
    const affixes = [], keys = [];
    for (let i = 0; i < rarity; i++) {
      let pick = null, tries = 0;
      while (tries++ < 8) { const a = pool[Math.floor(Math.random() * pool.length)]; if (keys.indexOf(a.key) < 0) { pick = a; break; } }
      if (!pick) break;
      keys.push(pick.key);
      const af = { key: pick.key, name: pick.name };
      if (pick.atk) af.atk = rr(pick.atk[0], pick.atk[1]);
      if (pick.arm) af.arm = rr(pick.arm[0], pick.arm[1]);
      if (pick.hp) af.hp = rr(pick.hp[0], pick.hp[1]);
      if (pick.life) af.life = Math.round((pick.life[0] + Math.random() * (pick.life[1] - pick.life[0])) * 100) / 100;
      if (pick.sanity) af.sanity = true;
      affixes.push(af);
    }
    return { rarity: rarity, affixes: affixes };
  }

  // 実効ステータス
  function stats(slot) {
    const out = { atk: 0, armor: 0, hp: 0, lifesteal: 0, sanityResist: false };
    if (!slot) return out;
    const def = Game.ITEMS[slot.id];
    if (!def) return out;
    out.atk = def.attack || 0;
    out.armor = def.armor || 0;
    const rl = slot.roll;
    if (rl) {
      if (def.attack) out.atk += rl.rarity;             // レアリティ毎に攻撃+1
      if (def.armor && rl.rarity >= 2) out.armor += 1;  // エピック以上で防御+1
      rl.affixes.forEach(function (a) {
        if (a.atk) out.atk += a.atk;
        if (a.arm) out.armor += a.arm;
        if (a.hp) out.hp += a.hp;
        if (a.life) out.lifesteal += a.life;
        if (a.sanity) out.sanityResist = true;
      });
    }
    return out;
  }

  function rarityColor(slot) { return RARITY[(slot && slot.roll) ? slot.roll.rarity : 0].color; }
  function rarityName(slot) { return RARITY[(slot && slot.roll) ? slot.roll.rarity : 0].name; }
  function displayName(slot) {
    const def = Game.ITEMS[slot.id]; let name = def ? def.name : slot.id;
    if (slot.roll && slot.roll.affixes.length) name = slot.roll.affixes.map(function (a) { return a.name; }).join('') + name;
    return name;
  }
  function statText(slot) {
    const s = stats(slot); const parts = [];
    if (Game.ITEMS[slot.id] && Game.ITEMS[slot.id].attack != null) parts.push('攻撃 ' + s.atk);
    if (Game.ITEMS[slot.id] && Game.ITEMS[slot.id].armor != null) parts.push('防御 ' + s.armor);
    if (s.hp) parts.push('最大HP +' + s.hp);
    if (s.lifesteal) parts.push('吸血 ' + Math.round(s.lifesteal * 100) + '%');
    if (s.sanityResist) parts.push('正気耐性');
    return parts.join(' / ');
  }

  // ===== エンチャント =====
  function reroll(slot) { if (slot && slot.roll) slot.roll = rollAt(slot.id, slot.roll.rarity); }
  function upgrade(slot) { if (slot) { const r = slot.roll ? slot.roll.rarity : 0; slot.roll = rollAt(slot.id, Math.min(3, r + 1)); } }
  function maxRarity(slot) { return slot && slot.roll ? slot.roll.rarity >= 3 : false; }
  function enchantCost(slot, kind) {
    const r = slot && slot.roll ? slot.roll.rarity : 0;
    if (kind === 'reroll') return { lumen: 2 + r, shadow_crystal: 1 + r };
    return { lumen: 4 + r * 3, shadow_crystal: 3 + r * 2, shadow_core: r >= 2 ? 1 : 0 }; // upgrade
  }

  // 深層・NG+ で良質化
  function lootBonus() {
    let b = 0;
    if (Game.World.inDepths()) b += 0.15;
    b += (Game.state.ngLevel || 0) * 0.08;
    const pl = Game.state.player;
    if (Game.Player.skillFlag && Game.Player.skillFlag('forager')) b += 0.12; // スキル: 採取の達人
    return b;
  }

  // モブの強さに応じた装備ベース
  function gearPoolFor(def) {
    // プロシージャル生成装備から、敵の強さに応じたティア帯を抽選
    const G = Game.GEN_BY_TIER;
    if (G) {
      const xp = def.xp || 1;
      const maxT = def.boss ? 5 : xp <= 2 ? 2 : xp <= 5 ? 3 : 4; // 最高ティア(星鋼/虚空)はボス限定
      const pool = [];
      for (let t = 1; t <= maxT; t++) if (G[t]) for (let i = 0; i < G[t].length; i++) pool.push(G[t][i]);
      if (pool.length) return pool;
    }
    if (def.boss) return ['shadow_blade', 'shadow_chest', 'shadow_helmet', 'iron_sword'];
    if ((def.xp || 1) <= 2) return ['wood_sword', 'leather_helmet', 'leather_chest'];
    return ['iron_sword', 'iron_chest', 'iron_helmet'];
  }

  // モブ撃破時の装備ドロップ（ground drop配列にpush）
  function rollMobDrop(def, x, y) {
    const chance = (def.boss ? 1.0 : 0.07) + lootBonus();
    const drops = [];
    const n = def.boss ? 2 : (Math.random() < chance ? 1 : 0);
    const pool = gearPoolFor(def);
    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      drops.push({ id: id, count: 1, roll: roll(id, lootBonus() + (def.boss ? 0.25 : 0)), x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16 });
    }
    return drops;
  }

  // 精鋭(elite)個体の確定ドロップ: 必ず高品質ギア1点(レアリティ加点)＋少量で書/宝珠
  function rollEliteDrop(def) {
    const drops = [];
    const pool = gearPoolFor(def);
    if (pool.length) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      drops.push({ id: id, count: 1, roll: roll(id, lootBonus() + 0.4) }); // +0.4でレア以上が出やすい
    }
    if (Math.random() < 0.18) drops.push({ id: 'xp_orb', count: 1 });
    if (Math.random() < 0.07) drops.push({ id: 'wisdom_tome', count: 1 });
    return drops;
  }

  return { roll, rollAt, stats, rarityColor, rarityName, displayName, statText, rollable, lootBonus, rollMobDrop, rollEliteDrop, reroll, upgrade, maxRarity, enchantCost, RARITY };
})();
