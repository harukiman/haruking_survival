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
    // 収穫の満足感: 稀に「豊作」— クリティカル風の演出＋控えめな上乗せ(+1〜2)
    const TS = Game.CFG.TILE_SIZE, wx = tx * TS + TS / 2, wy = ty * TS + TS / 2;
    if (Math.random() < 0.15) {
      const bonus = Math.random() < 0.25 ? 2 : 1;
      Game.Inventory.add(c.harvest || 'wheat', bonus);
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(wx, wy - 12, '豊作！ +' + bonus, '#ffd86b', true);
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(wx, wy - 4, '#ffd86b', 12);
      Game.Audio.play('crit');
    } else if (Game.Render.spawnParticles) {
      Game.Render.spawnParticles(wx, wy - 4, '#8fd06a', 5);
    }
    Game.World.setObj(tx, ty, O.FARMLAND);
    Game.World.clearTileData(tx, ty);
    Game.Audio.play('pickup');
    Game.UI.refreshAll();
  }

  // 雨・雷雨・雪は畑を潤し、朝霧の露も成長を少し助ける(天候は save 対象なので永続)
  function wetBoost() {
    const w = Game.state.weather; if (!w) return 0;
    if (w.type === 'rain' || w.type === 'storm' || w.type === 'snow') return 12;
    if (w.type === 'fog' && Game.state.timeOfDay < 0.35) return 8; // 朝霧の露
    return 0;
  }

  // 段階が進んだ瞬間の見えるフィードバック(画面近傍のみ・SFXは1回の更新で1度だけ)
  function stageFeedback(key, grown, sfxDone) {
    const parts = key.split(','); const TS = Game.CFG.TILE_SIZE;
    const wx = parseInt(parts[0], 10) * TS + TS / 2, wy = parseInt(parts[1], 10) * TS + TS / 2;
    const p = Game.state.player;
    if (Math.abs(wx - p.x) > 420 || Math.abs(wy - p.y) > 320) return sfxDone;
    if (Game.Render) {
      Game.Render.spawnParticles(wx, wy - 4, grown ? '#ffd86b' : '#8fd06a', grown ? 7 : 3);
      if (grown && Game.Render.spawnFloat) Game.Render.spawnFloat(wx, wy - 10, '実り', '#ffd86b');
    }
    if (grown && !sfxDone) { Game.Audio.play('pickup'); return true; }
    return sfxDone;
  }

  // 成長更新（main から定期呼び出し）
  function scarecrowNear(tx, ty) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (Game.World.objAt(tx + dx, ty + dy) === Game.OBJ.SCARECROW) return true;
    }
    return false;
  }
  function update() {
    const daytime = Game.Lighting.ambientDarkness() < 0.3;
    const wet = wetBoost();
    let ripeSfx = false;
    Game.state.tileData.forEach(function (d, key) {
      if (d.crop && d.crop.stage < MAX_STAGE) {
        let boost = 0;
        // かかしが近く(半径3)にあると育ちが早まる
        const kp = key.split(','); const ktx = parseInt(kp[0], 10), kty = parseInt(kp[1], 10);
        if (scarecrowNear(ktx, kty)) boost = 22;
        d.crop.timer += (daytime ? 30 : 10) + wet + boost; // 昼の方が早い＋潤いボーナス＋かかし
        if (d.crop.timer >= Game.TUNE.CROP_GROW_TICKS) {
          d.crop.timer = 0; d.crop.stage++;
          ripeSfx = stageFeedback(key, d.crop.stage >= MAX_STAGE, ripeSfx);
        }
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
        // 実った作物はそよ風に揺れ、時折きらめく(収穫どきがひと目で分かる)
        const sway = grown ? Math.sin(Game.state.tick * 0.08 + tx * 1.7 + ty * 0.9) * 1.3 : 0;
        ctx.fillStyle = grown ? ((d && d.crop && d.crop.color) || '#d9b84a') : '#5aa83c';
        for (let k = 0; k < 4; k++) {
          const cx = s.x + 6 + k * 7;
          ctx.fillRect(cx + sway * ((k % 2) ? 1 : 0.6), s.y + TS - 4 - h, 2, h);
          if (grown) { ctx.fillRect(cx - 1 + sway, s.y + TS - 4 - h, 4, 3); }
        }
        if (grown && ((Game.state.tick + tx * 7 + ty * 13) % 100) < 8) {
          ctx.fillStyle = 'rgba(255,244,190,0.9)';
          ctx.fillRect(s.x + 6 + ((tx + ty) % 4) * 7, s.y + TS - 6 - h, 2, 2);
        }
      }
    }
  }

  return { till, plant, isGrown, harvest, update, drawCrops, MAX_STAGE };
})();
