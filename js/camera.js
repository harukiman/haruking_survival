// camera.js — 追従カメラと world<->screen 変換、可視範囲算出
window.Game = window.Game || {};

Game.Camera = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 描画は CSS ピクセルで行う（main.js で dpr スケール済み）
  function viewSize() {
    return { w: Game.view.w, h: Game.view.h };
  }

  const camLA = { x: 0, y: 0 }; // 進行方向への先読みオフセット(平滑)
  function follow(alpha) {
    const p = Game.state.player;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    // 先読みカメラ: 動いている方向を少し先に見せる(進む先が見えて手触りが軽快に)
    if (Game.Settings && Game.Settings.get('lookAhead') === false) { camLA.x = 0; camLA.y = 0; }
    else {
      const laMax = TS * 2.4;
      const tvx = Math.max(-laMax, Math.min(laMax, (p.x - p.prevX) * 9));
      const tvy = Math.max(-laMax, Math.min(laMax, (p.y - p.prevY) * 9));
      camLA.x += (tvx - camLA.x) * 0.055;
      camLA.y += (tvy - camLA.y) * 0.055;
    }
    Game.state.camera.x = px + camLA.x;
    Game.state.camera.y = py + camLA.y;
  }

  function zoom() { return Game.state.zoom || 1; }

  function worldToScreen(wx, wy) {
    const v = viewSize(), z = zoom();
    return {
      x: (wx - Game.state.camera.x) * z + v.w / 2,
      y: (wy - Game.state.camera.y) * z + v.h / 2,
    };
  }

  function screenToWorld(sx, sy) {
    const v = viewSize(), z = zoom();
    return {
      x: (sx - v.w / 2) / z + Game.state.camera.x,
      y: (sy - v.h / 2) / z + Game.state.camera.y,
    };
  }

  function screenToTile(sx, sy) {
    const w = screenToWorld(sx, sy);
    return { tx: Math.floor(w.x / TS), ty: Math.floor(w.y / TS) };
  }

  // 可視タイル範囲（+1余白）
  function visibleTileRange() {
    const v = viewSize(), z = zoom();
    const hw = (v.w / 2) / z, hh = (v.h / 2) / z;
    const cx = Game.state.camera.x, cy = Game.state.camera.y;
    const tx0 = Math.floor((cx - hw) / TS) - 1;
    const ty0 = Math.floor((cy - hh) / TS) - 1;
    const tx1 = Math.floor((cx + hw) / TS) + 1;
    const ty1 = Math.floor((cy + hh) / TS) + 1;
    return { tx0, ty0, tx1, ty1 };
  }

  return { follow, worldToScreen, screenToWorld, screenToTile, visibleTileRange, zoom };
})();
