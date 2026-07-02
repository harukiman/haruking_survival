// input.js — キーボード/マウス/タッチ/ゲームパッドを統合 intent 化
window.Game = window.Game || {};

Game.Input = (function () {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, inside: false, moved: false };
  const touch = { up: false, down: false, left: false, right: false, mine: false, dash: false };
  const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 }; // フローティング仮想スティック
  const joySm = { x: 0, y: 0 };      // スティック出力の平滑化（方向のガタつき防止）
  let dashLatch = false;             // 走るボタン: 短タップでON/OFF固定（押しっぱ不要）
  let dashDownT = 0, dashLatchIdle = 0, dashTipShown = false;
  let placeQueued = false;   // 設置エッジ
  let useQueued = false;     // 開く/使うエッジ
  let rollQueued = false;    // 回避ロールエッジ
  let lastDir = 'down';
  const cursor = { x: 200, y: 200, active: false }; // ゲームパッド右スティックの選択カーソル
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  const intent = { dx: 0, dy: 0, dir: 'down', mine: false, place: false, dash: false, usePointer: false, mouseTile: null };

  // ===== キーリバインド =====
  const DEF_BINDS = { up: 'w', down: 's', left: 'a', right: 'd', mine: ' ', place: 'q', use: 'g', inv: 'e', stats: 'c', map: 'n', roll: 'r', dash: 'shift', shift: 'f' };
  function B(action) { const kb = Game.Settings && Game.Settings.get && Game.Settings.get('keybinds'); return (kb && kb[action]) || DEF_BINDS[action]; }
  let rebinding = null; // {action, cb}
  function beginRebind(action, cb) { rebinding = { action: action, cb: cb }; }
  function applyRebind(k) {
    if (!rebinding) return false;
    if (k === 'escape') { const r = rebinding; rebinding = null; if (r.cb) r.cb(null); return true; }
    const kb = Object.assign({}, (Game.Settings.get('keybinds') || DEF_BINDS));
    kb[rebinding.action] = k; Game.Settings.set('keybinds', kb);
    const r = rebinding; rebinding = null; if (r.cb) r.cb(k); return true;
  }
  const KEY_LABELS = { ' ': 'Space', 'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→', 'escape': 'Esc' };
  function keyLabel(k) { return KEY_LABELS[k] || (k ? k.toUpperCase() : '—'); }
  const BIND_ACTIONS = [
    ['up', '上移動'], ['down', '下移動'], ['left', '左移動'], ['right', '右移動'],
    ['mine', '採掘/攻撃'], ['place', '設置'], ['use', '開く/使う'], ['inv', 'インベントリ'],
    ['stats', 'ステータス'], ['map', '大マップ'], ['roll', '回避ロール'], ['dash', '走る'], ['shift', '影渡り'],
  ];

  function init() {
    const cv = Game.canvas;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // フォーム入力中は無視
      const k = e.key.toLowerCase();
      if (rebinding) { e.preventDefault(); applyRebind(k); return; } // リバインド捕捉中
      keys[k] = true;
      if (!Game.state) return; // ゲーム開始前は操作無効
      // ホットバー 1-9
      if (k >= '1' && k <= '9') Game.Inventory.setHotbar(parseInt(k, 10) - 1);
      if (k === B('inv')) { Game.UI.toggleInventory(); }
      if (k === B('shift')) { Game.World.shift(); }          // 世界シフト
      if (k === 'm') { const on = Game.Audio.toggle(); Game.UI.toast(on ? 'サウンド ON' : 'サウンド OFF'); }
      if (k === 'escape' || k === 'p') { Game.UI.toggleOptions(); } // 設定は固定(誤割当でロックしない)
      if (k === B('map') || k === 'tab') { e.preventDefault(); Game.UI.toggleBigMap(); } // 大マップ
      if (k === B('stats')) { Game.UI.toggleStats(); } // ステータス&スキル(再押下で閉じる)
      if (k === B('place') || k === 'k') placeQueued = true; // facing設置
      if (k === B('use')) useQueued = true;   // 開く/使う(近隣のチェスト等)
      if (k === B('roll')) rollQueued = true;  // 回避ロール
      if (k === ' ') e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

    cv.addEventListener('mousemove', function (e) {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.inside = true; mouse.moved = true;
    });
    cv.addEventListener('mouseleave', function () { mouse.inside = false; });
    cv.addEventListener('mousedown', function (e) {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      if (e.button === 0) mouse.down = true;
      else if (e.button === 2) placeQueued = true;
    });
    window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = false; });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      let i = Game.state.player.hotbarIndex + dir;
      if (i < 0) i = Game.HOTBAR_SIZE - 1;
      if (i >= Game.HOTBAR_SIZE) i = 0;
      Game.Inventory.setHotbar(i);
    }, { passive: false });

    initTouch();
    // コントローラ接続でタッチUIを隠す
    window.addEventListener('gamepadconnected', function () { document.body.classList.add('has-pad'); if (Game.UI) Game.UI.toast('コントローラを接続しました'); });
    window.addEventListener('gamepaddisconnected', function () {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let any = false; for (let i = 0; i < pads.length; i++) if (pads[i]) any = true;
      if (!any) { document.body.classList.remove('has-pad'); cursor.active = false; }
    });
  }

  function initTouch() {
    // フローティング仮想スティック（左側のタッチで出現・指を追いかける追従式）
    const cv = Game.canvas, JR = 56;
    const joyEl = document.getElementById('joystick'), knob = document.getElementById('joy-knob');
    function setKnob(kx, ky) { if (knob) knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)'; }
    function setJoyPos(x, y) { if (joyEl) { joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; } }
    if (cv) {
      cv.addEventListener('touchstart', function (e) {
        if (document.body.classList.contains('has-pad')) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (joy.active) break;
          // 移動スティックの割り当て（左利きは右側で受け付け）
          const lh = Game.Settings && Game.Settings.get('leftHanded');
          const inZone = lh ? (t.clientX > window.innerWidth * 0.45) : (t.clientX < window.innerWidth * 0.55);
          if (inZone && t.clientY > 90) {
            joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.dx = 0; joy.dy = 0;
            if (joyEl) { setJoyPos(t.clientX, t.clientY); joyEl.classList.remove('hidden'); }
            setKnob(0, 0); e.preventDefault();
          }
        }
      }, { passive: false });
      cv.addEventListener('touchmove', function (e) {
        if (!joy.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier !== joy.id) continue;
          let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; let len = Math.hypot(dx, dy);
          // 追従式: 半径を超えた分だけ原点を指へ引きずる → 反転入力が即応する
          if (len > JR && (!Game.Settings || Game.Settings.get('joyFollow') !== false)) {
            const k = (len - JR) / len;
            joy.ox += dx * k; joy.oy += dy * k; setJoyPos(joy.ox, joy.oy);
            dx = t.clientX - joy.ox; dy = t.clientY - joy.oy; len = JR;
          }
          const l = len || 1;
          const cl = Math.min(len, JR), nx = dx / l, ny = dy / l;
          joy.dx = nx * (cl / JR); joy.dy = ny * (cl / JR); setKnob(nx * cl, ny * cl); e.preventDefault();
        }
      }, { passive: false });
      const endJoy = function (e) {
        if (!joy.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joy.id) { joy.active = false; joy.dx = 0; joy.dy = 0; joySm.x = 0; joySm.y = 0; if (joyEl) joyEl.classList.add('hidden'); }
        }
      };
      cv.addEventListener('touchend', endJoy, { passive: false });
      cv.addEventListener('touchcancel', endJoy, { passive: false });
    }
    const dbtns = document.querySelectorAll('#dpad .dbtn');
    dbtns.forEach(function (b) {
      const dir = b.getAttribute('data-dir');
      const set = function (v) { return function (e) { e.preventDefault(); touch[dir] = v; }; };
      b.addEventListener('touchstart', set(true), { passive: false });
      b.addEventListener('touchend', set(false), { passive: false });
      b.addEventListener('touchcancel', set(false), { passive: false });
      // マウスでも押せるように
      b.addEventListener('mousedown', set(true));
      b.addEventListener('mouseup', set(false));
      b.addEventListener('mouseleave', set(false));
    });
    const mineBtn = document.getElementById('btn-mine');
    mineBtn.addEventListener('touchstart', function (e) { e.preventDefault(); touch.mine = true; }, { passive: false });
    mineBtn.addEventListener('touchend', function (e) { e.preventDefault(); touch.mine = false; }, { passive: false });
    mineBtn.addEventListener('mousedown', function () { touch.mine = true; });
    mineBtn.addEventListener('mouseup', function () { touch.mine = false; });
    const placeBtn = document.getElementById('btn-place');
    const doPlace = function (e) { e.preventDefault(); placeQueued = true; };
    placeBtn.addEventListener('touchstart', doPlace, { passive: false });
    placeBtn.addEventListener('click', doPlace);
    document.getElementById('btn-inv').addEventListener('click', function () { Game.UI.toggleInventory(); });
    const useBtn = document.getElementById('btn-use');
    if (useBtn) { const doUse = function (e) { e.preventDefault(); useQueued = true; }; useBtn.addEventListener('touchstart', doUse, { passive: false }); useBtn.addEventListener('click', doUse); }
    const rollBtn = document.getElementById('btn-roll');
    if (rollBtn) { const doRoll = function (e) { e.preventDefault(); rollQueued = true; }; rollBtn.addEventListener('touchstart', doRoll, { passive: false }); rollBtn.addEventListener('click', doRoll); }
    const shiftBtn = document.getElementById('btn-shift');
    if (shiftBtn) shiftBtn.addEventListener('click', function (e) { e.preventDefault(); Game.World.shift(); });
    const dashBtn = document.getElementById('btn-dash');
    if (dashBtn) {
      // 押しっぱ=走る / 短タップ=走り続けるON・OFF切替（親指を固定しなくて良い）
      dashBtn.addEventListener('touchstart', function (e) { e.preventDefault(); touch.dash = true; dashDownT = performance.now(); }, { passive: false });
      const dashUp = function (e) {
        e.preventDefault(); touch.dash = false;
        if (performance.now() - dashDownT < 260) {
          setDashLatch(!dashLatch);
          if (dashLatch && !dashTipShown && Game.UI) { dashTipShown = true; Game.UI.toast('走り続ける: ON（もう一度タップで解除）'); }
        }
      };
      dashBtn.addEventListener('touchend', dashUp, { passive: false });
      dashBtn.addEventListener('touchcancel', function (e) { e.preventDefault(); touch.dash = false; }, { passive: false });
      // マウスは従来どおり押している間だけ
      dashBtn.addEventListener('mousedown', function () { touch.dash = true; });
      dashBtn.addEventListener('mouseup', function () { touch.dash = false; });
      dashBtn.addEventListener('mouseleave', function () { touch.dash = false; });
    }
  }

  function setDashLatch(v) {
    dashLatch = v; dashLatchIdle = 0;
    const b = document.getElementById('btn-dash');
    if (b) b.classList.toggle('latched', v);
  }

  // ゲームパッド（PS4/DualShock4 標準配置）
  const padPrev = [];
  let padIdle = 0; // 右スティックを離してからの経過フレーム(自動照準切替用)
  // ===== ゲームパッドのボタン割当(再割当可能・Settings保存) =====
  const PAD_DEF = { mine: 0, fire: 7, place: 2, shift: 3, roll: 1, hotbarPrev: 4, hotbarNext: 5, dash: 6, inv: 9, map: 11 };
  const PAD_ACTIONS = [
    ['mine', '採掘/攻撃'], ['fire', '照準で攻撃'], ['place', '設置/対話'], ['shift', '影渡り'], ['roll', '回避ロール'],
    ['hotbarPrev', 'ホットバー←'], ['hotbarNext', 'ホットバー→'], ['dash', '走る'], ['inv', 'インベントリ'], ['map', '大マップ'],
  ];
  function PB(a) { const m = Game.Settings && Game.Settings.get && Game.Settings.get('padbinds'); return (m && m[a] != null) ? m[a] : PAD_DEF[a]; }
  function padLabel(a) { const b = PB(a); return 'ボタン' + b; }
  let padRebind = null; // {action, cb}
  function beginPadRebind(action, cb) { padRebind = { action: action, cb: cb }; }
  function resetPadBinds() { if (Game.Settings) Game.Settings.set('padbinds', Object.assign({}, PAD_DEF)); }
  function pollGamepad(out) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) return;
    const btn = function (i) { return gp.buttons[i] && gp.buttons[i].pressed; };
    const edge = function (i) { const p = btn(i); const e = p && !padPrev[i]; padPrev[i] = p; return e; };
    // リバインド捕捉中: 最初に押されたボタンを割当て、ゲーム操作は処理しない
    if (padRebind) {
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i] && gp.buttons[i].pressed && !padPrev[i]) {
          const m = Object.assign({}, (Game.Settings.get('padbinds') || PAD_DEF)); m[padRebind.action] = i;
          Game.Settings.set('padbinds', m);
          const r = padRebind; padRebind = null; if (r.cb) r.cb(i);
          break;
        }
      }
      for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = gp.buttons[i] && gp.buttons[i].pressed;
      return;
    }

    // 移動: 左スティック（放射状デッドゾーン＋滑らかな立ち上がり）+ 十字キー
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const al = Math.hypot(ax, ay);
    if (al > 0.22) { const g = Math.min(1, (al - 0.22) / 0.78); out.dx += (ax / al) * g; out.dy += (ay / al) * g; }
    if (btn(14)) out.dx -= 1; if (btn(15)) out.dx += 1;   // dpad L/R
    if (btn(12)) out.dy -= 1; if (btn(13)) out.dy += 1;   // dpad U/D

    // 右スティック=選択カーソル移動（マウス代替）。動かしている間だけ表示し、
    // 離せば自動でカーソルを消して「向いている方向」へ自動照準する(#18)
    // 2乗レスポンスで微調整しやすく、大きく倒せば素早く動く
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    const menuOpen = Game.state && Game.state.paused; // メニュー中はカーソルでボタン操作するため維持
    if (Math.abs(rx) > 0.16 || Math.abs(ry) > 0.16) {
      cursor.active = true; padIdle = 0;
      cursor.x = clamp(cursor.x + rx * Math.abs(rx) * 13, 0, Game.view ? Game.view.w : window.innerWidth);
      cursor.y = clamp(cursor.y + ry * Math.abs(ry) * 13, 0, Game.view ? Game.view.h : window.innerHeight);
      mouse.x = cursor.x; mouse.y = cursor.y; mouse.inside = true; mouse.moved = true;
    } else if (cursor.active && !menuOpen) {
      // スティックを離した: 数フレーム後にカーソルを消し、方向照準へ切替
      padIdle++;
      if (padIdle > 8) { cursor.active = false; mouse.inside = false; mouse.moved = false; }
    }

    // 採掘/攻撃(押しっぱ)。カーソル非使用時は向いている方向へ
    if (btn(PB('mine'))) out.mine = true;
    // 照準で攻撃: メニュー上ならボタン押下、フィールドなら採掘/攻撃(カーソル位置 or 向き方向)
    if (btn(PB('fire'))) { out.mine = true; if (cursor.active) { mouse.x = cursor.x; mouse.y = cursor.y; mouse.inside = true; mouse.moved = true; } }
    if (edge(PB('fire'))) clickAtCursor();
    // 設置/対話(エッジ)
    if (edge(PB('place'))) placeQueued = true;
    // 影渡り(エッジ)
    if (edge(PB('shift'))) Game.World.shift();
    // 回避ロール(エッジ)
    if (edge(PB('roll'))) rollQueued = true;
    // ホットバー切替(エッジ)
    if (edge(PB('hotbarPrev'))) { let n = Game.state.player.hotbarIndex - 1; if (n < 0) n = Game.HOTBAR_SIZE - 1; Game.Inventory.setHotbar(n); }
    if (edge(PB('hotbarNext'))) { let n = Game.state.player.hotbarIndex + 1; if (n >= Game.HOTBAR_SIZE) n = 0; Game.Inventory.setHotbar(n); }
    // ダッシュ
    if (btn(PB('dash'))) out.dash = true;
    // インベントリ(エッジ)
    if (edge(PB('inv'))) Game.UI.toggleInventory();
    // 大マップ開閉(エッジ)
    if (edge(PB('map'))) Game.UI.toggleBigMap();
    // 他ボタンのprev更新（エッジ漏れ防止）
    [8, 10, 16].forEach(function (i) { padPrev[i] = btn(i); });
  }

  // カーソル位置のDOM要素がボタンならクリック（メニュー操作）
  function clickAtCursor() {
    if (!cursor.active) return;
    const el = document.elementFromPoint(cursor.x, cursor.y);
    if (el && (el.tagName === 'BUTTON' || el.closest('button'))) {
      (el.tagName === 'BUTTON' ? el : el.closest('button')).click();
    }
  }

  function poll() {
    let dx = 0, dy = 0;
    if (keys[B('left')] || keys['arrowleft'] || touch.left) dx -= 1;
    if (keys[B('right')] || keys['arrowright'] || touch.right) dx += 1;
    if (keys[B('up')] || keys['arrowup'] || touch.up) dy -= 1;
    if (keys[B('down')] || keys['arrowdown'] || touch.down) dy += 1;
    // フローティング仮想スティック: 放射状デッドゾーン(0.14)＋なめらか再スケール＋平滑化
    let jx = 0, jy = 0;
    if (joy.active) {
      const jl = Math.hypot(joy.dx, joy.dy), DZ = 0.14;
      if (jl > DZ) {
        const g = Math.min(1, (jl - DZ) / (1 - DZ));
        const sn = (Game.Settings ? Game.Settings.get('joySens') : 100) / 100;
        jx = (joy.dx / jl) * g * sn; jy = (joy.dy / jl) * g * sn;
      }
    }
    if (jx === 0 && jy === 0) { joySm.x = 0; joySm.y = 0; } // 離した瞬間は即停止（滑り防止）
    else { joySm.x += (jx - joySm.x) * 0.55; joySm.y += (jy - joySm.y) * 0.55; }
    dx += joySm.x; dy += joySm.y;

    const tmp = { dx: dx, dy: dy, mine: false, dash: false };
    pollGamepad(tmp);
    dx = tmp.dx; dy = tmp.dy;

    // 向き（縦横の支配的な方向）
    if (Math.abs(dx) > Math.abs(dy)) lastDir = dx < 0 ? 'left' : 'right';
    else if (dy !== 0) lastDir = dy < 0 ? 'up' : 'down';

    // 走り続けるモード: 入力が約0.7秒途切れたら自動解除
    const movingNow = (dx !== 0 || dy !== 0);
    if (dashLatch) { if (movingNow) dashLatchIdle = 0; else if (++dashLatchIdle > 20) setDashLatch(false); }

    const usePointer = mouse.inside && mouse.moved && !('ontouchstart' in window && !mouse.down);
    intent.dx = dx; intent.dy = dy; intent.dir = lastDir;
    intent.mine = mouse.down || touch.mine || !!keys[B('mine')] || !!keys['j'] || tmp.mine;
    intent.place = placeQueued; placeQueued = false;
    intent.use = useQueued; useQueued = false;
    intent.roll = rollQueued; rollQueued = false;
    intent.dash = !!keys[B('dash')] || touch.dash || tmp.dash || (dashLatch && movingNow);
    intent.usePointer = usePointer;
    intent.mouseTile = usePointer ? Game.Camera.screenToTile(mouse.x, mouse.y) : null;
    return intent;
  }

  function resetBinds() { Game.Settings.set('keybinds', Object.assign({}, DEF_BINDS)); }
  return { init, poll, intent, cursor, beginRebind, keyLabel, bindAt: B, BIND_ACTIONS, resetBinds,
    beginPadRebind, padLabel, PAD_ACTIONS, resetPadBinds };
})();
