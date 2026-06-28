// player.js — 状態・移動・衝突・採掘/設置・対話・戦闘・装備・成長
window.Game = window.Game || {};

Game.Player = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const R = 11; // 当たり判定半径(px)

  const mining = { active: false, tx: 0, ty: 0, obj: 0, progress: 0 };

  function makeDefault() {
    return {
      x: 0, y: 0, prevX: 0, prevY: 0,
      dir: 'down', speed: 2.4,
      health: 100, maxHealth: 100,
      hunger: 100, maxHunger: 100,
      hungerTimer: 0, regenTimer: 0,
      invuln: 0, hotbarIndex: 0,
      attackCd: 0,
      xp: 0, level: 1, xpNext: 5,
      baseMaxHealth: 100,
      armor: { head: null, chest: null }, // {id, roll} インスタンス
    };
  }

  function spawnAt(tx, ty) {
    const p = Game.state.player;
    p.x = tx * TS + TS / 2; p.y = ty * TS + TS / 2;
    p.prevX = p.x; p.prevY = p.y;
  }

  function blocked(wx, wy) {
    const pts = [[wx - R, wy - R], [wx + R, wy - R], [wx - R, wy + R], [wx + R, wy + R]];
    for (let i = 0; i < pts.length; i++) {
      const tx = Math.floor(pts[i][0] / TS), ty = Math.floor(pts[i][1] / TS);
      if (!Game.World.isWalkable(tx, ty)) return true;
    }
    return false;
  }

  function update(intent) {
    const p = Game.state.player;
    p.prevX = p.x; p.prevY = p.y;

    let dx = intent.dx, dy = intent.dy;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      p.dir = intent.dir || p.dir;
      const nx = p.x + dx * p.speed;
      if (!blocked(nx, p.y)) p.x = nx;
      const ny = p.y + dy * p.speed;
      if (!blocked(p.x, ny)) p.y = ny;
    }

    if (p.invuln > 0) p.invuln--;
    if (p.attackCd > 0) p.attackCd--;

    // 左クリック/採掘ボタン: 攻撃優先、なければ採掘
    if (intent.mine) {
      if (Game.Combat.tryAttack()) { mining.active = false; mining.progress = 0; }
      else mineTick();
    } else { mining.active = false; if (mining.progress > 0) mining.progress -= 0.5; }

    // 右クリック/設置ボタン: 対話/設置/使用
    if (intent.place) interact();

    // とげダメージ（サボテン等）
    checkHazard();

    updateDrops();
  }

  function playerTile() {
    const p = Game.state.player;
    return { tx: Math.floor(p.x / TS), ty: Math.floor(p.y / TS) };
  }

  function candidateTile() {
    const i = Game.Input.intent;
    if (i.usePointer && i.mouseTile) return { tx: i.mouseTile.tx, ty: i.mouseTile.ty };
    const pt = playerTile();
    const d = Game.state.player.dir;
    let ox = 0, oy = 0;
    if (d === 'up') oy = -1; else if (d === 'down') oy = 1;
    else if (d === 'left') ox = -1; else if (d === 'right') ox = 1; else oy = 1;
    return { tx: pt.tx + ox, ty: pt.ty + oy };
  }

  function targetTile() {
    const c = candidateTile();
    if (!c) return null;
    const pt = playerTile();
    const dist = Math.max(Math.abs(c.tx - pt.tx), Math.abs(c.ty - pt.ty));
    const inReach = dist <= Game.CFG.REACH;
    const obj = Game.World.objAt(c.tx, c.ty);
    const meta = Game.OBJ_META[obj];
    const selDef = Game.Inventory.selectedItemDef();
    const mineable = obj !== Game.OBJ.NONE && meta && meta.mineable;
    const placeableEmpty = selDef && selDef.place !== undefined && obj === Game.OBJ.NONE;
    return { tx: c.tx, ty: c.ty, obj: obj, inReach: inReach, valid: inReach && (mineable || placeableEmpty) };
  }

  function toolTierFor(toolType) {
    const sel = Game.Inventory.selectedItemDef();
    if (sel && sel.tool === toolType) return sel.tier;
    return 0;
  }

  function mineTick() {
    const t = targetTile();
    if (!t || !t.inReach) { mining.active = false; return; }
    const obj = t.obj;
    const meta = Game.OBJ_META[obj];
    // 封印壁は破壊不可（二相連動で解く）。ヒント提示
    if (obj === Game.OBJ.SEAL_WALL) {
      mining.active = false;
      if (Game.state.tick % 40 === 0) Game.UI.toast('固い封印だ… 影の世界の同じ場所に「共鳴核」があるはず');
      return;
    }
    if (obj === Game.OBJ.NONE || !meta || !meta.mineable) { mining.active = false; return; }

    // 幻影鉱脈は正気度が低いときだけ掘れる
    if (meta.phantom && Game.state.sanity >= 40) { mining.active = false; return; }
    const tierUsed = toolTierFor(meta.tool);
    if (tierUsed < meta.tier) {
      mining.active = false; mining.progress = 0;
      if (Game.state.tick % 30 === 0) Game.UI.toast('もっと良い道具が必要');
      return;
    }
    if (mining.tx !== t.tx || mining.ty !== t.ty || mining.obj !== obj) {
      mining.progress = 0; mining.tx = t.tx; mining.ty = t.ty; mining.obj = obj;
    }
    mining.active = true;
    const sel = Game.Inventory.selectedItemDef();
    const matched = sel && sel.tool === meta.tool;
    const speed = matched ? (1 + sel.tier) : 0.6;
    mining.progress += speed;
    if (Game.state.tick % 6 === 0) Game.Audio.play('mine');
    if (mining.progress >= meta.hp) { breakBlock(t.tx, t.ty, obj, meta); mining.active = false; mining.progress = 0; }
  }

  function breakBlock(tx, ty, obj, meta) {
    // チェスト/宝箱の中身を放出
    if (obj === Game.OBJ.CHEST || obj === Game.OBJ.TREASURE_CHEST) {
      const d = Game.World.getTileData(tx, ty);
      if (d && d.chest) d.chest.forEach(function (sl) {
        if (sl) Game.state.drops.push({ id: sl.id, count: sl.count, x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
      });
    }
    if (meta.dualPlaced) Game.World.setObjBothWorlds(tx, ty, Game.OBJ.NONE);
    else Game.World.setObj(tx, ty, Game.OBJ.NONE);
    const wx = tx * TS + TS / 2, wy = ty * TS + TS / 2;
    if (meta.drops) {
      for (let i = 0; i < meta.drops.length; i++) {
        const d = meta.drops[i];
        const n = Game.Utils.randInt(Math.random, d.n[0], d.n[1]);
        for (let k = 0; k < n; k++) {
          Game.state.drops.push({ id: d.item, count: 1, x: wx + (Math.random() - 0.5) * 14, y: wy + (Math.random() - 0.5) * 14 });
        }
      }
    }
    const col = (Game.ITEMS[meta.drops && meta.drops[0] && meta.drops[0].item] || {}).color || '#999';
    Game.Render.spawnParticles(wx, wy, col, 8);
    if (meta.phantom && Game.Achievements) Game.Achievements.unlock('madness_sight');
    if (meta.resonator) Game.World.resonate(tx, ty);  // 共鳴核破壊→封印解除
    Game.Audio.play('break');
  }

  // 対話/設置/使用
  function interact() {
    const t = targetTile();
    if (!t || !t.inReach) return;
    const obj = Game.World.objAt(t.tx, t.ty);

    if (obj === Game.OBJ.CHEST) { Game.UI.openChest(t.tx, t.ty); return; }
    if (obj === Game.OBJ.TREASURE_CHEST) {
      let d = Game.World.getTileData(t.tx, t.ty);
      if (!d || !d.chest) { Game.World.setTileData(t.tx, t.ty, { chest: makeTreasureLoot() }); }
      Game.UI.openChest(t.tx, t.ty); return;
    }
    if (obj === Game.OBJ.RIFT_ANCHOR) { Game.UI.openSharedChest(t.tx, t.ty); return; }
    if (obj === Game.OBJ.STELA) { Game.Lore.read(t.tx, t.ty); return; }
    if (obj === Game.OBJ.SHADOW_ALTAR) { Game.Mobs.summonBoss(t.tx, t.ty); return; }
    if (obj === Game.OBJ.BED) { sleep(); return; }
    if (obj === Game.OBJ.WHEAT && Game.Farming.isGrown(t.tx, t.ty)) { Game.Farming.harvest(t.tx, t.ty); return; }

    const sel = Game.Inventory.selectedSlot();
    const def = sel ? Game.ITEMS[sel.id] : null;
    if (!def) return;

    if (def.ending) { Game.Quests.reunify(); return; }
    if (def.shift) { Game.World.shift(); return; }
    if (def.food) { Game.Inventory.useSelected(); return; }
    if (def.armor) { equipSelectedArmor(); return; }
    if (def.tool === 'hoe' && obj === Game.OBJ.NONE) {
      const g = Game.World.groundAt(t.tx, t.ty);
      if (g === Game.TILE.GRASS || g === Game.TILE.DIRT || g === Game.TILE.FOREST) { Game.Farming.till(t.tx, t.ty); return; }
    }
    if (def.plant !== undefined && obj === Game.OBJ.FARMLAND) {
      Game.Farming.plant(t.tx, t.ty); Game.Inventory.remove(sel.id, 1); Game.UI.refreshAll(); return;
    }
    if (def.place !== undefined) placeObject(t, def, sel);
  }

  function placeObject(t, def, sel) {
    if (t.obj !== Game.OBJ.NONE) return;
    const pt = playerTile();
    const targetMeta = Game.OBJ_META[def.place];
    if (targetMeta && targetMeta.solid && t.tx === pt.tx && t.ty === pt.ty) return;
    const g = Game.World.groundAt(t.tx, t.ty);
    // 橋は水上に架けられる。それ以外は深い水に設置不可
    const targetMetaB = Game.OBJ_META[def.place];
    if (g === Game.TILE.DEEP_WATER && !(targetMetaB && targetMetaB.bridge)) return;
    // 両世界リンク設置物（裂け目の楔）
    if (targetMeta && targetMeta.dualPlaced) Game.World.setObjBothWorlds(t.tx, t.ty, def.place);
    else Game.World.setObj(t.tx, t.ty, def.place);
    if (def.place === Game.OBJ.CHEST) Game.World.setTileData(t.tx, t.ty, { chest: new Array(27).fill(null) });
    if (def.place === Game.OBJ.SAPLING) Game.World.setTileData(t.tx, t.ty, { sapling: { timer: 0 } });
    Game.Inventory.remove(sel.id, 1);
    Game.Audio.play('place');
    Game.UI.refreshAll();
  }

  function makeTreasureLoot() {
    const arr = new Array(27).fill(null);
    const pool = [['lumen', 2, 5], ['shadow_steel', 1, 3], ['shadow_crystal', 2, 5], ['gold_ore', 2, 6], ['shadow_core', 1, 2], ['iron', 2, 5]];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const it = pool[Math.floor(Math.random() * pool.length)];
      arr[i] = { id: it[0], count: it[1] + Math.floor(Math.random() * (it[2] - it[1] + 1)) };
    }
    // 宝箱には rolled装備を1つ（やや良質）
    const gearPool = ['iron_sword', 'iron_chest', 'iron_helmet', 'shadow_blade', 'shadow_helmet'];
    const gid = gearPool[Math.floor(Math.random() * gearPool.length)];
    arr[n] = { id: gid, count: 1, roll: Game.Loot.roll(gid, 0.3 + Game.Loot.lootBonus()) };
    return arr;
  }

  // 選択中(ホットバー)の防具を装備。前装備はインベントリへ戻す
  function equipSelectedArmor() {
    const p = Game.state.player;
    const idx = p.hotbarIndex;
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.armor || !def.slot) return;
    const prev = p.armor[def.slot];
    p.armor[def.slot] = { id: slot.id, roll: slot.roll || null };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1, roll: prev.roll || null } : null;
    applyEquipStats();
    Game.Audio.play('equip');
    Game.UI.toast(Game.Loot.displayName(p.armor[def.slot]) + ' を装備');
    Game.UI.refreshAll();
  }

  function equipFromInventory(idx) {
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.armor || !def.slot) return;
    const p = Game.state.player;
    const prev = p.armor[def.slot];
    p.armor[def.slot] = { id: slot.id, roll: slot.roll || null };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1, roll: prev.roll || null } : null;
    applyEquipStats();
    Game.Audio.play('equip');
    Game.UI.toast(Game.Loot.displayName(p.armor[def.slot]) + ' を装備');
    Game.UI.refreshAll();
  }

  function totalArmor() {
    const a = Game.state.player.armor;
    let s = 0;
    for (const k in a) if (a[k]) s += Game.Loot.stats(a[k]).armor;
    return s;
  }

  // 装備由来の最大HP等を反映
  function applyEquipStats() {
    const p = Game.state.player;
    let hpBonus = 0;
    for (const k in p.armor) if (p.armor[k]) hpBonus += Game.Loot.stats(p.armor[k]).hp;
    const base = p.baseMaxHealth || 100;
    p.maxHealth = base + hpBonus;
    if (p.health > p.maxHealth) p.health = p.maxHealth;
  }

  function sleep() {
    if (Game.Lighting.ambientDarkness() < 0.3) { Game.UI.toast('夜だけ眠れる'); return; }
    const p = Game.state.player;
    const cur = Game.state.tick % Game.DAY_LENGTH;
    const morning = Math.floor(0.30 * Game.DAY_LENGTH);
    Game.state.tick += ((morning - cur) + Game.DAY_LENGTH) % Game.DAY_LENGTH;
    p.health = Math.min(p.maxHealth, p.health + 20);
    Game.Audio.play('craft');
    Game.UI.toast('おやすみ… 朝になった');
    Game.UI.refreshAll();
  }

  function gainXP(n) {
    const p = Game.state.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++; p.xpNext = 5 + p.level * 3;
      p.baseMaxHealth = (p.baseMaxHealth || 100) + 2;
      applyEquipStats();
      p.health = p.maxHealth;
      Game.Audio.play('levelup');
      Game.UI.toast('レベルアップ！ Lv.' + p.level);
      if (Game.Achievements && p.level >= 5) Game.Achievements.unlock('level5');
    }
    Game.UI.refreshStats();
  }

  function checkHazard() {
    const p = Game.state.player;
    if (p.invuln > 0) return;
    const pt = playerTile();
    const o = Game.World.objAt(pt.tx, pt.ty);
    const meta = Game.OBJ_META[o];
    if (meta && meta.touchDamage) Game.Survival.damage(meta.touchDamage, 'hazard');
  }

  function updateDrops() {
    const p = Game.state.player;
    const drops = Game.state.drops;
    const PR = Game.CFG.PICKUP_RADIUS;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const dx = p.x - d.x, dy = p.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < PR * 2.2) { d.x += dx * 0.18; d.y += dy * 0.18; }
      if (dist < 16) {
        if (d.roll) {
          if (Game.Inventory.addInstance(d)) {
            drops.splice(i, 1); Game.Audio.play('pickup'); Game.UI.refreshHotbar();
            Game.UI.toast('入手: ' + Game.Loot.displayName(d) + '（' + Game.Loot.rarityName(d) + '）');
          }
        } else {
          const overflow = Game.Inventory.add(d.id, d.count);
          if (overflow === 0) { drops.splice(i, 1); Game.Audio.play('pickup'); Game.UI.refreshHotbar(); }
          else d.count = overflow;
        }
      }
    }
  }

  return {
    makeDefault, spawnAt, update, targetTile, mining, playerTile, breakBlock,
    interact, gainXP, totalArmor, sleep, equipSelectedArmor, equipFromInventory, applyEquipStats,
  };
})();
