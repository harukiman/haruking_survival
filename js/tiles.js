// tiles.js — タイル/オブジェクトを手続き描画してランタイムアトラス化
window.Game = window.Game || {};

Game.Tiles = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const U = Game.Utils;
  const groundAtlas = {}; // TILE id -> canvas
  const objAtlas = {};    // OBJ id -> canvas

  function mk() {
    const c = document.createElement('canvas');
    c.width = TS; c.height = TS;
    return c;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = U.clamp(r + amt, 0, 255); g = U.clamp(g + amt, 0, 255); b = U.clamp(b + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function buildGround(id) {
    const c = mk(), x = c.getContext('2d');
    const base = Game.TILE_COLOR[id] || '#555';
    x.fillStyle = base; x.fillRect(0, 0, TS, TS);
    // 決定論的な斑点で質感
    const rnd = U.rng(id * 99991 + 7);
    const speckles = (id === Game.TILE.WATER || id === Game.TILE.DEEP_WATER) ? 6 : 14;
    for (let i = 0; i < speckles; i++) {
      const px = Math.floor(rnd() * TS), py = Math.floor(rnd() * TS);
      const amt = (rnd() < 0.5 ? -1 : 1) * (8 + Math.floor(rnd() * 14));
      x.fillStyle = shade(base, amt);
      const s = 2 + Math.floor(rnd() * 3);
      x.fillRect(px, py, s, s);
    }
    groundAtlas[id] = c;
  }

  function buildObj(id) {
    const meta = Game.OBJ_META[id];
    if (!meta) return;
    const c = mk(), x = c.getContext('2d');
    const r = meta.render;
    if (r === 'tree') {
      x.fillStyle = '#6b4424'; x.fillRect(TS / 2 - 3, TS - 12, 6, 12);
      x.fillStyle = '#2c6b22'; circle(x, TS / 2, TS / 2 - 2, 12);
      x.fillStyle = '#3c8a2e'; circle(x, TS / 2 - 3, TS / 2 - 5, 7);
    } else if (r === 'rock') {
      x.fillStyle = '#6f7478'; roundBlob(x);
      x.fillStyle = '#878c90'; circle(x, TS / 2 - 3, TS / 2 - 3, 5);
    } else if (r === 'ore') {
      x.fillStyle = '#6f7478'; roundBlob(x);
      const rnd = U.rng(id * 131 + 3);
      x.fillStyle = meta.oreColor;
      for (let i = 0; i < 6; i++) { const px = 6 + Math.floor(rnd() * 20), py = 6 + Math.floor(rnd() * 20); x.fillRect(px, py, 4, 4); }
    } else if (r === 'bush') {
      x.fillStyle = '#2f7a2a'; circle(x, TS / 2, TS / 2 + 2, 9);
      x.fillStyle = '#3c9636'; circle(x, TS / 2 - 4, TS / 2, 5);
    } else if (r === 'flower') {
      x.fillStyle = '#2f7a2a'; x.fillRect(TS / 2 - 1, TS / 2, 2, 8);
      x.fillStyle = '#e85ab0'; circle(x, TS / 2, TS / 2, 4);
      x.fillStyle = '#ffd84a'; circle(x, TS / 2, TS / 2, 1.6);
    } else if (r === 'block') {
      x.fillStyle = meta.blockColor; x.fillRect(2, 2, TS - 4, TS - 4);
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; x.strokeRect(3, 3, TS - 6, TS - 6);
    } else if (r === 'table') {
      x.fillStyle = '#7a5630'; x.fillRect(3, 3, TS - 6, TS - 6);
      x.fillStyle = '#a9762f'; x.fillRect(6, 6, TS - 12, TS - 12);
      x.strokeStyle = '#5a3d1f'; x.lineWidth = 2; x.strokeRect(6, 6, TS - 12, TS - 12);
    } else if (r === 'furnace') {
      x.fillStyle = '#55585c'; x.fillRect(3, 3, TS - 6, TS - 6);
      x.fillStyle = '#222'; x.fillRect(10, 14, TS - 20, 10);
      x.fillStyle = '#ff8a3c'; x.fillRect(12, 18, TS - 24, 5);
    } else if (r === 'torch') {
      x.fillStyle = '#6b4424'; x.fillRect(TS / 2 - 2, TS / 2, 4, 12);
      x.fillStyle = '#ffcf6b'; circle(x, TS / 2, TS / 2 - 1, 4);
      x.fillStyle = '#ff8a3c'; circle(x, TS / 2, TS / 2 - 1, 2);
    } else if (r === 'chest') {
      x.fillStyle = '#8a5a2a'; x.fillRect(4, 8, TS - 8, TS - 14);
      x.fillStyle = '#a9762f'; x.fillRect(4, 8, TS - 8, 6);
      x.fillStyle = '#ffcf6b'; x.fillRect(TS / 2 - 2, 14, 4, 4);
    }
    objAtlas[id] = c;
  }

  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
  function roundBlob(x) { x.beginPath(); x.ellipse(TS / 2, TS / 2 + 1, 12, 10, 0, 0, Math.PI * 2); x.fill(); }

  function init() {
    for (const k in Game.TILE) buildGround(Game.TILE[k]);
    for (const k in Game.OBJ) { if (Game.OBJ[k] !== 0) buildObj(Game.OBJ[k]); }
  }

  return { init, ground: groundAtlas, obj: objAtlas };
})();
