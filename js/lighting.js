// lighting.js — 昼夜の暗さ＋光源（たいまつ/焚き火/ランタン/かまど）オーバーレイ
window.Game = window.Game || {};

Game.Lighting = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const U = Game.Utils;
  const MAX_DARK = 0.74;
  let lc = null, lctx = null; // 光バッファ

  function darknessFor(t) {
    if (t < 0.20 || t >= 0.80) return MAX_DARK;
    if (t < 0.30) return MAX_DARK * (1 - U.fade((t - 0.20) / 0.10)); // 夜明け
    if (t < 0.70) return 0;                                          // 昼
    return MAX_DARK * U.fade((t - 0.70) / 0.10);                     // 夕暮れ
  }

  function ambientDarkness() {
    if (!Game.state) return 0;
    let d = darknessFor(Game.state.timeOfDay);
    // 影世界は常時薄暗
    if (Game.state.worldName === 'shadow') d = Math.max(d, Game.TUNE.SHADOW_AMBIENT);
    // 正気度が低いと視界が狭まる（恐怖演出）
    const sanity = Game.state.sanity;
    if (sanity != null && sanity < 40) d = Math.min(0.92, d + (40 - sanity) / 40 * 0.28);
    return d;
  }

  // 空のティント色（影世界=紫, 夜=青, 夕焼け=橙）
  function skyTint() {
    if (Game.state.worldName === 'shadow') return [26, 10, 44]; // 影の紫
    const t = Game.state.timeOfDay;
    if (t >= 0.68 && t < 0.80) return [70, 30, 20];   // 夕焼け
    if (t >= 0.20 && t < 0.30) return [40, 30, 50];   // 明け方
    return [8, 12, 38];                                // 夜の青
  }

  function ensureBuf() {
    const v = Game.view;
    if (!lc) { lc = document.createElement('canvas'); lctx = lc.getContext('2d'); }
    if (lc.width !== v.w || lc.height !== v.h) { lc.width = v.w; lc.height = v.h; }
  }

  function punch(sx, sy, radiusPx, flicker) {
    const r = radiusPx * (flicker ? (0.9 + Math.sin(Game.state.tick * 0.3 + sx) * 0.08) : 1);
    const g = lctx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(sx, sy, r, 0, Math.PI * 2); lctx.fill();
  }

  function drawOverlay(ctx) {
    const d = ambientDarkness();
    if (d <= 0.02) return;
    ensureBuf();
    const v = Game.view;
    const tint = skyTint();
    lctx.clearRect(0, 0, v.w, v.h);
    lctx.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + d + ')';
    lctx.fillRect(0, 0, v.w, v.h);

    // 光源を切り抜く
    lctx.globalCompositeOperation = 'destination-out';
    // プレイヤーの微光
    const p = Game.state.player;
    const ps = Game.Camera.worldToScreen(p.x, p.y);
    punch(ps.x, ps.y, 2.4 * TS, false);

    // 可視範囲の発光オブジェクト
    const range = Game.Camera.visibleTileRange();
    for (let ty = range.ty0; ty <= range.ty1; ty++) {
      for (let tx = range.tx0; tx <= range.tx1; tx++) {
        const o = Game.World.objAt(tx, ty);
        const light = Game.LIGHT_LEVEL[o];
        if (light) {
          const s = Game.Camera.worldToScreen(tx * TS + TS / 2, ty * TS + TS / 2);
          punch(s.x, s.y, light * TS * 0.55, o === Game.OBJ.TORCH || o === Game.OBJ.CAMPFIRE);
        }
      }
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0);
  }

  return { ambientDarkness, drawOverlay };
})();
