// farming.js — 開墾・植付け・成長・収穫
window.Game = window.Game || {};

Game.Farming = (function () {
  const O = Game.OBJ;
  const MAX_STAGE = 3;

  function till(tx, ty) {
    Game.World.setObj(tx, ty, O.FARMLAND);
    Game.Audio.play('place');
  }

  function plant(tx, ty) {
    // 選択中の種から作物種別を決定（無ければ小麦）
    const sl = Game.Inventory.selectedSlot(); const def = sl && Game.ITEMS[sl.id];
    const c = (def && def.crop) || { harvest: 'wheat', seeds: 'wheat_seeds', color: '#d9b84a' };
    Game.World.setObj(tx, ty, O.WHEAT);
    Game.World.setTileData(tx, ty, { crop: { stage: 0, timer: 0, harvest: c.harvest, seeds: c.seeds || (sl && sl.id) || 'wheat_seeds', color: c.color || '#d9b84a' } });
    Game.Audio.play('place');
  }

  function isGrown(tx, ty) {
    const d = Game.World.getTileData(tx, ty);
    return d && d.crop && d.crop.stage >= MAX_STAGE;
  }

  function harvest(tx, ty) {
    const d = Game.World.getTileData(tx, ty); const c = (d && d.crop) || { harvest: 'wheat', seeds: 'wheat_seeds' };
    Game.Inventory.add(c.harvest || 'wheat', Game.Utils.randInt(Math.random, 1, 3));
    Game.Inventory.add(c.seeds || 'wheat_seeds', Game.Utils.randInt(Math.random, 1, 2));
    Game.World.setObj(tx, ty, O.FARMLAND);
    Game.World.clearTileData(tx, ty);
    Game.Audio.play('pickup');
    Game.UI.refreshAll();
  }

  // 成長更新（main から定期呼び出し）
  function update() {
    const daytime = Game.Lighting.ambientDarkness() < 0.3;
    Game.state.tileData.forEach(function (d, key) {
      if (d.crop && d.crop.stage < MAX_STAGE) {
        d.crop.timer += daytime ? 30 : 10; // 昼の方が早い
        if (d.crop.timer >= Game.TUNE.CROP_GROW_TICKS) { d.crop.timer = 0; d.crop.stage++; }
      } else if (d.sapling) {
        d.sapling.timer += 30;
        if (d.sapling.timer >= Game.TUNE.CROP_GROW_TICKS * 3) {
          const parts = key.split(',');
          const tx = parseInt(parts[0], 10), ty = parseInt(parts[1], 10);
          Game.World.setObj(tx, ty, O.TREE);
          Game.World.clearTileData(tx, ty);
        }
      }
    });
  }

  // 作物の段階描画（render から呼ぶ）
  function drawCrops(ctx) {
    const TS = Game.CFG.TILE_SIZE;
    const range = Game.Camera.visibleTileRange();
    for (let ty = range.ty0; ty <= range.ty1; ty++) {
      for (let tx = range.tx0; tx <= range.tx1; tx++) {
        if (Game.World.objAt(tx, ty) !== O.WHEAT) continue;
        const d = Game.World.getTileData(tx, ty);
        const stage = d && d.crop ? d.crop.stage : 0;
        const s = Game.Camera.worldToScreen(tx * TS, ty * TS);
        const h = 4 + stage * 7;
        const grown = stage >= MAX_STAGE;
        ctx.fillStyle = grown ? ((d && d.crop && d.crop.color) || '#d9b84a') : '#5aa83c';
        for (let k = 0; k < 4; k++) {
          const cx = s.x + 6 + k * 7;
          ctx.fillRect(cx, s.y + TS - 4 - h, 2, h);
          if (grown) { ctx.fillRect(cx - 1, s.y + TS - 4 - h, 4, 3); }
        }
      }
    }
  }

  return { till, plant, isGrown, harvest, update, drawCrops, MAX_STAGE };
})();
