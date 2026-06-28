// inventory.js — インベントリモデル（スタック/追加/削除/使用）
window.Game = window.Game || {};

Game.Inventory = (function () {
  function slots() { return Game.state.inventory; }

  function makeEmpty() {
    const arr = new Array(Game.INV_SIZE);
    for (let i = 0; i < arr.length; i++) arr[i] = null;
    return arr;
  }

  function count(id) {
    let n = 0;
    const s = slots();
    for (let i = 0; i < s.length; i++) if (s[i] && s[i].id === id) n += s[i].count;
    return n;
  }

  // 追加。入りきらなかった数を返す（0なら全部入った）
  function add(id, n) {
    const def = Game.ITEMS[id];
    if (!def) return n;
    const max = def.stack || 99;
    const s = slots();
    // 既存スタックに詰める
    for (let i = 0; i < s.length && n > 0; i++) {
      if (s[i] && s[i].id === id && s[i].count < max) {
        const room = max - s[i].count;
        const put = Math.min(room, n);
        s[i].count += put; n -= put;
      }
    }
    // 空きスロットへ
    for (let i = 0; i < s.length && n > 0; i++) {
      if (!s[i]) {
        const put = Math.min(max, n);
        s[i] = { id: id, count: put }; n -= put;
      }
    }
    checkItemAchievement(id);
    return n;
  }

  function checkItemAchievement(id) {
    if (!Game.Achievements || !Game.state) return;
    if (id === 'wood') Game.Achievements.unlock('first_wood');
    else if (id === 'lumen') Game.Achievements.unlock('lumen');
    if (Game.MAGIC_ITEMS && Game.MAGIC_ITEMS.indexOf(id) >= 0) Game.Achievements.unlock('magic_user');
    if (Game.LEGENDARY_ITEMS && Game.LEGENDARY_ITEMS.indexOf(id) >= 0) Game.Achievements.unlock('legendary');
    const d = Game.ITEMS[id]; if (d && d.tool === 'gun') Game.Achievements.unlock('gun_user');
  }

  // rolled装備など個別インスタンスを空きスロットへ（スタックしない）。成功でtrue
  function addInstance(slot) {
    const s = slots();
    for (let i = 0; i < s.length; i++) {
      if (!s[i]) { s[i] = { id: slot.id, count: 1, roll: slot.roll || null }; checkItemAchievement(slot.id); return true; }
    }
    return false;
  }

  // 数量を消費。成功でtrue
  function remove(id, n) {
    if (count(id) < n) return false;
    const s = slots();
    for (let i = 0; i < s.length && n > 0; i++) {
      if (s[i] && s[i].id === id) {
        const take = Math.min(s[i].count, n);
        s[i].count -= take; n -= take;
        if (s[i].count <= 0) s[i] = null;
      }
    }
    return true;
  }

  function selectedSlot() { return slots()[Game.state.player.hotbarIndex]; }
  function selectedItemDef() {
    const sl = selectedSlot();
    return sl ? Game.ITEMS[sl.id] : null;
  }

  function setHotbar(i) {
    if (!Game.state) return;
    Game.state.player.hotbarIndex = Game.Utils.clamp(i, 0, Game.HOTBAR_SIZE - 1);
    if (Game.UI) Game.UI.refreshHotbar();
  }

  // 選択中アイテムを「使う」（食べる）。設置/採掘は player 側で扱う
  function useSelected() {
    const sl = selectedSlot();
    if (!sl) return false;
    const def = Game.ITEMS[sl.id];
    const p = Game.state.player;
    // 知恵の書: スキルポイント+1
    if (def && def.skillTome) {
      p.skillPoints = (p.skillPoints || 0) + 1;
      remove(sl.id, 1); Game.Audio.play('levelup');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 18, 'スキルP +1', '#ffd86b', true);
      Game.UI.toast(def.name + ' を読んだ — スキルポイント +1');
      Game.UI.refreshAll(); return true;
    }
    // 経験の宝珠: 大量の経験値
    if (def && def.xpGain) {
      remove(sl.id, 1); Game.Player.gainXP(def.xpGain); Game.Audio.play('enchant');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 18, 'EXP +' + def.xpGain, '#7fd0ff', true);
      Game.UI.toast(def.name + ' を砕いた — 経験 +' + def.xpGain);
      Game.UI.refreshAll(); return true;
    }
    // 治療アイテム（包帯/解毒薬）
    if (def && def.buff) {
      Game.Status.apply(def.buff.type, def.buff.dur);
      if (Game.Achievements) Game.Achievements.unlock('potion_master');
      Game.Player.applyEquipStats();
      Game.Render.spawnParticles(p.x, p.y - 6, '#ffe9a0', 10);
      remove(sl.id, 1); Game.Audio.play('eat');
      Game.UI.toast(def.name + ' を飲んだ — ' + (Game.Status.TYPES[def.buff.type] ? Game.Status.TYPES[def.buff.type].name : '') + ' 効果');
      Game.UI.refreshAll(); return true;
    }
    if (def && def.cures && !def.food) {
      def.cures.forEach(function (c) { Game.Status.cure(c); });
      if (def.heal) p.health = Math.min(p.maxHealth, p.health + def.heal);
      Game.Render.spawnParticles(p.x, p.y, '#9fe0b0', 8);
      remove(sl.id, 1); Game.Audio.play('eat');
      Game.UI.toast(def.name + ' を使った');
      Game.UI.refreshAll(); return true;
    }
    if (def && def.food) {
      if (p.hunger >= p.maxHunger && !def.sick && !def.cures) { Game.UI.toast('お腹いっぱい'); return false; }
      Game.Survival.eat(def.food);
      if (def.cures) def.cures.forEach(function (c) { Game.Status.cure(c); }); // 料理が状態異常も治す（沼の煮込み等）
      if (def.sick) { // 腐肉
        if (Math.random() < 0.75) Game.Status.add('poison', 300);
        if (Math.random() < 0.4) Game.Status.add('infection', 360);
        Game.UI.toast('うっ…腐っていた');
      } else if (def.food >= 35) {
        Game.Status.apply('wellfed', 900); // 良い食料で満腹バフ
      }
      Game.Render.spawnParticles(p.x, p.y, def.sick ? '#6b7a3a' : '#ffd86b', 6);
      remove(sl.id, 1);
      Game.Audio.play('eat');
      Game.UI.refreshAll();
      return true;
    }
    return false;
  }

  // カテゴリ並び順（小さいほど先頭）
  function catOrder(def) {
    if (!def) return 99;
    if (def.attack != null || def.tool === 'sword') return 0; // 武器
    if (def.tool) return 1;                                   // ツール(銃/つるはし/斧/鍬/杖)
    if (def.armor != null) return 2;                          // 防具
    if (def.relic) return 3;                                  // 遺物
    if (def.food != null || def.cures || def.buff || def.skillTome || def.xpGain) return 4; // 消費/食料
    if (def.place != null) return 6;                          // 設置物
    return 5;                                                 // 素材/その他
  }

  // インベントリ整理: スタック統合＋カテゴリ→名前順。rolled装備は個別保持
  function autoSort() {
    const s = slots();
    const stackable = {}; const instances = [];
    for (let i = 0; i < s.length; i++) {
      const it = s[i]; if (!it) continue;
      if (it.roll) instances.push(it);
      else stackable[it.id] = (stackable[it.id] || 0) + it.count;
    }
    const list = [];
    for (const id in stackable) {
      const def = Game.ITEMS[id]; const max = (def && def.stack) || 99; let n = stackable[id];
      while (n > 0) { const c = Math.min(max, n); list.push({ id: id, count: c, roll: null }); n -= c; }
    }
    for (let i = 0; i < instances.length; i++) list.push(instances[i]);
    list.sort(function (a, b) {
      const da = Game.ITEMS[a.id], db = Game.ITEMS[b.id];
      const ca = catOrder(da), cb = catOrder(db); if (ca !== cb) return ca - cb;
      const na = (da && da.name) || a.id, nb = (db && db.name) || b.id; return na < nb ? -1 : na > nb ? 1 : 0;
    });
    for (let i = 0; i < s.length; i++) s[i] = i < list.length ? list[i] : null;
  }

  return { makeEmpty, slots, count, add, addInstance, remove, selectedSlot, selectedItemDef, setHotbar, useSelected, autoSort };
})();
