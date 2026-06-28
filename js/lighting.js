// lighting.js — 昼夜照明オーバーレイ（MVPはスタブ。次波で本格実装）
window.Game = window.Game || {};

Game.Lighting = (function () {
  // 0=完全に明るい, 1=真っ暗。MVPは常時昼。
  function ambientDarkness() {
    return 0;
  }

  // render から呼ばれる。MVPは何もしない（昼）。
  function drawOverlay(ctx) {
    const d = ambientDarkness();
    if (d <= 0.001) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,30,' + d + ')';
    ctx.fillRect(0, 0, Game.view.w, Game.view.h);
    ctx.restore();
  }

  return { ambientDarkness, drawOverlay };
})();
