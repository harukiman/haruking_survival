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
    if (el.statusRow) el.statusRow.addEventListener('click', toggleStatusHelp); // 状態異常アイコン行タップで平易ヘルプ
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
    } else {
      // デスクトップ(非タッチ): マウスだけで全操作が完結するよう操作ボタン＋移動パッドを表示
      // (各ボタンは mousedown/click ハンドラ済み。パッド接続時は body.has-pad が非表示化)
      document.body.classList.add('desktop');
      el.touch.classList.remove('hidden');
      const dp = document.getElementById('dpad'); if (dp) dp.classList.remove('hidden');
    }
  }

  function showGameUI() {
    el.hud.classList.remove('hidden');
    el.hotbar.classList.remove('hidden');
    if (el.sound) el.sound.classList.remove('hidden');
    const ob = document.getElementById('btn-options'); if (ob) ob.classList.remove('hidden');
    if (el.btnMap) el.btnMap.classList.remove('hidden');
    startHints(); // 初回セーブのみのマイクロガイド(案内済みフラグで再表示しない)
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
    // 交戦中(engaged)のボスのみ表示: 離脱でバーが消え、再接近で再表示される
    // (engaged はモブ更新が交戦距離 BOSS_ENGAGE_TILES 内で立てるフラグ。undefined=まだ更新前は近接扱い)
    const eng = function (m) { return m.engaged !== false; };
    const mobs = Game.state.mobs; let boss = null;
    for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def && m.def.boss && eng(m)) { if (!boss || m.maxHp > boss.maxHp) boss = m; } }
    // ボスが居なければ チャンピオン or 中ボス をバー表示
    if (!boss) { for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if ((m.champion || (m.def && m.def.midboss)) && eng(m)) { if (!boss || m.maxHp > boss.maxHp) boss = m; } } }
    if (!boss) { if (!bbEl.classList.contains('hidden')) bbEl.classList.add('hidden'); bbEl.classList.remove('champion'); return; }
    bbEl.classList.remove('hidden');
    const isChamp = (!boss.def.boss && !boss.def.midboss) || boss.bountyBoss;
    bbEl.classList.toggle('champion', isChamp);
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    // 強さの格付け: ボスは tier(4=S〜1=C)、中ボスは D
    const TIER = { 4: 'S', 3: 'A', 2: 'B', 1: 'C' };
    const rank = boss.def.boss ? TIER[boss.def.tier || 1] : (boss.def.midboss ? 'D' : '');
    const rankLbl = rank ? '【' + rank + '】' : '';
    const nm = (boss.enraged ? '⚠ ' : '') + rankLbl + (boss.championName || (isChamp ? 'チャンピオン' : boss.def.name)) + '　' + Math.ceil(pct) + '%';
    if (bbName.textContent !== nm) bbName.textContent = nm;
    bbFill.style.width = pct + '%';
    // 激昂で赤化(フェーズ2を一目で把握)
    bbEl.classList.toggle('enraged', !!boss.enraged);
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
    const title = sc.querySelector('h2'); if (title) title.textContent = 'バーツ商館 🏪';
    tradeStock = SHOP_STOCK.slice(); lastBoughtIdx = -1; lastCurShown = null; refreshTrade();
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
  function openTrade() { const sc = document.getElementById('trade-screen'); if (!sc) return; shopMode = false; const title = sc.querySelector('h2'); if (title) title.textContent = '旅の商人 🧳'; sc.classList.remove('hidden'); Game.state.paused = true; rollTradeStock(); lastBoughtIdx = -1; lastCurShown = null; refreshTrade(); }
  function closeTrade() { const sc = document.getElementById('trade-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; shopMode = false; }

  // 記憶回廊(物語ギャラリー)
  function openStory() { const sc = document.getElementById('story-screen'); if (!sc) return; sc.classList.remove('hidden'); Game.state.paused = true; renderStory(); }
  function closeStory() { const sc = document.getElementById('story-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; }
  function renderStory() {
    const body = document.getElementById('story-body'); if (!body || !Game.Story) return;
    const list = Game.Story.list(); const seen = list.filter(function (f) { return f.seen; }).length;
    // 章ごとのムード色は公開データ Game.STORY の col を参照（無ければ既定紫）
    const colOf = {};
    if (Game.STORY && Game.STORY.forEach) Game.STORY.forEach(function (f) { colOf[f.id] = f.col; });
    const pct = list.length ? Math.round(seen / list.length * 100) : 0;
    let h = '<div class="story-head"><span>解放した物語 <b>' + seen + ' / ' + list.length + '</b></span><span>刻片 🔮 <b>' + (Game.Inventory ? Game.Inventory.count('kokuhen') : 0) + '</b></span></div>';
    h += '<div class="story-prog"><i style="width:' + pct + '%"></i></div>';
    let idx = 0;
    const card = function (f) {
      const col = colOf[f.id] || '#3a3458';
      const delay = Math.min(idx * 45, 540); idx++;
      if (f.seen) {
        return '<div class="story-frag" style="animation-delay:' + delay + 'ms;border-left-color:' + col + '">' +
          '<div class="sf-head"><span class="sf-chip" style="background:' + col + '"></span><b>' + f.title + '</b>' +
          '<button class="sf-play map-btn" data-id="' + f.id + '">▶ 再生</button></div>' +
          '<div class="sf-text">' + f.text.replace(/\n/g, '<br>') + '</div></div>';
      }
      return '<div class="story-frag locked" style="animation-delay:' + delay + 'ms">' +
        '<div class="sf-head"><span class="sf-chip"></span><b>？？？</b></div>' +
        '<div class="sf-text" style="opacity:.55">解放条件: ' + f.trigger + '</div></div>';
    };
    // 本編章と断章をセクション分け（タイトル先頭「断章」で判定）
    const main = list.filter(function (f) { return f.title.indexOf('断章') !== 0; });
    const frags = list.filter(function (f) { return f.title.indexOf('断章') === 0; });
    h += '<div class="story-sec">本編 <span class="ss-n">' + main.filter(function (f) { return f.seen; }).length + '/' + main.length + '</span></div>';
    main.forEach(function (f) { h += card(f); });
    if (frags.length) {
      h += '<div class="story-sec">断章 <span class="ss-n">' + frags.filter(function (f) { return f.seen; }).length + '/' + frags.length + '</span></div>';
      frags.forEach(function (f) { h += card(f); });
    }
    body.innerHTML = h;
    body.querySelectorAll('.sf-play[data-id]').forEach(function (btn) { btn.addEventListener('click', function () { closeStory(); Game.Story.play(btn.getAttribute('data-id')); }); });
  }
  // ショップカード用: アイテムデータから一行効果テキストを導出（無ければ flavor）
  const CURE_NAMES = { bleed: '出血', poison: '毒', infection: '感染', burn: '火傷', frost: '凍え' };
  const BUFF_NAMES = { strength: '一時的に攻撃力が高まる', swiftness: '一時的に足が速くなる', ironskin: '一時的に守りが固くなる', regen_buff: '一時的にHPが回復し続ける' };
  function itemEffectLine(id) {
    const def = Game.ITEMS[id]; if (!def) return '';
    const s = [];
    if (def.heal) s.push('HP+' + def.heal);
    if (def.cures) s.push(def.cures.map(function (c) { return CURE_NAMES[c] || c; }).join('・') + 'を治す');
    if (def.food) s.push('空腹+' + def.food);
    if (def.buff) s.push(BUFF_NAMES[def.buff.type] || '一時強化');
    if (def.throw) s.push('投擲 威力' + (def.throw.dmg || '?'));
    if (def.attack != null) s.push('攻撃力 ' + def.attack);
    if (def.armor != null) s.push('防御 ' + def.armor);
    if (def.relic) {
      const r = def.relic;
      if (r.crit) s.push('会心率+' + Math.round(r.crit * 100) + '%');
      if (r.moveSpd) s.push('移動速度+' + Math.round(r.moveSpd * 100) + '%');
      if (r.regen) s.push('HP自然回復+');
      if (r.lifesteal) s.push('吸血+' + Math.round(r.lifesteal * 100) + '%');
      if (r.xpBoost) s.push('経験+' + Math.round(r.xpBoost * 100) + '%');
    }
    if (def.keepBts) s.push('死亡してもバーツを失わない');
    if (def.skillTome) s.push('スキルポイント+' + def.skillTome);
    if (def.invExpand) s.push('持ち物の上限が増える');
    if (def.xpGain) s.push('経験値+' + def.xpGain);
    if (def.plant) s.push('畑に植えて育てる');
    if (!s.length && def.tool) s.push('道具: ' + def.tool + (def.tier ? ' Lv' + def.tier : ''));
    if (!s.length && def.place !== undefined) s.push('設置して使う');
    if (!s.length) return def.flavor || '';
    return s.join(' / ');
  }
  // ===== 上位近接武器の特殊効果(config ITEMS[].special)の平易な説明 =====
  const DOT_NAMES = { fire: '炎上', frost: '凍え', venom: '毒' };
  function specialDesc(sp) {
    const sec = sp.cd ? (Math.round(sp.cd / 3) / 10) : 0; // 30tick = 1秒
    const pct = sp.pct ? Math.round(sp.pct * 100) : 0;
    if (sp.type === 'thunder') return '斬ると天から雷が落ち、近くの敵 最大' + (sp.count || 2) + '体に攻撃力の' + pct + '%のダメージ（約' + sec + '秒に1回）';
    if (sp.type === 'shock') return '斬撃と同時に周囲へ衝撃波を放つ（攻撃力の' + pct + '%' + (sp.dot ? '・' + (DOT_NAMES[sp.dot] || sp.dot) + '付与' : '') + '、約' + sec + '秒に1回）';
    if (sp.type === 'echo') return '一閃の後、残光が' + (sp.hits || 2) + '回追い斬る（各 攻撃力の' + pct + '%、約' + sec + '秒に1回）';
    if (sp.type === 'reap') return '敵を倒すと最大HPの' + Math.round((sp.healPct || 0.03) * 100) + '%回復（連続発動は約' + sec + '秒に1回）';
    if (sp.type === 'brand') return '斬った敵に' + (DOT_NAMES[sp.dot] || sp.dot) + 'を付与する（毎回発動・待ち時間なし）';
    return '特殊な力が宿っている';
  }
  function specialBlock(sp) {
    const col = sp.color || '#ffe27a';
    return '<div class="sp-effect" style="border-left-color:' + col + '"><span class="sp-name" style="color:' + col + '">✦ 特殊効果「' + sp.name + '」</span><span class="sp-desc">' + specialDesc(sp) + '</span></div>';
  }

  // 商館のカテゴリ分け（表示のみ・在庫データは不変）
  const SHOP_CAT_ORDER = ['回復・治療', '食料', '弾薬', '強化薬', '投擲・爆薬', '農耕の種', '設置・道具', '成長の秘宝', '遺物・護符', '素材・その他', '掘り出し物'];
  function shopCategory(t) {
    if (t.rand) return '掘り出し物';
    const def = Game.ITEMS[t.id]; if (!def) return '素材・その他';
    if (t.id.indexOf('ammo_') === 0 || t.id === 'rocket_ammo' || t.id === 'energy_cell' || t.id === 'shell_12g') return '弾薬';
    if (def.relic || def.keepBts) return '遺物・護符';
    if (def.skillTome || def.invExpand || def.xpGain) return '成長の秘宝';
    if (def.heal || def.cures) return '回復・治療';
    if (def.buff) return '強化薬';
    if (def.throw || def.attack != null) return '投擲・爆薬';
    if (def.food) return '食料';
    if (def.plant) return '農耕の種';
    if (def.place !== undefined || def.tool) return '設置・道具';
    return '素材・その他';
  }
  let lastBoughtIdx = -1, lastCurShown = null, curAnimId = 0;
  // 購入後の所持通貨カウントアップ演出
  function animateCurNum(from, to) {
    const numEl = document.getElementById('trade-cur-num'); if (!numEl) return;
    const wrap = document.getElementById('trade-cur');
    if (wrap) { wrap.classList.remove('pulse'); void wrap.offsetWidth; wrap.classList.add('pulse'); }
    const dur = 420, t0 = performance.now(), my = ++curAnimId;
    (function step(now) {
      if (my !== curAnimId) return;
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      numEl.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function refreshTrade() {
    const body = document.getElementById('trade-body'); if (!body) return;
    const cur = shopMode ? (Game.state.player.bts || 0) : Game.Inventory.count('gold_bar');
    const curName = shopMode ? 'バーツ' : '金塊', curIcon = shopMode ? '🪙' : '🟨';
    let h = '<div class="trade-wallet"><span class="tw-lbl">所持' + curName + '</span><b id="trade-cur" class="tw-val' + (shopMode ? '' : ' gold') + '">' + curIcon + ' <span id="trade-cur-num">' + cur + '</span></b></div>';
    h += '<p class="trade-sub">' + (shopMode ? '常設の品揃え・固定価格。欲しい品をタップで購入。' : '品揃えは旅のたびに入れ替わる — 一期一会の市。') + '</p>';
    const rowHTML = function (t, i) {
      const can = cur >= t.price;
      const def = t.rand ? null : Game.ITEMS[t.id];
      const name = t.rand ? t.label : (def.name + (t.n > 1 ? ' ×' + t.n : ''));
      const url = !t.rand && Game.Icons ? Game.Icons.dataURL(t.id, null) : null;
      const eff = t.rand ? '何が届くかは受け取るまで分からない' : itemEffectLine(t.id);
      return '<button class="trade-row' + (can ? '' : ' disabled') + (t.rare ? ' rare' : '') + (i === lastBoughtIdx ? ' bought' : '') + '" data-i="' + i + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="tr-ic"' + (url ? ' style="background-image:url(' + url + ')"' : '') + '>' + (t.rand ? '🎁' : '') + '</span>' +
        '<span class="tr-mid"><span class="tr-name">' + (t.rare ? '<em class="tr-rare-tag">希少</em>' : '') + name + '</span>' +
        (eff ? '<span class="tr-eff">' + eff + '</span>' : '') + '</span>' +
        '<span class="tr-price' + (can ? '' : ' short') + '">' + curIcon + t.price + '</span></button>';
    };
    if (shopMode) {
      // カテゴリごとにまとめて陳列（見出し＋カード）
      const groups = {};
      tradeStock.forEach(function (t, i) { const c = shopCategory(t); (groups[c] = groups[c] || []).push([t, i]); });
      SHOP_CAT_ORDER.forEach(function (c) {
        if (!groups[c]) return;
        h += '<div class="trade-cat">' + c + '</div><div class="trade-list">';
        groups[c].forEach(function (p) { h += rowHTML(p[0], p[1]); });
        h += '</div>';
        delete groups[c];
      });
      for (const c in groups) { // 想定外カテゴリの保険
        h += '<div class="trade-cat">' + c + '</div><div class="trade-list">';
        groups[c].forEach(function (p) { h += rowHTML(p[0], p[1]); });
        h += '</div>';
      }
    } else {
      h += '<div class="trade-list">';
      tradeStock.forEach(function (t, i) { h += rowHTML(t, i); });
      h += '</div>';
    }
    body.innerHTML = h;
    body.querySelectorAll('.trade-row[data-i]').forEach(function (btn) { btn.addEventListener('click', function () { buyTrade(parseInt(btn.getAttribute('data-i'), 10)); }); });
    // 通貨が変動していればカウントアップ＋パルス（購入の満足感）
    if (lastCurShown != null && lastCurShown !== cur) animateCurNum(lastCurShown, cur);
    lastCurShown = cur;
    lastBoughtIdx = -1;
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
    lastBoughtIdx = i; // 再描画時に購入カードへパルス演出
    Game.Audio.play('craft'); refreshTrade(); refreshHotbar(); refreshStats();
    if (!shopMode && Game.Story && !Game.Story.seen('merchant')) Game.Story.unlock('merchant', true); // 旅商人と初取引で記憶回廊
  }

  // ===== ステータス & スキル画面 =====
  function openStats() {
    const sc = document.getElementById('stats-screen'); if (!sc) return;
    sc.classList.remove('hidden'); Game.state.paused = true; renderStats();
  }
  function closeStats() { const sc = document.getElementById('stats-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; }
  function toggleStats() { const sc = document.getElementById('stats-screen'); if (!sc) return; if (sc.classList.contains('hidden')) openStats(); else closeStats(); }
  const skOpen = {}; // スキル系統の開閉状態
  let achBase = null; // 実績のセッション開始時スナップショット(以後の解除に NEW を付ける)
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
            const isPassive = n.id.indexOf('p_') === 0; // T5パッシブ: 習得すれば常時/条件で勝手に働く
            h += '<button class="sk-node ' + cls + '" data-skill="' + n.id + '" title="' + n.desc + '">' +
              '<b>' + n.name + '</b>' + (isPassive ? '<span class="sk-auto">自動発動</span>' : '') + '<span class="sk-cost">' + (owned ? '習得済' : n.cost + 'P') + '</span><span class="sk-desc">' + n.desc + '</span></button>';
          });
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    });
    h += '<p class="hint">前提スキルを習得すると次が解放。振り直しは「記憶の書」(レア)。レベル上限 ' + (Game.MAX_LEVEL || 9999) + '。</p>';
    // 実績一覧（達成サマリー＋バー、セッション中の新規解除は NEW 強調）
    if (Game.ACHIEVEMENTS && Game.Achievements) {
      if (!achBase) { achBase = {}; for (const id in Game.ACHIEVEMENTS) if (Game.Achievements.has(id)) achBase[id] = 1; }
      const aGot = Game.Achievements.count(), aTot = Game.Achievements.total();
      const aPct = aTot ? Math.round(aGot / aTot * 100) : 0;
      h += '<h2>実績 <span style="color:#ffe27a;font-size:.9rem">' + aGot + ' / ' + aTot + '</span><span style="color:#7a8494;font-size:.78rem">　達成率 ' + aPct + '%</span></h2>';
      h += '<div class="ach-prog"><i style="width:' + aPct + '%"></i></div>';
      h += '<div class="ach-list">';
      for (const id in Game.ACHIEVEMENTS) {
        const a = Game.ACHIEVEMENTS[id], got = Game.Achievements.has(id);
        const isNew = got && !achBase[id];
        h += '<div class="ach-row' + (got ? ' got' : '') + (isNew ? ' fresh' : '') + '"><span class="ach-mk">' + (got ? '🏆' : '🔒') + '</span><div><b>' + a.name + (isNew ? '<em class="ach-new">NEW</em>' : '') + '</b><br><span class="ach-d">' + a.desc + '</span></div></div>';
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
      // 未発見は「？？？」行を並べず1行に折りたたむ(長大スクロール防止)
      let lockedCount = 0;
      types.forEach(function (id) {
        const m = Game.MOBS[id], got = best[id];
        if (!got) { lockedCount++; return; }
        const info = '<br><span class="ach-d">撃破 ' + best[id] + ' 体' + (m.boss ? '・ボス' : (m.hostile ? '' : '・非敵対')) + ' ｜ HP ' + m.hp + (m.hostile ? '・攻 ' + (m.dmg || 0) : '') + '</span>' + dropNames(m);
        h += '<div class="ach-row got"><span class="ach-mk">' + (m.boss ? '👑' : '☠') + '</span><div><b>' + m.name + '</b>' + info + '</div></div>';
      });
      if (lockedCount > 0) h += '<div class="ach-row"><span class="ach-mk">❔</span><div><b>未発見 ' + lockedCount + ' 種</b><br><span class="ach-d" style="opacity:.7">世界のどこかに潜んでいる…</span></div></div>';
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
    if (def.special) html += '<div class="tt-stat" style="color:' + (def.special.color || '#ffe27a') + '">✦ ' + def.special.name + ' — ' + specialDesc(def.special) + '</div>';
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
    if (Date.now() - lastTouchT < 700) return; // タッチ直後の擬似mouseenterでは出さない(スマホで残留するため)
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
  let lastTouchT = 0;
  if (typeof document !== 'undefined') {
    document.addEventListener('touchstart', function () { lastTouchT = Date.now(); hideTip(); }, { passive: true });
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
        ammoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(74px + max(var(--ey,16px), env(safe-area-inset-bottom)));z-index:55;background:rgba(16,24,42,.82);border:1px solid #33455e;border-radius:9px;padding:4px 11px;font-size:.82rem;color:#e8edf2;pointer-events:none;display:none;white-space:nowrap';
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
      toggle('joyFollow', '🕹 スティック追従(指を追う)') +
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
        '<div class="hk"><b>スマホ</b>: 画面左をなぞって移動（スティックは指を追従）／右下ボタンで 採掘・設置・開く・回避・走る・影渡り・袋。「走る」は短タップで走り続け・再タップ解除。ミニマップで大マップ</div>' +
        '<div class="hk"><b>インベントリ</b>: アイテムをタップ=選択／同じ物をもう一度タップ=すぐ使用・装備／長めになぞる=並べ替え</div>' +
        '<div class="hk"><b>移動</b> WASD / 矢印</div>' +
        '<div class="hk"><b>採掘・攻撃</b> 左クリック / スペース</div>' +
        '<div class="hk"><b>設置</b> 右クリック / Q・K</div>' +
        '<div class="hk"><b>開く・対話・使う</b> G（近くのチェスト/掲示板/石碑）</div>' +
        '<div class="hk"><b>回避ロール</b> R（無敵・スタミナ消費）</div>' +
        '<div class="hk"><b>走る</b> Shift（スタミナ消費）</div>' +
        '<div class="hk"><b>影渡り</b> F（影鏡が必要）</div>' +
        '<div class="hk"><b>インベントリ</b> E　<b>ステ/スキル</b> C　<b>大マップ</b> N/Tab</div>' +
        '<div class="hk"><b>ホットバー</b> 1-9　<b>サウンド</b> M　<b>設定</b> P/Esc</div>' +
        '<div class="hk"><b>PCマウスだけでも遊べる</b>: 画面の移動パッド＋右下ボタン(採掘/設置/回避/走る/影渡り/袋)をクリック。キーボードは補助</div>' +
        '<div class="hk"><b>パッドのメニュー操作</b>: 十字キー/左スティック=カーソル移動 ／ ×=決定 ／ ○=閉じる ／ L1・R1=タブ切替 ／ SHARE=設定 ／ L3=ステータス ／ 右スティック+R2=ポインタでも操作可</div>' +
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

  // 状態異常の「何が起きているか＋対処」平易ヘルプ(アイコン行タップで表示)
  const STATUS_HELP = {
    bleed:      { what: 'HPがじわじわ減っている', fix: '包帯で止血できる' },
    poison:     { what: 'HPが減り続けている', fix: '解毒薬で治る' },
    infection:  { what: '放置すると悪化して出血も併発する', fix: '早めに解毒薬で治療しよう' },
    cold:       { what: '体が凍えてHPが減っている', fix: '焚き火など火のそばへ・防寒装備を着よう' },
    burn:       { what: '炎に焼かれHPが速く減っている', fix: '時間経過で鎮火する。回復を惜しまずに' },
    wellfed:    { what: '満腹でHPが自然回復している(良い状態)', fix: '' },
    strength:   { what: '薬の力で攻撃力が上がっている', fix: '' },
    swiftness:  { what: '薬の力で足が速くなっている', fix: '' },
    ironskin:   { what: '薬の力で守りが固くなっている', fix: '' },
    regen_buff: { what: '薬の力でHPが回復し続けている', fix: '' },
  };
  let statusPop = null, statusPopTimer = null;
  function hideStatusHelp() { if (statusPop) statusPop.classList.remove('show'); clearTimeout(statusPopTimer); }
  function toggleStatusHelp() {
    if (!Game.Status) return;
    if (statusPop && statusPop.classList.contains('show')) { hideStatusHelp(); return; }
    const list = Game.Status.activeList();
    if (!list.length) return;
    if (!statusPop) {
      statusPop = document.createElement('div'); statusPop.id = 'status-pop';
      statusPop.addEventListener('click', hideStatusHelp);
      (document.getElementById('app') || document.body).appendChild(statusPop);
    }
    let h = '';
    list.forEach(function (s) {
      const hp = STATUS_HELP[s.key] || { what: '', fix: '' };
      h += '<div class="sp-row"><span class="sp-i" style="border-color:' + s.color + '">' + s.icon + '</span><div><b style="color:' + s.color + '">' + s.name + '</b> <span class="sp-w">' + hp.what + '</span>' + (hp.fix ? '<br><span class="sp-f">▶ ' + hp.fix + '</span>' : '') + '</div></div>';
    });
    statusPop.innerHTML = h;
    statusPop.classList.add('show');
    Game.Audio.play('cursor');
    clearTimeout(statusPopTimer);
    statusPopTimer = setTimeout(hideStatusHelp, 6000);
  }
  let statusTicks = 0;
  function refreshStatus() {
    if (!el.statusRow || !Game.Status) return;
    const list = Game.Status.activeList();
    el.statusRow.innerHTML = list.map(function (s) {
      return '<span class="st-chip" style="border-color:' + s.color + '" title="' + s.name + '">' + s.icon + '</span>';
    }).join('');
    if (!list.length) hideStatusHelp();
    // 低頻度の見守り処理をここに相乗り(0.5秒周期・非ポーズ時のみ呼ばれる)
    statusTicks++;
    hintTick();
    if (statusTicks % 4 === 0) craftableTick(); // 約2秒ごと
  }

  // ===== 初回セッション マイクロガイド =====
  // 非モーダルの小ピルを1件ずつ表示(タップで次へ/条件達成で自動前進)。
  // 達成フラグは save.js のホワイトリスト外のため Game.state には持たせず、
  // ui.js 管轄の localStorage キー(シード毎)で永続化する。
  const HINT_STEPS = [
    { icon: '🕹', text: '画面の左半分をなぞると移動できる', life: 20, done: function () { const p = Game.state.player, sp = Game.state.spawn, TS = Game.CFG.TILE_SIZE; if (!sp || sp.tx == null) return false; return Math.hypot(p.x - (sp.tx + 0.5) * TS, p.y - (sp.ty + 0.5) * TS) > 140; } },
    { icon: '⛏', text: '「採掘」ボタンで木や石を集めよう', life: 40, done: function () { return Game.Inventory.count('wood') > 0 || Game.Inventory.count('stone') > 0; } },
    { icon: '🔨', text: '「袋」を開いてクラフトで道具を作ろう', life: 45, done: function () { return Game.Achievements && Game.Achievements.has('first_craft'); } },
    { icon: '🌙', text: '夜は敵が強くなる。松明と武器を備えよう', life: 25, done: function () { return Game.Inventory.count('torch') > 0; } },
    { icon: '💾', text: '進行は自動保存される。⚙からも保存できる', life: 12, done: function () { return false; } },
  ];
  let hintPill = null, hintIdx = -1, hintShownAt = 0, hintsActive = false, hintKey = null, hintStartTick = 0;
  function hintsDoneFlag() { try { return localStorage.getItem(hintKey) === '1'; } catch (e) { return false; } }
  function markHintsDone() { hintsActive = false; if (hintPill) hintPill.classList.remove('in'); try { localStorage.setItem(hintKey, '1'); } catch (e) {} }
  function startHints() {
    if (!Game.state) return;
    hintKey = 'hk_hints:' + (Game.state.seed || 0);
    if (hintsDoneFlag()) return; // このセーブでは案内済み
    if (Game.state.player && Game.state.player.level >= 3) { markHintsDone(); return; } // 既に基本を知っている進行度
    hintsActive = true; hintIdx = -1; hintStartTick = Game.state.tick;
    advanceHint();
  }
  function advanceHint() {
    hintIdx++;
    // 既に達成済みの段階は読み飛ばす(ロード再開時など)
    while (hintIdx < HINT_STEPS.length) {
      let d = false; try { d = HINT_STEPS[hintIdx].done(); } catch (e) {}
      if (!d) break; hintIdx++;
    }
    if (hintIdx >= HINT_STEPS.length) { markHintsDone(); return; }
    if (!hintPill) {
      hintPill = document.createElement('button'); hintPill.id = 'hint-pill'; hintPill.type = 'button';
      hintPill.addEventListener('click', function () { Game.Audio.play('select'); advanceHint(); });
      (document.getElementById('app') || document.body).appendChild(hintPill);
    }
    const st = HINT_STEPS[hintIdx];
    hintPill.innerHTML = '<span class="hp-ic">' + st.icon + '</span><span class="hp-tx">' + st.text + '</span><span class="hp-x">✕</span>';
    hintPill.classList.add('in');
    hintShownAt = Game.state.tick;
  }
  function hintTick() {
    if (!hintsActive || hintIdx < 0 || !Game.state) return;
    if (Game.state.tick - hintStartTick > 9000) { markHintsDone(); return; } // ガイドは開始から約5分間だけ
    const st = HINT_STEPS[hintIdx];
    let ok = false; try { ok = st.done(); } catch (e) {}
    if (ok || (Game.state.tick - hintShownAt) > st.life * 30) advanceHint();
  }

  // ===== 「作れるようになった!」ウォッチャー =====
  // 素材/作業台の変化で新たに作成可能になったレシピを検知し、まとめて1トースト＋袋ボタンに光バッジ
  let craftKnown = null;
  function craftableTick() {
    if (!Game.Crafting || !Game.RECIPES || !Game.state) return;
    const list = Game.Crafting.availableList();
    if (!craftKnown) { craftKnown = {}; list.forEach(function (e, i) { if (e.can) craftKnown[i] = 1; }); return; } // 初回は基準登録のみ
    const freshNames = [], seenNm = {};
    list.forEach(function (e, i) {
      if (!e.can || craftKnown[i]) return;
      craftKnown[i] = 1;
      const d = Game.ITEMS[e.recipe.out.id]; const nm = d ? d.name : e.recipe.out.id;
      if (!seenNm[nm]) { seenNm[nm] = 1; freshNames.push(nm); }
    });
    if (!freshNames.length) return;
    const bi = document.getElementById('btn-inv'); if (bi) bi.classList.add('craft-new');
    richToast('🔨 <b style="color:#ffd86b">作れるようになった!</b> <span style="color:#cfe0f0">' + esc(freshNames.slice(0, 2).join('、')) + (freshNames.length > 2 ? ' ほか' + (freshNames.length - 2) + '種' : '') + '</span>', 'tst-craft', 2100);
  }

  function refreshNet() {
    const badge = document.getElementById('net-badge');
    const cnt = document.getElementById('net-count');
    if (!badge) return;
    if (Game.Net && Game.Net.isConnected()) {
      badge.classList.remove('hidden');
      cnt.textContent = Game.Net.statusText ? Game.Net.statusText() : (Game.Net.peerCount() + 1) + '人'; // net.js の状態文言に統一(再接続中…等)
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

  // 装備欄: 頭/胴/遺物1/遺物2(武器はホットバー管理のため廃止)。タップで解除＋ロードアウト5セット＋効果表示
  let loadoutView = 0; // 表示中のセット番号(0-4)
  function renderEquipPanel() {
    const ep = document.getElementById('equip-panel'); if (!ep || !Game.state) return;
    const p = Game.state.player;
    const cells = [
      { key: 'head', label: '頭', item: p.armor && p.armor.head },
      { key: 'chest', label: '胴', item: p.armor && p.armor.chest },
      { key: 'accessory', label: '遺物1', item: p.accessory },
      { key: 'accessory2', label: '遺物2', item: p.accessory2 },
    ];
    let h = '<div class="eq-cells">';
    cells.forEach(function (c) {
      let inner = '<span class="eq-none">—</span>', nm = '空き';
      if (c.item && c.item.id) {
        const def = Game.ITEMS[c.item.id];
        nm = (c.item.roll && Game.Loot.displayName) ? Game.Loot.displayName(c.item) : (def ? def.name : c.item.id);
        try { inner = '<img class="eq-ic" src="' + Game.Icons.dataURL(c.item.id, c.item.roll || null) + '" alt="">'; } catch (e) {}
      }
      h += '<div class="eq-cell' + (c.item ? ' filled' : '') + '" data-key="' + c.key + '" data-drop="' + c.key + '"><span class="eq-lbl">' + c.label + '</span>' + inner + '<span class="eq-nm">' + nm + '</span></div>';
    });
    h += '</div>';
    // 効果サマリー
    const sb = Game.Player.setBonus ? Game.Player.setBonus() : {};
    let relicEff = [];
    [p.accessory, p.accessory2].forEach(function (r) { if (r) { const d = Game.ITEMS[r.id]; if (d && d.relic) for (const k in d.relic) relicEff.push(relLabel(k) + '+' + relFmt(k, d.relic[k])); } });
    h += '<div class="eq-stats">🛡 防御 <b>' + Game.Player.totalArmor() + '</b>　❤ 最大HP <b>' + p.maxHealth + '</b>' + (sb.name ? '　<span style="color:#ffd86b">セット効果: ' + sb.name + '</span>' : '') + (relicEff.length ? '<br>💠 ' + relicEff.join(' / ') : '') + '</div>';
    // ロードアウトバー
    const lo = p.loadouts || [];
    const cur = lo[loadoutView];
    h += '<div class="eq-loadout"><button class="lo-arrow" id="lo-prev">◀</button><span class="lo-label">装備セット ' + (loadoutView + 1) + ' / 5' + (cur ? '' : '（空）') + '</span><button class="lo-arrow" id="lo-next">▶</button>' +
      '<button class="map-btn" id="lo-save">保存</button><button class="map-btn" id="lo-apply"' + (cur ? '' : ' disabled') + ' style="background:#2a5a6a">このセットを装備</button></div>';
    if (cur) {
      const names = ['head', 'chest', 'accessory', 'accessory2'].map(function (k) { return cur[k] ? (Game.ITEMS[cur[k].id] ? Game.ITEMS[cur[k].id].name : cur[k].id) : '—'; });
      h += '<div class="eq-lo-detail">' + names.join(' / ') + '</div>';
    }
    ep.innerHTML = h;
    ep.querySelectorAll('.eq-cell').forEach(function (cell) {
      const key = cell.getAttribute('data-key');
      cell.addEventListener('click', function () { if (Game.Player.unequipSlot(key)) refreshInventory(); });
    });
    { const a = document.getElementById('lo-prev'); if (a) a.addEventListener('click', function () { loadoutView = (loadoutView + 4) % 5; Game.Audio.play('cursor'); renderEquipPanel(); }); }
    { const a = document.getElementById('lo-next'); if (a) a.addEventListener('click', function () { loadoutView = (loadoutView + 1) % 5; Game.Audio.play('cursor'); renderEquipPanel(); }); }
    { const a = document.getElementById('lo-save'); if (a) a.addEventListener('click', function () { Game.Player.saveLoadout(loadoutView); }); }
    { const a = document.getElementById('lo-apply'); if (a) a.addEventListener('click', function () { Game.Player.applyLoadout(loadoutView); }); }
  }
  function relLabel(k) { return ({ atk: '攻撃', armor: '防御', hp: 'HP', crit: '会心', moveSpd: '移動', lifesteal: '吸血', regen: '回復', xpBoost: '経験', staminaMax: 'スタミナ' })[k] || k; }
  function relFmt(k, v) { return (k === 'crit' || k === 'moveSpd' || k === 'lifesteal' || k === 'xpBoost') ? Math.round(v * 100) + '%' : v; }

  // インベントリで現在の目標を表示
  function renderInvQuest() {
    const q = document.getElementById('inv-quest'); if (!q || !Game.Quests) return;
    const cur = Game.Quests.current();
    q.textContent = cur ? ('🎯 目標: ' + cur.name + ' — ' + cur.desc) : '🎯 すべての目標を達成した';
  }

  // ===== ドラッグ移動＋スワップ（タップ=選択 / 2連タップ=即使用・装備 / スワイプ=移動）=====
  let dragSrc = -1, dragging = false, dragGhost = null, dragStart = null;
  let lastTapIdx = -1, lastTapT = 0;
  function invPointerDown(e, idx) {
    dragSrc = idx; dragging = false; dragStart = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', invPointerMove);
    window.addEventListener('pointerup', invPointerUp);
  }
  // 選択中アイテムの既定アクション（2連タップ用）: 装備/使用/ホットバーへ
  function invPrimaryAction(idx) {
    const cur = Game.Inventory.slots()[idx]; if (!cur) return false;
    const d2 = Game.ITEMS[cur.id]; if (!d2) return false;
    if (d2.armor && d2.slot) Game.Player.equipFromInventory(idx);
    else if (d2.relic) { invSelected = idx; Game.Player.equipRelic(idx); }
    else if (d2.food || d2.cures || d2.buff || d2.skillTome || d2.xpGain || d2.invExpand || d2.summonBoss || d2.opensShop || d2.recall) {
      const tmp = Game.state.player.hotbarIndex;
      Game.state.player.hotbarIndex = idx; Game.Inventory.useSelected();
      Game.state.player.hotbarIndex = Math.min(tmp, Game.HOTBAR_SIZE - 1);
    } else if (Game.Loot.rollable(cur.id) || d2.tool || d2.throw) {
      const sl = Game.Inventory.slots(); const hb = Game.state.player.hotbarIndex;
      const t2 = sl[hb]; sl[hb] = sl[idx]; sl[idx] = t2;
      toast('ホットバー' + (hb + 1) + 'に装備');
    } else return false;
    invSelected = -1; refreshInventory(); refreshHotbar();
    return true;
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
    if (!dragging) {
      // 同じスロットを素早く2回タップ → 即 使用/装備（メニュー往復を省く）
      const now = Date.now();
      if (src === lastTapIdx && now - lastTapT < 340 && Game.Inventory.slots()[src]) {
        lastTapIdx = -1; lastTapT = 0;
        if (invPrimaryAction(src)) { Game.Audio.play('select'); return; }
      }
      lastTapIdx = src; lastTapT = now;
      invSelected = src; if (Game.Inventory.slots()[src]) Game.Audio.play('cursor'); refreshInventory(); return; // タップ=選択
    }
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
    if (!st) { el.invDetail.innerHTML = '<p class="hint">アイテムをタップで選択 ／ 同じ物を2回タップですぐ使用・装備 ／ なぞって並べ替え</p>'; return; }
    const def = Game.ITEMS[st.id];
    let h = '<div class="ench-name" style="color:' + (st.roll ? Game.Loot.rarityColor(st) : (def.color || '#fff')) + '">' + (st.roll ? Game.Loot.displayName(st) : def.name) + '</div>';
    if (Game.Loot.rollable(st.id)) h += '<div class="ench-stat">' + Game.Loot.statText(st) + '</div>';
    if (def.attack != null) {
      const eff = Game.Player.effAttack(Game.Loot.stats(st).atk);
      h += '<div class="ench-stat">' + (def.aoe ? '🌀 範囲攻撃' : '🗡 単体攻撃') + '　実効攻撃力 <b style="color:#ffd86b">' + eff + '</b> ' + cmpDelta(eff - Game.Player.currentWeaponAtk()) + '<span style="color:#7a8494;font-size:.78rem">（手持ち比）</span></div>';
    }
    if (def.special) h += specialBlock(def.special); // 上位武器: 効果名+発動条件を平易に
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
    else if (def.food || def.cures || def.buff || def.skillTome || def.xpGain || def.invExpand || def.summonBoss || def.opensShop || def.recall) btns.push('<button id="inv-act" class="big-btn">' + (def.food ? '食べる' : def.skillTome ? '読む' : def.summonBoss ? '掲げる' : def.opensShop ? '鳴らす' : '使う') + '</button>');
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
    if (!el.invScreen.classList.contains('hidden')) {
      invSelected = -1; refreshInventory();
      const bi = document.getElementById('btn-inv'); if (bi) bi.classList.remove('craft-new'); // クラフト解禁バッジは開いたら消灯
    }
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
  // 死因ごとの一行対策ヒント(次の一手をその場で学べる)
  const DEATH_HINTS = {
    '餓死': '食料を持ち歩き、空腹バーが減り切る前に食べよう',
    '正気の崩壊': '影の世界に長居は禁物。松明や焚き火のそばで正気は戻る',
    '状態異常': '包帯・解毒薬を常備しよう。左上の状態アイコンをタップすると対処法が見られる',
    '棘の反射': '棘を持つ敵には弓・銃・投擲など遠くからの攻撃が安全',
    '魔物の襲撃': '防具を整え、回避ロール(無敵時間)を使おう。夜は明かりの近くが安全',
  };
  function showDeath(s) {
    const box = document.getElementById('death-stats'); if (!box) return;
    box.innerHTML =
      '<div>死因　　　<b style="color:#ff8a8a">' + s.cause + '</b></div>' +
      '<div>生存　　　<b>' + s.days + '</b> 日（約 ' + s.mins + ' 分）</div>' +
      '<div>レベル　　<b>' + s.level + '</b></div>' +
      '<div>撃破ボス　<b style="color:#ffd86b">' + s.bosses + '</b> 体</div>' +
      '<div>討伐総数　<b>' + s.kills + '</b></div>' +
      '<div>所持金塊　<b style="color:#e8c54a">' + s.gold + '</b></div>' +
      '<div class="death-hint">💡 ' + (DEATH_HINTS[s.cause] || '回復アイテムと回避ロールを忘れずに。装備の更新が生存の鍵') + '</div>';
    document.getElementById('death-screen').classList.remove('hidden');
  }

  // ===== トースト & 祝祭バナー =====
  // 既存の toast() 呼び出し(mobs/player/achievements 等)をメッセージ内容で振り分け、
  // 節目イベント(レベルアップ/ボス討伐/実績/レジェンダリー入手)はバナー演出へ昇格する。
  const RM = (typeof window.matchMedia === 'function') && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function plainToast(msg) {
    el.toast.className = ''; // 前回のレアリティ装飾等を解除
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }
  function richToast(html, cls, ms) {
    el.toast.className = cls || '';
    el.toast.innerHTML = html;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, ms || 1800);
  }
  // 単一バナー＋キュー(最大3)。ゲームを止めず上部に流す
  let bannerEl = null, bannerTimer = null;
  const bannerQ = [];
  function showBanner(icon, titleHtml, subHtml, cls, ms) {
    if (!bannerEl) {
      bannerEl = document.createElement('div'); bannerEl.id = 'event-banner';
      bannerEl.innerHTML = '<div class="eb-inner"><span class="eb-ic"></span><div class="eb-tx"><b class="eb-title"></b><span class="eb-sub"></span></div></div>';
      (document.getElementById('app') || document.body).appendChild(bannerEl);
    }
    if (bannerTimer) { if (bannerQ.length < 3) bannerQ.push([icon, titleHtml, subHtml, cls, ms]); return; }
    bannerEl.className = 'eb-show' + (cls ? ' ' + cls : '');
    bannerEl.querySelector('.eb-ic').textContent = icon || '';
    bannerEl.querySelector('.eb-title').innerHTML = titleHtml || '';
    const sub = bannerEl.querySelector('.eb-sub');
    sub.innerHTML = subHtml || ''; sub.style.display = subHtml ? '' : 'none';
    bannerTimer = setTimeout(function () {
      bannerEl.className = ''; bannerTimer = null;
      const nx = bannerQ.shift();
      if (nx) setTimeout(function () { showBanner(nx[0], nx[1], nx[2], nx[3], nx[4]); }, 240);
    }, ms || 2200);
  }
  // レベルアップ祝祭: セッション初回は盛大(金バースト大+バナー)、以降は控えめトースト
  let lvlUps = 0, burstEl = null;
  function goldBurst(big) {
    if (RM) return; // 動きを抑える設定を尊重
    if (!burstEl) { burstEl = document.createElement('div'); burstEl.id = 'lvl-burst'; (document.getElementById('app') || document.body).appendChild(burstEl); }
    burstEl.className = ''; void burstEl.offsetWidth;
    burstEl.className = big ? 'go big' : 'go';
  }
  function celebrateLevelUp(msg) {
    const m = msg.match(/Lv\.(\d+)/); const lv = m ? m[1] : '?';
    lvlUps++;
    goldBurst(lvlUps === 1);
    if (lvlUps === 1) {
      showBanner('✨', 'LEVEL UP！ <em>Lv.' + lv + '</em>', '最大HP+2・スキルP+2 — 左上のLvバッジから強化しよう', 'eb-lvl eb-big', 3000);
    } else {
      richToast('<b style="color:#ffe27a">▲ LEVEL UP — Lv.' + lv + '</b> <span style="color:#cfe0f0">スキルP+2</span>', 'tst-lvl', 1700);
    }
  }
  // レア以上の入手: レアリティ色＋アイテムアイコン。レジェンダリーは初回のみバナー(名前ごと)
  const legendSeen = {};
  function pickupToast(msg) {
    const m = msg.match(/^入手: (.+)（(.+)）$/);
    if (!m) return false;
    const name = m[1], rname = m[2];
    let idx = -1;
    Game.Loot.RARITY.forEach(function (r, i) { if (r.name === rname) idx = i; });
    if (idx < 1) return false; // コモンは通常トーストのまま(繰り返しは控えめに)
    const col = Game.Loot.RARITY[idx].color;
    // 表示名は affix接頭辞+基礎名 のため、末尾一致(最長)で元アイテムを推定しアイコン取得
    let baseId = null, bl = 0;
    for (const id in Game.ITEMS) { const d = Game.ITEMS[id]; if (d.name && name.length >= d.name.length && name.slice(-d.name.length) === d.name && d.name.length > bl) { baseId = id; bl = d.name.length; } }
    let url = null; try { url = baseId && Game.Icons ? Game.Icons.dataURL(baseId, null) : null; } catch (e) {}
    if (idx === 3 && !legendSeen[name]) {
      legendSeen[name] = 1;
      showBanner('🌟', '<em style="color:' + col + '">' + esc(name) + '</em>', 'レジェンダリーを手に入れた！', 'eb-leg eb-big', 2600);
      return true;
    }
    const ic = url ? '<span class="tst-ic" style="background-image:url(' + url + ')"></span>' : '';
    richToast(ic + '<b style="color:' + col + '">' + esc(name) + '</b><span class="tst-r" style="color:' + col + '">' + esc(rname) + '</span>', 'tst-rare r' + idx, 1900);
    return true;
  }
  function toast(msg) {
    msg = String(msg == null ? '' : msg);
    try {
      if (msg.indexOf('レベルアップ！') === 0) { celebrateLevelUp(msg); return; }
      if (msg.indexOf('実績: ') >= 0 && msg.indexOf('🏆') === 0) { // achievements.js: '🏆 実績: NAME — DESC'
        const body = msg.split('実績: ')[1] || '';
        const sp = body.split(' — ');
        showBanner('🏆', esc(sp[0] || '実績解除'), esc(sp[1] || '実績を解除した'), 'eb-ach', 2400);
        return;
      }
      const bk = msg.indexOf('を打ち倒した！'); // mobs.js のボス撃破文言のみ(雑魚討伐は含まれない)
      if (bk > 0) {
        const rest = msg.slice(bk + 'を打ち倒した！'.length).trim();
        showBanner('👑', esc(msg.slice(0, bk)) + '<em class="eb-slay">討伐</em>', esc(rest), 'eb-boss eb-big', 3000);
        return;
      }
      if (msg.indexOf('入手: ') === 0 && pickupToast(msg)) return;
    } catch (e) { /* 演出に失敗しても通常トーストで内容は必ず届ける */ }
    plainToast(msg);
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
        ctxBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(154px + max(var(--ey,16px), env(safe-area-inset-bottom)));z-index:57;background:rgba(28,40,64,.94);border:1px solid #5a78a8;border-radius:12px;padding:12px 20px;min-height:48px;font-size:1rem;color:#eaf2ff;font-weight:700;box-shadow:0 3px 12px rgba(0,0,0,.4);display:none;cursor:pointer';
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
        hbInfoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(118px + max(var(--ey,16px), env(safe-area-inset-bottom)));z-index:56;background:rgba(14,20,36,.9);border:1px solid #3a4c66;border-radius:10px;padding:6px 13px;max-width:86vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s;backdrop-filter:blur(2px)';
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
    else if (def.attack != null) sub = '🗡 武器 — 攻撃力 ' + Game.Player.effAttack(Game.Loot.stats(st).atk) + (def.special ? '　✦' + def.special.name : '');
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

  // 連続撃破コンボ表示(中央上にエスカレートして点滅)
  let comboEl = null, comboTimer = null;
  function flashCombo(n) {
    if (!comboEl) {
      comboEl = document.createElement('div'); comboEl.id = 'combo-hud';
      comboEl.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:58;font-weight:900;pointer-events:none;opacity:0;transition:opacity .25s;text-shadow:0 2px 8px rgba(0,0,0,.6);white-space:nowrap';
      (document.getElementById('app') || document.body).appendChild(comboEl);
    }
    const tier = n >= 30 ? '#ff4a6a' : n >= 20 ? '#ff8a3c' : n >= 10 ? '#ffd24a' : '#9fe0a0';
    const sz = Math.min(2.4, 1.2 + n * 0.03);
    comboEl.innerHTML = '<span style="color:' + tier + ';font-size:' + sz + 'rem">' + n + ' COMBO</span>' + (n % 10 === 0 ? '<div style="color:#ffe9a0;font-size:.8rem;text-align:center">★ ボーナス！</div>' : '');
    comboEl.style.opacity = '1';
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(function () { if (comboEl) comboEl.style.opacity = '0'; }, 1200);
  }

  // 控えめなオートセーブ表示(右下に一瞬フェード)。proactive-UX原則: 邪魔しない
  let saveEl = null, saveTimer = null;
  function flashSave(reason) {
    if (!saveEl) {
      saveEl = document.createElement('div'); saveEl.id = 'autosave-ind';
      saveEl.style.cssText = 'position:fixed;right:calc(10px + max(var(--ex,10px), env(safe-area-inset-right)));bottom:calc(10px + max(var(--ey,16px), env(safe-area-inset-bottom)));z-index:60;background:rgba(16,24,42,.82);color:#9fd8a0;border:1px solid #33455e;border-radius:8px;padding:5px 9px;font-size:.72rem;pointer-events:none;opacity:0;transition:opacity .35s;backdrop-filter:blur(2px)';
      (document.getElementById('app') || document.body).appendChild(saveEl);
    }
    saveEl.textContent = '💾 オートセーブ';
    saveEl.style.opacity = '1';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (saveEl) saveEl.style.opacity = '0'; }, 1100);
  }

  // ===== ゲームパッド メニューナビ（フォーカスリング / 十字キー・左スティック操作） =====
  // どのオーバーレイでも汎用に効く: 可視の操作要素を集めて方向で最寄りへフォーカス移動
  const PAD_FOCUS_SEL = 'button, .slot, input[type="range"], .craft-row, .eq-cell.filled, .sk-branch-name, [data-focusable]';
  const PAD_CLOSERS = {
    'inv-screen': function () { toggleInventory(); },
    'options-screen': function () { toggleOptions(); },
    'stats-screen': closeStats, 'chest-screen': closeChest, 'trade-screen': closeTrade,
    'story-screen': closeStory, 'quest-screen': closeQuest, 'enchant-screen': closeEnchant, 'lore-screen': closeLore,
  };
  let padFocusEl = null, padLastPt = null;
  function padMenuRoot() {
    // 最後（=最前面）の可視オーバーレイをナビ対象にする
    const list = document.querySelectorAll('.overlay:not(.hidden)');
    return list.length ? list[list.length - 1] : null;
  }
  function padRect(n) {
    const r = n.getBoundingClientRect();
    return (r.width < 4 || r.height < 4) ? null : r;
  }
  function padFocusables(root) {
    const out = [];
    root.querySelectorAll(PAD_FOCUS_SEL).forEach(function (n) {
      if (n.disabled || n.classList.contains('disabled')) return;
      const r = padRect(n); if (!r) return;
      out.push({ el: n, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    return out;
  }
  function padSetFocus(n) {
    if (padFocusEl && padFocusEl !== n) padFocusEl.classList.remove('pad-focus');
    padFocusEl = n; if (!n) return;
    n.classList.add('pad-focus');
    const r = n.getBoundingClientRect();
    padLastPt = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    try { n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  function padNearestPt(list, pt) {
    let best = list[0], bd = Infinity;
    list.forEach(function (c) { const d = Math.hypot(c.x - pt.x, c.y - pt.y); if (d < bd) { bd = d; best = c; } });
    return best;
  }
  const PAD_DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function padMove(list, cur, dir) {
    // 進行方向にあり、直交方向のずれが小さい要素を優先（グリッド対応）
    const v = PAD_DIRV[dir];
    let best = null, bs = Infinity;
    list.forEach(function (c) {
      if (c.el === cur.el) return;
      const dx = c.x - cur.x, dy = c.y - cur.y;
      const fwd = dx * v[0] + dy * v[1];
      if (fwd < 4) return; // 後方・同列は対象外
      const ortho = Math.abs(dx * v[1]) + Math.abs(dy * v[0]);
      const score = fwd + ortho * 2.6;
      if (score < bs) { bs = score; best = c; }
    });
    return best;
  }
  function padActivateEl(n) {
    if (!n) return;
    if (n.tagName === 'INPUT' && n.type !== 'range') { try { n.focus(); } catch (e) {} return; }
    if (n.tagName === 'INPUT') return; // スライダーは左右キーで調整
    // インベントリ格子は pointerdown/up タップ仕様(2連タップ=使用/装備)を合成イベントで踏襲
    if (n.classList.contains('slot') && n.parentElement && n.parentElement.id === 'inv-grid') {
      try {
        const r = n.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
        n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
        return;
      } catch (e) { /* PointerEvent 未対応環境は click へフォールバック */ }
    }
    n.click();
  }
  function padTab(root, dir) {
    const tabs = root.querySelectorAll('.craft-tabs .craft-tab');
    if (!tabs.length) return false;
    let on = 0; tabs.forEach(function (t, i) { if (t.classList.contains('on')) on = i; });
    const n = (on + dir + tabs.length) % tabs.length;
    tabs[n].click();
    const root2 = padMenuRoot(); // 再描画後の新タブへフォーカスを貼り直す
    if (root2) { const t2 = root2.querySelectorAll('.craft-tabs .craft-tab'); if (t2[n]) padSetFocus(t2[n]); }
    return true;
  }
  // 入口: 'up'|'down'|'left'|'right'|'ok'|'back'|'tabprev'|'tabnext'
  function padNav(cmd) {
    const root = padMenuRoot(); if (!root) return false;
    if (cmd === 'back') {
      const closer = PAD_CLOSERS[root.id];
      padSetFocus(null);
      if (closer) { Game.Audio.play('select'); closer(); }
      return true;
    }
    if (cmd === 'tabprev' || cmd === 'tabnext') return padTab(root, cmd === 'tabnext' ? 1 : -1);
    const list = padFocusables(root);
    if (!list.length) return false;
    let cur = null;
    if (padFocusEl && padFocusEl.isConnected && root.contains(padFocusEl)) {
      const r = padRect(padFocusEl);
      if (r) cur = { el: padFocusEl, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    if (!cur) { // 初回 or 再描画で消失: 直前位置に最も近い要素へ復帰
      padSetFocus(padLastPt ? padNearestPt(list, padLastPt).el : list[0].el);
      Game.Audio.play('cursor');
      return true;
    }
    if (cmd === 'ok') {
      padActivateEl(cur.el);
      if (!padFocusEl || !padFocusEl.isConnected) { // 再描画された画面へフォーカスを貼り直す
        const root2 = padMenuRoot();
        if (root2 && padLastPt) { const l2 = padFocusables(root2); if (l2.length) padSetFocus(padNearestPt(l2, padLastPt).el); }
      }
      return true;
    }
    if (cur.el.tagName === 'INPUT' && cur.el.type === 'range' && (cmd === 'left' || cmd === 'right')) {
      const mn = +cur.el.min || 0, mx = +cur.el.max || 100;
      const step = Math.max(1, Math.round((mx - mn) / 20));
      cur.el.value = Math.max(mn, Math.min(mx, (+cur.el.value) + (cmd === 'right' ? step : -step)));
      cur.el.dispatchEvent(new Event('input', { bubbles: true }));
      Game.Audio.play('cursor');
      return true;
    }
    const nxt = padMove(list, cur, cmd);
    if (nxt) { padSetFocus(nxt.el); Game.Audio.play('cursor'); }
    return true;
  }

  return {
    init, showGameUI, refreshHotbar, refreshStats, refreshInventory,
    refreshCraft, refreshAll, toggleInventory, toast, updateMinimap,
    openChest, openSharedChest, closeChest, refreshChest, refreshWorld,
    showLore, closeLore, refreshQuest, openQuest, closeQuest, refreshBounty, showEnding, showDeath, showIntro, refreshNet, refreshStatus,
    toggleOptions, openEnchant, closeEnchant, flashSave, flashHotbarItem, flashCombo, refreshContext, refreshAmmo,
    toggleBigMap, isBigMapOpen, updateBigMap, openStats, closeStats, toggleStats, renderStats, refreshBossBar, openTrade, closeTrade, openShop, openStory, closeStory,
    padNav, padMenuRoot, padActivateEl,
  };
})();
