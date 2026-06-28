// crafting.js — レシピ照合・クラフト実行（station近接判定含む）
window.Game = window.Game || {};

Game.Crafting = (function () {
  const Inv = Game.Inventory;

  // プレイヤー近くに指定stationのオブジェクトがあるか
  function hasStation(stationName) {
    if (!stationName) return true; // 手作り
    const objId = stationName === 'crafting_table' ? Game.OBJ.CRAFTING_TABLE
      : stationName === 'furnace' ? Game.OBJ.FURNACE : null;
    if (objId === null) return false;
    const p = Game.state.player;
    const TS = Game.CFG.TILE_SIZE;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const R = 4;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        if (Game.World.objAt(ptx + dx, pty + dy) === objId) return true;
    return false;
  }

  function canCraft(recipe) {
    if (!hasStation(recipe.station)) return false;
    for (const id in recipe.in) {
      if (Inv.count(id) < recipe.in[id]) return false;
    }
    return true;
  }

  function craft(recipe) {
    if (!canCraft(recipe)) {
      Game.UI.toast(recipe.station && !hasStation(recipe.station)
        ? (recipe.station === 'furnace' ? 'かまどが近くに必要' : '作業台が近くに必要')
        : '材料が足りない');
      return false;
    }
    for (const id in recipe.in) Inv.remove(id, recipe.in[id]);
    Inv.add(recipe.out.id, recipe.out.n);
    Game.Audio.play('craft');
    Game.UI.toast(Game.ITEMS[recipe.out.id].name + ' を作成');
    Game.UI.refreshAll();
    return true;
  }

  // 現在クラフト可能なレシピ一覧（UI表示用）
  function availableList() {
    return Game.RECIPES.map(function (r) {
      return { recipe: r, can: canCraft(r) };
    });
  }

  return { hasStation, canCraft, craft, availableList };
})();
