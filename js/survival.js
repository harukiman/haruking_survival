// survival.js — HP/空腹・回復/餓死・ダメージ・死亡/リスポーン
window.Game = window.Game || {};

Game.Survival = (function () {
  function update() {
    const p = Game.state.player;

    // 低HP警告音（鼓動・設定 lowHpWarn 尊重・play内で1.1sスロットル）
    if (p.health > 0 && p.health < p.maxHealth * 0.22 && Game.state.tick % 15 === 0 &&
        !(Game.Settings && Game.Settings.get('lowHpWarn') === false)) {
      Game.Audio.play('lowhp');
    }

    // 空腹減少（移動/採掘でやや速く）
    p.hungerTimer++;
    const moving = Game.Input.intent.dx !== 0 || Game.Input.intent.dy !== 0 || Game.Player.mining.active;
    let drainEvery = moving ? 110 : 170;
    const hs = Math.min(0.8, Game.Player.setBonus().hungerSlow + Game.Player.skillBonus().hungerSlow);
    if (hs) drainEvery = Math.round(drainEvery / (1 - hs)); // 革セットで空腹緩やか
    if (p.hungerTimer >= drainEvery) {
      p.hungerTimer = 0;
      if (p.hunger > 0) { p.hunger--; Game.UI.refreshStats(); }
    }

    // 回復 or 餓死
    p.regenTimer++;
    if (p.regenTimer >= 60) {
      p.regenTimer = 0;
      const wf = Game.Status && Game.Status.has('wellfed');
      const totem = nearHealTotem();
      const regenSkill = Game.Player.skillBonus().regen + (Game.Status ? Game.Status.buffSum().regen : 0);
      if (regenSkill > 0 && p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + regenSkill); // スキル不屈＋再生の薬
      if (totem && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + 3); // 癒しの祭壇
        Game.Render.spawnParticles(p.x, p.y - 6, '#7fd0a0', 1);
        Game.UI.refreshStats();
      } else if ((p.hunger > 70 || (wf && p.hunger > 40) || (p.stamina >= 70 && p.hunger > 0)) && p.health < p.maxHealth) {
        // 満腹 or スタミナが十分(=休息)なら HP 徐々に回復
        p.health = Math.min(p.maxHealth, p.health + (wf ? 2 : 1));
        Game.UI.refreshStats();
      } else if (p.hunger <= 0 && p.health > 0) {
        damage(1, 'starve');
      }
    }

    // 正気度（影世界で減少・光の護符/光源で緩和、光世界で回復）
    const T = Game.TUNE;
    if (Game.state.worldName === 'shadow') {
      let drain = T.SANITY_DRAIN * (1 + (Game.state.ngLevel || 0) * T.NG_SANITY_PER);
      if (Game.World.inDepths()) drain *= 2;     // 深層は正気消費2倍
      let immune = false;
      let sanityResist = false;
      for (const k in p.armor) {
        const a = p.armor[k]; if (!a) continue;
        const def = Game.ITEMS[a.id || a];
        if (!def) continue;
        if (def.immuneSanity) immune = true;
        else if (def.lumen) drain *= 0.4;
        if (a.roll && Game.Loot && Game.Loot.stats(a).sanityResist) sanityResist = true;
      }
      if (Game.Player.setBonus().sanityResist) sanityResist = true; // 影鋼セット
      if (Game.Player.skillFlag('sanityResist')) sanityResist = true; // スキル: 精神統一
      if (sanityResist) drain *= 0.5;
      if (immune) drain = 0;
      if (nearLight()) drain *= 0.3;
      // 深層突入のフィードバック
      const deep = Game.World.inDepths();
      if (deep !== Game.state.wasDeep) {
        if (deep) Game.UI.toast('影の深層へ踏み込んだ… 危険だが、闇は深いほど豊かだ');
        Game.state.wasDeep = deep;
        Game.UI.refreshWorld();
      }
      Game.state.sanity = Math.max(0, Game.state.sanity - drain);
      if (Game.state.sanity < 10 && Game.Achievements) Game.Achievements.unlock('deep_sanity');
      const diff = Game.DIFFICULTIES[Game.state.difficulty] || Game.DIFFICULTIES.normal;
      if (diff.sanityKill && Game.state.sanity <= 0 && p.health > 0 && Game.state.tick % 50 === 0) damage(2, 'sanity');
    } else if (Game.state.sanity < T.SANITY_MAX) {
      Game.state.sanity = Math.min(T.SANITY_MAX, Game.state.sanity + 0.06);
    }
    // 状態異常・腐敗
    Game.Status.update();
    if (Game.state.tick % 600 === 0) spoilFood();
    if (Game.state.tick % 15 === 0) Game.UI.refreshStats();
  }

  // 生肉などが時間で腐る（グロ）
  function spoilFood() {
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) {
      const sl = s[i]; if (!sl) continue;
      const def = Game.ITEMS[sl.id];
      if (def && def.spoils && Math.random() < Game.TUNE.SPOIL_CHANCE) {
        sl.count--; if (sl.count <= 0) s[i] = null;
        Game.Inventory.add('rotten_meat', 1);
      }
    }
  }

  function nearHealTotem() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (Game.World.objAt(ptx + dx, pty + dy) === Game.OBJ.HEALING_TOTEM) return true;
    }
    return false;
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
    const physical = source !== 'starve' && source !== 'sanity' && source !== 'status';
    if (p.invuln > 0 && physical) return;
    // 防具で軽減（飢餓・正気崩壊は無視）
    if (physical) {
      const armor = Game.Player.totalArmor();
      amount = Math.max(1, amount - armor);
    }
    p.health -= amount;
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 16, '-' + amount, '#ff6a6a');
    if (physical) { p.invuln = 30; Game.Audio.play('hurt'); if (Game.Render.hurtFlash) Game.Render.hurtFlash(); if (Game.Render.shake && amount >= 6) Game.Render.shake(Math.min(9, 3 + amount * 0.4)); }
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
        Game.state.drops.push({ id: s[i].id, count: s[i].count, roll: s[i].roll || null, x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30 });
        s[i] = null;
      }
    }
    if (Game.Status) Game.Status.clearAll();
    // レベルは完全リセットせず 1/3 を失う（経験値ペナルティ）
    const lost = Math.floor(p.level / 3);
    if (lost > 0) {
      p.level = Math.max(1, p.level - lost);
      p.baseMaxHealth = 100 + (p.level - 1) * 2;
      p.xp = 0; p.xpNext = 5 + p.level * 3;
      Game.Player.applyEquipStats();
      Game.UI.toast('力尽きた… レベルが ' + lost + ' 失われた（Lv.' + p.level + '）');
    }
    p.health = p.maxHealth; p.hunger = Math.max(40, p.hunger);
    p.invuln = 60;
    Game.Player.spawnAt(Game.state.spawn.tx, Game.state.spawn.ty);
    Game.UI.refreshAll();
  }

  return { update, eat, damage, die, nearLight };
})();
