// utils.js — 共通ユーティリティ
window.Game = window.Game || {};

Game.Utils = (function () {
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  // mulberry32 seeded RNG -> 0..1 関数を返す
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 座標＋seedから決定論的な 0..1 値（オブジェクト配置などに使用）
  function hash3(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function tileKey(tx, ty) { return tx + ',' + ty; }
  function chunkKey(cx, cy) { return cx + ',' + cy; }

  // 負数対応の floor 除算
  function floorDiv(a, b) { return Math.floor(a / b); }
  // 負数対応の剰余（常に 0..b-1）
  function mod(a, b) { return ((a % b) + b) % b; }

  function randInt(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
  // 採集ドロップ数: 基本は最小値。確率で1つずつ増える(乱獲インフレ防止)。
  // 例 [1,3] → 約68% 1個 / 22% 2個 / 10% 3個。p=0.32
  function harvestQty(rnd, lo, hi) { let n = lo; while (n < hi && rnd() < 0.32) n++; return n; }

  return { clamp, lerp, fade, rng, hash3, tileKey, chunkKey, floorDiv, mod, randInt, harvestQty };
})();
