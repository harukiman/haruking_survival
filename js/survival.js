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
    // 空腹の危機警告(20を下回ったら一度・回復で再武装)。餓死前に気づける
    if (p.hunger <= 20 && !p._hungerWarned) { p._hungerWarned = true; Game.UI.toast('🍖 お腹が空いた… 何か食べないと餓死する！'); if (Game.Audio) Game.Audio.play('lowhp'); }
    else if (p.hunger > 35 && p._hungerWarned) { p._hungerWarned = false; }

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
    if (p.invuln > 0 && physical) {
      // ジャスト回避: ロール無敵中に攻撃を受け流したら報酬(1ロール1回)
      if ((p.rolling || 0) > 0 && !p.rollRewarded) {
        p.rollRewarded = true;
        p.stamina = Math.min(p.maxStamina, p.stamina + 10); // スタミナ還元
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 24, 'JUST!', '#7fe0ff', true);
        if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#bfe8ff', 10);
        Game.Audio.play('crit');
      }
      return;
    }
    // 防具で軽減（飢餓・正気崩壊は無視）
    if (physical) {
      const armor = Game.Player.totalArmor();
      amount = Math.max(1, amount - armor);
    }
    p.health -= amount;
    p.deathCause = source; // 死因追跡（直近のダメージ源）
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 16, '-' + amount, '#ff6a6a');
    if (physical) { p.invuln = 30; Game.Audio.play('hurt'); if (Game.Render.hurtFlash) Game.Render.hurtFlash(); if (Game.Render.shake && amount >= 6) Game.Render.shake(Math.min(9, 3 + amount * 0.4)); }
    if (p.health <= 0) { p.health = 0; die(); }
    Game.UI.refreshStats();
  }

  const CAUSE_LABEL = { starve: '餓死', sanity: '正気の崩壊', status: '状態異常', thorns: '棘の反射', mob: '魔物の襲撃' };
  // 死亡時にバーツを守る手段(守銭の護符)を所持/装備しているか
  function hasBtsGuard() {
    const p = Game.state.player;
    const ID = Game.ITEMS;
    if (p.accessory && ID[p.accessory.id] && ID[p.accessory.id].keepBts) return true;
    if (p.accessory2 && ID[p.accessory2.id] && ID[p.accessory2.id].keepBts) return true;
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) { if (s[i] && ID[s[i].id] && ID[s[i].id].keepBts) return true; }
    return false;
  }

  function die() {
    const p = Game.state.player;
    if (Game.state.deathPending) return; // 二重発火防止
    Game.state.deathPending = true;
    if (Game.Save) Game.Save.autosave('force'); // 死亡時セーブ(進行を保全。autosave内でゲスト判定)
    // 死亡サマリーを表示してから復活（マルチ参加中は簡略に即復活）
    if (Game.UI && Game.UI.showDeath && !(Game.Net && Game.Net.isConnected())) {
      const best = Game.state.bestiary || {};
      let kills = 0; for (const k in best) kills += best[k];
      const survTicks = Game.state.tick - (p.lifeStart || 0);
      const dl = Game.DAY_LENGTH || 3600;
      const summary = {
        cause: CAUSE_LABEL[p.deathCause] || p.deathCause || '不明',
        level: p.level,
        days: Math.max(0, Math.floor(survTicks / dl)),
        mins: Math.max(0, Math.floor(survTicks / 30 / 60)),
        bosses: Game.Player.bossesDefeated ? Game.Player.bossesDefeated() : 0,
        kills: kills,
        gold: Game.Inventory.count('gold_bar'),
      };
      Game.state.paused = true;
      Game.Audio.play('hurt');
      Game.UI.showDeath(summary);
      return;
    }
    respawn();
  }

  function respawn() {
    Game.state.deathPending = false;
    Game.state.paused = false;
    const p = Game.state.player;
    p.lifeStart = Game.state.tick;
    const btsGuarded = hasBtsGuard(); // ドロップ前に判定(護符が落ちても今回の死は守られる)
    Game.UI.toast('力尽きた…リスポーンします');
    // 所持品の一部をその場にドロップ（守銭の護符など keepBts 品は落とさない）
    const TS = Game.CFG.TILE_SIZE;
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) {
      if (s[i] && !(Game.ITEMS[s[i].id] && Game.ITEMS[s[i].id].keepBts) && Math.random() < 0.5) {
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
      p.xp = 0; p.xpNext = Game.Player.xpForLevel(p.level);
      Game.Player.applyEquipStats();
      Game.UI.toast('力尽きた… レベルが ' + lost + ' 失われた（Lv.' + p.level + '）');
    }
    // バーツ(通貨): 死亡で半分を失う。守銭の護符を持っていれば失わない
    if ((p.bts || 0) > 0) {
      if (btsGuarded) {
        Game.UI.toast('守銭の護符が輝いた — バーツ ' + p.bts + ' bts は失われない');
      } else {
        const before = p.bts; p.bts = Math.floor(p.bts / 2);
        Game.UI.toast('バーツを落とした… ' + before + ' → ' + p.bts + ' bts');
      }
    }
    p.health = p.maxHealth; p.hunger = Math.max(40, p.hunger);
    p.invuln = 60;
    Game.Player.spawnAt(Game.state.spawn.tx, Game.state.spawn.ty);
    Game.UI.refreshAll();
    // はじめて斃れ再び立ち上がったとき、記憶回廊「名もなき者」を解放
    if (Game.Story && !Game.Story.seen('traveler')) Game.Story.unlock('traveler', true);
  }

  return { update, eat, damage, die, respawn, nearLight };
})();
