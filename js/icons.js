// icons.js — 武器/防具/道具などのアイテムアイコンを canvas で手続き描画
// emoji を廃し、クラス別シェイプ×素材色×名前ハッシュ配色で「同一アイコンを作らない」
window.Game = window.Game || {};

Game.Icons = (function () {
  const SIZE = 48;
  const cache = {};

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
  function hx(rgb) { return '#' + rgb.map(function (v) { return ('0' + clamp(v).toString(16)).slice(-2); }).join(''); }
  function toRgb(hex) { hex = (hex || '#888').replace('#', ''); if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]; }
  function shade(hex, f) { const c = toRgb(hex); return hx([c[0] * f, c[1] * f, c[2] * f]); }
  function mix(a, b, t) { const x = toRgb(a), y = toRgb(b); return hx([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }

  function classify(id, def) {
    if (!def) return 'misc';
    if (def.tool === 'gun') return 'gun';
    if (def.tool === 'staff' || def.tool === 'warp') return 'staff';
    if (def.tool === 'pickaxe') return 'pickaxe';
    if (def.tool === 'axe') return 'axe';
    if (def.tool === 'hoe') return 'hoe';
    if (def.attack != null || def.tool === 'sword') {
      if (/hammer|戦鎚|magma_hammer|war_hammer/.test(id)) return 'hammer';
      if (/spear|槍|chitin_spear|gae_bolg/.test(id)) return 'spear';
      if (/club|bone_club|棍/.test(id)) return 'club';
      if (/axe|boomerang|斧/.test(id)) return 'axe';
      if (/dagger|短剣/.test(id)) return 'sword';
      return 'sword';
    }
    if (def.armor != null) return def.slot === 'head' ? 'helmet' : 'chest';
    if (def.vehicle) return 'vehicle';
    if (id === 'rocket') return 'rocket';
    if (def.respec) return 'book';
    if (def.cures || def.heal != null) return 'potion';
    if (def.food != null) return 'food';
    if (/^ammo_|^shell|^bullet$|rocket_ammo|energy_cell/.test(id)) return 'ammo';
    if (def.place != null) return 'block';
    if (/ore|_bar|_ore$|^iron$|^coal$|^stone$|crystal|lumen|shadow_steel|star_metal|star_core|chitin|shadow_core|void_heart|shadow_shard|_shard/.test(id)) return 'material';
    return 'misc';
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100; const k = function (n) { return (n + h / 30) % 12; }; const a = s * Math.min(l, 1 - l);
    const f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return hx([f(0) * 255, f(8) * 255, f(4) * 255]);
  }
  // 名前由来の色（同クラス・同素材でも個体差を出し、同一アイコンを作らない）
  function nameColor(id, rawBase) {
    const h = hash(id);
    const accent = hslToHex(h % 360, 55 + h % 25, 52 + (h >> 3) % 16);
    const base = mix(rawBase, accent, 0.13); // ベースを名前でわずかに色変え
    return { base: base, accent: accent, edge: shade(base, 0.55), hi: mix(base, '#ffffff', 0.45) };
  }

  function outline(ctx) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.4; }

  function drawIcon(ctx, id, def, roll) {
    const cls = classify(id, def);
    const base = (def && def.color) || '#9aa';
    const c = nameColor(id, base);
    ctx.clearRect(0, 0, SIZE, SIZE);
    outline(ctx);
    const M = SIZE / 2;
    switch (cls) {
      case 'sword': {
        // 斜めの刀身＋鍔＋柄
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(3, -18); ctx.lineTo(4, 8); ctx.lineTo(0, 13); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.hi; ctx.fillRect(-1, -17, 1.6, 24); // 刃の光
        ctx.fillStyle = c.accent; ctx.fillRect(-9, 8, 18, 4); ctx.strokeRect(-9, 8, 18, 4); // 鍔
        ctx.fillStyle = shade(c.accent, 0.6); ctx.fillRect(-2.5, 11, 5, 9); ctx.strokeRect(-2.5, 11, 5, 9); // 柄
        ctx.restore(); break;
      }
      case 'hammer': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = shade('#7a5a30', 1); ctx.fillRect(M - 2, 10, 4, 30); ctx.strokeRect(M - 2, 10, 4, 30); // 柄
        ctx.fillStyle = c.base; ctx.fillRect(M - 14, 8, 28, 14); ctx.strokeRect(M - 14, 8, 28, 14); // ヘッド
        ctx.fillStyle = c.hi; ctx.fillRect(M - 12, 10, 24, 3);
        ctx.fillStyle = c.accent; ctx.fillRect(M - 14, 8, 4, 14); break;
      }
      case 'club': {
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(6, -16); ctx.lineTo(3, 16); ctx.lineTo(-3, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.hi; ctx.beginPath(); ctx.arc(0, -12, 3, 0, 7); ctx.fill(); ctx.restore(); break;
      }
      case 'spear': {
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = shade('#7a5a30', 1); ctx.fillRect(-1.5, -6, 3, 26); ctx.strokeRect(-1.5, -6, 3, 26); // 柄
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, -8); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); // 穂先
        ctx.fillStyle = c.hi; ctx.fillRect(-0.8, -20, 1.4, 10); ctx.restore(); break;
      }
      case 'gun': {
        // 黒ベースのスタイリッシュな銃。名前ハッシュで本体形状/アクセント差
        const h = hash(id), longBarrel = (h % 3 !== 0);
        ctx.fillStyle = '#161618';
        // 本体
        ctx.fillRect(8, 20, longBarrel ? 30 : 22, 8); ctx.strokeRect(8, 20, longBarrel ? 30 : 22, 8);
        ctx.fillStyle = '#101012'; ctx.fillRect(12, 27, 7, 11); ctx.strokeRect(12, 27, 7, 11); // グリップ
        ctx.fillStyle = '#222'; ctx.fillRect(10, 22, longBarrel ? 26 : 18, 2); // スライド光沢
        ctx.fillStyle = c.accent; ctx.fillRect(30, 18, 5, 3); ctx.strokeRect(30, 18, 5, 3); // サイト/アクセント
        if (h % 2 === 0) { ctx.fillStyle = '#3a2a18'; ctx.fillRect(12, 30, 7, 6); } // 木製グリップ個体差
        break;
      }
      case 'staff': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = shade('#6a4a2a', 1); ctx.fillRect(M - 1.5, 12, 3, 28); ctx.strokeRect(M - 1.5, 12, 3, 28); // 杖
        const g = ctx.createRadialGradient(M, 12, 1, M, 12, 10); g.addColorStop(0, c.hi); g.addColorStop(1, c.base);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(M, 11, 8, 0, 7); ctx.fill(); ctx.stroke(); // 宝玉
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M - 2, 9, 2, 0, 7); ctx.fill(); break;
      }
      case 'pickaxe': case 'axe': case 'hoe': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = '#8a5a30'; ctx.save(); ctx.translate(M, M); ctx.rotate(Math.PI / 5);
        ctx.fillRect(-2, -16, 4, 32); ctx.strokeRect(-2, -16, 4, 32); ctx.restore(); // 柄
        ctx.fillStyle = c.base;
        if (cls === 'pickaxe') { ctx.beginPath(); ctx.moveTo(M - 16, M - 12); ctx.quadraticCurveTo(M, M - 18, M + 16, M - 12); ctx.lineTo(M + 14, M - 8); ctx.quadraticCurveTo(M, M - 13, M - 14, M - 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else if (cls === 'axe') { ctx.beginPath(); ctx.moveTo(M + 2, M - 16); ctx.quadraticCurveTo(M + 18, M - 12, M + 14, M + 2); ctx.lineTo(M + 2, M - 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(M + 2, M - 16, 14, 5); ctx.strokeRect(M + 2, M - 16, 14, 5); }
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.5; ctx.fillRect(M - 10, M - 12, 20, 1.5); ctx.globalAlpha = 1; break;
      }
      case 'bow': {
        ctx.strokeStyle = c.base; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(M + 6, M, 16, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M - 5, M - 14); ctx.lineTo(M - 5, M + 14); ctx.stroke(); break;
      }
      case 'shield': case 'chest': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 14, 14); ctx.lineTo(M + 11, 34); ctx.lineTo(M, 40); ctx.lineTo(M - 11, 34); ctx.lineTo(M - 14, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.fillRect(M - 2, 12, 4, 26); ctx.fillRect(M - 12, 20, 24, 4);
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M - 10, 16); ctx.lineTo(M - 2, 16); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; break;
      }
      case 'helmet': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M, 14, Math.PI, 0); ctx.lineTo(M + 14, M + 8); ctx.lineTo(M - 14, M + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(c.base, 0.5); ctx.fillRect(M - 14, M + 4, 28, 5); ctx.strokeRect(M - 14, M + 4, 28, 5); // 面
        ctx.fillStyle = c.accent; ctx.fillRect(M - 1.5, M - 14, 3, 10); // 飾り
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(M - 5, M - 4, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
      }
      case 'potion': {
        ctx.fillStyle = '#cfe0ee'; ctx.fillRect(M - 4, 8, 8, 6); ctx.strokeRect(M - 4, 8, 8, 6); // 栓
        ctx.fillStyle = mix(c.base, '#ffffff', 0.1); ctx.beginPath(); ctx.moveTo(M - 5, 14); ctx.lineTo(M + 5, 14); ctx.lineTo(M + 9, 38); ctx.quadraticCurveTo(M, 44, M - 9, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.moveTo(M - 7, 26); ctx.lineTo(M + 7, 26); ctx.lineTo(M + 8.5, 37); ctx.quadraticCurveTo(M, 42, M - 8.5, 37); ctx.closePath(); ctx.fill(); // 中身
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(M - 4, 18, 2, 16); ctx.globalAlpha = 1; break;
      }
      case 'food': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M + 2, 13, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(M - 4, M - 3, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#5a8f3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, M - 11); ctx.lineTo(M + 4, M - 16); ctx.stroke(); break;
      }
      case 'ammo': {
        const h = hash(id), n = 3;
        for (let i = 0; i < n; i++) {
          const bx = M - 10 + i * 9;
          ctx.fillStyle = c.base; ctx.fillRect(bx, M - 2, 6, 14); ctx.strokeRect(bx, M - 2, 6, 14);
          ctx.fillStyle = mix(c.base, '#ffd24a', 0.6); ctx.beginPath(); ctx.moveTo(bx, M - 2); ctx.lineTo(bx + 3, M - 9); ctx.lineTo(bx + 6, M - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (id.indexOf('rocket') >= 0) { ctx.clearRect(0, 0, SIZE, SIZE); outline(ctx); ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 6, 22); ctx.lineTo(M + 6, 36); ctx.lineTo(M - 6, 36); ctx.lineTo(M - 6, 22); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0402a'; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 6, 22); ctx.lineTo(M - 6, 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.moveTo(M - 6, 36); ctx.lineTo(M, 44); ctx.lineTo(M + 6, 36); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'rocket': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 6); ctx.lineTo(M + 8, 30); ctx.lineTo(M + 8, 36); ctx.lineTo(M - 8, 36); ctx.lineTo(M - 8, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M, 20, 3.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#c0444a'; ctx.beginPath(); ctx.moveTo(M - 8, 30); ctx.lineTo(M - 14, 38); ctx.lineTo(M - 8, 36); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(M + 8, 30); ctx.lineTo(M + 14, 38); ctx.lineTo(M + 8, 36); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.moveTo(M - 5, 36); ctx.lineTo(M, 44); ctx.lineTo(M + 5, 36); ctx.closePath(); ctx.fill(); break;
      }
      case 'vehicle': {
        ctx.fillStyle = c.base; ctx.fillRect(8, 22, 32, 10); ctx.strokeRect(8, 22, 32, 10);
        ctx.fillStyle = mix(c.base, '#fff', 0.3); ctx.fillRect(15, 16, 16, 8); ctx.strokeRect(15, 16, 16, 8);
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(16, 34, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(32, 34, 4, 0, 7); ctx.fill(); break;
      }
      case 'block': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M + 14, 18); ctx.lineTo(M + 14, 34); ctx.lineTo(M, 42); ctx.lineTo(M - 14, 34); ctx.lineTo(M - 14, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(c.base, 0.7); ctx.beginPath(); ctx.moveTo(M, 26); ctx.lineTo(M + 14, 18); ctx.lineTo(M + 14, 34); ctx.lineTo(M, 42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix(c.base, '#fff', 0.25); ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M + 14, 18); ctx.lineTo(M, 26); ctx.lineTo(M - 14, 18); ctx.closePath(); ctx.fill(); break;
      }
      case 'book': {
        ctx.fillStyle = c.accent; ctx.fillRect(12, 12, 24, 28); ctx.strokeRect(12, 12, 24, 28);
        ctx.fillStyle = mix(c.accent, '#fff', 0.7); ctx.fillRect(16, 14, 18, 24);
        ctx.strokeStyle = c.edge; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(18, 19 + i * 5); ctx.lineTo(32, 19 + i * 5); ctx.stroke(); } break;
      }
      case 'material': {
        // 結晶/インゴット風
        const h = hash(id);
        if (h % 2 === 0) { ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 12, 22); ctx.lineTo(M + 6, 40); ctx.lineTo(M - 6, 40); ctx.lineTo(M - 12, 22); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.hi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M - 12, 22); ctx.lineTo(M, 26); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(30, 38); ctx.lineTo(10, 38); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = mix(c.base, '#fff', 0.3); ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(31, 26); ctx.lineTo(11, 26); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        break;
      }
      default: {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M, 12, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M, M, 5, 0, 7); ctx.fill();
      }
    }
  }

  function dataURL(id, roll) {
    const def = Game.ITEMS[id]; if (!def) return null;
    const key = id + (roll ? ':' + roll.rarity : '');
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext('2d');
    try { drawIcon(ctx, id, def, roll); } catch (e) { return null; }
    const url = cv.toDataURL();
    cache[key] = url; return url;
  }

  return { dataURL, classify };
})();
