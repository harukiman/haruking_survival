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
    if (Game.Achievements && Game.state) {
      if (id === 'wood') Game.Achievements.unlock('first_wood');
      else if (id === 'lumen') Game.Achievements.unlock('lumen');
    }
    return n;
  }

  // rolled装備など個別インスタンスを空きスロットへ（スタックしない）。成功でtrue
  function addInstance(slot) {
    const s = slots();
    for (let i = 0; i < s.length; i++) {
      if (!s[i]) { s[i] = { id: slot.id, count: 1, roll: slot.roll || null }; return true; }
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
    if (def && def.food) {
      if (Game.state.player.hunger >= Game.state.player.maxHunger) {
        Game.UI.toast('お腹いっぱい'); return false;
      }
      Game.Survival.eat(def.food);
      remove(sl.id, 1);
      Game.Audio.play('eat');
      Game.UI.refreshAll();
      return true;
    }
    return false;
  }

  return { makeEmpty, slots, count, add, addInstance, remove, selectedSlot, selectedItemDef, setHotbar, useSelected };
})();
