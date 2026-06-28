// camera.js — 追従カメラと world<->screen 変換、可視範囲算出
window.Game = window.Game || {};

Game.Camera = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 描画は CSS ピクセルで行う（main.js で dpr スケール済み）
  function viewSize() {
    return { w: Game.view.w, h: Game.view.h };
  }

  function follow(alpha) {
    const p = Game.state.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    Game.state.camera.x = px;
    Game.state.camera.y = py;
  }

  function worldToScreen(wx, wy) {
    const v = viewSize();
    return {
      x: wx - Game.state.camera.x + v.w / 2,
      y: wy - Game.state.camera.y + v.h / 2,
    };
  }

  function screenToWorld(sx, sy) {
    const v = viewSize();
    return {
      x: sx + Game.state.camera.x - v.w / 2,
      y: sy + Game.state.camera.y - v.h / 2,
    };
  }

  function screenToTile(sx, sy) {
    const w = screenToWorld(sx, sy);
    return { tx: Math.floor(w.x / TS), ty: Math.floor(w.y / TS) };
  }

  // 可視タイル範囲（+1余白）
  function visibleTileRange() {
    const v = viewSize();
    const cx = Game.state.camera.x, cy = Game.state.camera.y;
    const tx0 = Math.floor((cx - v.w / 2) / TS) - 1;
    const ty0 = Math.floor((cy - v.h / 2) / TS) - 1;
    const tx1 = Math.floor((cx + v.w / 2) / TS) + 1;
    const ty1 = Math.floor((cy + v.h / 2) / TS) + 1;
    return { tx0, ty0, tx1, ty1 };
  }

  return { follow, worldToScreen, screenToWorld, screenToTile, visibleTileRange };
})();
