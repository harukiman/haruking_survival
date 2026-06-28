// ui.js — HUD/ホットバー/インベントリ/クラフト/ミニマップ/トースト
window.Game = window.Game || {};

Game.UI = (function () {
  let el = {};
  let toastTimer = null;
  let mmCtx = null;
  let bmCtx = null, bigMapOpen = false;
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
    if (lb) lb.addEventListener('click', openStats);
    // デバッグ用チートコード（haruking でアイテム付与パネル解禁）
    const cheatIn = document.getElementById('cheat-input');
    if (cheatIn) cheatIn.addEventListener('input', function () {
      const panel = document.getElementById('cheat-panel');
      if (cheatIn.value.trim().toLowerCase() === 'haruking') { buildCheatPanel(panel); panel.classList.remove('hidden'); }
      else panel.classList.add('hidden');
    });
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
    document.getElementById('btn-close-chest').addEventListener('click', closeChest);
    var cm = document.getElementById('chest-multi'); if (cm) cm.addEventListener('click', toggleChestMulti);
    var cds = document.getElementById('chest-deposit-sel'); if (cds) cds.addEventListener('click', depositSelected);
    var cda = document.getElementById('chest-deposit-all'); if (cda) cda.addEventListener('click', depositAll);
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
    if (bigMapOpen) { applyBigMapOpacity(); updateBigMap(); }
  }
  function isBigMapOpen() { return bigMapOpen; }

  // ===== ステータス & スキル画面 =====
  function openStats() {
    const sc = document.getElementById('stats-screen'); if (!sc) return;
    sc.classList.remove('hidden'); Game.state.paused = true; renderStats();
  }
  function closeStats() { const sc = document.getElementById('stats-screen'); if (sc) sc.classList.add('hidden'); Game.state.paused = false; }
  function renderStats() {
    const p = Game.state.player; const body = document.getElementById('stats-body'); if (!body || !p) return;
    const slot = Game.Inventory.selectedSlot(); const wst = Game.Loot.stats(slot);
    const eff = Game.Player.effAttack(wst.atk > 0 ? wst.atk : 1);
    let h = '';
    h += '<div class="ench-stat">Lv.' + p.level + '（EXP ' + p.xp + '/' + p.xpNext + '）　スキルP: <span class="sp-badge">' + (p.skillPoints || 0) + '</span></div>';
    h += '<div class="ench-stat">攻撃力(手持ち) <b style="color:#ffd86b">' + eff + '</b>　防御力 <b style="color:#9fd8ff">' + Game.Player.totalArmor() + '</b>　最大HP <b style="color:#ff8a8a">' + p.maxHealth + '</b></div>';
    const stats = [['str', '力 STR', '攻撃 +1 / pt'], ['vit', '体 VIT', '最大HP +5 / pt'], ['dex', '技 DEX', '攻撃速度UP / pt']];
    stats.forEach(function (s) {
      h += '<div class="stat-row"><span class="sname">' + s[1] + ' <em>' + s[2] + '</em></span><span class="sval">' + (p[s[0]] || 0) + '</span><button class="stat-plus" data-stat="' + s[0] + '"' + ((p.skillPoints || 0) <= 0 ? ' disabled' : '') + '>＋</button></div>';
    });
    h += '<h2>スキル</h2>';
    for (const id in Game.SKILLS) {
      const sk = Game.SKILLS[id]; const owned = p.skills && p.skills[id];
      h += '<div class="skill-row' + (owned ? ' owned' : '') + '"><div><b>' + sk.name + '</b> <span style="color:#8fa3bb">(' + sk.cost + 'P)</span><br><span style="color:#9fb0c4;font-size:.8rem">' + sk.desc + '</span></div>' +
        (owned ? '<span class="sk-buy">習得済</span>' : '<button class="sk-buy" data-skill="' + id + '"' + ((p.skillPoints || 0) < sk.cost ? ' disabled style="opacity:.4"' : '') + '>習得</button>') + '</div>';
    }
    h += '<p class="hint">スキルPは好きな時に振れます。振り直しは「記憶の書」(レア)を使用。</p>';
    body.innerHTML = h;
    body.querySelectorAll('.stat-plus').forEach(function (b) { b.addEventListener('click', function () { Game.Player.spendStat(b.getAttribute('data-stat')); renderStats(); }); });
    body.querySelectorAll('.sk-buy[data-skill]').forEach(function (b) { b.addEventListener('click', function () { const id = b.getAttribute('data-skill'); if (Game.Player.unlockSkill(id, Game.SKILLS[id].cost)) renderStats(); }); });
  }

  // 発見済みランドマークのマーカー色
  const LANDMARK_COL = { dungeon: '#e0644a', vault: '#e3c24a', stela: '#b6a6f0', treasure: '#ffd86b', cosmic: '#7fc8ff', boss: '#ff5a4a' };

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
      bmCtx.fillStyle = LANDMARK_COL[kind] || '#fff';
      bmCtx.beginPath(); bmCtx.arc(mx, my, 5, 0, Math.PI * 2); bmCtx.fill();
      bmCtx.strokeStyle = 'rgba(0,0,0,0.6)'; bmCtx.lineWidth = 1.5; bmCtx.stroke();
    }
    // 仲間（MP・同一世界）
    if (Game.Net && Game.Net.isConnected()) {
      const peers = Game.Net.getPeers();
      for (const id in peers) {
        const pe = peers[id]; if (!pe || pe.world !== Game.state.worldName || pe.tx == null) continue;
        const mx = (pe.tx - (ptx - half)) * scale, my = (pe.ty - (pty - half)) * scale;
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
    if (opening) renderOptions();
  }

  // マイクラ風 設定一覧（音量/明るさ/ボタン/操作）
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
      toggle('showFps', '📈 FPS表示');
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
    renderInvQuest();
    renderInvDetail();
    refreshCraft();
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
    if (!dragging) { invSelected = src; refreshInventory(); return; } // タップ=選択
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
      h += '<div class="ench-stat">' + (def.aoe ? '🌀 範囲攻撃' : '🗡 単体攻撃') + '　実効攻撃力 <b style="color:#ffd86b">' + eff + '</b>（Lv/STR補正込）</div>';
    }
    if (def.armor != null) h += '<div class="ench-stat">🛡 防御 <b style="color:#9fd8ff">' + Game.Loot.stats(st).armor + '</b></div>';
    if (def.flavor) h += '<div class="tt-flavor" style="margin-bottom:6px">' + def.flavor + '</div>';
    const btns = [];
    if (def.armor && def.slot) btns.push('<button id="inv-act" class="big-btn">装備する</button>');
    else if (def.food || def.cures) btns.push('<button id="inv-act" class="big-btn">' + (def.cures ? '使う' : '食べる') + '</button>');
    else if (Game.Loot.rollable(st.id) || def.tool) btns.push('<button id="inv-hot" class="big-btn alt">ホットバーへ装備</button>');
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

  // チートパネル: 全アイテムをタップで付与
  let cheatBuilt = false;
  function buildCheatPanel(panel) {
    if (!panel || cheatBuilt) return; cheatBuilt = true;
    let h = '<p class="hint">タップで付与（装備はランダムaffix付き／素材は10個）。デバッグ用。</p><div class="grid" id="cheat-grid"></div>';
    panel.innerHTML = h;
    const grid = document.getElementById('cheat-grid');
    for (const id in Game.ITEMS) {
      const def = Game.ITEMS[id];
      const cell = document.createElement('div'); cell.className = 'slot';
      const g = Game.ITEM_GLYPH[id];
      cell.innerHTML = g ? '<span class="icon glyph">' + g + '</span>' : '<span class="icon" style="background:' + (def.color || '#888') + '"></span>';
      cell.title = def.name;
      cell.addEventListener('click', function () {
        if (Game.Loot.rollable(id)) { Game.Inventory.addInstance({ id: id, roll: Game.Loot.roll(id, 0.2) }); }
        else { Game.Inventory.add(id, (def.stack && def.stack > 1) ? 10 : 1); }
        toast('付与: ' + def.name); refreshInventory();
      });
      grid.appendChild(cell);
    }
  }

  function refreshCraft() {
    el.craftList.innerHTML = '';
    const list = Game.Crafting.availableList();
    // タブ
    const tabs = document.createElement('div'); tabs.className = 'craft-tabs';
    const mkTab = function (key, label) {
      const t = document.createElement('button'); t.className = 'craft-tab' + (craftCatFilter === key ? ' on' : ''); t.textContent = label;
      t.addEventListener('click', function () { craftCatFilter = key; refreshCraft(); }); return t;
    };
    tabs.appendChild(mkTab('all', 'すべて'));
    CRAFT_CATS.forEach(function (c) { tabs.appendChild(mkTab(c[0], c[1].replace(/ .*/, ''))); });
    el.craftList.appendChild(tabs);
    // カテゴリ別セクション
    CRAFT_CATS.forEach(function (cat) {
      if (craftCatFilter !== 'all' && craftCatFilter !== cat[0]) return;
      const rows = list.filter(function (e) { return craftCategory(Game.ITEMS[e.recipe.out.id]) === cat[0]; });
      if (!rows.length) return;
      const head = document.createElement('div'); head.className = 'craft-cat-head'; head.textContent = cat[1] + '（' + rows.length + '）';
      el.craftList.appendChild(head);
      rows.forEach(function (entry) {
        const r = entry.recipe, out = Game.ITEMS[r.out.id];
        const row = document.createElement('div');
        row.className = 'craft-row' + (entry.can ? '' : ' disabled');
        let ing = '';
        for (const id in r.in) ing += (Game.ITEMS[id] ? Game.ITEMS[id].name : id) + '×' + r.in[id] + ' ';
        const station = r.station ? ' <em>(' + (r.station === 'furnace' ? 'かまど' : '作業台') + ')</em>' : '';
        const glyph = Game.ITEM_GLYPH[r.out.id];
        row.innerHTML = (glyph ? '<span class="ci" style="background:transparent;font-size:18px;text-align:center">' + glyph + '</span>' : '<span class="ci" style="background:' + (out.color || '#888') + '"></span>') +
          '<span class="cn">' + out.name + (r.out.n > 1 ? '×' + r.out.n : '') + station + '</span>' +
          '<span class="cin">' + ing + '</span>';
        row.addEventListener('click', function () { if (Game.Crafting.craft(r)) refreshInventory(); });
        el.craftList.appendChild(row);
      });
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
      cell.className = 'slot' + (chestMulti && chestSel[i] ? ' multi-sel' : ''); cell.innerHTML = slotHTML(st);
      cell.addEventListener('click', function () {
        if (chestMulti) { if (!st) return; chestSel[i] = !chestSel[i]; refreshChest(); }
        else invToChest(i);
      });
      el.chestInvGrid.appendChild(cell);
    });
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
    toggleBigMap, isBigMapOpen, updateBigMap, openStats, closeStats, renderStats,
  };
})();
