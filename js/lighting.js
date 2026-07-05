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
    if (Game.state.worldName === 'space') d = Math.max(d, 0.5); // 宇宙は暗い
    // 正気度が低いと視界が狭まる（恐怖演出）
    const sanity = Game.state.sanity;
    if (sanity != null && sanity < 40) d = Math.min(0.92, d + (40 - sanity) / 40 * 0.28);
    return d;
  }

  // 空のティント色。夜明け/夕暮れは時刻でなめらかに色替え（ハードな切替を排除）
  const TINT_NIGHT = [8, 12, 38];   // 夜の青
  const TINT_DAWN = [58, 34, 54];   // 明け方の紫がかった暖色
  const TINT_DUSK = [86, 36, 18];   // 夕焼けの橙
  function lerp3(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function skyTint() {
    if (Game.state.bloodMoon && Game.state.worldName === 'light') return [70, 8, 12]; // 血の月
    if (Game.state.worldName === 'space') return [2, 3, 10]; // 宇宙の闇
    if (Game.state.worldName === 'shadow') return [26, 10, 44]; // 影の紫
    const t = Game.state.timeOfDay;
    if (t < 0.20) return TINT_NIGHT;
    if (t < 0.30) return lerp3(TINT_NIGHT, TINT_DAWN, U.fade((t - 0.20) / 0.10)); // 夜→明け方
    if (t < 0.70) return TINT_DUSK;                                               // 昼(暗さ0で不可視)→夕へ連続
    if (t < 0.80) return lerp3(TINT_DUSK, TINT_NIGHT, U.fade((t - 0.70) / 0.10)); // 夕焼け→夜
    return TINT_NIGHT;
  }

  // ライティングは半解像度で描画し合成時に拡大(スマホ最適化: 塗り/放射グラデのピクセル数を1/4に)。
  // 光は元々ソフトなので画質劣化はほぼ無く、夜のフィルレートを大きく削減する。
  const LS = 0.5;
  function ensureBuf() {
    const v = Game.view;
    if (!lc) { lc = document.createElement('canvas'); lctx = lc.getContext('2d'); }
    const lw = Math.max(1, Math.ceil(v.w * LS)), lh = Math.max(1, Math.ceil(v.h * LS));
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    lctx.setTransform(LS, 0, 0, LS, 0, 0); // 以降のdrawはスクリーン座標のまま(内部で半解像度)
  }

  // 光の切り抜きスプライト（毎フレームの createRadialGradient を排除）
  let punchCv = null;
  function ensurePunchSprite() {
    if (punchCv) return;
    punchCv = document.createElement('canvas'); punchCv.width = punchCv.height = 128;
    const g2 = punchCv.getContext('2d');
    const gr = g2.createRadialGradient(64, 64, 9, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  }
  // 暖色グロースプライト（炎系光源の色味）
  let warmCv = null;
  function ensureWarmSprite() {
    if (warmCv) return;
    warmCv = document.createElement('canvas'); warmCv.width = warmCv.height = 128;
    const g2 = warmCv.getContext('2d');
    const gr = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,176,80,0.9)');
    gr.addColorStop(0.5, 'rgba(255,140,50,0.38)');
    gr.addColorStop(1, 'rgba(255,120,40,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  }

  function punch(sx, sy, radiusPx, flicker, strength) {
    const r = radiusPx * (flicker ? (0.92 + Math.sin(Game.state.tick * 0.3 + sx) * 0.08) : 1);
    if (strength != null) lctx.globalAlpha = strength;
    lctx.drawImage(punchCv, sx - r, sy - r, r * 2, r * 2);
    if (strength != null) lctx.globalAlpha = 1;
  }

  // 炎系光源（暖色グロー＋揺らめき）の対象と強さ
  const warmSource = {
    [Game.OBJ.TORCH]: 1.0, [Game.OBJ.CAMPFIRE]: 1.15, [Game.OBJ.BRAZIER]: 1.1,
    [Game.OBJ.FURNACE]: 0.8, [Game.OBJ.LANTERN]: 0.6, [Game.OBJ.STREET_LAMP]: 0.45,
    [Game.OBJ.BANDIT_SPAWNER]: 0.9,
  };
  const warmPts = [];
  let lightScanKey = '', lightScanPts = []; // 光源走査キャッシュ(範囲+編集revで無効化) // 使い回しの平坦配列 [sx, sy, r, factor, ...]（毎フレームのオブジェクト割当なし）

  function drawOverlay(ctx) {
    const d = ambientDarkness();
    if (d <= 0.02) return;
    ensureBuf(); ensurePunchSprite(); ensureWarmSprite();
    const v = Game.view;
    const tint = skyTint();
    lctx.clearRect(0, 0, v.w, v.h);
    lctx.fillStyle = 'rgba(' + (tint[0] | 0) + ',' + (tint[1] | 0) + ',' + (tint[2] | 0) + ',' + d + ')';
    lctx.fillRect(0, 0, v.w, v.h);

    // 光源を切り抜く
    lctx.globalCompositeOperation = 'destination-out';
    // プレイヤーの微光＋近傍のソフトな視界確保（スマホでも足元が読める夜）
    const p = Game.state.player;
    const ps = Game.Camera.worldToScreen(p.x, p.y);
    punch(ps.x, ps.y, 2.4 * TS, false);
    punch(ps.x, ps.y, 4.8 * TS, false, 0.30);

    // 可視範囲の発光オブジェクト。毎フレームの全タイルobjAt走査は重いので、
    // 「可視タイル範囲+世界編集リビジョン」が変わった時だけ再走査し、光源リストをキャッシュする
    warmPts.length = 0;
    const range = Game.Camera.visibleTileRange();
    const tick = Game.state.tick;
    const lkey = range.tx0 + ',' + range.ty0 + ',' + range.tx1 + ',' + range.ty1 + '|' + (Game.World.editRev ? Game.World.editRev() : 0) + '|' + Game.state.worldName;
    if (lkey !== lightScanKey) {
      lightScanKey = lkey; lightScanPts.length = 0;
      for (let ty = range.ty0; ty <= range.ty1; ty++) {
        for (let tx = range.tx0; tx <= range.tx1; tx++) {
          const o = Game.World.objAt(tx, ty);
          const light = Game.LIGHT_LEVEL[o];
          if (light) {
            const flame = o === Game.OBJ.TORCH || o === Game.OBJ.CAMPFIRE || o === Game.OBJ.BRAZIER;
            lightScanPts.push(tx * TS + TS / 2, ty * TS + TS / 2, light, flame ? 1 : 0, warmSource[o] || 0);
          }
        }
      }
    }
    for (let i = 0; i < lightScanPts.length; i += 5) {
      const s = Game.Camera.worldToScreen(lightScanPts[i], lightScanPts[i + 1]);
      const light = lightScanPts[i + 2];
      punch(s.x, s.y, light * TS * 0.55, !!lightScanPts[i + 3]);
      const wf = lightScanPts[i + 4];
      if (wf) { warmPts.push(s.x, s.y, light * TS * 0.42, wf); }
    }
    // 燃え盛る炎も光源(夜の森林火災が一帯を赤々と照らす)
    const fires = Game.state.fires;
    if (fires && fires.length) {
      for (let i = 0; i < fires.length; i++) {
        const f = fires[i];
        if (f.tx < range.tx0 - 1 || f.tx > range.tx1 + 1 || f.ty < range.ty0 - 1 || f.ty > range.ty1 + 1) continue;
        const s = Game.Camera.worldToScreen(f.tx * TS + TS / 2, f.ty * TS + TS / 2);
        const fade = f.t < 12 ? f.t / 12 : 1;
        punch(s.x, s.y, 2.0 * TS * fade, true, 0.85);
        warmPts.push(s.x, s.y, 1.6 * TS * fade, 1);
      }
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0, v.w, v.h); // 半解像度の光バッファを画面全体へ拡大合成

    // 暖色グロー: 切り抜いた光の上に炎の色味を薄く重ねる（揺らめき付き）
    if (warmPts.length) {
      ctx.save();
      for (let i = 0; i < warmPts.length; i += 4) {
        const sx = warmPts[i], sy = warmPts[i + 1], f = warmPts[i + 3];
        const fl = 0.85 + Math.sin(tick * 0.27 + sx * 0.7) * 0.15;
        const r = warmPts[i + 2] * fl;
        ctx.globalAlpha = Math.min(0.5, d * 0.5) * f * fl;
        ctx.drawImage(warmCv, sx - r, sy - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  }

  return { ambientDarkness, drawOverlay };
})();
