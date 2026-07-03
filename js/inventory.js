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
    // 影晶をはじめて手にしたとき、記憶回廊「傷の結晶」を解放
    if (id === 'shadow_crystal' && Game.Story && !Game.Story.seen('shadowcrystal')) Game.Story.unlock('shadowcrystal', true);
    if (id === 'lumen' && Game.Story && !Game.Story.seen('lumen')) Game.Story.unlock('lumen', true);
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
    if (Game.RELIC_IDS && Game.RELIC_IDS.indexOf(id) >= 0) Game.Achievements.unlock('relic_hoarder');
    if (Game.ENDGAME_ITEMS && Game.ENDGAME_ITEMS.indexOf(id) >= 0) Game.Achievements.unlock('endgame_smith');
  }

  // そのアイテムを少しでも追加できる余地があるか（満杯判定用）
  // roll(装備等)は空きスロット必須。通常品は空きスロット or 同IDの未満スタックがあれば可
  function hasRoomFor(id, isInstance) {
    const s = slots();
    for (let i = 0; i < s.length; i++) if (!s[i]) return true; // 空きがあれば常に可
    if (isInstance) return false; // 装備は空き必須
    const def = Game.ITEMS[id]; const max = (def && def.stack) || 99;
    for (let i = 0; i < s.length; i++) if (s[i] && s[i].id === id && s[i].count < max) return true; // 同IDの空き
    return false;
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
    const prev = Game.state.player.hotbarIndex;
    Game.state.player.hotbarIndex = Game.Utils.clamp(i, 0, Game.HOTBAR_SIZE - 1);
    if (Game.state.player.hotbarIndex !== prev) { if (Game.Audio) Game.Audio.play('cursor'); if (Game.UI && Game.UI.flashHotbarItem) Game.UI.flashHotbarItem(); } // 切替: カーソル音＋アイテム説明
    if (Game.UI) Game.UI.refreshHotbar();
  }

  // インベントリ上限を拡張（最大100）。増えた数を返す（0=これ以上不可）
  const MAX_SLOTS = 100;
  function expand(n) {
    const s = slots(); const add = Math.min(n, MAX_SLOTS - s.length);
    for (let i = 0; i < add; i++) s.push(null);
    if (add > 0) Game.state.player.invSlots = s.length;
    if (s.length >= MAX_SLOTS && Game.Achievements) Game.Achievements.unlock('pack_rat');
    return add;
  }

  // 選択中アイテムを「使う」（食べる）。設置/採掘は player 側で扱う
  // 食材の食感を推定して効果音の種類を返す（apple=しゃりしゃり 等）
  function foodSoundKind(def, id) {
    const nm = (def && def.name) || '';
    if (/茶|スープ|ジュース|蜜/.test(nm)) return 'drink';
    if (def && (def.cookTo || /肉|meat|魚|fish/.test(id + nm))) return 'meat';
    if (/シチュー|煮込み|パイ|パン|サラダ|かぼちゃ/.test(nm)) return 'soft';
    if (/りんご|木の実|にんじん|トマト|サボテン|キノコ|草|berry|apple|carrot/.test(id + nm)) return 'crunch';
    return 'soft';
  }
  function useSelected() {
    const sl = selectedSlot();
    if (!sl) return false;
    const def = Game.ITEMS[sl.id];
    const p = Game.state.player;
    // ボス再召喚アイテム: 近くにボスを呼び戻す（重複不可）
    if (def && def.summonBoss) {
      if (Game.state.worldName !== 'light') { Game.UI.toast('地上(光の世界)でのみ使える'); return false; }
      let exists = false; const mobs = Game.state.mobs; for (let i = 0; i < mobs.length; i++) if (mobs[i].type === def.summonBoss) { exists = true; break; }
      if (exists) { Game.UI.toast('既にその強敵が顕現している'); return false; }
      remove(sl.id, 1);
      Game.Mobs.spawnMob(def.summonBoss, p.x + 140, p.y);
      Game.Audio.play('shift');
      Game.UI.toast(def.name + ' を掲げた — ' + ((Game.MOBS[def.summonBoss] && Game.MOBS[def.summonBoss].name) || '強敵') + ' が顕現する！');
      Game.UI.refreshAll(); return true;
    }
    // 商館の呼び鈴: バーツ商館を開く（消費しない）
    if (def && def.opensShop) {
      if (Game.UI && Game.UI.openShop) { Game.UI.openShop(); Game.Audio.play('select'); }
      return true;
    }
    // 拡張のポーチ: インベントリ上限 +2〜5（最大100）
    if (def && def.invExpand) {
      const want = def.invExpand[0] + Math.floor(Math.random() * (def.invExpand[1] - def.invExpand[0] + 1));
      const got = expand(want);
      if (got <= 0) { Game.UI.toast('これ以上拡張できない（最大' + MAX_SLOTS + '）'); return false; }
      remove(sl.id, 1); Game.Audio.play('enchant');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 18, 'スロット +' + got, '#caa86a', true);
      Game.UI.toast(def.name + ' — インベントリ +' + got + '（現在 ' + slots().length + '）');
      Game.UI.refreshAll(); return true;
    }
    // 知恵の書: スキルポイント+1
    // 帰還の巻物: 拠点(初期地点)へ瞬間帰還。光の世界へ戻してから移動
    if (def && def.recall) {
      if (Game.state.worldName !== 'light' && Game.World.setActiveWorld) { Game.World.setActiveWorld('light'); Game.UI.refreshWorld && Game.UI.refreshWorld(); }
      const sp = Game.state.spawn || { tx: 0, ty: 0 };
      Game.Render.spawnParticles(p.x, p.y, '#d8b0ff', 16);
      Game.Player.spawnAt(sp.tx, sp.ty);
      const pt = Game.Player.playerTile(); Game.World.updateChunks(pt.tx, pt.ty);
      Game.Render.spawnParticles(p.x, p.y, '#fff', 16);
      if (Game.Render.flash) Game.Render.flash('rgba(216,176,255,0.3)');
      remove(sl.id, 1); Game.Audio.play('shift');
      Game.UI.toast('帰還の巻物 — 拠点へ還った'); Game.UI.refreshAll(); return true;
    }
    if (def && def.skillTome) {
      p.skillPoints = (p.skillPoints || 0) + 1;
      remove(sl.id, 1); Game.Audio.play('levelup');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 18, 'スキルP +1', '#ffd86b', true);
      Game.UI.toast(def.name + ' を読んだ — スキルポイント +1');
      Game.UI.refreshAll(); return true;
    }
    // 時止めの砂時計: 一定時間すべての敵を静止させる
    if (def && def.stasis) {
      remove(sl.id, 1);
      Game.state.mobFreeze = def.stasis;
      Game.Audio.play('enchant'); if (Game.Audio.cue) Game.Audio.cue('shimmer');
      if (Game.Render.flash) Game.Render.flash('rgba(180,220,255,0.4)');
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#cfeeff', 20);
      Game.UI.toast(def.name + ' — 時が止まった');
      Game.UI.refreshAll(); return true;
    }
    // 経験の宝珠: 大量の経験値
    if (def && def.xpGain) {
      remove(sl.id, 1); Game.Player.gainXP(def.xpGain); Game.Audio.play('enchant');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 18, 'EXP +' + def.xpGain, '#7fd0ff', true);
      Game.UI.toast(def.name + ' を砕いた — 経験 +' + def.xpGain);
      Game.UI.refreshAll(); return true;
    }
    // 治療アイテム（包帯/解毒薬・バフ薬）。food も持つ料理は食事側で処理
    if (def && def.buff && !def.food) {
      Game.Status.apply(def.buff.type, def.buff.dur);
      if (Game.Achievements) Game.Achievements.unlock('potion_master');
      Game.Player.applyEquipStats();
      Game.Render.spawnParticles(p.x, p.y - 6, '#ffe9a0', 10);
      remove(sl.id, 1); if (Game.Audio.eat) Game.Audio.eat('drink'); else Game.Audio.play('eat');
      Game.UI.toast(def.name + ' を飲んだ — ' + (Game.Status.TYPES[def.buff.type] ? Game.Status.TYPES[def.buff.type].name : '') + ' 効果');
      Game.UI.refreshAll(); return true;
    }
    if (def && def.cures && !def.food) {
      def.cures.forEach(function (c) { Game.Status.cure(c); });
      if (def.heal) p.health = Math.min(p.maxHealth, p.health + def.heal);
      Game.Render.spawnParticles(p.x, p.y, '#9fe0b0', 8);
      remove(sl.id, 1); if (Game.Audio.eat) Game.Audio.eat('drink'); else Game.Audio.play('eat');
      Game.UI.toast(def.name + ' を使った');
      Game.UI.refreshAll(); return true;
    }
    if (def && def.food) {
      if (p.hunger >= p.maxHunger && !def.sick && !def.cures && !def.buff) { Game.UI.toast('お腹いっぱい'); return false; }
      Game.Survival.eat(def.food);
      if (def.cures) def.cures.forEach(function (c) { Game.Status.cure(c); }); // 料理が状態異常も治す（沼の煮込み等）
      if (def.buff) { Game.Status.apply(def.buff.type, def.buff.dur); Game.Player.applyEquipStats(); } // 料理のバフ（キノコのスープ等）
      if (def.sick) { // 腐肉
        if (Math.random() < 0.75) Game.Status.add('poison', 300);
        if (Math.random() < 0.4) Game.Status.add('infection', 360);
        Game.UI.toast('うっ…腐っていた');
      } else if (def.food >= 35) {
        Game.Status.apply('wellfed', 900); // 良い食料で満腹バフ
      }
      Game.Render.spawnParticles(p.x, p.y, def.sick ? '#6b7a3a' : '#ffd86b', 6);
      remove(sl.id, 1);
      if (Game.Audio.eat) Game.Audio.eat(foodSoundKind(def, sl.id)); else Game.Audio.play('eat');
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

  return { makeEmpty, slots, count, add, addInstance, hasRoomFor, remove, selectedSlot, selectedItemDef, setHotbar, useSelected, autoSort, expand };
})();
