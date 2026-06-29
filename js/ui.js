// ui.js — HUD/ホットバー/インベントリ/クラフト/ミニマップ/トースト
window.Game = window.Game || {};

Game.UI = (function () {
  let el = {};
  let toastTimer = null;
  let mmCtx = null;
  let bmCtx = null, bigMapOpen = false;
  let invSelected = -1;
  const pendStat = { str: 0, vit: 0, dex: 0 }; // スキル振りの未確定分(確定で反映)

  function init() {
    el.hud = document.getElementById('hud');
    el.hotbar = document.getElementById('hotbar');
    el.health = document.getElementById('health-bar');
    el.hunger = document.getElementById('hunger-bar');
    el.healthVal = document.getElementById('health-val');
    el.hungerVal = document.getElementById('hunger-val');
    el.staminaVal = document.getElementById('stamina-val');
    el.sanityVal = document.getElementById('sanity-val');
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
    el.bts = document.getElementById('bts-text');
    el.xp = document.getElementById('xp-bar');
    el.sanity = document.getElementById('sanity-bar');
    el.sanityWrap = document.getElementById('sanity-wrap');
    el.statusRow = document.getElementById('status-row');
    el.world = document.getElementById('world-label');
    el.chestScreen = document.getElementById('chest-screen');
    el.chestGrid = document.getElementById('chest-grid');
    el.chestInvGrid = document.getElementById('chest-inv-grid');
    mmCtx = el.minimap.getContext('2d');
    el.bigmapScreen = document.getElementById('bigmap-screen');
    el.bigmap = document.getElementById('bigmap');
    bmCtx = el.bigmap.getContext('2d');
    el.btnMap = document.getElementById('btn-map');
    if (el.btnMap) el.btnMap.addEventListener('click', toggleBigMap);
    // ミニマップをタップで大マップ開閉
    if (el.minimap) el.minimap.addEventListener('click', toggleBigMap);
    const mmWrap = document.getElementById('minimap-wrap'); if (mmWrap) { mmWrap.style.pointerEvents = 'auto'; mmWrap.style.cursor = 'pointer'; }
    const opBtn = document.getElementById('bigmap-opacity');
    if (opBtn) opBtn.addEventListener('click', function (e) { e.stopPropagation(); cycleBigMapOpacity(); });
    const clBtn = document.getElementById('bigmap-close');
    if (clBtn) clBtn.addEventListener('click', function (e) { e.stopPropagation(); if (bigMapOpen) toggleBigMap(); });
    // ステータス画面: レベルバッジをタップで開く
    const lb = document.getElementById('level-badge');
    if (lb) lb.addEventListener('click', toggleStats);
    // デバッグ用チートコード（haruking で解放→コマンド入力で敵召喚/アイテム付与）
    const cheatIn = document.getElementById('cheat-input');
    if (cheatIn) {
      cheatIn.addEventListener('input', function () {
        const panel = document.getElementById('cheat-panel');
        if (cheatIn.value.trim().toLowerCase() === 'haruking') { cheatUnlocked = true; buildCheatPanel(panel); panel.classList.remove('hidden'); cheatIn.placeholder = 'コマンド: give<id>[n] / spawn<type>[n] / bts<n> / xp<n> / heal'; }
      });
      cheatIn.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault(); e.stopPropagation();
        const v = cheatIn.value; runCheat(v); cheatIn.value = '';
      });
    }
    const csb = document.getElementById('btn-close-stats');
    if (csb) csb.addEventListener('click', closeStats);

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
    { const sb = document.getElementById('btn-sort-inv'); if (sb) sb.addEventListener('click', function () { Game.Inventory.autoSort(); Game.Audio.play('select'); refreshInventory(); refreshHotbar(); }); }
    { const sbtn = document.getElementById('btn-inv-story'); if (sbtn) sbtn.addEventListener('click', function () { el.invScreen.classList.add('hidden'); Game.Audio.play('select'); openStory(); }); } // インベントリから記憶回廊を開く
    document.getElementById('btn-close-chest').addEventListener('click', closeChest);
    var ct = document.getElementById('btn-close-trade'); if (ct) ct.addEventListener('click', closeTrade);
    var cst = document.getElementById('btn-close-story'); if (cst) cst.addEventListener('click', closeStory);
    var cm = document.getElementById('chest-multi'); if (cm) cm.addEventListener('click', toggleChestMulti);
    var cds = document.getElementById('chest-deposit-sel'); if (cds) cds.addEventListener('click', depositSelected);
    var cda = document.getElementById('chest-deposit-all'); if (cda) cda.addEventListener('click', depositAll);
    document.getElementById('btn-close-lore').addEventListener('click', closeLore);
    document.getElementById('btn-close-quest').addEventListener('click', closeQuest);
    el.questTracker.addEventListener('click', openQuest);
    document.getElementById('btn-ending-continue').addEventListener('click', function () {
      el.endingScreen.classList.add('hidden'); Game.state.paused = false;
    });
    { const rv = document.getElementById('btn-death-revive'); if (rv) rv.addEventListener('click', function () { document.getElementById('death-screen').classList.add('hidden'); Game.Survival.respawn(); }); }
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
    if (el.btnMap) el.btnMap.classList.remove('hidden');
  }

  // ===== 大マップ（半透明オーバーレイ・操作継続）=====
  const BIGMAP_OPACITY = [{ n: '濃い', v: 0.96 }, { n: '標準', v: 0.78 }, { n: '薄い', v: 0.5 }, { n: '極薄', v: 0.3 }];
  let bigMapOpacityIdx = 1;
  function applyBigMapOpacity() {
    const o = BIGMAP_OPACITY[bigMapOpacityIdx];
    const panel = document.getElementById('bigmap-panel');
    if (panel) panel.style.opacity = o.v;
    const ob = document.getElementById('bigmap-opacity');
    if (ob) ob.textContent = '薄さ: ' + o.n;
  }
  function cycleBigMapOpacity() { bigMapOpacityIdx = (bigMapOpacityIdx + 1) % BIGMAP_OPACITY.length; applyBigMapOpacity(); }

  function toggleBigMap() {
    if (!el.bigmapScreen) return;
    bigMapOpen = !bigMapOpen;
    el.bigmapScreen.classList.toggle('hidden', !bigMapOpen);
    if (el.btnMap) el.btnMap.classList.toggle('active', bigMapOpen);
    if (bigMapOpen) { buildLegend(); applyBigMapOpacity(); updateBigMap(); }
  }
  function isBigMapOpen() { return bigMapOpen; }

  // ボスHPバー（最大HPのボスを表示・不在なら隠す）
  let bbName = null, bbFill = null, bbEl = null;
  function refreshBossBar() {
    if (!bbEl) { bbEl = document.getElementById('boss-bar'); bbName = document.getElementById('boss-bar-name'); bbFill = document.getElementById('boss-bar-fill'); }
    if (!bbEl || !Game.state) return;
    const mobs = Game.state.mobs; let boss = null;
    for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def && m.def.boss) { if (!boss || m.maxHp > boss.maxHp) boss = m; } }
    // ボスが居なければチャンピオン(ネームド精鋭)をバー表示
    if (!boss) { for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.champion) { if (!boss || m.maxHp > boss.maxHp) boss = m; } } }
    if (!boss) { if (!bbEl.classList.contains('hidden')) bbEl.classList.add('hidden'); bbEl.classList.remove('champion'); return; }
    bbEl.classList.remove('hidden');
    const isChamp = !boss.def.boss || boss.bountyBoss;
    bbEl.classList.toggle('champion', isChamp);
    const nm = boss.championName || (isChamp ? 'チャンピオン' : boss.def.name);
    if (bbName.textContent !== nm) bbName.textContent = nm;
    bbFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  }

  // ===== 旅商人トレード =====
  // 常設の基本在庫
  const TRADE_BASE = [
    { id: 'bandage', n: 3, price: 1 }, { id: 'antidote', n: 2, price: 1 },
    { id: 'ammo_9mm', n: 16, price: 1 }, { id: 'ammo_762', n: 12, price: 2 },
    { id: 'carrot_seeds', n: 3, price: 1 }, { id: 'bounty_board', n: 1, price: 4 },
  ];
  // 来訪ごとに一部が並ぶ品（rare は低確率）
  const TRADE_POOL = [
    { id: 'strength_potion', n: 1, price: 2 }, { id: 'swift_potion', n: 1, price: 2 },
    { id: 'iron_potion', n: 1, price: 2 }, { id: 'regen_potion', n: 1, price: 2 },
    { id: 'energy_cell', n: 10, price: 2 }, { id: 'rocket_ammo', n: 2, price: 3 },
    { id: 'bomb', n: 2, price: 2 }, { id: 'poison_flask', n: 2, price: 2 }, { id: 'flash_bomb', n: 2, price: 2 },
    { id: 'pumpkin_seeds', n: 2, price: 1 }, { id: 'tomato_seeds', n: 3, price: 1 },
    { id: 'banner', n: 1, price: 1 }, { id: 'brazier', n: 1, price: 2 }, { id: 'barrel', n: 1, price: 1 }, { id: 'potted_plant', n: 1, price: 1 },
    { id: 'glow_spore', n: 3, price: 2 }, { id: 'obsidian', n: 2, price: 3 }, { id: 'sulfur', n: 3, price: 2 }, { id: 'luminous_cap', n: 3, price: 2 },
    { id: 'xp_orb', n: 1, price: 3 },
    // レア枠
    { id: 'wisdom_tome', n: 1, price: 8, rare: true }, { id: 'expand_pouch', n: 1, price: 6, rare: true },
    { id: 'ring_crit', n: 1, price: 10, rare: true }, { id: 'heart_regen', n: 1, price: 10, rare: true },
    { id: 'amulet_swift', n: 1, price: 10, rare: true }, { id: 'siege_pick', n: 1, price: 14, rare: true },
  ];
  // バーツ商館の品揃え(常設・固定価格)
  const SHOP_STOCK = [
    { id: 'bandage', n: 5, price: 6 }, { id: 'antidote', n: 3, price: 6 },
    { id: 'cooked_meat', n: 3, price: 5 }, { id: 'bread', n: 3, price: 4 }, { id: 'torch', n: 8, price: 5 },
    { id: 'ammo_9mm', n: 24, price: 6 }, { id: 'ammo_762', n: 18, price: 8 },
    { id: 'strength_potion', n: 1, price: 14 }, { id: 'swift_potion', n: 1, price: 14 }, { id: 'iron_potion', n: 1, price: 14 }, { id: 'regen_potion', n: 1, price: 14 },
    { id: 'bomb', n: 3, price: 16 }, { id: 'frost_grenade', n: 3, price: 18 },
    { id: 'carrot_seeds', n: 5, price: 6 }, { id: 'xp_orb', n: 1, price: 45 },
    { id: 'expand_pouch', n: 1, price: 120 }, { id: 'wisdom_tome', n: 1, price: 150 },
    { id: 'ring_crit', n: 1, price: 260 }, { id: 'amulet_swift', n: 1, price: 260 }, { id: 'heart_regen', n: 1, price: 260 },
    { id: 'coin_charm', n: 1, price: 400 },
    { rand: true, price: 90, label: '掘り出し物（ランダム装備）' },
  ];
  let shopMode = false; // true=バーツ商館 / false=金塊の旅商人
  function openShop() {
    const sc = document.getElementById('trade-screen'); if (!sc) return;
    shopMode = true; sc.classList.remove('hidden'); Game.state.paused = true;
    const title = sc.querySelector('h2'); if (title) title.textContent = '商館 🏪';
    tradeStock = SHOP_STOCK.slice(); refreshTrade();
  }
  let tradeStock = [];
  function rollTradeStock() {
    const pool = TRADE_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    const picks = [];
    for (let i = 0; i < pool.length && picks.length < 7; i++) { if (pool[i].rare && Math.random() > 0.4) continue; picks.push(pool[i]); }
    tradeStock = TRADE_BASE.concat(picks);
    tradeStock.push({ rand: true, price: 4, label: '謎の装備（ランダム）' });
  }
  function openTrade() { const sc = document.getElementById('trade-screen'); if (!sc) return; shopMode = false; const title = sc.querySelector('h2'); if (title) title.textContent = '旅の商人 🧳'; sc.classList.remove('hidden'); Game.state.paused = true; rollTradeStock(); refreshTrade(); }
  function closeTrade() { const sc = document.getElementById('trade-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; shopMode = false; }

  // 記憶回廊(物語ギャラリー)
  function openStory() { const sc = document.getElementById('story-screen'); if (!sc) return; sc.classList.remove('hidden'); Game.state.paused = true; renderStory(); }
  function closeStory() { const sc = document.getElementById('story-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; }
  function renderStory() {
    const body = document.getElementById('story-body'); if (!body || !Game.Story) return;
    const list = Game.Story.list(); const seen = list.filter(function (f) { return f.seen; }).length;
    let h = '<p class="hint">解放した物語 <b style="color:#bfa0ff">' + seen + ' / ' + list.length + '</b>　｜　刻片 🔮 <b>' + (Game.Inventory ? Game.Inventory.count('kokuhen') : 0) + '</b></p>';
    list.forEach(function (f) {
      if (f.seen) {
        h += '<div class="story-frag"><div class="sf-head"><b>' + f.title + '</b><button class="sf-play map-btn" data-id="' + f.id + '">▶ 再生</button></div><div class="sf-text">' + f.text.replace(/\n/g, '<br>') + '</div></div>';
      } else {
        h += '<div class="story-frag locked"><div class="sf-head"><b>？？？</b></div><div class="sf-text" style="opacity:.55">解放条件: ' + f.trigger + '</div></div>';
      }
    });
    body.innerHTML = h;
    body.querySelectorAll('.sf-play[data-id]').forEach(function (btn) { btn.addEventListener('click', function () { closeStory(); Game.Story.play(btn.getAttribute('data-id')); }); });
  }
  function refreshTrade() {
    const body = document.getElementById('trade-body'); if (!body) return;
    const cur = shopMode ? (Game.state.player.bts || 0) : Game.Inventory.count('gold_bar');
    const curName = shopMode ? 'バーツ' : '金塊', curColor = shopMode ? '#ffd24a' : '#e8c54a', curIcon = shopMode ? '🪙' : '🟨';
    const sub = shopMode ? '欲しい品を選べ。（バーツで購入）' : '欲しい品を選べ。（品揃えは来訪ごとに変わる）';
    let h = '<p class="hint">所持 ' + curName + ' <b style="color:' + curColor + '">' + cur + '</b>　' + sub + '</p><div class="trade-list">';
    tradeStock.forEach(function (t, i) {
      const can = cur >= t.price;
      const name = t.rand ? t.label : (Game.ITEMS[t.id].name + (t.n > 1 ? ' ×' + t.n : ''));
      const url = !t.rand && Game.Icons ? Game.Icons.dataURL(t.id, null) : null;
      h += '<button class="trade-row' + (can ? '' : ' disabled') + '" data-i="' + i + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="tr-ic"' + (url ? ' style="background-image:url(' + url + ')"' : '') + '></span>' +
        '<span class="tr-name">' + name + '</span><span class="tr-price">' + curIcon + t.price + '</span></button>';
    });
    h += '</div>';
    body.innerHTML = h;
    body.querySelectorAll('.trade-row[data-i]').forEach(function (btn) { btn.addEventListener('click', function () { buyTrade(parseInt(btn.getAttribute('data-i'), 10)); }); });
  }
  function buyTrade(i) {
    const t = tradeStock[i]; if (!t) return;
    if (shopMode) {
      const pl = Game.state.player; if ((pl.bts || 0) < t.price) return; pl.bts -= t.price;
    } else {
      if (Game.Inventory.count('gold_bar') < t.price) return; Game.Inventory.remove('gold_bar', t.price);
    }
    if (t.rand) {
      const pool = (Game.GEN_BY_TIER[3] || []).concat(Game.GEN_BY_TIER[2] || []);
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (id) { Game.Inventory.addInstance({ id: id, roll: Game.Loot.roll(id, 0.1) }); toast('購入: ' + Game.ITEMS[id].name); }
    } else { Game.Inventory.add(t.id, t.n); toast('購入: ' + Game.ITEMS[t.id].name); }
    Game.Audio.play('craft'); refreshTrade(); refreshHotbar(); refreshStats();
  }

  // ===== ステータス & スキル画面 =====
  function openStats() {
    const sc = document.getElementById('stats-screen'); if (!sc) return;
    sc.classList.remove('hidden'); Game.state.paused = true; renderStats();
  }
  function closeStats() { const sc = document.getElementById('stats-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; }
  function toggleStats() { const sc = document.getElementById('stats-screen'); if (!sc) return; if (sc.classList.contains('hidden')) openStats(); else closeStats(); }
  const skOpen = {}; // スキル系統の開閉状態
  function renderStats() {
    const p = Game.state.player; const body = document.getElementById('stats-body'); if (!body || !p) return;
    const slot = Game.Inventory.selectedSlot(); const wst = Game.Loot.stats(slot);
    const eff = Game.Player.effAttack(wst.atk > 0 ? wst.atk : 1);
    let h = '';
    h += '<div class="ench-stat">Lv.' + p.level + '（EXP ' + p.xp + '/' + p.xpNext + '）　スキルP: <span class="sp-badge">' + (p.skillPoints || 0) + '</span>　称号 <b style="color:#ffd86b">' + Game.Player.bossTitle() + '</b></div>';
    h += '<div class="ench-stat">攻撃力(手持ち) <b style="color:#ffd86b">' + eff + '</b>　防御力 <b style="color:#9fd8ff">' + Game.Player.totalArmor() + '</b>　最大HP <b style="color:#ff8a8a">' + p.maxHealth + '</b></div>';
    // ===== 装備サマリー＆派生ステータス =====
    function gearCell(label, slotObj, fallback) {
      let icon = '', name = fallback || 'なし';
      if (slotObj && slotObj.id) {
        const def = Game.ITEMS[slotObj.id];
        name = (slotObj.roll && Game.Loot.displayName) ? Game.Loot.displayName(slotObj) : (def ? def.name : slotObj.id);
        try { icon = '<img class="gs-ic" src="' + Game.Icons.dataURL(slotObj.id, slotObj.roll || null) + '" alt="">'; } catch (e) { icon = ''; }
      }
      return '<div class="gs-cell"><span class="gs-lbl">' + label + '</span><span class="gs-it">' + (icon || '<span class="gs-none">—</span>') + '<span class="gs-nm">' + name + '</span></span></div>';
    }
    const heldSlot = slot && (Game.Loot.rollable(slot.id) || (Game.ITEMS[slot.id] && Game.ITEMS[slot.id].attack != null)) ? slot : null;
    h += '<h2>装備</h2><div class="gear-summary">';
    h += gearCell('武器', heldSlot, '素手');
    h += gearCell('頭', p.armor && p.armor.head);
    h += gearCell('胴', p.armor && p.armor.chest);
    h += gearCell('遺物1', p.accessory);
    h += gearCell('遺物2', p.accessory2);
    h += '</div>';
    // 派生ステータス（%）
    const sb = Game.Player.skillBonus();
    const setb = Game.Player.setBonus();
    const critPct = Math.round(((Game.TUNE.BASE_CRIT || 0.08) + (sb.crit || 0) + (wst.crit || 0) + (setb.crit || 0)) * 100);
    const lsPct = Math.round(((sb.lifesteal || 0) + (wst.lifesteal || 0) + (setb.lifesteal || 0)) * 100);
    const spdPct = Math.round(((sb.moveSpd || 0) + (setb.moveSpd || 0)) * 100);
    const xpPct = Math.round((sb.xpBoost || 0) * 100);
    const regenV = (sb.regen || 0);
    const derived = [
      ['会心率', critPct + '%', '#ffd23a'],
      ['吸血', lsPct + '%', '#ff7a8a'],
      ['移動速度', '+' + spdPct + '%', '#7fe0a0'],
      ['HP回復', '+' + (Math.round(regenV * 10) / 10), '#9fe0b0'],
      ['経験', '+' + xpPct + '%', '#7fd0ff'],
    ];
    h += '<div class="derived-stats">';
    derived.forEach(function (d) { h += '<span class="ds-chip">' + d[0] + ' <b style="color:' + d[2] + '">' + d[1] + '</b></span>'; });
    h += '</div>';
    if (setb.name) h += '<div class="set-bonus" style="margin-top:4px;color:#caa86a;font-size:.82rem">✨ ' + setb.name + ' セット効果 発動中</div>';
    // ===== 討伐の証（ボス図鑑・恒久報酬） =====
    if (Game.MOBS) {
      const best = Game.state.bestiary || {};
      const bosses = Object.keys(Game.MOBS).filter(function (id) { return Game.MOBS[id].boss && !Game.MOBS[id].npc; });
      const nDef = Game.Player.bossesDefeated();
      h += '<h2>討伐の証 <span style="color:#ffe27a;font-size:.9rem">' + nDef + ' / ' + bosses.length + '</span><span style="color:#7a8494;font-size:.78rem">　最大HP +' + (nDef * 5) + '</span></h2>';
      h += '<div class="trophy-row">';
      bosses.forEach(function (id) {
        const got = best[id] > 0; const m = Game.MOBS[id];
        h += '<span class="trophy ' + (got ? 'got' : '') + '" title="' + (got ? m.name : '？？？') + '">' + (got ? '👑' : '🔒') + '<span class="tname">' + (got ? m.name : '？？？') + '</span></span>';
      });
      h += '</div>';
    }
    const stats = [['str', '力 STR', '攻撃 +1 / pt'], ['vit', '体 VIT', '最大HP +5 / pt'], ['dex', '技 DEX', '攻撃速度UP / pt']];
    const pendTotal = pendStat.str + pendStat.vit + pendStat.dex;
    const remain = (p.skillPoints || 0) - pendTotal; // 確定前の残りポイント
    stats.forEach(function (s) {
      const cur = (p[s[0]] || 0) + pendStat[s[0]];
      const pd = pendStat[s[0]];
      h += '<div class="stat-row"><span class="sname">' + s[1] + ' <em>' + s[2] + '</em></span>' +
        '<button class="stat-minus" data-stat="' + s[0] + '"' + (pd <= 0 ? ' disabled' : '') + '>－</button>' +
        '<span class="sval">' + cur + (pd ? ' <span style="color:#7fe0a0;font-size:.8em">(+' + pd + ')</span>' : '') + '</span>' +
        '<button class="stat-plus" data-stat="' + s[0] + '"' + (remain <= 0 ? ' disabled' : '') + '>＋</button></div>';
    });
    if (pendTotal > 0) {
      h += '<div class="stat-row" style="justify-content:flex-end;gap:8px"><span style="color:#9fb6d0;font-size:.82rem;margin-right:auto">未確定 ' + pendTotal + 'P（残 ' + remain + '）</span>' +
        '<button id="stat-cancel" class="map-btn">取消</button><button id="stat-confirm" class="map-btn" style="background:#2a6a3a;border-color:#3f9a5a">確定</button></div>';
    }
    const totalSk = Game.SKILL_TREE.length;
    const ownedSk = p.skills ? Object.keys(p.skills).filter(function (k) { return p.skills[k]; }).length : 0;
    h += '<h2>スキルツリー <span style="color:#ffe27a;font-size:.85rem">' + ownedSk + ' / ' + totalSk + '</span><span style="color:#7a8494;font-size:.74rem">　系統名をタップで開閉</span></h2>';
    // 系統ごとに折りたたみ表示(視認性)。既定は閉。習得可がある系統と展開中の系統だけ開く
    Game.SKILL_BRANCHES.forEach(function (br) {
      const nodes = Game.SKILL_TREE.filter(function (n) { return n.branch === br[0]; });
      const own = nodes.filter(function (n) { return p.skills && p.skills[n.id]; }).length;
      const canAny = nodes.some(function (n) { return Game.Player.canUnlock(n.id); });
      const open = skOpen[br[0]] != null ? skOpen[br[0]] : false;
      h += '<div class="sk-branch' + (open ? ' open' : '') + '">';
      h += '<div class="sk-branch-name" data-br="' + br[0] + '"><span>' + (open ? '▼' : '▶') + ' ' + br[1] + '</span><span class="sk-bcount">' + own + '/' + nodes.length + (canAny ? ' <em style="color:#ffd86b">●習得可</em>' : '') + '</span></div>';
      if (open) {
        h += '<div class="sk-tree">';
        for (let t = 1; t <= 5; t++) {
          h += '<div class="sk-tier"><div class="sk-tlbl">T' + t + '</div>';
          nodes.filter(function (n) { return n.tier === t; }).forEach(function (n) {
            const owned = p.skills && p.skills[n.id];
            const can = Game.Player.canUnlock(n.id);
            const cls = owned ? 'owned' : can ? 'can' : 'locked';
            h += '<button class="sk-node ' + cls + '" data-skill="' + n.id + '" title="' + n.desc + '">' +
              '<b>' + n.name + '</b><span class="sk-cost">' + (owned ? '習得済' : n.cost + 'P') + '</span><span class="sk-desc">' + n.desc + '</span></button>';
          });
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    });
    h += '<p class="hint">前提スキルを習得すると次が解放。振り直しは「記憶の書」(レア)。レベル上限 ' + (Game.MAX_LEVEL || 9999) + '。</p>';
    // 実績一覧
    if (Game.ACHIEVEMENTS && Game.Achievements) {
      h += '<h2>実績 <span style="color:#ffe27a;font-size:.9rem">' + Game.Achievements.count() + ' / ' + Game.Achievements.total() + '</span></h2><div class="ach-list">';
      for (const id in Game.ACHIEVEMENTS) {
        const a = Game.ACHIEVEMENTS[id], got = Game.Achievements.has(id);
        h += '<div class="ach-row' + (got ? ' got' : '') + '"><span class="ach-mk">' + (got ? '🏆' : '🔒') + '</span><div><b>' + a.name + '</b><br><span class="ach-d">' + a.desc + '</span></div></div>';
      }
      h += '</div>';
    }
    // 魔物図鑑
    if (Game.MOBS) {
      const best = Game.state.bestiary || {};
      const types = Object.keys(Game.MOBS).filter(function (id) { return !Game.MOBS[id].npc; });
      const found = types.filter(function (id) { return best[id]; }).length;
      h += '<h2>魔物図鑑 <span style="color:#ffe27a;font-size:.9rem">' + found + ' / ' + types.length + '</span></h2>';
      h += '<div class="ach-d" style="margin:2px 0 6px">✦ 精鋭個体 討伐数: <b style="color:#ffd86b">' + (Game.state.eliteKills || 0) + '</b>　★ チャンピオン: <b style="color:#ff8ad8">' + (Game.state.championKills || 0) + '</b></div>';
      h += '<div class="ach-list">';
      const dropNames = function (m) {
        if (!m.drops || !m.drops.length) return '';
        const seen = {}; const names = [];
        m.drops.forEach(function (d) { const it = Game.ITEMS[d.item]; const nm = it ? it.name : d.item; if (!seen[nm]) { seen[nm] = 1; names.push(nm); } });
        return names.length ? '<br><span class="ach-d" style="color:#9fd0a0">ドロップ: ' + names.join('・') + '</span>' : '';
      };
      types.forEach(function (id) {
        const m = Game.MOBS[id], got = best[id];
        const info = got ? ('<br><span class="ach-d">撃破 ' + best[id] + ' 体' + (m.boss ? '・ボス' : (m.hostile ? '' : '・非敵対')) + ' ｜ HP ' + m.hp + (m.hostile ? '・攻 ' + (m.dmg || 0) : '') + '</span>' + dropNames(m)) : '';
        h += '<div class="ach-row' + (got ? ' got' : '') + '"><span class="ach-mk">' + (got ? (m.boss ? '👑' : '☠') : '❔') + '</span><div><b>' + (got ? m.name : '？？？') + '</b>' + info + '</div></div>';
      });
      h += '</div>';
    }
    body.innerHTML = h;
    // 保留方式: +/- で未確定に積み、確定でまとめて反映(確定前は調整自由)
    body.querySelectorAll('.stat-plus').forEach(function (b) { b.addEventListener('click', function () {
      const st = b.getAttribute('data-stat');
      if (((p.skillPoints || 0) - (pendStat.str + pendStat.vit + pendStat.dex)) > 0) { pendStat[st]++; Game.Audio.play('cursor'); renderStats(); }
    }); });
    body.querySelectorAll('.stat-minus').forEach(function (b) { b.addEventListener('click', function () {
      const st = b.getAttribute('data-stat');
      if (pendStat[st] > 0) { pendStat[st]--; Game.Audio.play('cursor'); renderStats(); }
    }); });
    { const cf = document.getElementById('stat-confirm'); if (cf) cf.addEventListener('click', function () {
      let applied = false;
      ['str', 'vit', 'dex'].forEach(function (st) { for (let k = 0; k < pendStat[st]; k++) { if (Game.Player.spendStat(st)) applied = true; } pendStat[st] = 0; });
      if (applied) { Game.Audio.play('craft'); toast('スキルを確定しました'); }
      renderStats();
    }); }
    { const cc = document.getElementById('stat-cancel'); if (cc) cc.addEventListener('click', function () { pendStat.str = pendStat.vit = pendStat.dex = 0; Game.Audio.play('select'); renderStats(); }); }
    body.querySelectorAll('.sk-node[data-skill]').forEach(function (b) { b.addEventListener('click', function () { const id = b.getAttribute('data-skill'); if (Game.Player.unlockSkill(id)) renderStats(); }); });
    body.querySelectorAll('.sk-branch-name[data-br]').forEach(function (b) { b.addEventListener('click', function () { const k = b.getAttribute('data-br'); skOpen[k] = !skOpen[k]; renderStats(); }); });
  }

  // 発見済みランドマークのマーカー色
  // 種別ごとの色・形・凡例ラベル
  const LANDMARKS = {
    dungeon:  { col: '#e0644a', shape: 'diamond', label: 'ダンジョン' },
    treasure: { col: '#ffd86b', shape: 'square', label: '宝箱・野営地' },
    cosmic:   { col: '#7fc8ff', shape: 'star', label: '星の宝' },
    stela:    { col: '#b6a6f0', shape: 'pillar', label: '石碑' },
    vault:    { col: '#e3c24a', shape: 'diamondHollow', label: '共鳴遺跡' },
    boss:     { col: '#ff5a4a', shape: 'cross', label: 'ボス' },
    altar:    { col: '#ffe27a', shape: 'circle', label: '古の祭壇' },
  };
  function drawLandmark(ctx, x, y, kind) {
    const d = LANDMARKS[kind]; const col = d ? d.col : '#fff'; const shape = d ? d.shape : 'circle';
    ctx.save();
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
    const s = 5;
    if (shape === 'diamond' || shape === 'diamondHollow') {
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
      if (shape === 'diamondHollow') { ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); } else { ctx.fill(); ctx.stroke(); }
    } else if (shape === 'square') {
      ctx.fillRect(x - s + 1, y - s + 1, s * 2 - 2, s * 2 - 2); ctx.strokeRect(x - s + 1, y - s + 1, s * 2 - 2, s * 2 - 2);
    } else if (shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (shape === 'pillar') {
      ctx.fillRect(x - 2.5, y - s, 5, s * 2); ctx.strokeRect(x - 2.5, y - s, 5, s * 2);
    } else if (shape === 'cross') {
      ctx.lineWidth = 3; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  let legendBuilt = false;
  function buildLegend() {
    const el2 = document.getElementById('bigmap-legend'); if (!el2 || legendBuilt) return;
    let h = '';
    for (const k in LANDMARKS) h += '<span class="lg-item"><i style="background:' + LANDMARKS[k].col + '"></i>' + LANDMARKS[k].label + '</span>';
    el2.innerHTML = h; legendBuilt = true;
  }

  function updateBigMap() {
    if (!bmCtx || !bigMapOpen || !Game.state) return;
    const size = el.bigmap.width, span = 120; // 120タイル四方の俯瞰
    const scale = size / span;
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const half = span / 2;
    const palette = Game.state.worldName === 'shadow' ? Game.SHADOW_TILE_COLOR
      : (Game.state.worldName === 'space' && Game.SPACE_TILE_COLOR) ? Game.SPACE_TILE_COLOR : Game.TILE_COLOR;
    bmCtx.clearRect(0, 0, size, size);
    // 2タイルおきにサンプリングして負荷を抑える
    const stepT = 2;
    for (let y = 0; y < span; y += stepT) {
      for (let x = 0; x < span; x += stepT) {
        const t = Game.WorldGen.genTile(ptx - half + x, pty - half + y, Game.state.seed);
        bmCtx.fillStyle = palette[t.ground] || '#333';
        bmCtx.fillRect(x * scale, y * scale, scale * stepT + 0.6, scale * stepT + 0.6);
      }
    }
    // 発見済みランドマーク（現在世界・視野内）
    const disc = Game.state.discovered || {};
    for (const key in disc) {
      const parts = key.split(':'); if (parts[0] !== Game.state.worldName) continue;
      const kind = parts[1], rc = (parts[2] || '0,0').split(',');
      const ltx = parseInt(rc[0], 10) * 40 + 20, lty = parseInt(rc[1], 10) * 40 + 20;
      const mx = (ltx - (ptx - half)) * scale, my = (lty - (pty - half)) * scale;
      if (mx < 0 || my < 0 || mx > size || my > size) continue;
      drawLandmark(bmCtx, mx, my, kind);
    }
    // 敵/ボスドット
    const TS2 = Game.CFG.TILE_SIZE, mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i]; if (!m.def || m.def.friendly) continue;
      const mx = (Math.floor(m.x / TS2) - (ptx - half)) * scale, my = (Math.floor(m.y / TS2) - (pty - half)) * scale;
      if (mx < 0 || my < 0 || mx > size || my > size) continue;
      if (m.def.boss) { bmCtx.fillStyle = '#ff3030'; bmCtx.fillRect(mx - 3, my - 3, 6, 6); }
      else if (m.def.hostile) { bmCtx.fillStyle = '#e0404a'; bmCtx.fillRect(mx - 1.5, my - 1.5, 3, 3); }
    }
    // 仲間（MP・同一世界）
    if (Game.Net && Game.Net.isConnected()) {
      const peers = Game.Net.getPeers();
      for (const id in peers) {
        const pe = peers[id]; if (!pe || pe.world !== Game.state.worldName || pe.tx == null) continue;
        const mx = (Math.floor(pe.tx / TS2) - (ptx - half)) * scale, my = (Math.floor(pe.ty / TS2) - (pty - half)) * scale;
        if (mx < 0 || my < 0 || mx > size || my > size) continue;
        bmCtx.fillStyle = '#5fd0ff'; bmCtx.fillRect(mx - 3, my - 3, 6, 6);
      }
    }
    // プレイヤー（中央・向き）
    const c = size / 2;
    bmCtx.fillStyle = '#fff'; bmCtx.beginPath(); bmCtx.arc(c, c, 4, 0, Math.PI * 2); bmCtx.fill();
    bmCtx.strokeStyle = '#000'; bmCtx.lineWidth = 1.5; bmCtx.stroke();
    bmCtx.strokeStyle = 'rgba(180,200,240,0.5)'; bmCtx.lineWidth = 2; bmCtx.strokeRect(1, 1, size - 2, size - 2);
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

  // 装備比較の差分表示（緑▲ / 赤▼ / ±0）
  function cmpDelta(d) {
    if (d > 0) return '<span style="color:#7fe07f;font-weight:700">▲+' + d + '</span>';
    if (d < 0) return '<span style="color:#ff7a7a;font-weight:700">▼' + d + '</span>';
    return '<span style="color:#9fb0c4">±0</span>';
  }

  function slotHTML(stack) {
    if (!stack) return '';
    const def = Game.ITEMS[stack.id];
    const col = (def && def.color) || '#888';
    const cnt = stack.count > 1 ? '<span class="cnt">' + stack.count + '</span>' : '';
    let ring = '';
    if (stack.roll) ring = ';box-shadow:0 0 0 2px ' + Game.Loot.rarityColor(stack) + ',0 0 6px ' + Game.Loot.rarityColor(stack);
    const title = stack.roll ? Game.Loot.displayName(stack) : (def ? def.name : stack.id);
    // canvas手続きアイコン（クラス別シェイプ×色）。失敗時は色/絵文字にフォールバック
    const url = Game.Icons && Game.Icons.dataURL(stack.id, stack.roll);
    if (url) return '<span class="icon img" style="background-image:url(' + url + ')' + ring + '" title="' + title + '" data-tip="' + stack.id + '"></span>' + cnt;
    const glyph = Game.ITEM_GLYPH[stack.id];
    if (glyph) return '<span class="icon glyph" style="background:transparent' + ring + '" data-tip="' + stack.id + '">' + glyph + '</span>' + cnt;
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
    // 装備比較（武器=手持ち比 / 防具=装備中比）
    if (Game.Player.currentWeaponAtk) {
      if (def.attack != null) { const eff = Game.Player.effAttack(Game.Loot.stats(stack).atk); html += '<div class="tt-stat">攻撃 ' + eff + ' ' + cmpDelta(eff - Game.Player.currentWeaponAtk()) + '</div>'; }
      else if (def.armor != null) { const av = Game.Loot.stats(stack).armor; html += '<div class="tt-stat">防御 ' + av + ' ' + cmpDelta(av - Game.Player.equippedArmorAt(def.slot)) + '</div>'; }
    }
    if (!Game.Loot.rollable(stack.id)) {
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
  // タッチ環境では mouseleave が発火せずツールチップが残るため、画面タッチで強制的に消す
  if (typeof document !== 'undefined') {
    document.addEventListener('touchstart', function () { hideTip(); }, { passive: true });
  }

  function refreshHotbar() {
    if (!el.hotbar || !Game.state) return;
    const s = Game.Inventory.slots();
    const slots = el.hotbar.children;
    for (let i = 0; i < slots.length; i++) {
      slots[i].innerHTML = slotHTML(s[i]);
      slots[i].classList.toggle('selected', i === Game.state.player.hotbarIndex);
    }
    setupTooltip(el.hotbar);
    refreshAmmo();
  }

  // 銃の弾薬HUD: 選択中の銃の「装填 / 予備」と弾種、リロード状態を表示
  let ammoEl = null;
  function refreshAmmo() {
    const p = Game.state && Game.state.player; if (!p) return;
    const sel = Game.Inventory.selectedItemDef();
    if (!ammoEl) {
      ammoEl = document.getElementById('ammo-hud');
      if (!ammoEl) {
        ammoEl = document.createElement('div'); ammoEl.id = 'ammo-hud';
        ammoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:74px;z-index:55;background:rgba(16,24,42,.82);border:1px solid #33455e;border-radius:9px;padding:4px 11px;font-size:.82rem;color:#e8edf2;pointer-events:none;display:none;white-space:nowrap';
        (document.getElementById('app') || document.body).appendChild(ammoEl);
      }
    }
    // オーバーレイ(インベントリ/チェスト等)表示中・ポーズ中は隠す
    const overlayOpen = (el.invScreen && !el.invScreen.classList.contains('hidden')) || (el.chestScreen && !el.chestScreen.classList.contains('hidden')) || Game.state.paused;
    if (!sel || sel.tool !== 'gun' || overlayOpen) { ammoEl.style.display = 'none'; return; }
    const ammoName = Game.ITEMS[sel.ammo] ? Game.ITEMS[sel.ammo].name : sel.ammo;
    const reserve = Game.Inventory.count(sel.ammo);
    ammoEl.style.display = 'block';
    if (p.reloadCd > 0) {
      const prog = p.reloadMax ? Math.max(0, Math.min(1, 1 - p.reloadCd / p.reloadMax)) : 0;
      ammoEl.innerHTML = '🔄 <b style="color:#ffd86b">リロード中</b> <span style="display:inline-block;vertical-align:middle;width:80px;height:7px;background:#22304a;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:' + Math.round(prog * 100) + '%;background:linear-gradient(90deg,#ffb84a,#ffe06a)"></span></span> <span style="color:#9fb6d0">' + ammoName + ' 予備' + reserve + '</span>';
    } else {
      const loaded = Game.Player.magLoaded(sel), cap = Game.Player.magCap(sel);
      const col = loaded === 0 ? '#e0664a' : (loaded <= cap * 0.25 ? '#e0a84a' : '#7fe0a0');
      ammoEl.innerHTML = '🔫 <span style="color:#9fb6d0">' + ammoName + '</span>　装填 <b style="color:' + col + '">' + loaded + '</b><span style="color:#5a6b80">/' + cap + '</span>　予備 <b>' + reserve + '</b>' + (loaded === 0 && reserve === 0 ? ' <span style="color:#e0664a">弾切れ</span>' : '');
    }
  }

  function refreshStats() {
    if (!el.health || !Game.state) return;
    const p = Game.state.player;
    el.health.style.width = (p.health / p.maxHealth * 100) + '%';
    el.hunger.style.width = (p.hunger / p.maxHunger * 100) + '%';
    if (el.healthVal) el.healthVal.textContent = Math.ceil(p.health) + '/' + p.maxHealth;
    if (el.hungerVal) el.hungerVal.textContent = Math.ceil(p.hunger) + '/' + p.maxHunger;
    if (el.staminaVal) el.staminaVal.textContent = Math.ceil(p.stamina) + '/' + p.maxStamina;
    if (el.sanityVal) el.sanityVal.textContent = Math.ceil(Game.state.sanity) + '/' + Game.TUNE.SANITY_MAX;
    el.clock.textContent = Game.DayNight.clockText();
    if (el.level) {
      el.level.textContent = p.level;
      el.armor.textContent = Game.Player.totalArmor();
      if (el.bts) el.bts.textContent = p.bts || 0;
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
    if (opening) renderOptions();
  }

  // マイクラ風 設定一覧（音量/明るさ/ボタン/操作）
  let optHelpOpen = false;
  function renderOptions() {
    const c = document.getElementById('opt-settings'); if (!c || !Game.Settings) return;
    const S = Game.Settings;
    const slider = function (key, label, min, max) {
      return '<div class="opt-row"><label>' + label + ' <span class="opt-val" id="ov-' + key + '">' + S.get(key) + '%</span></label>' +
        '<input type="range" class="opt-slider" data-k="' + key + '" min="' + min + '" max="' + max + '" value="' + S.get(key) + '"></div>';
    };
    const toggle = function (key, label) {
      return '<div class="opt-row tg"><label>' + label + '</label><button class="opt-toggle ' + (S.get(key) ? 'on' : '') + '" data-k="' + key + '">' + (S.get(key) ? 'ON' : 'OFF') + '</button></div>';
    };
    c.innerHTML =
      slider('bgmVol', '🎵 BGM音量', 0, 100) +
      slider('sfxVol', '🔊 効果音量', 0, 100) +
      slider('brightness', '🔆 明るさ', 40, 100) +
      slider('btnSize', '📐 ボタンサイズ', 70, 140) +
      slider('btnOpacity', '👁 ボタン透明度', 30, 100) +
      slider('joySens', '🕹 スティック感度', 60, 160) +
      toggle('leftHanded', '✋ 左利き(操作左右反転)') +
      toggle('dmgNumbers', '🔢 ダメージ数値表示') +
      toggle('screenShake', '📳 画面のゆれ') +
      toggle('lowHpWarn', '🩸 低HP警告') +
      toggle('ambient', '🌿 環境演出') +
      toggle('homeCompass', '🧭 帰路コンパス') +
      toggle('showFps', '📈 FPS表示') +
      '<div class="opt-row"><button id="opt-story" class="map-btn" style="width:100%">📖 記憶回廊（物語）を開く</button></div>' +
      // ===== 操作キー設定(リバインド) =====
      (Game.Input && Game.Input.BIND_ACTIONS ?
        '<div class="opt-keybinds"><div class="opt-kb-head">⌨ 操作キー設定 <button id="kb-reset" class="map-btn">初期化</button></div>' +
        Game.Input.BIND_ACTIONS.map(function (a) {
          return '<div class="opt-row tg"><label>' + a[1] + '</label><button class="kb-btn" data-act="' + a[0] + '">' + Game.Input.keyLabel(Game.Input.bindAt(a[0])) + '</button></div>';
        }).join('') + '<div class="hk" style="opacity:.7">変更したい操作を押し、割り当てたいキーを入力（Escで取消）</div></div>'
        : '') +
      // ===== コントローラのボタン設定(リバインド) =====
      (Game.Input && Game.Input.PAD_ACTIONS ?
        '<div class="opt-keybinds"><div class="opt-kb-head">🎮 コントローラ設定 <button id="pad-reset" class="map-btn">初期化</button></div>' +
        Game.Input.PAD_ACTIONS.map(function (a) {
          return '<div class="opt-row tg"><label>' + a[1] + '</label><button class="pad-btn" data-pad="' + a[0] + '">' + Game.Input.padLabel(a[0]) + '</button></div>';
        }).join('') + '<div class="hk" style="opacity:.7">変更したい操作を押し、割り当てたいパッドのボタンを押す（移動=左スティック/照準=右スティックは固定）</div></div>'
        : '') +
      // ===== 操作ヘルプ(折りたたみ) =====
      '<div class="opt-help"><div class="opt-help-head" id="opt-help-head">' + (optHelpOpen ? '▼' : '▶') + ' ❔ 操作ヘルプ</div>' +
      (optHelpOpen ? '<div class="opt-help-body">' +
        '<div class="hk"><b>スマホ</b>: 画面左をなぞって移動／右下ボタンで 採掘・設置・開く・回避・走る・影渡り・袋。ミニマップで大マップ</div>' +
        '<div class="hk"><b>移動</b> WASD / 矢印</div>' +
        '<div class="hk"><b>採掘・攻撃</b> 左クリック / スペース</div>' +
        '<div class="hk"><b>設置</b> 右クリック / Q・K</div>' +
        '<div class="hk"><b>開く・対話・使う</b> G（近くのチェスト/掲示板/石碑）</div>' +
        '<div class="hk"><b>回避ロール</b> R（無敵・スタミナ消費）</div>' +
        '<div class="hk"><b>走る</b> Shift（スタミナ消費）</div>' +
        '<div class="hk"><b>影渡り</b> F（影鏡が必要）</div>' +
        '<div class="hk"><b>インベントリ</b> E　<b>ステ/スキル</b> C　<b>大マップ</b> N/Tab</div>' +
        '<div class="hk"><b>ホットバー</b> 1-9　<b>サウンド</b> M　<b>設定</b> P/Esc</div>' +
        '</div>' : '') + '</div>';
    c.querySelectorAll('.opt-slider').forEach(function (sl) {
      sl.addEventListener('input', function () {
        const k = this.dataset.k, v = parseInt(this.value, 10);
        S.set(k, v); const lab = document.getElementById('ov-' + k); if (lab) lab.textContent = v + '%';
      });
    });
    c.querySelectorAll('.opt-toggle').forEach(function (tg) {
      tg.addEventListener('click', function () {
        const k = this.dataset.k, v = !S.get(k); S.set(k, v);
        this.classList.toggle('on', v); this.textContent = v ? 'ON' : 'OFF';
      });
    });
    c.querySelectorAll('.kb-btn[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!Game.Input || !Game.Input.beginRebind) return;
        c.querySelectorAll('.kb-btn').forEach(function (o) { o.classList.remove('listening'); });
        btn.classList.add('listening'); btn.textContent = '…入力';
        Game.Input.beginRebind(btn.getAttribute('data-act'), function () { renderOptions(); });
      });
    });
    const kbr = document.getElementById('kb-reset');
    if (kbr) kbr.addEventListener('click', function () { if (Game.Input && Game.Input.resetBinds) { Game.Input.resetBinds(); renderOptions(); } });
    c.querySelectorAll('.pad-btn[data-pad]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!Game.Input || !Game.Input.beginPadRebind) return;
        c.querySelectorAll('.pad-btn').forEach(function (o) { o.classList.remove('listening'); });
        btn.classList.add('listening'); btn.textContent = '…ボタンを押す';
        Game.Input.beginPadRebind(btn.getAttribute('data-pad'), function () { renderOptions(); });
      });
    });
    const padr = document.getElementById('pad-reset');
    if (padr) padr.addEventListener('click', function () { if (Game.Input && Game.Input.resetPadBinds) { Game.Input.resetPadBinds(); renderOptions(); } });
    const ostry = document.getElementById('opt-story');
    if (ostry) ostry.addEventListener('click', function () { toggleOptions(); openStory(); });
    const hh = document.getElementById('opt-help-head');
    if (hh) hh.addEventListener('click', function () { optHelpOpen = !optHelpOpen; renderOptions(); });
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
      d.dataset.index = i;
      d.innerHTML = slotHTML(s[i]);
      if (s[i]) {
        d.title = Game.ITEMS[s[i].id] ? Game.ITEMS[s[i].id].name : s[i].id;
        if (i === invSelected) d.classList.add('selected');
      }
      d.addEventListener('pointerdown', (function (idx) { return function (e) { invPointerDown(e, idx); }; })(i));
      el.invGrid.appendChild(d);
    }
    setupTooltip(el.invGrid);
    renderEquipPanel();
    renderInvQuest();
    renderInvDetail();
    refreshCraft();
  }

  // 装備欄(5スロット): 武器(手持ち表示)/頭/胴/遺物1/遺物2。タップで解除(武器以外)
  function renderEquipPanel() {
    const ep = document.getElementById('equip-panel'); if (!ep || !Game.state) return;
    const p = Game.state.player;
    const held = Game.Inventory.selectedSlot();
    const heldW = held && (Game.Loot.rollable(held.id) || (Game.ITEMS[held.id] && Game.ITEMS[held.id].attack != null)) ? held : null;
    const cells = [
      { key: 'weapon', label: '武器', item: heldW, ro: true },
      { key: 'head', label: '頭', item: p.armor && p.armor.head },
      { key: 'chest', label: '胴', item: p.armor && p.armor.chest },
      { key: 'accessory', label: '遺物1', item: p.accessory },
      { key: 'accessory2', label: '遺物2', item: p.accessory2 },
    ];
    let h = '';
    cells.forEach(function (c) {
      let inner = '<span class="eq-none">—</span>', nm = '空き';
      if (c.item && c.item.id) {
        const def = Game.ITEMS[c.item.id];
        nm = (c.item.roll && Game.Loot.displayName) ? Game.Loot.displayName(c.item) : (def ? def.name : c.item.id);
        try { inner = '<img class="eq-ic" src="' + Game.Icons.dataURL(c.item.id, c.item.roll || null) + '" alt="">'; } catch (e) {}
      }
      h += '<div class="eq-cell' + (c.item ? ' filled' : '') + (c.ro ? ' ro' : '') + '" data-key="' + c.key + '"><span class="eq-lbl">' + c.label + '</span>' + inner + '<span class="eq-nm">' + nm + '</span></div>';
    });
    ep.innerHTML = h;
    const list = ep.querySelectorAll('.eq-cell');
    for (let i = 0; i < list.length; i++) {
      const key = list[i].getAttribute('data-key');
      if (key === 'weapon') continue; // 武器枠は表示のみ
      list[i].addEventListener('click', function () { if (Game.Player.unequipSlot(key)) refreshInventory(); });
    }
  }

  // インベントリで現在の目標を表示
  function renderInvQuest() {
    const q = document.getElementById('inv-quest'); if (!q || !Game.Quests) return;
    const cur = Game.Quests.current();
    q.textContent = cur ? ('🎯 目標: ' + cur.name + ' — ' + cur.desc) : '🎯 すべての目標を達成した';
  }

  // ===== ドラッグ移動＋スワップ（タップ=選択 / スワイプ=移動）=====
  let dragSrc = -1, dragging = false, dragGhost = null, dragStart = null;
  function invPointerDown(e, idx) {
    dragSrc = idx; dragging = false; dragStart = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', invPointerMove);
    window.addEventListener('pointerup', invPointerUp);
  }
  function invPointerMove(e) {
    if (dragSrc < 0) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) < 9) return;
      const st = Game.Inventory.slots()[dragSrc]; if (!st) return; // 空スロットはドラッグ不可
      dragging = true; dragGhost = document.createElement('div'); dragGhost.className = 'drag-ghost'; dragGhost.innerHTML = slotHTML(st); document.body.appendChild(dragGhost);
    }
    if (dragGhost) { dragGhost.style.left = e.clientX + 'px'; dragGhost.style.top = e.clientY + 'px'; }
  }
  function invPointerUp(e) {
    window.removeEventListener('pointermove', invPointerMove);
    window.removeEventListener('pointerup', invPointerUp);
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    const src = dragSrc; dragSrc = -1;
    if (!dragging) { invSelected = src; if (Game.Inventory.slots()[src]) Game.Audio.play('cursor'); refreshInventory(); return; } // タップ=選択
    dragging = false;
    const tgt = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = tgt && tgt.closest && tgt.closest('.slot');
    const s = Game.Inventory.slots();
    if (slotEl && slotEl.dataset.index != null && el.invGrid.contains(slotEl)) {
      const dst = parseInt(slotEl.dataset.index, 10);
      if (dst !== src) { const tmp = s[dst]; s[dst] = s[src]; s[src] = tmp; Game.Audio.play('select'); } // 占有先はスワップ
    }
    invSelected = -1; refreshInventory();
  }

  // 選択中アイテムの詳細＋操作（誤使用防止: 確認ボタン式）
  function renderInvDetail() {
    if (!el.invDetail) return;
    const st = Game.Inventory.slots()[invSelected];
    if (!st) { el.invDetail.innerHTML = '<p class="hint">アイテムをタップで選択</p>'; return; }
    const def = Game.ITEMS[st.id];
    let h = '<div class="ench-name" style="color:' + (st.roll ? Game.Loot.rarityColor(st) : (def.color || '#fff')) + '">' + (st.roll ? Game.Loot.displayName(st) : def.name) + '</div>';
    if (Game.Loot.rollable(st.id)) h += '<div class="ench-stat">' + Game.Loot.statText(st) + '</div>';
    if (def.attack != null) {
      const eff = Game.Player.effAttack(Game.Loot.stats(st).atk);
      h += '<div class="ench-stat">' + (def.aoe ? '🌀 範囲攻撃' : '🗡 単体攻撃') + '　実効攻撃力 <b style="color:#ffd86b">' + eff + '</b> ' + cmpDelta(eff - Game.Player.currentWeaponAtk()) + '<span style="color:#7a8494;font-size:.78rem">（手持ち比）</span></div>';
    }
    if (def.armor != null) { const av = Game.Loot.stats(st).armor; h += '<div class="ench-stat">🛡 防御 <b style="color:#9fd8ff">' + av + '</b> ' + cmpDelta(av - Game.Player.equippedArmorAt(def.slot)) + '<span style="color:#7a8494;font-size:.78rem">（装備中比）</span></div>'; }
    if (def.relic) {
      const RL = { atk: '攻撃', armor: '防御', hp: '最大HP', crit: '会心率', moveSpd: '移動速度', lifesteal: '吸血', regen: 'HP回復', xpBoost: '経験', staminaMax: 'スタミナ' };
      const parts = [];
      for (const k in def.relic) { const v = def.relic[k]; const pct = (k === 'crit' || k === 'moveSpd' || k === 'lifesteal' || k === 'xpBoost'); parts.push((RL[k] || k) + ' +' + (pct ? Math.round(v * 100) + '%' : v)); }
      h += '<div class="ench-stat">💠 遺物効果 <b style="color:#ffd86b">' + parts.join('・') + '</b></div>';
      const eq = Game.state.player.accessory; if (eq) { const ed = Game.ITEMS[eq.id || eq]; if (ed) h += '<div class="tt-flavor" style="color:#7a8494">装備中: ' + ed.name + '（入替）</div>'; }
    }
    // 銃: 必要弾・装弾数・使い方を明示
    if (def.tool === 'gun') {
      const an = Game.ITEMS[def.ammo] ? Game.ITEMS[def.ammo].name : def.ammo;
      const reserve = Game.Inventory.count(def.ammo);
      h += '<div class="ench-stat">🔫 必要な弾: <b style="color:#ffd86b">' + an + '</b>（所持 ' + reserve + '）</div>';
      h += '<div class="ench-stat">🧮 装弾数: <b style="color:#9fd8ff">' + (def.mag || 12) + '</b>発　·　弾を撃ち切ると<b>自動リロード</b></div>';
      h += '<div class="tt-flavor" style="color:#9fb6d0">▶ ホットバーに置いて攻撃ボタン/画面タップで発射。弾が無いと撃てません</div>';
    }
    // 投擲(爆弾・火炎瓶など): 使い方を明示
    if (def.throw) {
      h += '<div class="ench-stat">💥 投擲武器（' + (def.throw.explosive ? '範囲ダメージ' : 'ダメージ') + ' ' + def.throw.dmg + '）</div>';
      h += '<div class="tt-flavor" style="color:#9fb6d0">▶ ホットバーに置いて選択し、攻撃ボタン/画面タップで投げる。向いている方向へ飛びます</div>';
    }
    if (def.flavor) h += '<div class="tt-flavor" style="margin-bottom:6px">' + def.flavor + '</div>';
    const btns = [];
    if (def.armor && def.slot) btns.push('<button id="inv-act" class="big-btn">装備する</button>');
    else if (def.relic) btns.push('<button id="inv-act" class="big-btn">遺物を装備</button>');
    else if (def.food || def.cures || def.buff || def.skillTome || def.xpGain || def.invExpand || def.summonBoss || def.opensShop) btns.push('<button id="inv-act" class="big-btn">' + (def.food ? '食べる' : def.skillTome ? '読む' : def.summonBoss ? '掲げる' : def.opensShop ? '鳴らす' : '使う') + '</button>');
    else if (Game.Loot.rollable(st.id) || def.tool || def.throw) btns.push('<button id="inv-hot" class="big-btn alt">ホットバーへ装備</button>');
    if (Game.Net && Game.Net.isConnected()) btns.push('<button id="inv-give" class="big-btn alt">仲間に渡す</button>');
    btns.push('<button id="inv-drop" class="big-btn inv-discard">捨てる' + (st.count > 1 ? '（1個）' : '') + '</button>');
    el.invDetail.innerHTML = h + btns.join('');
    const give = document.getElementById('inv-give');
    if (give) give.addEventListener('click', function () {
      const cur = Game.Inventory.slots()[invSelected]; if (!cur) return;
      const one = { id: cur.id, count: 1, roll: cur.roll || null };
      if (Game.Net.giveItem(one)) { cur.count--; if (cur.count <= 0) { Game.Inventory.slots()[invSelected] = null; invSelected = -1; } refreshInventory(); }
    });
    const drop = document.getElementById('inv-drop');
    if (drop) drop.addEventListener('click', function () {
      const cur = Game.Inventory.slots()[invSelected]; if (!cur) return;
      cur.count--; if (cur.count <= 0) Game.Inventory.slots()[invSelected] = null;
      Game.Audio.play('select'); toast('捨てた: ' + (Game.ITEMS[cur.id] ? Game.ITEMS[cur.id].name : cur.id));
      if (!Game.Inventory.slots()[invSelected]) invSelected = -1;
      refreshInventory();
    });
    const act = document.getElementById('inv-act');
    if (act) act.addEventListener('click', function () {
      const cur = Game.Inventory.slots()[invSelected]; if (!cur) return;
      const d2 = Game.ITEMS[cur.id];
      if (d2.armor) Game.Player.equipFromInventory(invSelected);
      else if (d2.relic) Game.Player.equipRelic(invSelected);
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

  // クラフトをカテゴリ分類（ユーザビリティ向上）
  function craftCategory(out) {
    if (!out) return 'material';
    if (out.attack != null || out.fireDmg != null || out.tool === 'staff' || out.tool === 'warp') return 'weapon';
    if (out.armor != null) return 'armor';
    if (out.tool === 'pickaxe' || out.tool === 'axe' || out.tool === 'hoe' || out.tool === 'gun') return 'tool';
    if (out.food != null || out.cures || out.heal != null) return 'life';
    if (out.place != null || out.vehicle) return 'build';
    return 'material';
  }
  const CRAFT_CATS = [['weapon', '⚔ 武器・魔法'], ['armor', '🛡 防具'], ['tool', '⛏ 道具'], ['build', '🏠 設置・建築・乗物'], ['life', '🍖 生活・回復'], ['material', '🧱 素材・その他']];
  let craftCatFilter = 'all';
  let craftSearch = '';
  let craftCanOnly = false;
  let craftPage = 0;
  const CRAFT_PAGE_SIZE = 12; // 1ページの行数(横ページ送り)

  // デバッグコマンド: 任意の敵召喚・アイテム付与など
  let cheatUnlocked = false;
  function runCheat(raw) {
    const s = (raw || '').trim(); if (!s) return;
    const parts = s.split(/\s+/); const cmd = parts[0].toLowerCase();
    if (cmd === 'haruking') { cheatUnlocked = true; const panel = document.getElementById('cheat-panel'); if (panel) { buildCheatPanel(panel); panel.classList.remove('hidden'); } toast('チート解放: give/spawn/bts/xp/heal'); return; }
    if (!cheatUnlocked) { toast('まず haruking と入力して解放'); return; }
    const p = Game.state.player;
    if (cmd === 'give') {
      const id = parts[1]; const n = Math.max(1, parseInt(parts[2] || '1', 10) || 1);
      if (!id || !Game.ITEMS[id]) { toast('不明なアイテム: ' + id); return; }
      const d = Game.ITEMS[id];
      if ((d.attack != null || (d.armor != null && d.slot)) && Game.Loot) { for (let k = 0; k < n; k++) Game.Inventory.addInstance({ id: id, roll: Game.Loot.roll(id, 0.4) }); }
      else Game.Inventory.add(id, n);
      toast('付与: ' + d.name + ' ×' + n); refreshAll();
    } else if (cmd === 'spawn') {
      const t = parts[1]; const n = Math.min(30, Math.max(1, parseInt(parts[2] || '1', 10) || 1));
      if (!t || !Game.MOBS[t]) { toast('不明な敵: ' + t); return; }
      for (let k = 0; k < n; k++) Game.Mobs.spawnMob(t, p.x + (Math.random() - 0.5) * 140 + 50, p.y + (Math.random() - 0.5) * 140);
      toast('召喚: ' + (Game.MOBS[t].name || t) + ' ×' + n);
    } else if (cmd === 'bts') { const n = parseInt(parts[1] || '0', 10) || 0; p.bts = Math.max(0, (p.bts || 0) + n); toast('bts ' + (n >= 0 ? '+' : '') + n + ' → ' + p.bts); refreshStats(); }
    else if (cmd === 'xp') { Game.Player.gainXP(Math.max(0, parseInt(parts[1] || '0', 10) || 0)); refreshAll(); toast('XP付与'); }
    else if (cmd === 'heal') { p.health = p.maxHealth; p.hunger = p.maxHunger; if (Game.state.sanity != null && Game.TUNE) Game.state.sanity = Game.TUNE.SANITY_MAX; if (Game.Status) Game.Status.clearAll(); refreshAll(); toast('全回復'); }
    else if (cmd === 'allstory' || cmd === 'story') { if (Game.Story && Game.Story.unlockAll) { Game.Story.unlockAll(); toast('記憶回廊を全解除しました（' + Game.Story.total() + '章）'); } }
    else if (cmd === 'help') { toast('give<id>[n] / spawn<type>[n] / bts<n> / xp<n> / heal / allstory'); }
    else { toast('不明: ' + cmd + '（help）'); }
  }

  // チートパネル: 全アイテムをタップで付与
  let cheatBuilt = false;
  function buildCheatPanel(panel) {
    if (!panel || cheatBuilt) return; cheatBuilt = true;
    let h = '<button id="cheat-allstory" class="big-btn alt" style="width:100%;margin:2px 0 8px">📖 記憶回廊を全解除</button>';
    h += '<p class="hint">▼ アイテム：タップで付与（装備はランダムaffix付き／素材は10個）</p><div class="grid" id="cheat-grid"></div>';
    h += '<p class="hint">▼ 敵：タップでプレイヤー付近に召喚</p><div class="grid" id="cheat-mobgrid"></div>';
    panel.innerHTML = h;
    // 記憶回廊 全解除
    const asBtn = document.getElementById('cheat-allstory');
    if (asBtn) asBtn.addEventListener('click', function () { if (Game.Story && Game.Story.unlockAll) { Game.Story.unlockAll(); toast('記憶回廊を全解除しました（' + Game.Story.total() + '章）'); } });
    // 全アイテム
    const grid = document.getElementById('cheat-grid');
    for (const id in Game.ITEMS) {
      const def = Game.ITEMS[id];
      const cell = document.createElement('div'); cell.className = 'slot';
      cell.innerHTML = slotHTML({ id: id, count: 1 });
      cell.title = def.name;
      cell.addEventListener('click', function () {
        if (Game.Loot.rollable(id)) { Game.Inventory.addInstance({ id: id, roll: Game.Loot.roll(id, 0.2) }); }
        else { Game.Inventory.add(id, (def.stack && def.stack > 1) ? 10 : 1); }
        toast('付与: ' + def.name); refreshInventory();
      });
      grid.appendChild(cell);
    }
    // 全敵（ボスは赤、敵は橙、生物は緑のラベル）
    const mg = document.getElementById('cheat-mobgrid');
    for (const type in Game.MOBS) {
      const def = Game.MOBS[type];
      const col = def.boss ? '#e0504a' : (def.hostile ? '#d8923c' : '#5fa85f');
      const cell = document.createElement('div'); cell.className = 'slot mob-cheat';
      cell.style.cssText = 'display:flex;align-items:center;justify-content:center;text-align:center;font-size:.62rem;line-height:1.05;padding:3px;border-color:' + col + ';color:' + col;
      cell.textContent = (def.boss ? '★' : '') + (def.name || type);
      cell.title = type + (def.boss ? ' (ボス)' : def.hostile ? ' (敵)' : ' (生物)');
      cell.addEventListener('click', function () {
        const p = Game.state.player;
        Game.Mobs.spawnMob(type, p.x + (Math.random() - 0.5) * 120 + 60, p.y + (Math.random() - 0.5) * 120);
        toast('召喚: ' + (def.name || type));
      });
      mg.appendChild(cell);
    }
  }

  function refreshCraft() {
    el.craftList.innerHTML = '';
    let list = Game.Crafting.availableList();
    // 検索＋「作成可能のみ」ツール
    const tools = document.createElement('div'); tools.className = 'craft-tools';
    const search = document.createElement('input'); search.type = 'text'; search.className = 'craft-search'; search.placeholder = '🔍 レシピ検索…'; search.value = craftSearch;
    search.addEventListener('input', function () { craftSearch = search.value; craftPage = 0; refreshCraftRows(); });
    const onlyBtn = document.createElement('button'); onlyBtn.className = 'craft-only' + (craftCanOnly ? ' on' : ''); onlyBtn.textContent = '作成可能のみ';
    onlyBtn.addEventListener('click', function () { craftCanOnly = !craftCanOnly; craftPage = 0; refreshCraft(); });
    tools.appendChild(search); tools.appendChild(onlyBtn);
    el.craftList.appendChild(tools);
    // タブ
    const tabs = document.createElement('div'); tabs.className = 'craft-tabs';
    const mkTab = function (key, label) {
      const t = document.createElement('button'); t.className = 'craft-tab' + (craftCatFilter === key ? ' on' : ''); t.textContent = label;
      t.addEventListener('click', function () { craftCatFilter = key; craftPage = 0; Game.Audio.play('tab'); refreshCraft(); }); return t;
    };
    tabs.appendChild(mkTab('all', 'すべて'));
    CRAFT_CATS.forEach(function (c) { tabs.appendChild(mkTab(c[0], c[1].replace(/ .*/, ''))); });
    el.craftList.appendChild(tabs);
    const rowsBox = document.createElement('div'); rowsBox.id = 'craft-rows'; el.craftList.appendChild(rowsBox);
    refreshCraftRows();
  }

  // クラフト行のみ再描画(検索で入力フォーカスを保つ)
  function refreshCraftRows() {
    const box = document.getElementById('craft-rows'); if (!box) return;
    box.innerHTML = '';
    const q = craftSearch.trim();
    let list = Game.Crafting.availableList();
    if (craftCanOnly) list = list.filter(function (e) { return e.can; });
    if (q) list = list.filter(function (e) { const o = Game.ITEMS[e.recipe.out.id]; return o && o.name.indexOf(q) >= 0; });
    // カテゴリ順に平坦化（作成可能を上に）。各行に所属カテゴリラベルを保持
    const flat = [];
    CRAFT_CATS.forEach(function (cat) {
      if (craftCatFilter !== 'all' && craftCatFilter !== cat[0]) return;
      const rows = list.filter(function (e) { return craftCategory(Game.ITEMS[e.recipe.out.id]) === cat[0]; });
      if (!rows.length) return;
      rows.sort(function (a, b) { return (b.can ? 1 : 0) - (a.can ? 1 : 0); });
      rows.forEach(function (entry) { flat.push({ entry: entry, cat: cat[1] }); });
    });
    if (!flat.length) { const e = document.createElement('div'); e.className = 'craft-cat-head'; e.textContent = '該当するレシピが無い'; box.appendChild(e); return; }
    // ページング（横タップ/スワイプで遷移）
    const pages = Math.max(1, Math.ceil(flat.length / CRAFT_PAGE_SIZE));
    if (craftPage >= pages) craftPage = pages - 1;
    if (craftPage < 0) craftPage = 0;
    const start = craftPage * CRAFT_PAGE_SIZE;
    const slice = flat.slice(start, start + CRAFT_PAGE_SIZE);
    let lastCat = null;
    slice.forEach(function (item) {
      if (item.cat !== lastCat) { lastCat = item.cat; const head = document.createElement('div'); head.className = 'craft-cat-head'; head.textContent = item.cat; box.appendChild(head); }
      const entry = item.entry, r = entry.recipe, out = Game.ITEMS[r.out.id];
      const row = document.createElement('div');
      row.className = 'craft-row' + (entry.can ? '' : ' disabled');
      let ing = '';
      for (const id in r.in) ing += (Game.ITEMS[id] ? Game.ITEMS[id].name : id) + '×' + r.in[id] + ' ';
      const station = r.station ? ' <em>(' + (r.station === 'furnace' ? 'かまど' : r.station === 'campfire' ? '焚き火' : r.station === 'enchant_table' ? 'エンチャント台' : '作業台') + ')</em>' : '';
      const iurl = Game.Icons && Game.Icons.dataURL(r.out.id, null);
      row.innerHTML = (iurl ? '<span class="ci img" style="background-image:url(' + iurl + ')"></span>' : '<span class="ci" style="background:' + (out.color || '#888') + '"></span>') +
        '<span class="cn">' + out.name + (r.out.n > 1 ? '×' + r.out.n : '') + station + '</span>' +
        '<span class="cin">' + ing + '</span>';
      row.addEventListener('click', function () { if (Game.Crafting.craft(r)) refreshInventory(); });
      box.appendChild(row);
    });
    // ページャ（◀ ページ X/Y ▶）
    if (pages > 1) {
      const pager = document.createElement('div'); pager.className = 'craft-pager';
      pager.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:14px;padding:8px 4px 2px;user-select:none';
      const prev = document.createElement('button'); prev.className = 'craft-page-btn'; prev.textContent = '◀'; prev.disabled = craftPage === 0;
      const lab = document.createElement('span'); lab.style.cssText = 'font-size:.86rem;color:#cbd6e6;min-width:84px;text-align:center'; lab.textContent = 'ページ ' + (craftPage + 1) + ' / ' + pages;
      const next = document.createElement('button'); next.className = 'craft-page-btn'; next.textContent = '▶'; next.disabled = craftPage >= pages - 1;
      const mkStyle = function (btn) { btn.style.cssText = 'min-width:48px;min-height:38px;font-size:1.1rem;border-radius:8px;border:1px solid #33455e;background:' + (btn.disabled ? '#1a2436' : '#22304a') + ';color:' + (btn.disabled ? '#4a5a70' : '#e8edf2') + ';'; };
      mkStyle(prev); mkStyle(next);
      prev.addEventListener('click', function () { if (craftPage > 0) { craftPage--; Game.Audio.play('cursor'); refreshCraftRows(); } });
      next.addEventListener('click', function () { if (craftPage < pages - 1) { craftPage++; Game.Audio.play('cursor'); refreshCraftRows(); } });
      pager.appendChild(prev); pager.appendChild(lab); pager.appendChild(next);
      box.appendChild(pager);
    }
    // 横スワイプでページ遷移（スマホ最優先）
    bindCraftSwipe(box, pages);
  }

  // クラフト一覧の横スワイプ（左で次ページ・右で前ページ）
  function bindCraftSwipe(box, pages) {
    if (box._swipeBound) return; box._swipeBound = true;
    let sx = 0, sy = 0, tracking = false;
    box.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (!tracking) return; tracking = false;
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0 && craftPage < pages - 1) { craftPage++; refreshCraftRows(); }
        else if (dx > 0 && craftPage > 0) { craftPage--; refreshCraftRows(); }
      }
    }, { passive: true });
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
    showChestInfo(null);
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
      cell.addEventListener('click', function () { if (st) showChestInfo(st); chestToInv(i); });
      el.chestGrid.appendChild(cell);
    });
    el.chestInvGrid.innerHTML = '';
    inv.forEach(function (st, i) {
      const cell = document.createElement('div');
      cell.className = 'slot' + (chestMulti && chestSel[i] ? ' multi-sel' : ''); cell.innerHTML = slotHTML(st);
      cell.addEventListener('click', function () {
        if (chestMulti) { if (!st) return; chestSel[i] = !chestSel[i]; refreshChest(); }
        else { if (st) showChestInfo(st); invToChest(i); }
      });
      el.chestInvGrid.appendChild(cell);
    });
    setupTooltip(el.chestGrid); setupTooltip(el.chestInvGrid); // PCホバーで中身を確認
  }
  // チェスト/インベントリのスロット内容を下部に表示(タップで何かわかる)
  function showChestInfo(st) {
    const box = document.getElementById('chest-info'); if (!box) return;
    if (!st) { box.innerHTML = '<span class="hint">タップで移動／アイテムをタップすると名前が出ます</span>'; return; }
    const def = Game.ITEMS[st.id]; if (!def) return;
    const name = st.roll ? Game.Loot.displayName(st) : def.name;
    const col = st.roll ? Game.Loot.rarityColor(st) : (def.color || '#fff');
    let sub = def.tool === 'gun' ? '🔫 銃' : def.throw ? '💥 投擲' : def.attack != null ? ('🗡 攻撃 ' + def.attack) : def.armor != null ? ('🛡 防御 ' + def.armor) : def.food ? ('🍖 空腹+' + def.food) : def.place !== undefined ? '🧱 設置可' : (def.flavor || '素材');
    box.innerHTML = '<b style="color:' + col + '">' + name + (st.count > 1 ? ' ×' + st.count : '') + '</b> <span style="color:#9fb6d0;font-size:.8rem">' + sub + '</span>';
  }
  let chestMulti = false; const chestSel = {};
  function toggleChestMulti() {
    chestMulti = !chestMulti; for (const k in chestSel) delete chestSel[k];
    const mb = document.getElementById('chest-multi'); if (mb) mb.textContent = 'まとめて選択: ' + (chestMulti ? 'ON' : 'OFF');
    const sb = document.getElementById('chest-deposit-sel'); if (sb) sb.classList.toggle('hidden', !chestMulti);
    refreshChest();
  }
  function depositSelected() {
    const idx = Object.keys(chestSel).filter(function (k) { return chestSel[k]; }).map(Number).sort(function (a, b) { return b - a; });
    idx.forEach(function (i) { invToChest(i); });
    for (const k in chestSel) delete chestSel[k];
    refreshChest();
  }
  function depositAll() {
    const inv = Game.Inventory.slots();
    for (let i = inv.length - 1; i >= 0; i--) if (inv[i]) invToChest(i);
    refreshChest();
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
    refreshAmmo(); // オーバーレイ開閉で弾薬HUDの表示/非表示を即反映
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
  function refreshBounty() {
    const tr = document.getElementById('bounty-tracker'); if (!tr || !Game.state) return;
    const b = Game.state.bounty;
    if (!b) { tr.classList.add('hidden'); return; }
    const txt = document.getElementById('bounty-text');
    if (b.big) txt.textContent = b.done ? '大物 討伐済' : ('大物 ' + (b.bossName || '賞金首') + ' を討て');
    else if (b.done) txt.textContent = '賞金首 達成! 掲示板で報酬を受け取れ';
    else txt.textContent = '賞金首 ' + b.targetName + '  ' + b.count + '/' + b.need;
    tr.classList.remove('hidden');
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

  // ===== 死亡サマリー =====
  function showDeath(s) {
    const box = document.getElementById('death-stats'); if (!box) return;
    box.innerHTML =
      '<div>死因　　　<b style="color:#ff8a8a">' + s.cause + '</b></div>' +
      '<div>生存　　　<b>' + s.days + '</b> 日（約 ' + s.mins + ' 分）</div>' +
      '<div>レベル　　<b>' + s.level + '</b></div>' +
      '<div>撃破ボス　<b style="color:#ffd86b">' + s.bosses + '</b> 体</div>' +
      '<div>討伐総数　<b>' + s.kills + '</b></div>' +
      '<div>所持金塊　<b style="color:#e8c54a">' + s.gold + '</b></div>';
    document.getElementById('death-screen').classList.remove('hidden');
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
    // 発見済ランドマーク（種別色の小ドット・視野内）
    const disc = Game.state.discovered || {};
    for (const key in disc) {
      const parts = key.split(':'); if (parts[0] !== Game.state.worldName) continue;
      const kind = parts[1]; if (kind === 'boss') continue; const rc = (parts[2] || '0,0').split(',');
      const ltx = parseInt(rc[0], 10) * 40 + 20, lty = parseInt(rc[1], 10) * 40 + 20;
      const mx = (ltx - (ptx - half)) * scale, my = (lty - (pty - half)) * scale;
      if (mx < 0 || my < 0 || mx > size || my > size) continue;
      mmCtx.fillStyle = (LANDMARKS[kind] && LANDMARKS[kind].col) || '#fff';
      mmCtx.fillRect(mx - 2, my - 2, 4, 4);
      mmCtx.strokeStyle = 'rgba(0,0,0,0.6)'; mmCtx.lineWidth = 1; mmCtx.strokeRect(mx - 2, my - 2, 4, 4);
    }
    // 動的ドット（敵=赤/ボス=大赤/NPC=黄/仲間=水色）
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i]; if (!m.def) continue;
      const mx = (Math.floor(m.x / TS) - (ptx - half)) * scale, my = (Math.floor(m.y / TS) - (pty - half)) * scale;
      if (mx < 0 || my < 0 || mx > size || my > size) continue;
      if (m.def.boss) { mmCtx.fillStyle = '#ff3030'; mmCtx.fillRect(mx - 2.5, my - 2.5, 5, 5); }
      else if (m.def.npc || m.def.friendly) { mmCtx.fillStyle = '#ffe24a'; mmCtx.fillRect(mx - 1.5, my - 1.5, 3, 3); }
      else if (m.def.hostile) { mmCtx.fillStyle = '#e0404a'; mmCtx.fillRect(mx - 1, my - 1, 2, 2); }
      else { mmCtx.fillStyle = '#7fd06a'; mmCtx.fillRect(mx - 1, my - 1, 2, 2); } // 受動的な動物(狩り対象)
    }
    if (Game.Net && Game.Net.isConnected()) {
      const peers = Game.Net.getPeers();
      for (const id in peers) { const pe = peers[id]; if (!pe || pe.world !== Game.state.worldName || pe.tx == null) continue; const mx = (Math.floor(pe.tx / TS) - (ptx - half)) * scale, my = (Math.floor(pe.ty / TS) - (pty - half)) * scale; if (mx < 0 || my < 0 || mx > size || my > size) continue; mmCtx.fillStyle = '#5fd0ff'; mmCtx.fillRect(mx - 1.5, my - 1.5, 3, 3); }
    }
    // プレイヤー
    mmCtx.fillStyle = '#fff';
    mmCtx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
    mmCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    mmCtx.strokeRect(0, 0, size, size);
  }

  // 文脈アクションボタン: チェスト等に近づくと「📦 開ける」等を表示しタップで実行(マイクラ式の開封導線)
  let ctxBtn = null, ctxLabel = '';
  function refreshContext() {
    if (!Game.state || !Game.Player.contextAction) return;
    if (!ctxBtn) {
      ctxBtn = document.getElementById('context-action');
      if (!ctxBtn) {
        ctxBtn = document.createElement('button'); ctxBtn.id = 'context-action';
        ctxBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:150px;z-index:57;background:rgba(28,40,64,.94);border:1px solid #5a78a8;border-radius:11px;padding:10px 18px;font-size:1rem;color:#eaf2ff;font-weight:700;box-shadow:0 3px 12px rgba(0,0,0,.4);display:none;cursor:pointer';
        (document.getElementById('app') || document.body).appendChild(ctxBtn);
        ctxBtn.addEventListener('click', function (e) { e.stopPropagation(); Game.Audio.play('select'); Game.Player.useNearby(); });
      }
    }
    // 各種オーバーレイが開いている間は隠す
    const overlayOpen = (el.invScreen && !el.invScreen.classList.contains('hidden')) || (el.chestScreen && !el.chestScreen.classList.contains('hidden')) || Game.state.paused;
    const ctx = overlayOpen ? null : Game.Player.contextAction();
    if (!ctx) { if (ctxBtn.style.display !== 'none') ctxBtn.style.display = 'none'; ctxLabel = ''; return; }
    if (ctx.label !== ctxLabel) { ctxBtn.textContent = ctx.label; ctxLabel = ctx.label; }
    if (ctxBtn.style.display === 'none') ctxBtn.style.display = 'block';
  }

  // ホットバー切替時のアイテム説明ポップアップ。単一要素＋単一タイマーで連続切替も重ならない
  let hbInfoEl = null, hbInfoTimer = null;
  function flashHotbarItem() {
    const p = Game.state && Game.state.player; if (!p) return;
    const st = Game.Inventory.slots()[p.hotbarIndex];
    if (!hbInfoEl) {
      hbInfoEl = document.getElementById('hb-iteminfo');
      if (!hbInfoEl) {
        hbInfoEl = document.createElement('div'); hbInfoEl.id = 'hb-iteminfo';
        hbInfoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:118px;z-index:56;background:rgba(14,20,36,.9);border:1px solid #3a4c66;border-radius:10px;padding:6px 13px;max-width:86vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s;backdrop-filter:blur(2px)';
        (document.getElementById('app') || document.body).appendChild(hbInfoEl);
      }
    }
    if (!st) { hbInfoEl.style.opacity = '0'; return; } // 空きスロットは非表示
    const def = Game.ITEMS[st.id]; if (!def) { hbInfoEl.style.opacity = '0'; return; }
    const name = st.roll ? Game.Loot.displayName(st) : def.name;
    const col = st.roll ? Game.Loot.rarityColor(st) : (def.color || '#fff');
    // 種別に応じた短い説明
    let sub = '';
    if (def.tool === 'gun') sub = '🔫 銃 — 弾:' + (Game.ITEMS[def.ammo] ? Game.ITEMS[def.ammo].name : def.ammo) + ' / 攻撃で発射';
    else if (def.throw) sub = '💥 投擲 — 攻撃で投げる';
    else if (def.attack != null) sub = '🗡 武器 — 攻撃力 ' + Game.Player.effAttack(Game.Loot.stats(st).atk);
    else if (def.tool) sub = '⛏ ' + def.tool + ' — ' + (def.place !== undefined ? '採掘/設置' : '採掘') + (def.tier ? ' Lv' + def.tier : '');
    else if (def.armor != null) sub = '🛡 防具 — タップで装備';
    else if (def.relic) sub = '💠 遺物 — タップで装備';
    else if (def.food) sub = '🍖 食料 — 空腹+' + def.food + ' / 使うで食べる';
    else if (def.buff || def.cures) sub = '🧪 薬 — 使うで効果';
    else if (def.place !== undefined) sub = '🧱 設置できる';
    else if (def.flavor) sub = def.flavor;
    hbInfoEl.innerHTML = '<div style="color:' + col + ';font-weight:700;font-size:.94rem">' + name + (st.count > 1 ? ' ×' + st.count : '') + '</div>' + (sub ? '<div style="color:#9fb6d0;font-size:.74rem;margin-top:1px">' + sub + '</div>' : '');
    hbInfoEl.style.opacity = '1';
    if (hbInfoTimer) clearTimeout(hbInfoTimer);
    hbInfoTimer = setTimeout(function () { if (hbInfoEl) hbInfoEl.style.opacity = '0'; }, 1500);
  }

  // 控えめなオートセーブ表示(右下に一瞬フェード)。proactive-UX原則: 邪魔しない
  let saveEl = null, saveTimer = null;
  function flashSave(reason) {
    if (!saveEl) {
      saveEl = document.createElement('div'); saveEl.id = 'autosave-ind';
      saveEl.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:60;background:rgba(16,24,42,.82);color:#9fd8a0;border:1px solid #33455e;border-radius:8px;padding:5px 9px;font-size:.72rem;pointer-events:none;opacity:0;transition:opacity .35s;backdrop-filter:blur(2px)';
      (document.getElementById('app') || document.body).appendChild(saveEl);
    }
    saveEl.textContent = '💾 オートセーブ';
    saveEl.style.opacity = '1';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (saveEl) saveEl.style.opacity = '0'; }, 1100);
  }

  return {
    init, showGameUI, refreshHotbar, refreshStats, refreshInventory,
    refreshCraft, refreshAll, toggleInventory, toast, updateMinimap,
    openChest, openSharedChest, closeChest, refreshChest, refreshWorld,
    showLore, closeLore, refreshQuest, openQuest, closeQuest, refreshBounty, showEnding, showDeath, showIntro, refreshNet, refreshStatus,
    toggleOptions, openEnchant, closeEnchant, flashSave, flashHotbarItem, refreshContext, refreshAmmo,
    toggleBigMap, isBigMapOpen, updateBigMap, openStats, closeStats, toggleStats, renderStats, refreshBossBar, openTrade, closeTrade, openShop, openStory, closeStory,
  };
})();
