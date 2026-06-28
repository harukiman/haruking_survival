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
      xp: 0, level: 1, xpNext: 22, invSlots: 36,
      baseMaxHealth: 100,
      stamina: 100, maxStamina: 100,
      vehicle: null, // null|'car'|'boat'|'plane'
      armor: { head: null, chest: null }, // {id, roll} インスタンス
      accessory: null, // 遺物(relic) {id}
      // RPGステータス（スキルポイントで振る）
      str: 0, vit: 0, dex: 0, skillPoints: 0, skills: {},
    };
  }

  function spawnAt(tx, ty) {
    const p = Game.state.player;
    p.x = tx * TS + TS / 2; p.y = ty * TS + TS / 2;
    p.prevX = p.x; p.prevY = p.y;
  }

  function blocked(wx, wy) {
    const v = Game.state.player.vehicle;
    if (v === 'plane' || v === 'carpet') return false; // 飛行機・絨毯は全障害を越える
    const pts = [[wx - R, wy - R], [wx + R, wy - R], [wx - R, wy + R], [wx + R, wy + R]];
    for (let i = 0; i < pts.length; i++) {
      const tx = Math.floor(pts[i][0] / TS), ty = Math.floor(pts[i][1] / TS);
      if (Game.World.isWalkable(tx, ty)) continue;
      // ボートは水上を進める
      if (v === 'boat') { const g = Game.World.groundAt(tx, ty); if (g === Game.TILE.WATER || g === Game.TILE.DEEP_WATER) continue; }
      return true;
    }
    return false;
  }

  function update(intent) {
    const p = Game.state.player;
    p.prevX = p.x; p.prevY = p.y;

    let dx = intent.dx, dy = intent.dy;
    const len = Math.hypot(dx, dy);
    // ダッシュ（スタミナ消費）
    const moving = len > 0;
    const dashing = intent.dash && moving && p.stamina > 0;
    if (dashing) { p.stamina = Math.max(0, p.stamina - 1.1); }
    else if (p.stamina < p.maxStamina) { p.stamina = Math.min(p.maxStamina, p.stamina + (moving ? 0.3 : 0.7)); }
    let spd = p.speed * (dashing ? 1.85 : 1);
    if (p.vehicle === 'car') spd = p.speed * 2.3;
    else if (p.vehicle === 'plane') spd = p.speed * 2.7;
    else if (p.vehicle === 'carpet') spd = p.speed * 2.4;
    else if (p.vehicle === 'boat') spd = p.speed * 1.5;
    // 浅瀬は減速＋水音（乗り物なし・徒歩のみ）
    const gUnder = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
    const onWater = !p.vehicle && gUnder === Game.TILE.WATER;
    if (onWater) spd *= 0.5;
    // 毒の沼地: 足が重く、稀に毒を受ける（徒歩のみ）
    if (!p.vehicle && gUnder === Game.TILE.SWAMP) {
      spd *= 0.72;
      if (Game.Status && Game.state.tick % 30 === 0 && Math.random() < 0.06) Game.Status.add('poison', 120);
    }
    // 砂嵐/吹雪は足が重い（飛行中は影響なし）
    const wt = Game.state.weather && Game.state.weather.type;
    if ((wt === 'sandstorm' || wt === 'blizzard') && p.vehicle !== 'plane' && p.vehicle !== 'carpet') spd *= 0.7;
    if (!p.vehicle) spd *= (1 + skillBonus().moveSpd + (Game.Status ? Game.Status.buffSum().spd : 0)); // スキル健脚＋俊足の薬
    if (moving) {
      dx /= len; dy /= len;
      p.dir = intent.dir || p.dir;
      const ox = p.x, oy = p.y;
      const nx = p.x + dx * spd;
      if (!blocked(nx, p.y)) p.x = nx;
      const ny = p.y + dy * spd;
      if (!blocked(p.x, ny)) p.y = ny;
      // スタック対策: 動こうとしているのに両軸とも進めない状態が続いたら歩ける場所へ救出
      if (Math.abs(p.x - ox) < 0.01 && Math.abs(p.y - oy) < 0.01 && !p.vehicle) {
        p.stuckT = (p.stuckT || 0) + 1;
        if (p.stuckT > 18 && Game.World.rescueStuck) { Game.World.rescueStuck(); p.stuckT = 0; }
      } else p.stuckT = 0;
      if (dashing && Game.state.tick % 4 === 0) Game.Render.spawnParticles(p.x, p.y, '#cfe0ff', 1);
      if (onWater && Game.state.tick % 16 === 0) { Game.Audio.play('splash'); Game.Render.spawnParticles(p.x, p.y + 8, '#a8d0f0', 3); }
      if (p.vehicle && Game.state.tick % 24 === 0) Game.Audio.play('engine');
    } else p.stuckT = 0;

    if (p.invuln > 0) p.invuln--;
    if (p.attackCd > 0) p.attackCd--;

    // 左クリック/採掘ボタン: 銃→発射、なければ攻撃→採掘
    if (intent.mine) {
      const sel = Game.Inventory.selectedItemDef();
      if (sel && sel.tool === 'gun') { tryFire(sel); mining.active = false; }
      else if (sel && sel.tool === 'staff') { tryStaff(sel); mining.active = false; }
      else if (sel && sel.tool === 'warp') { tryWarp(); mining.active = false; }
      else if (sel && sel.throw) { tryThrow(sel); mining.active = false; }
      else if (Game.Combat.tryAttack()) { mining.active = false; mining.progress = 0; }
      else mineTick();
    } else { mining.active = false; if (mining.progress > 0) mining.progress -= 0.5; }

    // 右クリック/設置ボタン: 対話/設置/使用
    if (intent.place) interact();
    // 開く/使うボタン: 近隣のチェスト等を開く（無ければ通常操作）
    if (intent.use) useNearby();

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

    // 設置物(OBJ番号100以上=プレイヤー設置/建材)は、近くに敵がいる間は採掘しない（戦闘中の誤破壊防止）
    if (obj >= 100) {
      const mobs = Game.state.mobs, px = Game.state.player.x, py = Game.state.player.y;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def && m.def.hostile && Math.hypot(m.x - px, m.y - py) < 2.6 * TS) { mining.active = false; mining.progress = 0; return; } }
    }

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
    const speed = (matched ? (1 + sel.tier) : 0.6) + skillBonus().mining;
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
    Game.Net.broadcastEdit(tx, ty, Game.OBJ.NONE, Game.state.worldName);
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
  // 「開く/使う」ボタン用: 近隣の対話可能オブジェクト(チェスト等)を探して開く。無ければ通常interact
  function useNearby() {
    const npc = Game.Mobs.nearbyNPC(2.2 * TS);
    if (npc) { Game.Mobs.interactNPC(npc); return; }
    const O = Game.OBJ, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const off = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < off.length; i++) {
      const tx = ptx + off[i][0], ty = pty + off[i][1], o = Game.World.objAt(tx, ty);
      if (o === O.CHEST) { Game.UI.openChest(tx, ty); return; }
      if (o === O.TREASURE_CHEST) { const d = Game.World.getTileData(tx, ty); if (!d || !d.chest) Game.World.setTileData(tx, ty, { chest: makeTreasureLoot() }); Game.UI.openChest(tx, ty); return; }
      if (o === O.RIFT_ANCHOR) { Game.UI.openSharedChest(tx, ty); return; }
      if (o === O.BOUNTY_BOARD) { Game.Bounty.open(tx, ty); return; }
      if (o === O.STELA) { Game.Lore.read(tx, ty); return; }
      if (o === O.SHADOW_ALTAR) { Game.Mobs.summonBoss(tx, ty); return; }
      if (o === O.ENCHANT_TABLE) { Game.UI.openEnchant(); return; }
      if (o === O.BED) { sleep(); return; }
    }
    interact(); // 近隣に対話対象が無ければ通常操作（手持ち使用/設置など）
  }

  function interact() {
    // 友好NPC（謎の旅人）が近ければ対話優先
    const npc = Game.Mobs.nearbyNPC(2.2 * TS);
    if (npc) { Game.Mobs.interactNPC(npc); return; }
    const t = targetTile();
    const hasTile = !!(t && t.inReach);
    const obj = hasTile ? Game.World.objAt(t.tx, t.ty) : Game.OBJ.NONE;

    // --- タイル対象の操作（狙っている時のみ・優先）---
    if (hasTile) {
      if (obj === Game.OBJ.CHEST) { Game.UI.openChest(t.tx, t.ty); return; }
      if (obj === Game.OBJ.TREASURE_CHEST) {
        let d = Game.World.getTileData(t.tx, t.ty);
        if (!d || !d.chest) { Game.World.setTileData(t.tx, t.ty, { chest: makeTreasureLoot() }); }
        Game.UI.openChest(t.tx, t.ty); return;
      }
      if (obj === Game.OBJ.RIFT_ANCHOR) { Game.UI.openSharedChest(t.tx, t.ty); return; }
      if (obj === Game.OBJ.STELA) { Game.Lore.read(t.tx, t.ty); return; }
      if (obj === Game.OBJ.BOUNTY_BOARD) { Game.Bounty.open(t.tx, t.ty); return; }
      if (obj === Game.OBJ.SHADOW_ALTAR) { Game.Mobs.summonBoss(t.tx, t.ty); return; }
      if (obj === Game.OBJ.ENCHANT_TABLE) { Game.UI.openEnchant(); return; }
      if (obj === Game.OBJ.ROCKET) { Game.Rocket.board(); return; }
      if (obj === Game.OBJ.BED) { sleep(); return; }
      if (obj === Game.OBJ.WHEAT && Game.Farming.isGrown(t.tx, t.ty)) { Game.Farming.harvest(t.tx, t.ty); return; }
    }

    const sel = Game.Inventory.selectedSlot();
    const def = sel ? Game.ITEMS[sel.id] : null;
    if (!def) return;

    // --- 手持ちアイテムの使用（タイル不要・モバイルでも確実に使える）---
    if (def.ending) { Game.Quests.reunify(); return; }
    if (def.vehicle) {
      const p = Game.state.player;
      if (p.vehicle === def.vehicle) { p.vehicle = null; Game.UI.toast(def.name + ' から降りた'); }
      else { p.vehicle = def.vehicle; Game.UI.toast(def.name + ' に乗った'); }
      Game.Audio.play('engine'); return;
    }
    if (def.shift) { Game.World.shift(); return; }
    if (def.respec) { const n = respec(); Game.Inventory.remove(sel.id, 1); Game.UI.toast('記憶の書を読んだ — スキルを振り直した（' + n + 'P返却）'); Game.UI.refreshAll(); return; }
    if (def.food || def.cures || def.buff || def.skillTome || def.xpGain || def.invExpand) { Game.Inventory.useSelected(); return; }
    if (def.armor) { equipSelectedArmor(); return; }
    if (def.relic) { equipRelic(); return; }

    // --- 以降はタイルが必要（耕作/植える/設置）---
    if (!hasTile) return;
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
    Game.Net.broadcastEdit(t.tx, t.ty, def.place, Game.state.worldName);
    Game.Inventory.remove(sel.id, 1);
    Game.Audio.play('place');
    Game.UI.refreshAll();
  }

  function makeTreasureLoot() {
    const arr = new Array(27).fill(null);
    const space = Game.state.worldName === 'space';
    const pool = space
      ? [['star_metal', 2, 6], ['star_core', 1, 2], ['lumen', 3, 8], ['shadow_steel', 2, 5]]
      : [['lumen', 2, 5], ['shadow_steel', 1, 3], ['shadow_crystal', 2, 5], ['gold_ore', 2, 6], ['shadow_core', 1, 2], ['iron', 2, 5]];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const it = pool[Math.floor(Math.random() * pool.length)];
      arr[i] = { id: it[0], count: it[1] + Math.floor(Math.random() * (it[2] - it[1] + 1)) };
    }
    // 宝箱には rolled装備を1つ（やや良質）
    const gearPool = space
      ? ['cosmic_blade', 'star_cannon', 'gravity_boots', 'shadow_chest']
      : ['iron_sword', 'iron_chest', 'iron_helmet', 'shadow_blade', 'shadow_helmet'];
    const gid = gearPool[Math.floor(Math.random() * gearPool.length)];
    arr[n] = { id: gid, count: 1, roll: Game.Loot.roll(gid, 0.3 + Game.Loot.lootBonus()) };
    // 金塊＋低確率で遺物
    arr[n + 1] = { id: 'gold_bar', count: 1 + Math.floor(Math.random() * 3) };
    if (Game.RELIC_IDS && Math.random() < 0.12) arr[n + 2] = { id: Game.RELIC_IDS[Math.floor(Math.random() * Game.RELIC_IDS.length)], count: 1 };
    if (Math.random() < 0.08) arr[n + 3] = { id: 'expand_pouch', count: 1 }; // 稀に拡張のポーチ
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

  function tryFire(sel) {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    if (Game.Inventory.count(sel.ammo) < 1) { if (Game.state.tick % 30 === 0) Game.UI.toast('弾切れ'); return; }
    Game.Inventory.remove(sel.ammo, 1);
    const kind = sel.bkind || 'bullet';
    const pellets = sel.pellets || 1;
    const dmg = effAttack(sel.fireDmg || 6); // 銃もLv/STR補正
    for (let i = 0; i < pellets; i++) {
      const spr = pellets > 1 ? (Math.random() - 0.5) * (sel.spread || 0.5) : (sel.spread || 0);
      Game.Projectiles.fire(dmg, kind, { spread: spr, explosive: sel.explosive || 0, speed: sel.bspeed });
    }
    p.attackCd = sel.cd || 12;
    Game.Render.spawnParticles(p.x, p.y, '#ffe9a0', 2);
    Game.Audio.play(sel.gunsfx || 'gun');
    Game.UI.refreshHotbar();
  }

  function tryStaff(sel) {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    Game.Projectiles.fire(sel.fireDmg || 12, sel.magic || 'fire');
    p.attackCd = 16;
    Game.Render.spawnParticles(p.x, p.y, sel.magic === 'frost' ? '#9fd8ff' : '#ff7a3c', 4);
    Game.Audio.play('gun');
  }
  function tryThrow(sel) {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    const slot = Game.Inventory.selectedSlot(); if (!slot) return; // 投擲アイテムのID取得
    const t = sel.throw;
    Game.Projectiles.fire(t.dmg, t.kind, { explosive: t.explosive, speed: t.speed });
    Game.Inventory.remove(slot.id, 1);
    p.attackCd = 26; Game.Audio.play('gun_rocket'); Game.UI.refreshHotbar();
  }
  function tryWarp() {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    let dx = 0, dy = 0; const it = Game.Input.intent;
    if (it.usePointer && it.mouseTile) { dx = (it.mouseTile.tx * TS + TS / 2) - p.x; dy = (it.mouseTile.ty * TS + TS / 2) - p.y; }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1; else if (p.dir === 'left') dx = -1; else dx = 1; }
    const len = Math.hypot(dx, dy) || 1; const dist = 6 * TS;
    let tx = p.x + dx / len * dist, ty = p.y + dy / len * dist;
    // 着地点が塞がっていたら手前に詰める
    for (let s = 6; s >= 1; s--) {
      const cx = p.x + dx / len * s * TS, cy = p.y + dy / len * s * TS;
      if (!blocked(cx, cy)) { tx = cx; ty = cy; break; }
    }
    Game.Render.spawnParticles(p.x, p.y, '#b06ad0', 10);
    p.x = tx; p.y = ty; p.prevX = tx; p.prevY = ty;
    Game.Render.spawnParticles(tx, ty, '#d8b0ff', 10);
    p.attackCd = 24; Game.Audio.play('shift');
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

  // 遺物(relic)アクセサリーを装備（スロット1つ・入替式）
  function equipRelic(idx) {
    const p = Game.state.player;
    if (idx == null) idx = p.hotbarIndex;
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.relic) return;
    const prev = p.accessory;
    p.accessory = { id: slot.id };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1 } : null;
    applyEquipStats();
    Game.Audio.play('relic_get');
    Game.UI.toast(def.name + ' を装備（遺物）');
    Game.UI.refreshAll();
  }

  function totalArmor() {
    const a = Game.state.player.armor;
    let s = 0;
    for (const k in a) if (a[k]) s += Game.Loot.stats(a[k]).armor;
    return s + setBonus().armor + levelArmorBonus() + skillBonus().armor + (Game.Status ? Game.Status.buffSum().armor : 0);
  }

  // 装備セット効果（head+chestが同セット）
  function setBonus() {
    const a = Game.state.player.armor;
    const out = { armor: 0, sanityResist: false, hungerSlow: 0, name: null };
    const hid = a.head && a.head.id, cid = a.chest && a.chest.id;
    if (!hid || !cid) return out;
    for (const k in Game.SETS) {
      const s = Game.SETS[k];
      if (s.items.indexOf(hid) >= 0 && s.items.indexOf(cid) >= 0) {
        if (s.armor) out.armor += s.armor;
        if (s.sanityResist) out.sanityResist = true;
        if (s.hungerSlow) out.hungerSlow = Math.max(out.hungerSlow, s.hungerSlow);
        out.name = s.name;
      }
    }
    return out;
  }

  // 撃破したユニークボス種数（恒久報酬/称号の基礎）
  function bossesDefeated() {
    const best = (Game.state && Game.state.bestiary) || {}; let n = 0;
    for (const k in best) { const d = Game.MOBS[k]; if (d && d.boss && !d.npc && best[k] > 0) n++; }
    return n;
  }
  function bossTitle() {
    const n = bossesDefeated();
    if (n >= 9) return '二相の覇者';
    if (n >= 6) return '魔物狩りの達人';
    if (n >= 3) return '歴戦の討伐者';
    if (n >= 1) return 'ボスハンター';
    return '旅人';
  }

  // 装備由来の最大HP等を反映（VIT＋レベル＋ボス討伐の恒久報酬も加味）
  function applyEquipStats() {
    const p = Game.state.player;
    let hpBonus = 0;
    for (const k in p.armor) if (p.armor[k]) hpBonus += Game.Loot.stats(p.armor[k]).hp;
    const base = p.baseMaxHealth || 100;
    const sb = skillBonus();
    p.maxHealth = base + hpBonus + (p.vit || 0) * 5 + sb.hp + bossesDefeated() * 5; // ボス討伐ごとに最大HP+5
    p.maxStamina = 100 + sb.staminaMax;
    if (p.health > p.maxHealth) p.health = p.maxHealth;
    if (p.stamina > p.maxStamina) p.stamina = p.maxStamina;
  }

  // ===== RPG: レベル/ステ/スキルツリーによる補正 =====
  function skillBonus() {
    const p = Game.state.player;
    const sk = p.skills || {};
    const o = { atk: 0, armor: 0, hp: 0, lifesteal: 0, moveSpd: 0, crit: 0, mining: 0, hungerSlow: 0, regen: 0, staminaMax: 0, xpBoost: 0 };
    for (const id in sk) {
      if (!sk[id]) continue; const n = Game.SKILL_BY_ID[id]; if (!n) continue;
      for (const k in n.eff) { if (k === 'flag') continue; o[k] = (o[k] || 0) + n.eff[k]; }
    }
    // 遺物(relic)アクセサリーの効果を合流
    const acc = p.accessory;
    if (acc) { const d = Game.ITEMS[acc.id || acc]; if (d && d.relic) for (const k in d.relic) o[k] = (o[k] || 0) + d.relic[k]; }
    return o;
  }
  function skillFlag(f) {
    const sk = Game.state.player.skills || {};
    for (const id in sk) { if (sk[id] && Game.SKILL_BY_ID[id] && Game.SKILL_BY_ID[id].eff.flag === f) return true; }
    return false;
  }
  function levelDmgBonus() { const p = Game.state.player; return (p.str || 0) + Math.floor((p.level - 1) * 0.5); }
  function levelArmorBonus() { const p = Game.state.player; return Math.floor(p.level / 4); }
  function attackCooldown() { const p = Game.state.player; return Math.max(7, Math.round(Game.TUNE.ATTACK_COOLDOWN * (1 - (p.dex || 0) * 0.02))); }
  function effAttack(baseAtk) { return Math.max(1, baseAtk + levelDmgBonus() + skillBonus().atk + (Game.Status ? Game.Status.buffSum().atk : 0)); }
  // 装備比較用: 現在手持ち武器の実効攻撃 / 指定スロットの装備防御
  function currentWeaponAtk() {
    const sl = Game.Inventory.slots()[Game.state.player.hotbarIndex];
    const d = sl && Game.ITEMS[sl.id];
    return (d && d.attack != null) ? effAttack(Game.Loot.stats(sl).atk) : effAttack(1);
  }
  function equippedArmorAt(slot) { const a = Game.state.player.armor[slot]; return a ? Game.Loot.stats(a).armor : 0; }

  function spendStat(stat) {
    const p = Game.state.player;
    if (p.skillPoints <= 0) return false;
    if (stat !== 'str' && stat !== 'vit' && stat !== 'dex') return false;
    p[stat] = (p[stat] || 0) + 1; p.skillPoints--;
    applyEquipStats(); Game.UI.refreshStats && Game.UI.refreshStats();
    Game.Audio.play('levelup'); return true;
  }
  // ツリー: 前提を満たし、ポイント足りれば習得
  function canUnlock(id) {
    const p = Game.state.player, n = Game.SKILL_BY_ID[id];
    if (!n || p.skills[id]) return false;
    if (p.skillPoints < n.cost) return false;
    for (let i = 0; i < n.req.length; i++) if (!p.skills[n.req[i]]) return false;
    return true;
  }
  function unlockSkill(id) {
    const p = Game.state.player, n = Game.SKILL_BY_ID[id];
    if (!n || !canUnlock(id)) return false;
    p.skills[id] = 1; p.skillPoints -= n.cost;
    applyEquipStats(); if (p.health > p.maxHealth) p.health = p.maxHealth;
    Game.UI.refreshStats && Game.UI.refreshStats(); Game.Audio.play('enchant'); return true;
  }
  function respec() {
    const p = Game.state.player;
    let refunded = (p.str || 0) + (p.vit || 0) + (p.dex || 0);
    for (const id in p.skills) { if (p.skills[id] && Game.SKILL_BY_ID[id]) refunded += Game.SKILL_BY_ID[id].cost; }
    p.str = 0; p.vit = 0; p.dex = 0; p.skills = {}; p.skillPoints += refunded;
    applyEquipStats(); if (p.health > p.maxHealth) p.health = p.maxHealth;
    Game.UI.refreshStats && Game.UI.refreshStats();
    return refunded;
  }

  function sleep() {
    const p = Game.state.player;
    // リスポーン地点をこのベッドに更新（死亡時はここへ戻る）
    const pt = playerTile();
    Game.state.spawn = { tx: pt.tx, ty: pt.ty };
    if (Game.Lighting.ambientDarkness() < 0.3) {
      Game.UI.toast('リスポーン地点をここに設定した（昼は眠れない）');
      Game.Audio.play('select'); Game.UI.refreshAll(); return;
    }
    const cur = Game.state.tick % Game.DAY_LENGTH;
    const morning = Math.floor(0.30 * Game.DAY_LENGTH);
    Game.state.tick += ((morning - cur) + Game.DAY_LENGTH) % Game.DAY_LENGTH;
    p.health = Math.min(p.maxHealth, p.health + 20);
    Game.Audio.play('craft');
    Game.UI.toast('おやすみ… 朝になった（リスポーン地点をここに設定）');
    Game.UI.refreshAll();
  }

  // レベル必要EXP曲線（序盤は緩やか・高レベルで急増。旧 5+level*3 より大幅に厳しく）
  function xpForLevel(lv) { return Math.round(12 + lv * 9 + lv * lv * 1.7); }

  function gainXP(n) {
    const p = Game.state.player;
    if (p.level >= (Game.MAX_LEVEL || 9999)) { p.xp = 0; return; }
    p.xp += Math.max(1, Math.round(n * (1 + skillBonus().xpBoost)));
    while (p.xp >= p.xpNext && p.level < (Game.MAX_LEVEL || 9999)) {
      p.xp -= p.xpNext; p.level++; p.xpNext = xpForLevel(p.level);
      p.baseMaxHealth = (p.baseMaxHealth || 100) + 2;
      p.skillPoints = (p.skillPoints || 0) + 2; // レベルごとにスキルポイント
      applyEquipStats();
      p.health = p.maxHealth;
      Game.Audio.play('levelup');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 20, 'LEVEL UP!', '#6fd0ff', true);
      Game.UI.toast('レベルアップ！ Lv.' + p.level + '（スキルP +2）');
      if (Game.Achievements) { if (p.level >= 5) Game.Achievements.unlock('level5'); if (p.level >= 20) Game.Achievements.unlock('level20'); if (p.level >= 50) Game.Achievements.unlock('level50'); }
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
    interact, useNearby, gainXP, totalArmor, setBonus, sleep, equipSelectedArmor, equipFromInventory, equipRelic, applyEquipStats, bossesDefeated, bossTitle,
    effAttack, attackCooldown, levelDmgBonus, levelArmorBonus, spendStat, unlockSkill, respec,
    skillBonus, skillFlag, canUnlock, currentWeaponAtk, equippedArmorAt,
  };
})();
