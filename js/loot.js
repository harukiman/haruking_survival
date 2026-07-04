// loot.js — ハクスラ戦利品（レアリティ＋ランダムaffix）
window.Game = window.Game || {};

Game.Loot = (function () {
  // レアリティ5段階(エピックとレジェンダリーの間に「神話」を追加)
  const RARITY = [
    { name: 'コモン', color: '#cfd6e0' },        // 0
    { name: 'レア', color: '#5a9fe0' },          // 1
    { name: 'エピック', color: '#b060e8' },      // 2
    { name: '神話', color: '#ff4d6d' },          // 3 (新設・エピック紫とレジェ橙の間の紅)
    { name: 'レジェンダリー', color: '#ff9a3c' },// 4
  ];
  // 武器の付与効果(約20種)。エピック以上でランダムに付与。値は控えめ(インフレ防止)
  const WEAPON_AFFIXES = [
    // 元素付与: 命中で状態異常を付与し、元素システム(熱衝撃/氷結/粉砕/相性)に接続する戦利品
    { key: 'flaming', name: '業火の', atk: [1, 2], dot: 'fire' },
    { key: 'freezing', name: '氷結の', atk: [1, 2], dot: 'frost' },
    { key: 'venomous', name: '猛毒の', atk: [1, 2], dot: 'venom' },
    { key: 'sharp', name: '鋭利な', atk: [1, 2] },
    { key: 'keen', name: '鋭敏な', atk: [1, 3] },
    { key: 'brutal', name: '残虐な', atk: [2, 4] },
    { key: 'cruel', name: '酷薄な', atk: [2, 3] },
    { key: 'heavy', name: '重厚な', atk: [2, 5] },
    { key: 'savage', name: '殺戮の', atk: [3, 5] },
    { key: 'warlord', name: '戦鬼の', atk: [3, 6] },
    { key: 'tyrant', name: '暴君の', atk: [4, 7] },
    { key: 'piercing', name: '貫きの', atk: [1, 4] },
    { key: 'ruthless', name: '無慈悲な', atk: [3, 5] },
    { key: 'vampiric', name: '吸血の', life: [0.05, 0.12] },
    { key: 'leech', name: '蛭の', life: [0.08, 0.16] },
    { key: 'bloodthirsty', name: '渇血の', life: [0.10, 0.20] },
    { key: 'critical', name: '会心の', crit: [0.03, 0.07] },
    { key: 'deadly', name: '致命の', crit: [0.05, 0.10] },
    { key: 'precise', name: '精密な', crit: [0.03, 0.06] },
    { key: 'executioner', name: '処刑人の', crit: [0.06, 0.12] },
    { key: 'frenzied', name: '狂乱の', crit: [0.04, 0.08] },
    { key: 'gory', name: '血濡れの', life: [0.06, 0.14] },
    { key: 'wicked', name: '邪悪な', atk: [2, 4] },
    // 耐久上限を伸ばすランダム効果(ユーザー: ランダム効果で耐久上限が変わる)
    { key: 'tempered', name: '鍛えの', atk: [1, 2], durMul: [1.35, 1.7] },
    { key: 'everlasting', name: '不朽の', durMul: [1.5, 2.0] },
  ];
  // 防具の付与効果(約20種)
  const ARMOR_AFFIXES = [
    { key: 'sturdy', name: '頑強な', arm: [1, 2] },
    { key: 'guardian', name: '守護の', arm: [2, 3] },
    { key: 'fortified', name: '鉄壁の', arm: [2, 4] },
    { key: 'bulwark', name: '城塞の', arm: [3, 5] },
    { key: 'resolute', name: '剛毅の', arm: [2, 3] },
    { key: 'vital', name: '生命の', hp: [6, 16] },
    { key: 'hardy', name: '屈強な', hp: [8, 18] },
    { key: 'titan', name: '剛健の', hp: [12, 24] },
    { key: 'stalwart', name: '堅忍の', hp: [10, 20] },
    { key: 'blessed', name: '祝福の', hp: [8, 16] },
    { key: 'warded', name: '護られし', sanity: true },
    { key: 'swift', name: '俊足の', moveSpd: [0.03, 0.06] },
    { key: 'fleet', name: '疾風の', moveSpd: [0.05, 0.08] },
    { key: 'lightfoot', name: '軽身の', moveSpd: [0.04, 0.07] },
    { key: 'enduring', name: '不屈の', staminaMax: [10, 20] },
    { key: 'tireless', name: '無尽の', staminaMax: [16, 30] },
    { key: 'bracing', name: '気力の', staminaMax: [12, 22] },
    { key: 'mending', name: '快癒の', regen: [1, 2] },
    { key: 'regenerating', name: '再生の', regen: [2, 3] },
    { key: 'scholar', name: '賢者の', xpBoost: [0.06, 0.14] },
    { key: 'thorned', name: '棘の', thorns: [0.10, 0.25] },
    { key: 'reinforced', name: '補強の', arm: [1, 2], durMul: [1.35, 1.7] },
    { key: 'immortal', name: '不滅の', durMul: [1.5, 2.0] },
    // 元素耐性(炎の敵/氷の敵・環境の炎上/凍えを軽減=元素システムの防御側)
    { key: 'fireward', name: '耐火の', burnResist: [0.35, 0.6] },
    { key: 'frostward', name: '耐氷の', coldResist: [0.35, 0.6] },
  ];

  function rr(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function isWeapon(d) { return d && d.attack != null; }
  function isArmor(d) { return d && d.armor != null && d.slot; }
  function rollable(id) { const d = Game.ITEMS[id]; return isWeapon(d) || isArmor(d); }

  function rollRarity(bonus) {
    const r = Math.random() - (bonus || 0);
    // バランス調整: コモン多め・高レアは稀に(インフレ防止)。5段階
    if (r > 0.46) return 0;   // コモン 約54%(affixなし)
    if (r > 0.18) return 1;   // レア 約28%(affix 1)
    if (r > 0.07) return 2;   // エピック 約11%(affix 1-2)
    if (r > 0.02) return 3;   // 神話 約5%(affix 2)
    return 4;                 // レジェンダリー 約2%(affix 2-3)
  }
  // レアリティ別の付与効果数(ユーザー指示: エピック以上最低1、レジェ以上最低2・最大3)
  function affixCount(rarity) {
    if (rarity <= 0) return 0;
    if (rarity === 1) return 1;      // レア
    if (rarity === 2) return rr(1, 2); // エピック: 最低1
    if (rarity === 3) return 2;      // 神話: 2
    return rr(2, 3);                 // レジェンダリー: 最低2・最大3
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
    const count = affixCount(rarity);
    for (let i = 0; i < count; i++) {
      let pick = null, tries = 0;
      while (tries++ < 12) { const a = pool[Math.floor(Math.random() * pool.length)]; if (keys.indexOf(a.key) < 0) { pick = a; break; } }
      if (!pick) break;
      keys.push(pick.key);
      const af = { key: pick.key, name: pick.name };
      if (pick.atk) af.atk = rr(pick.atk[0], pick.atk[1]);
      if (pick.arm) af.arm = rr(pick.arm[0], pick.arm[1]);
      if (pick.hp) af.hp = rr(pick.hp[0], pick.hp[1]);
      if (pick.life) af.life = Math.round((pick.life[0] + Math.random() * (pick.life[1] - pick.life[0])) * 100) / 100;
      if (pick.crit) af.crit = Math.round((pick.crit[0] + Math.random() * (pick.crit[1] - pick.crit[0])) * 100) / 100;
      if (pick.moveSpd) af.moveSpd = Math.round((pick.moveSpd[0] + Math.random() * (pick.moveSpd[1] - pick.moveSpd[0])) * 100) / 100;
      if (pick.staminaMax) af.staminaMax = rr(pick.staminaMax[0], pick.staminaMax[1]);
      if (pick.regen) af.regen = rr(pick.regen[0], pick.regen[1]);
      if (pick.xpBoost) af.xpBoost = Math.round((pick.xpBoost[0] + Math.random() * (pick.xpBoost[1] - pick.xpBoost[0])) * 100) / 100;
      if (pick.thorns) af.thorns = Math.round((pick.thorns[0] + Math.random() * (pick.thorns[1] - pick.thorns[0])) * 100) / 100;
      if (pick.sanity) af.sanity = true;
      if (pick.dot) af.dot = pick.dot; // 元素付与(業火/氷結/猛毒)を戦利品ロールに反映
      if (pick.durMul) af.durMul = Math.round((pick.durMul[0] + Math.random() * (pick.durMul[1] - pick.durMul[0])) * 100) / 100; // 耐久上限倍率
      if (pick.burnResist) af.burnResist = Math.round((pick.burnResist[0] + Math.random() * (pick.burnResist[1] - pick.burnResist[0])) * 100) / 100;
      if (pick.coldResist) af.coldResist = Math.round((pick.coldResist[0] + Math.random() * (pick.coldResist[1] - pick.coldResist[0])) * 100) / 100;
      affixes.push(af);
    }
    return { rarity: rarity, affixes: affixes };
  }

  // 実効ステータス
  function stats(slot) {
    const out = { atk: 0, armor: 0, hp: 0, lifesteal: 0, crit: 0, sanityResist: false, moveSpd: 0, staminaMax: 0, regen: 0, xpBoost: 0, thorns: 0, burnResist: 0, coldResist: 0 };
    if (!slot) return out;
    const def = Game.ITEMS[slot.id];
    if (!def) return out;
    out.atk = def.attack || 0;
    out.armor = def.armor || 0;
    const rl = slot.roll;
    if (rl) {
      if (def.attack) out.atk += Math.min(3, rl.rarity);           // レアリティ基礎攻撃(上限+3でインフレ防止)
      if (def.armor && rl.rarity >= 2) out.armor += (rl.rarity >= 4 ? 2 : 1); // エピック+1 / レジェ+2
      rl.affixes.forEach(function (a) {
        if (a.atk) out.atk += a.atk;
        if (a.arm) out.armor += a.arm;
        if (a.hp) out.hp += a.hp;
        if (a.life) out.lifesteal += a.life;
        if (a.crit) out.crit += a.crit;
        if (a.moveSpd) out.moveSpd += a.moveSpd;
        if (a.staminaMax) out.staminaMax += a.staminaMax;
        if (a.regen) out.regen += a.regen;
        if (a.xpBoost) out.xpBoost += a.xpBoost;
        if (a.thorns) out.thorns += a.thorns;
        if (a.sanity) out.sanityResist = true;
        if (a.burnResist) out.burnResist += a.burnResist;
        if (a.coldResist) out.coldResist += a.coldResist;
      });
    }
    // 破損: 耐久0の装備は性能が大幅低下(攻撃/防御 40%)。破壊はせず、修理で復活できる
    if (isBroken(slot)) { if (out.atk > 0) out.atk = Math.max(1, Math.round(out.atk * 0.4)); if (out.armor > 0) out.armor = Math.round(out.armor * 0.4); }
    return out;
  }
  // ===== 装備の耐久値 =====
  // 全装備(武器/防具)に耐久上限を設定。tier基礎 × レアリティ × ランダム耐久affix で変動。
  const DUR_BASE = { 0: 90, 1: 120, 2: 160, 3: 210, 4: 270, 5: 340 };
  function isEquip(id) { const d = Game.ITEMS[id]; return !!(d && (d.attack != null || d.tool === 'gun' || (d.armor != null && d.slot))); }
  function durMax(slot) {
    const def = Game.ITEMS[slot.id]; if (!def) return 0;
    let m = DUR_BASE[def.tier || 1] || 140;
    const rl = slot.roll;
    if (rl) { m *= (1 + 0.08 * rl.rarity); rl.affixes.forEach(function (a) { if (a.durMul) m *= a.durMul; }); }
    return Math.round(m);
  }
  // 装備スロットに dur/durMax を遅延初期化(既存セーブ・素材直クラフト品も初回アクセスで付与)
  function ensureDur(slot) {
    if (!slot || !isEquip(slot.id)) return slot;
    if (slot.durMax == null) slot.durMax = durMax(slot);
    if (slot.dur == null) slot.dur = slot.durMax;
    return slot;
  }
  function durFrac(slot) { if (!slot || slot.durMax == null || slot.durMax <= 0) return 1; return Math.max(0, slot.dur / slot.durMax); }
  function isBroken(slot) { return !!(slot && slot.durMax != null && slot.dur <= 0); }
  // 消耗: 武器は攻撃/防具は被弾で減少。0で「破損」(破壊はしない)。ちょうど壊れた瞬間 true を返す
  function degrade(slot, amount) {
    if (!slot || !isEquip(slot.id)) return false;
    ensureDur(slot);
    if (slot.dur <= 0) return false;
    slot.dur = Math.max(0, slot.dur - (amount || 1));
    return slot.dur <= 0;
  }
  // 修理: 耐久を回復(上限まで)。amount 省略で全回復
  function repair(slot, amount) { if (!slot || !isEquip(slot.id)) return; ensureDur(slot); slot.dur = amount == null ? slot.durMax : Math.min(slot.durMax, slot.dur + amount); }

  // 武器に付いた元素付与(業火/氷結/猛毒)の kind 一覧。命中時 applyDot に使う
  function dotKinds(slot) {
    if (!slot) return null;
    let ds = null;
    const def = Game.ITEMS[slot.id];
    if (def && def.hitDot) (ds || (ds = [])).push(def.hitDot); // 武器そのものの元素(業火/氷結の基礎装備・魔法武器)
    if (slot.roll && slot.roll.affixes) for (let i = 0; i < slot.roll.affixes.length; i++) { const a = slot.roll.affixes[i]; if (a.dot && (!ds || ds.indexOf(a.dot) < 0)) { (ds || (ds = [])).push(a.dot); } }
    return ds;
  }

  // rarityを配列範囲にクランプ(異常データでも描画例外を出さない)
  function rarityIdx(slot) { const r = (slot && slot.roll) ? slot.roll.rarity : 0; return Math.max(0, Math.min(RARITY.length - 1, r | 0)); }
  function rarityColor(slot) { return RARITY[rarityIdx(slot)].color; }
  function rarityName(slot) { return RARITY[rarityIdx(slot)].name; }
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
    if (s.crit) parts.push('会心 +' + Math.round(s.crit * 100) + '%');
    if (s.moveSpd) parts.push('移動 +' + Math.round(s.moveSpd * 100) + '%');
    if (s.staminaMax) parts.push('スタミナ +' + s.staminaMax);
    if (s.regen) parts.push('HP回復 +' + s.regen);
    if (s.xpBoost) parts.push('経験 +' + Math.round(s.xpBoost * 100) + '%');
    if (s.thorns) parts.push('棘 ' + Math.round(s.thorns * 100) + '%反射');
    if (s.burnResist) parts.push('🔥耐火 ' + Math.round(s.burnResist * 100) + '%');
    if (s.coldResist) parts.push('❄耐氷 ' + Math.round(s.coldResist * 100) + '%');
    if (s.sanityResist) parts.push('正気耐性');
    const ds = dotKinds(slot);
    if (ds) { const L = { fire: '🔥命中で炎上', frost: '❄命中で凍え', venom: '☠命中で毒' }; ds.forEach(function (d) { if (L[d]) parts.push(L[d]); }); }
    return parts.join(' / ');
  }

  // ===== エンチャント =====
  // エンチャントで affix(耐久affix含む)が変わるため耐久上限を再計算。現耐久は新上限に比例スケール
  function refreshDurAfterRoll(slot) { if (slot && slot.durMax != null) { const f = durFrac(slot); slot.durMax = durMax(slot); slot.dur = Math.round(slot.durMax * f); } }
  function reroll(slot) { if (slot && slot.roll) { slot.roll = rollAt(slot.id, slot.roll.rarity); refreshDurAfterRoll(slot); } }
  function upgrade(slot) { if (slot) { const r = slot.roll ? slot.roll.rarity : 0; slot.roll = rollAt(slot.id, Math.min(4, r + 1)); refreshDurAfterRoll(slot); } }
  function maxRarity(slot) { return slot && slot.roll ? slot.roll.rarity >= 4 : false; }
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
  function rollMobDrop(def, x, y, luck) {
    luck = luck || 0; // 深夜の高ぶり等でギアドロップ率＋レアリティを底上げ
    // 装備ドロップは絞る(ユーザー: 敵からの装備ドロップが多すぎ)。非ボスは 7%→3%
    const chance = (def.boss ? 1.0 : def.midboss ? 0.35 : 0.03) + lootBonus() * 0.6 + luck;
    const drops = [];
    const n = def.boss ? 2 : (Math.random() < chance ? 1 : 0);
    const pool = gearPoolFor(def);
    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      drops.push({ id: id, count: 1, roll: roll(id, lootBonus() + luck + (def.boss ? 0.25 : 0)), x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16 });
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

  return { roll, rollAt, stats, dotKinds, durMax, ensureDur, durFrac, isBroken, isEquip, degrade, repair, rarityColor, rarityName, displayName, statText, rollable, lootBonus, rollMobDrop, rollEliteDrop, reroll, upgrade, maxRarity, enchantCost, RARITY };
})();
