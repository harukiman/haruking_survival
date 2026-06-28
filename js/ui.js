// ui.js — HUD/ホットバー/インベントリ/クラフト/ミニマップ/トースト
window.Game = window.Game || {};

Game.UI = (function () {
  let el = {};
  let toastTimer = null;
  let mmCtx = null;
  let invSelected = -1;

  function init() {
    el.hud = document.getElementById('hud');
    el.hotbar = document.getElementById('hotbar');
    el.health = document.getElementById('health-bar');
    el.hunger = document.getElementById('hunger-bar');
    el.clock = document.getElementById('clock-text');
    el.invScreen = document.getElementById('inv-screen');
    el.invGrid = document.getElementById('inv-grid');
    el.invDetail = document.getElementById('inv-detail');
    el.craftList = document.getElementById('craft-list');
    el.toast = document.getElementById('toast');
    el.sound = document.getElementById('btn-sound');
    if (el.sound) el.sound.addEventListener('click', function () {
      const on = Game.Audio.toggle();
      el.sound.textContent = on ? '♪' : '🔇';
      el.sound.classList.toggle('off', !on);
    });
    el.stamina = document.getElementById('stamina-bar');
    el.netBadge = document.getElementById('net-badge');
    if (el.netBadge) el.netBadge.addEventListener('click', function () {
      if (!Game.Net.isConnected()) return;
      const t = window.prompt('チャット送信:'); if (t) Game.Net.chat(t);
    });
    // オプション
    el.optionsScreen = document.getElementById('options-screen');
    const optBtn = document.getElementById('btn-options');
    if (optBtn) optBtn.addEventListener('click', toggleOptions);
    document.getElementById('btn-close-options').addEventListener('click', toggleOptions);
    document.getElementById('opt-save').addEventListener('click', function () { Game.manualSave(); });
    document.getElementById('opt-title').addEventListener('click', function () { if (confirm('保存してタイトルに戻りますか？')) Game.toTitle(); });
    document.getElementById('opt-name').addEventListener('click', function () { const n = window.prompt('名前を入力:'); if (n) { Game.Net.setName(n); toast('名前を ' + n + ' に変更'); } });
    document.getElementById('opt-sound').addEventListener('click', function () { const on = Game.Audio.toggle(); this.textContent = 'サウンド: ' + (on ? 'ON' : 'OFF'); });
    document.getElementById('opt-zoom').addEventListener('click', function () {
      Game.state.zoom = Game.state.zoom > 0.85 ? 0.7 : 1;
      this.textContent = 'マップ表示: ' + (Game.state.zoom < 1 ? '広い' : '標準');
    });
    // エンチャント
    el.enchantScreen = document.getElementById('enchant-screen');
    el.enchantGrid = document.getElementById('enchant-grid');
    el.enchantDetail = document.getElementById('enchant-detail');
    document.getElementById('btn-close-enchant').addEventListener('click', closeEnchant);
    el.touch = document.getElementById('touch-controls');
    el.minimap = document.getElementById('minimap');
    el.level = document.getElementById('level-text');
    el.armor = document.getElementById('armor-text');
    el.xp = document.getElementById('xp-bar');
    el.sanity = document.getElementById('sanity-bar');
    el.sanityWrap = document.getElementById('sanity-wrap');
    el.statusRow = document.getElementById('status-row');
    el.world = document.getElementById('world-label');
    el.chestScreen = document.getElementById('chest-screen');
    el.chestGrid = document.getElementById('chest-grid');
    el.chestInvGrid = document.getElementById('chest-inv-grid');
    mmCtx = el.minimap.getContext('2d');

    el.loreScreen = document.getElementById('lore-screen');
    el.loreTitle = document.getElementById('lore-title');
    el.loreBody = document.getElementById('lore-body');
    el.loreCount = document.getElementById('lore-count');

    el.questTracker = document.getElementById('quest-tracker');
    el.questText = document.getElementById('quest-text');
    el.questScreen = document.getElementById('quest-screen');
    el.questList = document.getElementById('quest-list');
    el.endingScreen = document.getElementById('ending-screen');
    el.endingStats = document.getElementById('ending-stats');

    document.getElementById('btn-close-inv').addEventListener('click', toggleInventory);
    document.getElementById('btn-close-chest').addEventListener('click', closeChest);
    document.getElementById('btn-close-lore').addEventListener('click', closeLore);
    document.getElementById('btn-close-quest').addEventListener('click', closeQuest);
    el.questTracker.addEventListener('click', openQuest);
    document.getElementById('btn-ending-continue').addEventListener('click', function () {
      el.endingScreen.classList.add('hidden'); Game.state.paused = false;
    });
    document.getElementById('btn-ending-ngplus').addEventListener('click', function () {
      el.endingScreen.classList.add('hidden'); Game.startNGPlus();
    });
    buildHotbar();
    // モバイル端末ならタッチUI表示
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      el.touch.classList.remove('hidden');
    }
  }

  function showGameUI() {
    el.hud.classList.remove('hidden');
    el.hotbar.classList.remove('hidden');
    if (el.sound) el.sound.classList.remove('hidden');
    const ob = document.getElementById('btn-options'); if (ob) ob.classList.remove('hidden');
  }

  function buildHotbar() {
    el.hotbar.innerHTML = '';
    for (let i = 0; i < Game.HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = i;
      slot.addEventListener('click', function () {
        Game.Inventory.setHotbar(parseInt(this.dataset.index, 10));
        Game.Audio.play('select');
      });
      el.hotbar.appendChild(slot);
    }
  }

  function slotHTML(stack) {
    if (!stack) return '';
    const def = Game.ITEMS[stack.id];
    const col = (def && def.color) || '#888';
    const cnt = stack.count > 1 ? '<span class="cnt">' + stack.count + '</span>' : '';
    let ring = '';
    if (stack.roll) ring = ';box-shadow:0 0 0 2px ' + Game.Loot.rarityColor(stack) + ',0 0 6px ' + Game.Loot.rarityColor(stack);
    const title = stack.roll ? Game.Loot.displayName(stack) : (def ? def.name : stack.id);
    const glyph = Game.ITEM_GLYPH[stack.id];
    if (glyph) {
      // 絵文字アイコン＋レアリティ枠（区別しやすく）
      return '<span class="icon glyph" style="' + (stack.roll ? 'background:transparent' + ring : 'background:transparent') + '" data-tip="' + stack.id + '">' + glyph + '</span>' + cnt;
    }
    return '<span class="icon" style="background:' + col + ring + '" title="' + title + '" data-tip="' + stack.id + '"></span>' + cnt;
  }

  // ツールチップ（hover/カーソル）
  function setupTooltip(container) {
    if (!el.tooltip) el.tooltip = document.getElementById('tooltip');
    container.querySelectorAll('.slot').forEach(function (cell, i) {
      cell.addEventListener('mouseenter', function (e) { showTip(cell, container, i); });
      cell.addEventListener('mousemove', function (e) { moveTip(e); });
      cell.addEventListener('mouseleave', hideTip);
    });
  }
  function tipFor(stack) {
    if (!stack) return null;
    const def = Game.ITEMS[stack.id]; if (!def) return null;
    let html = '<div class="tt-name" style="color:' + (stack.roll ? Game.Loot.rarityColor(stack) : (def.color || '#fff')) + '">' + (stack.roll ? Game.Loot.displayName(stack) : def.name) + '</div>';
    if (Game.Loot.rollable(stack.id)) html += '<div class="tt-stat">' + Game.Loot.statText(stack) + '</div>';
    else {
      const s = [];
      if (def.food) s.push('空腹+' + def.food); if (def.heal) s.push('回復+' + def.heal);
      if (def.place !== undefined) s.push('設置可'); if (def.tool) s.push(def.tool + ' Lv' + def.tier);
      if (def.cures) s.push('治療: ' + def.cures.join('/'));
      if (s.length) html += '<div class="tt-stat">' + s.join(' / ') + '</div>';
    }
    if (def.flavor) html += '<div class="tt-flavor">' + def.flavor + '</div>';
    return html;
  }
  function showTip(cell, container, i) {
    if (!el.tooltip) return;
    const arr = container === el.hotbar ? Game.Inventory.slots() : null;
    // どのスロット配列か特定（hotbar/inv/chest/enchant 共通: data-index or order）
    const slots = Game.Inventory.slots();
    const idxAttr = cell.dataset.index != null ? parseInt(cell.dataset.index, 10) : i;
    let stack = null;
    const tipId = cell.querySelector('[data-tip]');
    if (tipId) stack = { id: tipId.getAttribute('data-tip') };
    // 正確なstack（roll込）を配列から取得
    const html = tipId ? tipFor(findStackById(tipId.getAttribute('data-tip'), idxAttr)) : null;
    if (!html) return;
    el.tooltip.innerHTML = html; el.tooltip.style.display = 'block';
  }
  function findStackById(id, idx) {
    const s = Game.Inventory.slots();
    if (s[idx] && s[idx].id === id) return s[idx];
    for (let i = 0; i < s.length; i++) if (s[i] && s[i].id === id) return s[i];
    return { id: id };
  }
  function moveTip(e) {
    if (!el.tooltip || el.tooltip.style.display !== 'block') return;
    const x = (e.clientX || 0) + 14, y = (e.clientY || 0) + 14;
    el.tooltip.style.left = Math.min(x, window.innerWidth - 230) + 'px';
    el.tooltip.style.top = Math.min(y, window.innerHeight - 80) + 'px';
  }
  function hideTip() { if (el.tooltip) el.tooltip.style.display = 'none'; }

  function refreshHotbar() {
    if (!el.hotbar || !Game.state) return;
    const s = Game.Inventory.slots();
    const slots = el.hotbar.children;
    for (let i = 0; i < slots.length; i++) {
      slots[i].innerHTML = slotHTML(s[i]);
      slots[i].classList.toggle('selected', i === Game.state.player.hotbarIndex);
    }
    setupTooltip(el.hotbar);
  }

  function refreshStats() {
    if (!el.health || !Game.state) return;
    const p = Game.state.player;
    el.health.style.width = (p.health / p.maxHealth * 100) + '%';
    el.hunger.style.width = (p.hunger / p.maxHunger * 100) + '%';
    el.clock.textContent = Game.DayNight.clockText();
    if (el.level) {
      el.level.textContent = p.level;
      el.armor.textContent = Game.Player.totalArmor();
      el.xp.style.width = (p.xp / p.xpNext * 100) + '%';
    }
    if (el.sanity) {
      el.sanity.style.width = (Game.state.sanity / Game.TUNE.SANITY_MAX * 100) + '%';
      // 正気度バーは影世界でのみ表示
      el.sanityWrap.style.display = Game.state.worldName === 'shadow' ? 'flex' : 'none';
    }
    if (el.stamina) el.stamina.style.width = (p.stamina / p.maxStamina * 100) + '%';
  }

  function toggleOptions() {
    if (!el.optionsScreen) return;
    const opening = el.optionsScreen.classList.contains('hidden');
    el.optionsScreen.classList.toggle('hidden');
    Game.state.paused = opening;
  }

  // ===== エンチャント台 =====
  let enchantSel = -1;
  // (invSelected declared near top via closure)
  function openEnchant() {
    enchantSel = -1;
    el.enchantScreen.classList.remove('hidden');
    Game.state.paused = true;
    refreshEnchant();
  }
  function closeEnchant() { el.enchantScreen.classList.add('hidden'); Game.state.paused = false; }
  function refreshEnchant() {
    if (!el.enchantScreen || el.enchantScreen.classList.contains('hidden')) return;
    const inv = Game.Inventory.slots();
    el.enchantGrid.innerHTML = '';
    inv.forEach(function (st, i) {
      const cell = document.createElement('div');
      cell.className = 'slot';
      if (st && Game.Loot.rollable(st.id)) {
        cell.innerHTML = slotHTML(st);
        if (i === enchantSel) cell.classList.add('selected');
        cell.addEventListener('click', function () { enchantSel = i; refreshEnchant(); });
      } else { cell.style.opacity = '0.25'; }
      el.enchantGrid.appendChild(cell);
    });
    const st = inv[enchantSel];
    if (!st || !Game.Loot.rollable(st.id)) { el.enchantDetail.innerHTML = '<p class="hint">武器・防具を選択してください</p>'; return; }
    const rerollC = Game.Loot.enchantCost(st, 'reroll');
    const upC = Game.Loot.enchantCost(st, 'upgrade');
    const fmt = function (c) { return Object.keys(c).filter(function (k) { return c[k]; }).map(function (k) { return Game.ITEMS[k].name + '×' + c[k]; }).join(' '); };
    const can = function (c) { for (const k in c) if (c[k] && Game.Inventory.count(k) < c[k]) return false; return true; };
    const maxed = Game.Loot.maxRarity(st);
    el.enchantDetail.innerHTML =
      '<div class="ench-name" style="color:' + Game.Loot.rarityColor(st) + '">' + Game.Loot.rarityName(st) + ' ' + Game.Loot.displayName(st) + '</div>' +
      '<div class="ench-stat">' + Game.Loot.statText(st) + '</div>' +
      '<button id="ench-reroll" class="big-btn alt' + (can(rerollC) ? '' : ' disabled') + '">振り直し（' + fmt(rerollC) + '）</button>' +
      (maxed ? '<p class="hint">位階は最高（レジェンダリー）</p>'
             : '<button id="ench-up" class="big-btn' + (can(upC) ? '' : ' disabled') + '">位階を上げる（' + fmt(upC) + '）</button>');
    const rr = document.getElementById('ench-reroll');
    if (rr) rr.addEventListener('click', function () { doEnchant(st, 'reroll', rerollC, can); });
    const up = document.getElementById('ench-up');
    if (up) up.addEventListener('click', function () { doEnchant(st, 'upgrade', upC, can); });
  }
  function doEnchant(st, kind, cost, can) {
    if (!can(cost)) { toast('素材が足りない'); return; }
    for (const k in cost) if (cost[k]) Game.Inventory.remove(k, cost[k]);
    if (kind === 'reroll') Game.Loot.reroll(st); else Game.Loot.upgrade(st);
    Game.Audio.play('enchant');
    Game.Player.applyEquipStats();
    toast(Game.Loot.rarityName(st) + ' ' + Game.Loot.displayName(st) + ' に！');
    refreshEnchant(); refreshHotbar();
  }

  function refreshStatus() {
    if (!el.statusRow || !Game.Status) return;
    const list = Game.Status.activeList();
    el.statusRow.innerHTML = list.map(function (s) {
      return '<span class="st-chip" style="border-color:' + s.color + '" title="' + s.name + '">' + s.icon + '</span>';
    }).join('');
  }

  function refreshNet() {
    const badge = document.getElementById('net-badge');
    const cnt = document.getElementById('net-count');
    if (!badge) return;
    if (Game.Net && Game.Net.isConnected()) {
      badge.classList.remove('hidden');
      cnt.textContent = (Game.Net.peerCount() + 1) + '人';
    } else badge.classList.add('hidden');
  }

  function refreshWorld() {
    if (!el.world) return;
    const wn = Game.state.worldName;
    const shadow = wn === 'shadow';
    let label = wn === 'space' ? '宇宙' : shadow ? '影の世界' : '光の世界';
    if (shadow && Game.World.inDepths()) label = '影の深層';
    if (Game.state.ngLevel > 0) label += ' NG+' + Game.state.ngLevel;
    el.world.textContent = label;
    el.world.className = wn === 'space' ? 'world-space' : shadow ? 'world-shadow' : 'world-light';
    document.body.classList.toggle('shadow-mode', shadow);
    refreshStats();
  }

  function refreshInventory() {
    if (!Game.state || el.invScreen.classList.contains('hidden')) return;
    const s = Game.Inventory.slots();
    el.invGrid.innerHTML = '';
    for (let i = 0; i < s.length; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = slotHTML(s[i]);
      if (s[i]) {
        d.title = Game.ITEMS[s[i].id] ? Game.ITEMS[s[i].id].name : s[i].id;
        d.addEventListener('click', (function (idx) {
          return function () { invSelected = idx; refreshInventory(); };
        })(i));
        if (i === invSelected) d.classList.add('selected');
      }
      el.invGrid.appendChild(d);
    }
    setupTooltip(el.invGrid);
    renderInvDetail();
    refreshCraft();
  }

  // 選択中アイテムの詳細＋操作（誤使用防止: 確認ボタン式）
  function renderInvDetail() {
    if (!el.invDetail) return;
    const st = Game.Inventory.slots()[invSelected];
    if (!st) { el.invDetail.innerHTML = '<p class="hint">アイテムをタップで選択</p>'; return; }
    const def = Game.ITEMS[st.id];
    let h = '<div class="ench-name" style="color:' + (st.roll ? Game.Loot.rarityColor(st) : (def.color || '#fff')) + '">' + (st.roll ? Game.Loot.displayName(st) : def.name) + '</div>';
    if (Game.Loot.rollable(st.id)) h += '<div class="ench-stat">' + Game.Loot.statText(st) + '</div>';
    if (def.flavor) h += '<div class="tt-flavor" style="margin-bottom:6px">' + def.flavor + '</div>';
    const btns = [];
    if (def.armor && def.slot) btns.push('<button id="inv-act" class="big-btn">装備する</button>');
    else if (def.food || def.cures) btns.push('<button id="inv-act" class="big-btn">' + (def.cures ? '使う' : '食べる') + '</button>');
    else if (Game.Loot.rollable(st.id) || def.tool) btns.push('<button id="inv-hot" class="big-btn alt">ホットバーへ装備</button>');
    el.invDetail.innerHTML = h + btns.join('');
    const act = document.getElementById('inv-act');
    if (act) act.addEventListener('click', function () {
      const cur = Game.Inventory.slots()[invSelected]; if (!cur) return;
      const d2 = Game.ITEMS[cur.id];
      if (d2.armor) Game.Player.equipFromInventory(invSelected);
      else { const tmp = Game.state.player.hotbarIndex; const sl = Game.Inventory.slots(); const k = sl.indexOf(cur); Game.state.player.hotbarIndex = k; Game.Inventory.useSelected(); Game.state.player.hotbarIndex = Math.min(tmp, Game.HOTBAR_SIZE - 1); }
      invSelected = -1; refreshInventory();
    });
    const hot = document.getElementById('inv-hot');
    if (hot) hot.addEventListener('click', function () {
      // 選択スロットをホットバー(現在の手持ち枠)と入れ替え
      const sl = Game.Inventory.slots(); const hb = Game.state.player.hotbarIndex;
      const tmp = sl[hb]; sl[hb] = sl[invSelected]; sl[invSelected] = tmp;
      toast('ホットバー' + (hb + 1) + 'に装備'); invSelected = -1; refreshInventory();
    });
  }

  function refreshCraft() {
    el.craftList.innerHTML = '';
    const list = Game.Crafting.availableList();
    list.forEach(function (entry) {
      const r = entry.recipe;
      const out = Game.ITEMS[r.out.id];
      const row = document.createElement('div');
      row.className = 'craft-row' + (entry.can ? '' : ' disabled');
      let ing = '';
      for (const id in r.in) ing += (Game.ITEMS[id] ? Game.ITEMS[id].name : id) + '×' + r.in[id] + ' ';
      const station = r.station ? ' <em>(' + (r.station === 'furnace' ? 'かまど' : '作業台') + ')</em>' : '';
      row.innerHTML = '<span class="ci" style="background:' + (out.color || '#888') + '"></span>' +
        '<span class="cn">' + out.name + (r.out.n > 1 ? '×' + r.out.n : '') + station + '</span>' +
        '<span class="cin">' + ing + '</span>';
      row.addEventListener('click', function () {
        if (Game.Crafting.craft(r)) refreshInventory();
      });
      el.craftList.appendChild(row);
    });
  }

  function refreshAll() { refreshHotbar(); refreshStats(); refreshInventory(); refreshChest(); refreshWorld(); }

  // ===== チェスト =====
  function openChest(tx, ty) {
    let d = Game.World.getTileData(tx, ty);
    if (!d || !d.chest) { d = { chest: new Array(27).fill(null) }; Game.World.setTileData(tx, ty, d); }
    Game.state.openChest = { tx: tx, ty: ty };
    Game.state.paused = true;
    el.chestScreen.classList.remove('hidden');
    Game.Audio.play('select');
    refreshChest();
  }
  // 裂け目の楔: 両世界共通の保管庫（どの楔からでも同じ中身）
  function openSharedChest(tx, ty) {
    if (!Game.state.riftBank) Game.state.riftBank = new Array(27).fill(null);
    Game.state.openChest = { shared: true };
    Game.state.paused = true;
    el.chestScreen.classList.remove('hidden');
    const title = el.chestScreen.querySelector('h2');
    if (title) title.textContent = '裂け目の保管庫（両世界共通）';
    Game.Audio.play('shift');
    refreshChest();
  }
  function closeChest() {
    Game.state.openChest = null;
    Game.state.paused = false;
    el.chestScreen.classList.add('hidden');
    const title = el.chestScreen.querySelector('h2');
    if (title) title.textContent = 'チェスト';
  }
  function chestData() {
    const oc = Game.state.openChest;
    if (!oc) return null;
    if (oc.shared) return Game.state.riftBank;
    const d = Game.World.getTileData(oc.tx, oc.ty);
    return d && d.chest ? d.chest : null;
  }
  function refreshChest() {
    if (!el.chestScreen || el.chestScreen.classList.contains('hidden')) return;
    const chest = chestData();
    if (!chest) return;
    const inv = Game.Inventory.slots();
    el.chestGrid.innerHTML = '';
    chest.forEach(function (st, i) {
      const cell = document.createElement('div');
      cell.className = 'slot'; cell.innerHTML = slotHTML(st);
      cell.addEventListener('click', function () { chestToInv(i); });
      el.chestGrid.appendChild(cell);
    });
    el.chestInvGrid.innerHTML = '';
    inv.forEach(function (st, i) {
      const cell = document.createElement('div');
      cell.className = 'slot'; cell.innerHTML = slotHTML(st);
      cell.addEventListener('click', function () { invToChest(i); });
      el.chestInvGrid.appendChild(cell);
    });
  }
  function chestToInv(i) {
    const chest = chestData(); if (!chest || !chest[i]) return;
    const st = chest[i];
    const overflow = Game.Inventory.add(st.id, st.count);
    if (overflow === 0) chest[i] = null; else st.count = overflow;
    Game.Audio.play('select'); refreshChest(); refreshHotbar();
  }
  function invToChest(i) {
    const chest = chestData(); const inv = Game.Inventory.slots();
    if (!chest || !inv[i]) return;
    const st = inv[i];
    // 既存スタックに詰める→空きへ
    const max = (Game.ITEMS[st.id].stack) || 99;
    for (let k = 0; k < chest.length && st.count > 0; k++) {
      if (chest[k] && chest[k].id === st.id && chest[k].count < max) {
        const put = Math.min(max - chest[k].count, st.count); chest[k].count += put; st.count -= put;
      }
    }
    for (let k = 0; k < chest.length && st.count > 0; k++) {
      if (!chest[k]) { const put = Math.min(max, st.count); chest[k] = { id: st.id, count: put }; st.count -= put; }
    }
    if (st.count <= 0) inv[i] = null;
    Game.Audio.play('select'); refreshChest(); refreshHotbar();
  }

  function toggleInventory() {
    el.invScreen.classList.toggle('hidden');
    Game.state.paused = !el.invScreen.classList.contains('hidden');
    if (!el.invScreen.classList.contains('hidden')) { invSelected = -1; refreshInventory(); }
  }

  // ===== 石碑（ロア） =====
  function showLore(title, body, n, total) {
    el.loreTitle.textContent = title;
    el.loreBody.textContent = body;
    el.loreCount.textContent = '石碑 ' + n + ' / ' + total + ' を解読';
    el.loreScreen.classList.remove('hidden');
    Game.state.paused = true;
  }
  function closeLore() {
    el.loreScreen.classList.add('hidden');
    Game.state.paused = false;
  }

  // ===== クエスト =====
  function refreshQuest() {
    if (!el.questTracker || !Game.state) return;
    const q = Game.Quests.current();
    if (!q || (q.id === 'reunify' && Game.state.reunified)) {
      el.questText.textContent = 'すべての目標を達成した';
    } else {
      el.questText.textContent = q.name + '：' + q.desc;
    }
    el.questTracker.classList.remove('hidden');
  }
  function openQuest() {
    if (!Game.state) return;
    el.questList.innerHTML = '';
    const curIdx = Game.state.questIndex || 0;
    Game.QUESTS.forEach(function (q, i) {
      const done = !!(Game.state.questDone && Game.state.questDone[q.id]);
      const row = document.createElement('div');
      row.className = 'quest-row' + (done ? ' done' : (i === curIdx ? ' current' : ' locked'));
      row.innerHTML = '<span class="qmark">' + (done ? '✓' : (i === curIdx ? '▶' : '・')) + '</span>' +
        '<span class="qname">' + q.name + '</span><span class="qdesc">' + q.desc + '</span>';
      el.questList.appendChild(row);
    });
    el.questScreen.classList.remove('hidden');
    Game.state.paused = true;
  }
  function closeQuest() { el.questScreen.classList.add('hidden'); Game.state.paused = false; }

  // ===== オープニング =====
  function showIntro() {
    const sc = document.getElementById('intro-screen');
    sc.classList.remove('hidden');
    Game.state.paused = true;
    const btn = document.getElementById('btn-intro-start');
    btn.onclick = function () { sc.classList.add('hidden'); Game.state.paused = false; Game.Audio.ensure(); Game.Audio.startBGM(); };
  }

  // ===== エンディング =====
  function showEnding(stats) {
    el.endingStats.innerHTML =
      '<div>生存日数　<b>' + stats.days + '</b> 日</div>' +
      '<div>レベル　　<b>' + stats.level + '</b></div>' +
      '<div>実績　　　<b>' + stats.ach + ' / ' + stats.achTotal + '</b></div>';
    el.endingScreen.classList.remove('hidden');
    Game.state.paused = false; // 演出後に「歩き続ける」で閉じる。pausedにしない（背景見せる）
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }

  // ミニマップ（周辺地形をダウンサンプル）
  function updateMinimap() {
    if (!mmCtx) return;
    const size = 120, span = 48; // 48タイル四方
    const scale = size / span;
    const p = Game.state.player;
    const TS = Game.CFG.TILE_SIZE;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const half = span / 2;
    const palette = Game.state.worldName === 'shadow' ? Game.SHADOW_TILE_COLOR : Game.TILE_COLOR;
    mmCtx.clearRect(0, 0, size, size);
    for (let y = 0; y < span; y++) {
      for (let x = 0; x < span; x++) {
        const t = Game.WorldGen.genTile(ptx - half + x, pty - half + y, Game.state.seed);
        mmCtx.fillStyle = palette[t.ground] || '#333';
        mmCtx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
      }
    }
    // プレイヤー
    mmCtx.fillStyle = '#fff';
    mmCtx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
    mmCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    mmCtx.strokeRect(0, 0, size, size);
  }

  return {
    init, showGameUI, refreshHotbar, refreshStats, refreshInventory,
    refreshCraft, refreshAll, toggleInventory, toast, updateMinimap,
    openChest, openSharedChest, closeChest, refreshChest, refreshWorld,
    showLore, closeLore, refreshQuest, openQuest, closeQuest, showEnding, showIntro, refreshNet, refreshStatus,
    toggleOptions, openEnchant, closeEnchant,
  };
})();
