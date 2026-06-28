// ui.js — HUD/ホットバー/インベントリ/クラフト/ミニマップ/トースト
window.Game = window.Game || {};

Game.UI = (function () {
  let el = {};
  let toastTimer = null;
  let mmCtx = null;

  function init() {
    el.hud = document.getElementById('hud');
    el.hotbar = document.getElementById('hotbar');
    el.health = document.getElementById('health-bar');
    el.hunger = document.getElementById('hunger-bar');
    el.clock = document.getElementById('clock-text');
    el.invScreen = document.getElementById('inv-screen');
    el.invGrid = document.getElementById('inv-grid');
    el.craftList = document.getElementById('craft-list');
    el.toast = document.getElementById('toast');
    el.touch = document.getElementById('touch-controls');
    el.minimap = document.getElementById('minimap');
    mmCtx = el.minimap.getContext('2d');

    document.getElementById('btn-close-inv').addEventListener('click', toggleInventory);
    buildHotbar();
    // モバイル端末ならタッチUI表示
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      el.touch.classList.remove('hidden');
    }
  }

  function showGameUI() {
    el.hud.classList.remove('hidden');
    el.hotbar.classList.remove('hidden');
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
    return '<span class="icon" style="background:' + col + '" title="' + (def ? def.name : stack.id) + '"></span>' + cnt;
  }

  function refreshHotbar() {
    if (!el.hotbar || !Game.state) return;
    const s = Game.Inventory.slots();
    const slots = el.hotbar.children;
    for (let i = 0; i < slots.length; i++) {
      slots[i].innerHTML = slotHTML(s[i]);
      slots[i].classList.toggle('selected', i === Game.state.player.hotbarIndex);
    }
  }

  function refreshStats() {
    if (!el.health || !Game.state) return;
    const p = Game.state.player;
    el.health.style.width = (p.health / p.maxHealth * 100) + '%';
    el.hunger.style.width = (p.hunger / p.maxHunger * 100) + '%';
    el.clock.textContent = Game.DayNight.clockText();
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
          return function () {
            const st = Game.Inventory.slots()[idx];
            if (!st) return;
            const def = Game.ITEMS[st.id];
            if (def && def.food) {
              // 食べる
              const tmp = Game.state.player.hotbarIndex;
              Game.state.player.hotbarIndex = -1;
              if (st.count > 0 && Game.state.player.hunger < Game.state.player.maxHunger) {
                Game.Survival.eat(def.food); Game.Inventory.remove(st.id, 1); Game.Audio.play('eat'); refreshAll();
              }
              Game.state.player.hotbarIndex = tmp;
            }
          };
        })(i));
      }
      el.invGrid.appendChild(d);
    }
    refreshCraft();
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

  function refreshAll() { refreshHotbar(); refreshStats(); refreshInventory(); }

  function toggleInventory() {
    el.invScreen.classList.toggle('hidden');
    Game.state.paused = !el.invScreen.classList.contains('hidden');
    if (!el.invScreen.classList.contains('hidden')) refreshInventory();
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
    mmCtx.clearRect(0, 0, size, size);
    for (let y = 0; y < span; y++) {
      for (let x = 0; x < span; x++) {
        const t = Game.WorldGen.genTile(ptx - half + x, pty - half + y, Game.state.seed);
        mmCtx.fillStyle = Game.TILE_COLOR[t.ground] || '#333';
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
  };
})();
