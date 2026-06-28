// tiles.js — タイル/オブジェクトを手続き描画してランタイムアトラス化
window.Game = window.Game || {};

Game.Tiles = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const U = Game.Utils;
  const groundAtlas = {};       // TILE id -> canvas（光世界）
  const groundAtlasShadow = {}; // TILE id -> canvas（影世界）
  const objAtlas = {};          // OBJ id -> canvas

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

  function buildGround(id, palette, store, saltOffset) {
    const c = mk(), x = c.getContext('2d');
    const base = palette[id] || '#555';
    x.fillStyle = base; x.fillRect(0, 0, TS, TS);
    // 決定論的な斑点で質感
    const rnd = U.rng(id * 99991 + 7 + saltOffset);
    const speckles = (id === Game.TILE.WATER || id === Game.TILE.DEEP_WATER) ? 6 : 14;
    for (let i = 0; i < speckles; i++) {
      const px = Math.floor(rnd() * TS), py = Math.floor(rnd() * TS);
      const amt = (rnd() < 0.5 ? -1 : 1) * (8 + Math.floor(rnd() * 14));
      x.fillStyle = shade(base, amt);
      const s = 2 + Math.floor(rnd() * 3);
      x.fillRect(px, py, s, s);
    }
    store[id] = c;
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
    } else if (r === 'berry') {
      x.fillStyle = '#2f7a2a'; circle(x, TS / 2, TS / 2 + 2, 9);
      x.fillStyle = '#c0307a';
      [[10,12],[20,14],[14,20],[22,22]].forEach(function (p) { circle(x, p[0], p[1], 2.4); });
    } else if (r === 'pine') {
      x.fillStyle = '#5a3a1e'; x.fillRect(TS / 2 - 2, TS - 10, 4, 10);
      x.fillStyle = '#1f5a2a';
      x.beginPath(); x.moveTo(TS / 2, 3); x.lineTo(TS / 2 + 11, TS - 8); x.lineTo(TS / 2 - 11, TS - 8); x.closePath(); x.fill();
      x.fillStyle = '#2c7a36';
      x.beginPath(); x.moveTo(TS / 2, 7); x.lineTo(TS / 2 + 8, 20); x.lineTo(TS / 2 - 8, 20); x.closePath(); x.fill();
    } else if (r === 'cactus') {
      x.fillStyle = '#3b8a3b'; x.fillRect(TS / 2 - 4, 6, 8, TS - 10);
      x.fillRect(TS / 2 - 10, 14, 6, 4); x.fillRect(TS / 2 + 4, 12, 6, 4);
      x.fillStyle = '#2c6e2c'; x.fillRect(TS / 2 - 1, 8, 2, TS - 14);
    } else if (r === 'farmland') {
      x.fillStyle = '#6b4326'; x.fillRect(2, 2, TS - 4, TS - 4);
      x.fillStyle = '#5a3720';
      for (let yy = 6; yy < TS - 4; yy += 6) x.fillRect(4, yy, TS - 8, 2);
    } else if (r === 'wheat') {
      // 成長段階は render 側で上書き描画するためベースは farmland
      x.fillStyle = '#6b4326'; x.fillRect(2, 2, TS - 4, TS - 4);
    } else if (r === 'campfire') {
      x.fillStyle = '#5a3a1e';
      x.fillRect(6, 18, 20, 4); x.fillRect(10, 14, 12, 4);
      x.fillStyle = '#ff8a3c'; x.beginPath(); x.moveTo(TS / 2, 6); x.lineTo(TS / 2 + 6, 18); x.lineTo(TS / 2 - 6, 18); x.closePath(); x.fill();
      x.fillStyle = '#ffd84a'; circle(x, TS / 2, 14, 3);
    } else if (r === 'lantern') {
      x.fillStyle = '#3a3a3e'; x.fillRect(TS / 2 - 6, 6, 12, 18);
      x.fillStyle = '#ffd86b'; x.fillRect(TS / 2 - 4, 9, 8, 12);
      x.fillStyle = '#222'; x.fillRect(TS / 2 - 6, 6, 12, 2); x.fillRect(TS / 2 - 6, 22, 12, 2);
    } else if (r === 'fence') {
      x.fillStyle = '#8a5a30';
      x.fillRect(TS / 2 - 9, 12, 18, 4);
      x.fillRect(TS / 2 - 7, 8, 4, 16); x.fillRect(TS / 2 + 3, 8, 4, 16);
    } else if (r === 'door') {
      x.fillStyle = '#8a5a2a'; x.fillRect(6, 4, TS - 12, TS - 6);
      x.strokeStyle = '#5a3a1e'; x.lineWidth = 2; x.strokeRect(7, 5, TS - 14, TS - 8);
      x.fillStyle = '#ffcf6b'; circle(x, TS - 11, TS / 2, 1.8);
    } else if (r === 'bed') {
      x.fillStyle = '#b54040'; x.fillRect(4, 6, TS - 8, TS - 12);
      x.fillStyle = '#eee'; x.fillRect(4, 6, TS - 8, 8);
      x.fillStyle = '#8a3030'; x.strokeRect(4, 6, TS - 8, TS - 12);
    } else if (r === 'sapling') {
      x.fillStyle = '#5a3a1e'; x.fillRect(TS / 2 - 1, TS / 2 + 2, 2, 8);
      x.fillStyle = '#4a9f3c'; circle(x, TS / 2, TS / 2, 5);
    } else if (r === 'shadowtree') {
      x.fillStyle = '#241a2e'; x.fillRect(TS / 2 - 3, TS - 12, 6, 12);
      x.fillStyle = '#3a2a55'; circle(x, TS / 2, TS / 2 - 2, 12);
      x.fillStyle = '#e0d0ff'; circle(x, TS / 2 - 3, TS / 2 - 4, 2.2); // 光る目
      x.fillStyle = '#1a1226'; circle(x, TS / 2 - 3, TS / 2 - 4, 0.9);
    } else if (r === 'shadowcrystal') {
      x.fillStyle = '#241a3a';
      x.beginPath(); x.moveTo(TS/2, 4); x.lineTo(TS/2+8, TS/2+4); x.lineTo(TS/2, TS-5); x.lineTo(TS/2-8, TS/2+4); x.closePath(); x.fill();
      x.fillStyle = '#9a5fe0';
      x.beginPath(); x.moveTo(TS/2, 8); x.lineTo(TS/2+5, TS/2+4); x.lineTo(TS/2, TS-9); x.lineTo(TS/2-5, TS/2+4); x.closePath(); x.fill();
      x.fillStyle = '#d8b0ff'; circle(x, TS/2, TS/2, 1.6);
    } else if (r === 'lumenore') {
      x.fillStyle = '#3b3550'; roundBlob(x);
      const rnd = U.rng(id * 211 + 9); x.fillStyle = '#ffe9a0';
      for (let i = 0; i < 6; i++) { const px = 6 + Math.floor(rnd()*20), py = 6 + Math.floor(rnd()*20); circle(x, px, py, 2.4); }
    } else if (r === 'soulflower') {
      x.fillStyle = '#2c3a44'; x.fillRect(TS/2 - 1, TS/2, 2, 8);
      x.fillStyle = '#a8e0c0'; circle(x, TS/2, TS/2, 4);
      x.fillStyle = '#e8fff4'; circle(x, TS/2, TS/2, 1.6);
    } else if (r === 'voidrock') {
      x.fillStyle = '#2a2238'; roundBlob(x);
      x.fillStyle = '#3a2e50'; circle(x, TS/2 - 3, TS/2 - 3, 5);
    } else if (r === 'rift') {
      x.strokeStyle = '#9a5fe0'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(TS/2, 5); x.lineTo(TS/2 + 4, TS/2); x.lineTo(TS/2 - 2, TS/2 + 2); x.lineTo(TS/2 + 2, TS - 5); x.stroke();
      x.fillStyle = 'rgba(122,79,176,0.35)'; circle(x, TS/2, TS/2, 11);
    } else if (r === 'lumenlantern') {
      x.fillStyle = '#caa84a'; x.fillRect(TS/2 - 6, 6, 12, 18);
      x.fillStyle = '#fff3c0'; x.fillRect(TS/2 - 4, 9, 8, 12);
      x.fillStyle = '#fffbe0'; circle(x, TS/2, 15, 3);
    } else if (r === 'phantom') {
      x.fillStyle = '#b0d8ff';
      x.beginPath(); x.moveTo(TS/2, 5); x.lineTo(TS/2+7, TS/2); x.lineTo(TS/2, TS-6); x.lineTo(TS/2-7, TS/2); x.closePath(); x.fill();
      x.fillStyle = '#eaf6ff'; circle(x, TS/2, TS/2, 2.4);
      x.strokeStyle = 'rgba(180,220,255,0.6)'; x.lineWidth = 1; x.strokeRect(4, 4, TS-8, TS-8);
    } else if (r === 'stela') {
      x.fillStyle = '#2a2438'; x.fillRect(TS/2 - 7, 4, 14, TS - 6);
      x.fillStyle = '#3c3450'; x.fillRect(TS/2 - 5, 6, 10, TS - 10);
      x.fillStyle = '#9a7fd0';
      for (let yy = 10; yy < TS - 6; yy += 5) x.fillRect(TS/2 - 3, yy, 6, 2); // 刻文
      x.fillStyle = '#d8b0ff'; circle(x, TS/2, 9, 1.8);
    } else if (r === 'wfloor') {
      x.fillStyle = '#9c6b3f'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
      x.strokeRect(2, 2, TS - 4, TS - 4); x.beginPath(); x.moveTo(2, TS / 2); x.lineTo(TS - 2, TS / 2); x.stroke();
    } else if (r === 'sfloor') {
      x.fillStyle = '#8e9296'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1;
      x.strokeRect(2, 2, TS / 2 - 3, TS / 2 - 3); x.strokeRect(TS / 2 + 1, TS / 2 + 1, TS / 2 - 3, TS / 2 - 3);
    } else if (r === 'wall') {
      x.fillStyle = '#8a6a44'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.strokeStyle = '#5a4226'; x.lineWidth = 1.5;
      for (let yy = 6; yy < TS; yy += 8) x.strokeRect(2, yy - 6, TS - 4, 8);
    } else if (r === 'window') {
      x.fillStyle = '#7a5a36'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.fillStyle = '#a8d8e8'; x.fillRect(5, 5, TS - 10, TS - 10);
      x.strokeStyle = '#7a5a36'; x.lineWidth = 2; x.beginPath(); x.moveTo(TS / 2, 5); x.lineTo(TS / 2, TS - 5); x.moveTo(5, TS / 2); x.lineTo(TS - 5, TS / 2); x.stroke();
    } else if (r === 'bridge') {
      x.fillStyle = '#9c6b3f'; x.fillRect(2, 4, TS - 4, TS - 8);
      x.fillStyle = '#7a5230'; for (let xx = 4; xx < TS - 2; xx += 6) x.fillRect(xx, 4, 2, TS - 8);
      x.fillStyle = '#5a3d1f'; x.fillRect(2, 4, TS - 4, 2); x.fillRect(2, TS - 6, TS - 4, 2);
    } else if (r === 'sign') {
      x.fillStyle = '#5a3a1e'; x.fillRect(TS / 2 - 1, TS / 2, 2, TS / 2 - 2);
      x.fillStyle = '#b5803f'; x.fillRect(6, 6, TS - 12, 12);
      x.strokeStyle = '#5a3d1f'; x.lineWidth = 1; x.strokeRect(6, 6, TS - 12, 12);
    } else if (r === 'dwall') {
      x.fillStyle = '#5a5560'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.strokeStyle = '#3a3640'; x.lineWidth = 1.5;
      for (let yy = 5; yy < TS; yy += 9) { x.beginPath(); x.moveTo(1, yy); x.lineTo(TS - 1, yy); x.stroke(); }
      x.beginPath(); x.moveTo(TS / 2, 1); x.lineTo(TS / 2, 5); x.moveTo(TS / 3, 14); x.lineTo(TS / 3, 23); x.stroke();
    } else if (r === 'icewall') {
      x.fillStyle = '#bfe4f5'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(3, 3, TS - 10, 4);
      x.strokeStyle = '#8fc8e0'; x.lineWidth = 1; x.strokeRect(2, 2, TS - 4, TS - 4);
    } else if (r === 'spawner') {
      x.fillStyle = '#2a2030'; x.fillRect(3, 3, TS - 6, TS - 6);
      x.strokeStyle = '#a04a6a'; x.lineWidth = 2; x.strokeRect(5, 5, TS - 10, TS - 10);
      x.fillStyle = '#e05a8a'; circle(x, TS / 2, TS / 2, 4);
      x.fillStyle = '#2a2030'; circle(x, TS / 2, TS / 2, 2);
    } else if (r === 'enchant') {
      x.fillStyle = '#2a1f44'; x.fillRect(4, 12, TS - 8, TS - 14);
      x.fillStyle = '#3a2a5a'; x.fillRect(6, 8, TS - 12, 8);
      x.fillStyle = '#caa0ff'; circle(x, TS / 2, 10, 3);
      x.fillStyle = '#e8d0ff'; x.font = '9px sans-serif'; x.textAlign = 'center'; x.fillText('✦', TS / 2, 24); x.textAlign = 'left';
    } else if (r === 'altar') {
      x.fillStyle = '#1f1430'; x.fillRect(4, 10, TS - 8, TS - 14);
      x.fillStyle = '#3a2050'; x.fillRect(7, 7, TS - 14, 8);
      x.fillStyle = '#c060ff'; circle(x, TS/2, 12, 3);
      x.strokeStyle = '#7a30c0'; x.lineWidth = 2; x.strokeRect(5, 11, TS - 10, TS - 16);
    } else if (r === 'seal') {
      x.fillStyle = '#4a4458'; x.fillRect(1, 1, TS - 2, TS - 2);
      x.fillStyle = '#5a5470'; x.fillRect(4, 4, TS - 8, TS - 8);
      x.strokeStyle = '#c8a8ff'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(TS/2, TS/2, 7, 0, Math.PI*2); x.stroke();
      x.beginPath(); x.moveTo(TS/2-7,TS/2); x.lineTo(TS/2+7,TS/2); x.moveTo(TS/2,TS/2-7); x.lineTo(TS/2,TS/2+7); x.stroke();
    } else if (r === 'rcore') {
      x.fillStyle = '#2a2040';
      x.beginPath(); x.arc(TS/2, TS/2, 11, 0, Math.PI*2); x.fill();
      x.fillStyle = '#c8a0ff';
      x.beginPath(); x.moveTo(TS/2,5); x.lineTo(TS/2+7,TS/2); x.lineTo(TS/2,TS-5); x.lineTo(TS/2-7,TS/2); x.closePath(); x.fill();
      x.fillStyle = '#fff'; circle(x, TS/2, TS/2, 2.4);
    } else if (r === 'tchest') {
      x.fillStyle = '#b58a2a'; x.fillRect(4, 9, TS - 8, TS - 13);
      x.fillStyle = '#e8c54a'; x.fillRect(4, 9, TS - 8, 6);
      x.strokeStyle = '#7a5a1a'; x.lineWidth = 1.5; x.strokeRect(4, 9, TS - 8, TS - 13);
      x.fillStyle = '#fff3c0'; x.fillRect(TS/2 - 2, 15, 4, 5);
    }
    objAtlas[id] = c;
  }

  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
  function roundBlob(x) { x.beginPath(); x.ellipse(TS / 2, TS / 2 + 1, 12, 10, 0, 0, Math.PI * 2); x.fill(); }

  function init() {
    for (const k in Game.TILE) {
      buildGround(Game.TILE[k], Game.TILE_COLOR, groundAtlas, 0);
      buildGround(Game.TILE[k], Game.SHADOW_TILE_COLOR, groundAtlasShadow, 50000);
    }
    for (const k in Game.OBJ) { if (Game.OBJ[k] !== 0) buildObj(Game.OBJ[k]); }
  }

  return { init, ground: groundAtlas, groundShadow: groundAtlasShadow, obj: objAtlas };
})();
