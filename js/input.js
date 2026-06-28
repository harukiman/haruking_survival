// input.js — キーボード/マウス/タッチ/ゲームパッドを統合 intent 化
window.Game = window.Game || {};

Game.Input = (function () {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, inside: false, moved: false };
  const touch = { up: false, down: false, left: false, right: false, mine: false };
  let placeQueued = false;   // 設置エッジ
  let lastDir = 'down';

  const intent = { dx: 0, dy: 0, dir: 'down', mine: false, place: false, usePointer: false, mouseTile: null };

  function init() {
    const cv = Game.canvas;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // フォーム入力中は無視
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (!Game.state) return; // ゲーム開始前は操作無効
      // ホットバー 1-9
      if (k >= '1' && k <= '9') Game.Inventory.setHotbar(parseInt(k, 10) - 1);
      if (k === 'e') { Game.UI.toggleInventory(); }
      if (k === 'k' || k === 'q') placeQueued = true; // facing設置
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
  }

  function initTouch() {
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
  }

  // ゲームパッド（接続時のみ）
  function pollGamepad(out) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (!gp) return;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) > 0.25) out.dx += ax;
    if (Math.abs(ay) > 0.25) out.dy += ay;
    if (gp.buttons[0] && gp.buttons[0].pressed) out.mine = true;       // A
    if (gp.buttons[1] && gp.buttons[1].pressed) placeQueued = true;    // B
  }

  function poll() {
    let dx = 0, dy = 0;
    if (keys['a'] || keys['arrowleft'] || touch.left) dx -= 1;
    if (keys['d'] || keys['arrowright'] || touch.right) dx += 1;
    if (keys['w'] || keys['arrowup'] || touch.up) dy -= 1;
    if (keys['s'] || keys['arrowdown'] || touch.down) dy += 1;

    const tmp = { dx: dx, dy: dy, mine: false };
    pollGamepad(tmp);
    dx = tmp.dx; dy = tmp.dy;

    // 向き（縦横の支配的な方向）
    if (Math.abs(dx) > Math.abs(dy)) lastDir = dx < 0 ? 'left' : 'right';
    else if (dy !== 0) lastDir = dy < 0 ? 'up' : 'down';

    const usePointer = mouse.inside && mouse.moved && !('ontouchstart' in window && !mouse.down);
    intent.dx = dx; intent.dy = dy; intent.dir = lastDir;
    intent.mine = mouse.down || touch.mine || !!keys[' '] || !!keys['j'] || tmp.mine;
    intent.place = placeQueued; placeQueued = false;
    intent.usePointer = usePointer;
    intent.mouseTile = usePointer ? Game.Camera.screenToTile(mouse.x, mouse.y) : null;
    return intent;
  }

  return { init, poll, intent };
})();
