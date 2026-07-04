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
    if (def.tool === 'staff' || def.tool === 'warp' || def.tool === 'grapple') return 'staff';
    if (def.tool === 'pickaxe') return 'pickaxe';
    if (def.tool === 'axe') return 'axe';
    if (def.tool === 'hoe') return 'hoe';
    if (def.attack != null || def.tool === 'sword') {
      if (/hammer|戦鎚|magma_hammer|war_hammer/.test(id)) return 'hammer';
      if (/spear|槍|chitin_spear|gae_bolg/.test(id)) return 'spear';
      if (/club|bone_club|棍/.test(id)) return 'club';
      if (/scythe|鎌/.test(id)) return 'scythe';
      if (/axe|boomerang|斧/.test(id)) return 'axe';
      if (/katana|居合|iai|blade|刀/.test(id)) return 'katana';
      if (/dagger|短剣/.test(id)) return 'sword';
      return 'sword';
    }
    if (def.relic) return 'relic';
    if (def.armor != null) return def.slot === 'head' ? 'helmet' : 'chest';
    if (def.vehicle) return 'vehicle';
    if (id === 'rocket') return 'rocket';
    if (def.respec) return 'book';
    if (def.throw) return 'bomb';
    if (def.plant != null) return 'material';
    if (def.cures || def.heal != null || def.buff) return 'potion';
    if (def.food != null) return 'food';
    if (/^ammo_|^shell|^bullet$|rocket_ammo|energy_cell/.test(id)) return 'ammo';
    if (def.place != null) return 'block';
    if (/ore|_bar|_ore$|^iron$|^coal$|^stone$|crystal|lumen|shadow_steel|star_metal|star_core|chitin|shadow_core|void_heart|shadow_shard|_shard/.test(id)) return 'material';
    // 追加素材(中間素材/有機/鉱物系)も material へ回して形を付ける
    if (/gunpowder|gun_parts|steel_plate|rope|glass|circuit|^guts$|^hide$|^leather$|^bone$|^string$|slime_ball|shadow_wood|^sulfur$|obsidian|moonshard|silk|feather|scale|web|wool|fiber|cloth|^wood$|glow_spore|luminous_cap|spore|_steel$|_alloy$|kokuhen|_metal$|wind_ore|wind_feather/.test(id)) return 'material';
    if (/aerial_bomb|heavy_bomb|cannon_shell|_bomb$/.test(id)) return 'bomb'; // 爆弾類は爆弾アイコン
    if (/_key$|^key$|鍵/.test(id) || def.summonBoss && /key/.test(id)) return 'key'; // 鍵系は鍵アイコン
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

  function outline(ctx) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2.7; }
  // アイコンが背景(地形/スロット)に埋もれないよう、被写体の後ろに柔らかな暗いハロを敷いて視認性を上げる
  function backdrop(ctx) {
    ctx.save();
    const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 3, SIZE / 2, SIZE / 2, SIZE * 0.5);
    g.addColorStop(0, 'rgba(6,10,18,0.42)'); g.addColorStop(0.72, 'rgba(6,10,18,0.24)'); g.addColorStop(1, 'rgba(6,10,18,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ===== 質感ヘルパー（アイコンは一度だけ描いてキャッシュされるため、ここでの勾配生成は毎フレーム負荷にならない） =====
  // 金属のきらめき（十字の光点）
  function glint(ctx, x, y, s) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - s, y - 0.6, s * 2, 1.2); ctx.fillRect(x - 0.6, y - s, 1.2, s * 2);
    ctx.globalAlpha = 0.6; ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    ctx.restore();
  }
  // 木目（柄などの縦方向の筋）
  function grainV(ctx, x, y, w, h) {
    ctx.save(); ctx.strokeStyle = 'rgba(40,22,8,0.35)'; ctx.lineWidth = 0.8;
    for (let i = 1; i <= 2; i++) { const gx = x + (w * i) / 3; ctx.beginPath(); ctx.moveTo(gx, y + 1); ctx.lineTo(gx + 0.6, y + h - 1); ctx.stroke(); }
    ctx.restore();
  }
  // 金属の縦グラデーション（刃・ヘッド用）
  function metalGradV(ctx, x0, x1, base) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, shade(base, 0.72)); g.addColorStop(0.45, mix(base, '#ffffff', 0.38)); g.addColorStop(1, shade(base, 0.88));
    return g;
  }

  // レアリティ演出＋接地影。描画済みアイコンの背面にグロー、前面に角飾り枠
  function finishIcon(ctx, roll) {
    // 接地影（背面へ）
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(SIZE / 2, SIZE - 5, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const r = roll ? roll.rarity : 0;
    if (r > 0 && Game.Loot && Game.Loot.RARITY && Game.Loot.RARITY[r]) {
      const col = Game.Loot.RARITY[r].color;
      // 背面グロー
      const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 3, SIZE / 2, SIZE / 2, SIZE / 2);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.16 + r * 0.06; ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
      // 前面の角飾り枠
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.85; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const L = 8, m = 2.5;
      ctx.beginPath();
      ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
      ctx.moveTo(SIZE - m - L, m); ctx.lineTo(SIZE - m, m); ctx.lineTo(SIZE - m, m + L);
      ctx.moveTo(SIZE - m, SIZE - m - L); ctx.lineTo(SIZE - m, SIZE - m); ctx.lineTo(SIZE - m - L, SIZE - m);
      ctx.moveTo(m + L, SIZE - m); ctx.lineTo(m, SIZE - m); ctx.lineTo(m, SIZE - m - L);
      ctx.stroke();
      // レジェンダリーは小さな星のきらめき
      if (r >= 3) { glint(ctx, SIZE - 9, 10, 3.2); glint(ctx, 10, SIZE - 12, 2.4); }
    }
    ctx.restore();
  }

  function drawIcon(ctx, id, def, roll) {
    const cls = classify(id, def);
    const base = (def && def.color) || '#9aa';
    const c = nameColor(id, base);
    ctx.clearRect(0, 0, SIZE, SIZE);
    backdrop(ctx); // 背景に埋もれない視認性ハロ
    outline(ctx);
    const M = SIZE / 2;
    switch (cls) {
      case 'sword': {
        // 武器の性質で刀身の形を変える: 大剣(幅広)/細剣(鋭)/通常
        const big = def.aoe || def.big || /greatsword|大剣|colossus|dragon|終焉|excalibur|約束/.test(id);
        const thin = /rapier|細|prism|gae|刺|突/.test(id) || (def.proj && def.proj.kind === 'pierce');
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = metalGradV(ctx, -6, 6, c.base);
        if (big) { // 幅広の大剣(切っ先が広く、両刃)
          ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(6, -18); ctx.lineTo(5, 6); ctx.lineTo(0, 12); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.fillRect(-0.8, -17, 1.6, 22); // 中央樋
          ctx.fillStyle = c.accent; ctx.fillRect(-11, 6, 22, 4); ctx.strokeRect(-11, 6, 22, 4); // 大きな鍔
          ctx.fillStyle = shade(c.accent, 0.6); ctx.fillRect(-2.5, 9, 5, 11); ctx.strokeRect(-2.5, 9, 5, 11);
        } else if (thin) { // 細身の刺突剣
          ctx.beginPath(); ctx.moveTo(-1.6, -20); ctx.lineTo(1.6, -20); ctx.lineTo(2, 8); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.fillRect(-0.6, -19, 1, 26);
          ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 9, 4, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke(); // 湾曲ガード
          ctx.fillStyle = shade(c.accent, 0.6); ctx.fillRect(-1.8, 9, 3.6, 10); ctx.strokeRect(-1.8, 9, 3.6, 10);
        } else { // 標準的な片手剣
          ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(3, -18); ctx.lineTo(4, 8); ctx.lineTo(0, 13); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.fillRect(-1, -17, 1.6, 24);
          ctx.fillStyle = shade(c.base, 0.6); ctx.fillRect(2.2, -16, 1.2, 22);
          ctx.fillStyle = c.accent; ctx.fillRect(-9, 8, 18, 4); ctx.strokeRect(-9, 8, 18, 4);
          ctx.fillStyle = shade(c.accent, 0.6); ctx.fillRect(-2.5, 11, 5, 9); ctx.strokeRect(-2.5, 11, 5, 9); grainV(ctx, -2.5, 11, 5, 9);
        }
        glint(ctx, 0, -13, 2.6);
        ctx.restore(); break;
      }
      case 'scythe': {
        // 長柄＋大きく湾曲した刃
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = shade('#5a3a1e', 1); ctx.fillRect(M + 6, 8, 3, 32); ctx.strokeRect(M + 6, 8, 3, 32); // 柄
        ctx.fillStyle = metalGradV(ctx, 8, 20, c.base); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(M + 7, 10); ctx.quadraticCurveTo(M - 18, 8, M - 14, 26); ctx.quadraticCurveTo(M - 8, 14, M + 7, 15); ctx.closePath(); ctx.fill(); ctx.stroke(); // 刃
        ctx.fillStyle = c.hi; ctx.beginPath(); ctx.moveTo(M + 6, 12); ctx.quadraticCurveTo(M - 12, 11, M - 12, 22); ctx.stroke(); glint(ctx, M - 12, 14, 2.2); break;
      }
      case 'katana': {
        // 反りのある細身の刀身＋円形の鍔
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = metalGradV(ctx, -3, 3, c.base);
        ctx.beginPath(); ctx.moveTo(-2, -20); ctx.quadraticCurveTo(3, -6, 2.5, 8); ctx.lineTo(-2.5, 8); ctx.quadraticCurveTo(-2, -6, -2, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.hi; ctx.fillRect(-1.4, -18, 1.2, 24); // 刃紋
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(0, 9, 4.5, 0, 7); ctx.fill(); ctx.stroke(); // 円鍔
        ctx.fillStyle = shade(c.accent, 0.5); ctx.fillRect(-2, 11, 4, 10); ctx.strokeRect(-2, 11, 4, 10); // 柄
        glint(ctx, 0, -15, 2.4); ctx.restore(); break;
      }
      case 'hammer': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = shade('#7a5a30', 1); ctx.fillRect(M - 2, 10, 4, 30); ctx.strokeRect(M - 2, 10, 4, 30); // 柄
        grainV(ctx, M - 2, 12, 4, 26);
        ctx.fillStyle = metalGradV(ctx, M - 14, M + 14, c.base); ctx.fillRect(M - 14, 8, 28, 14); ctx.strokeRect(M - 14, 8, 28, 14); // ヘッド
        ctx.fillStyle = c.hi; ctx.fillRect(M - 12, 10, 24, 3);
        ctx.fillStyle = shade(c.base, 0.55); ctx.fillRect(M - 12, 19, 24, 2); // 下面の陰
        ctx.fillStyle = c.accent; ctx.fillRect(M - 14, 8, 4, 14);
        glint(ctx, M + 9, 12, 2.6); break;
      }
      case 'club': {
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(6, -16); ctx.lineTo(3, 16); ctx.lineTo(-3, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.hi; ctx.beginPath(); ctx.arc(0, -12, 3, 0, 7); ctx.fill(); ctx.restore(); break;
      }
      case 'spear': {
        ctx.save(); ctx.translate(M, M); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = shade('#7a5a30', 1); ctx.fillRect(-1.5, -6, 3, 26); ctx.strokeRect(-1.5, -6, 3, 26); // 柄
        grainV(ctx, -1.5, -4, 3, 22);
        ctx.fillStyle = metalGradV(ctx, -5, 5, c.base);
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, -8); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); // 穂先
        ctx.fillStyle = c.hi; ctx.fillRect(-0.8, -20, 1.4, 10);
        glint(ctx, 0, -18, 2.2); ctx.restore(); break;
      }
      case 'gun': {
        // 銃種ごとに実銃に即したシルエットを描き分ける（同形を作らない）
        const FORM = { pistol: 'pistol', glock17: 'pistol', deagle: 'pistol', mp5: 'smg', uzi: 'smg', p90: 'smg', m4: 'rifle', scar_h: 'rifle', minigun: 'minigun', ak47: 'ak', shadow_rifle: 'rifle', m870: 'shotgun', spas12: 'shotgun', barrett: 'sniper', rpg7: 'rpg', m79: 'rpg', star_cannon: 'rpg', flamethrower: 'energy', laser_rifle: 'energy', railgun: 'energy', plasma_rifle: 'energy' };
        const form = FORM[id] || 'pistol';
        const body = '#1a1a1e', dark = '#0e0e11', metal = '#3a3a42', wood = '#5a3a1e';
        const R = function (x, y, w, hh, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); };
        if (form === 'pistol') {
          R(10, 19, 22, 8, body);            // スライド
          R(13, 26, 8, 12, dark);            // グリップ
          ctx.fillStyle = metal; ctx.fillRect(12, 21, 18, 2);
          R(28, 26, 5, 4, dark);             // トリガーガード下
          ctx.fillStyle = c.accent; ctx.fillRect(29, 18, 4, 2);
        } else if (form === 'smg') {
          R(8, 19, 26, 7, body);             // 本体
          R(14, 25, 6, 13, dark);            // マガジン(下方)
          R(12, 25, 5, 9, dark);             // グリップ
          R(33, 20, 7, 4, body);             // 短い銃口
          R(5, 20, 4, 5, metal);             // 折り畳みストック基部
          ctx.fillStyle = c.accent; ctx.fillRect(20, 17, 8, 2); // レール
        } else if (form === 'rifle' || form === 'ak') {
          R(6, 20, 34, 7, body);             // 長い本体+バレル
          R(40, 22, 5, 3, metal);            // マズル
          R(2, 21, 6, 6, form === 'ak' ? wood : dark); // ストック
          R(14, 26, 6, 9, dark);             // グリップ
          if (form === 'ak') { // AKは湾曲マガジン
            ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(22, 26); ctx.quadraticCurveTo(24, 36, 30, 38); ctx.lineTo(33, 37); ctx.quadraticCurveTo(27, 34, 26, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
          } else { R(22, 26, 6, 11, dark); }  // M4は直線マガジン
          ctx.fillStyle = c.accent; ctx.fillRect(16, 17, 12, 2); // キャリングハンドル/レール
        } else if (form === 'minigun') {
          // M134: 回転式の六銃身＋大きな機関部＋給弾ボックス
          R(6, 18, 16, 14, metal);           // 機関部(大きい四角)
          ctx.fillStyle = c.accent; ctx.fillRect(7, 19, 14, 3);
          R(4, 30, 12, 8, dark);             // グリップ/給弾
          // 束ねた6本の銃身
          for (let i = 0; i < 6; i++) { const by = 20 + (i % 3) * 3.2, bx = i < 3 ? 0 : 1.5; ctx.fillStyle = i % 2 ? '#111' : metal; ctx.fillRect(22 + bx, by, 20, 2.4); ctx.strokeRect(22 + bx, by, 20, 2.4); }
          ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(23, 25, 5, 0, 7); ctx.fill(); ctx.stroke(); // 回転部の輪
          ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(23, 25, 2, 0, 7); ctx.fill();
        } else if (form === 'shotgun') {
          R(5, 20, 36, 6, body);             // 長く太いバレル
          R(8, 26, 24, 4, metal);            // ポンプ(下)
          R(2, 19, 5, 8, wood);              // ストック
          R(13, 26, 5, 8, wood);             // グリップ
        } else if (form === 'sniper') {
          R(4, 22, 40, 5, body);             // 超長バレル
          R(44, 23, 3, 3, metal);            // マズル
          R(1, 20, 6, 8, dark);              // ストック
          R(16, 16, 16, 4, metal);           // スコープ筒
          R(19, 14, 3, 2, dark); R(28, 14, 3, 2, dark); // スコープマウント
          R(15, 27, 5, 9, dark);             // グリップ
          ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(30, 27); ctx.lineTo(34, 36); ctx.moveTo(34, 27); ctx.lineTo(30, 36); ctx.stroke(); // バイポッド
          outline(ctx);
        } else if (form === 'rpg') {
          R(8, 21, 28, 8, body);             // 太い発射筒
          ctx.fillStyle = c.accent;          // 円錐弾頭
          ctx.beginPath(); ctx.moveTo(36, 21); ctx.lineTo(45, 25); ctx.lineTo(36, 29); ctx.closePath(); ctx.fill(); ctx.stroke();
          R(4, 22, 5, 6, dark);              // 後方ノズル
          R(16, 29, 5, 8, dark);             // グリップ
          ctx.fillStyle = metal; ctx.fillRect(24, 18, 4, 3); // サイト
        } else { // energy: SF的なエネルギー銃
          R(8, 20, 26, 8, body);
          ctx.fillStyle = c.accent; ctx.fillRect(32, 22, 9, 4); ctx.strokeRect(32, 22, 9, 4); // 発光エミッタ
          ctx.fillStyle = mix(c.accent, '#ffffff', 0.4); ctx.fillRect(40, 23, 3, 2);
          R(14, 26, 6, 11, dark);            // グリップ
          ctx.fillStyle = c.accent; ctx.fillRect(12, 22, 4, 4); ctx.fillRect(20, 22, 3, 4); // エネルギーコイル
        }
        break;
      }
      case 'staff': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = shade('#6a4a2a', 1); ctx.fillRect(M - 1.5, 12, 3, 28); ctx.strokeRect(M - 1.5, 12, 3, 28); // 杖の柄(共通)
        if (def.tool === 'grapple') { // 鉤縄: 先端のフック
          ctx.strokeStyle = metal || '#3a3a42'; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(M, 12); ctx.lineTo(M, 6); ctx.arc(M - 3, 6, 3, 0, Math.PI * 1.4); ctx.stroke();
          ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; for (let y = 16; y < 38; y += 4) { ctx.beginPath(); ctx.moveTo(M + 2, y); ctx.lineTo(M + 5, y + 2); ctx.stroke(); } // 縄
        } else if (def.tool === 'warp') { // ワープ: 渦巻く先端
          ctx.strokeStyle = c.base; ctx.lineWidth = 2; ctx.beginPath();
          for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 3.2, rr = 1 + t * 1.1; const px = M + Math.cos(t) * rr, py = 10 + Math.sin(t) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.stroke(); ctx.fillStyle = c.hi; ctx.beginPath(); ctx.arc(M, 10, 2, 0, 7); ctx.fill();
        } else if (def.strike || def.castMeteor) { // 隕石/流星: 尖った星型クリスタル
          ctx.fillStyle = c.base; ctx.beginPath();
          for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2, rr = a % 2 ? 4 : 9; const px = M + Math.cos(an) * rr, py = 11 + Math.sin(an) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.hi; ctx.beginPath(); ctx.arc(M, 11, 2.5, 0, 7); ctx.fill();
        } else if (def.vortex) { // 渦: 三日月/リング状の先端
          ctx.strokeStyle = c.base; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(M, 11, 7, Math.PI * 0.3, Math.PI * 1.9); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.beginPath(); ctx.arc(M, 11, 2.5, 0, 7); ctx.fill();
        } else { // 元素の杖: 宝玉(色で属性)
          const g = ctx.createRadialGradient(M, 12, 1, M, 12, 10); g.addColorStop(0, c.hi); g.addColorStop(1, c.base);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(M, 11, 8, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M - 2, 9, 2, 0, 7); ctx.fill();
          // 宝玉を抱く爪
          ctx.strokeStyle = shade('#6a4a2a', 1); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(M - 6, 16); ctx.quadraticCurveTo(M - 7, 10, M - 3, 7); ctx.moveTo(M + 6, 16); ctx.quadraticCurveTo(M + 7, 10, M + 3, 7); ctx.stroke();
        }
        break;
      }
      case 'pickaxe': case 'axe': case 'hoe': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = '#8a5a30'; ctx.save(); ctx.translate(M, M); ctx.rotate(Math.PI / 5);
        ctx.fillRect(-2, -16, 4, 32); ctx.strokeRect(-2, -16, 4, 32); grainV(ctx, -2, -14, 4, 28); ctx.restore(); // 柄
        ctx.fillStyle = metalGradV(ctx, M - 16, M + 16, c.base);
        if (cls === 'pickaxe') { ctx.beginPath(); ctx.moveTo(M - 16, M - 12); ctx.quadraticCurveTo(M, M - 18, M + 16, M - 12); ctx.lineTo(M + 14, M - 8); ctx.quadraticCurveTo(M, M - 13, M - 14, M - 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else if (cls === 'axe') { ctx.beginPath(); ctx.moveTo(M + 2, M - 16); ctx.quadraticCurveTo(M + 18, M - 12, M + 14, M + 2); ctx.lineTo(M + 2, M - 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(M + 2, M - 16, 14, 5); ctx.strokeRect(M + 2, M - 16, 14, 5); }
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.5; ctx.fillRect(M - 10, M - 12, 20, 1.5); ctx.globalAlpha = 1;
        glint(ctx, cls === 'axe' ? M + 12 : M + 10, M - 12, 2.4); break;
      }
      case 'bow': {
        ctx.strokeStyle = c.base; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(M + 6, M, 16, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M - 5, M - 14); ctx.lineTo(M - 5, M + 14); ctx.stroke(); break;
      }
      case 'shield': case 'chest': {
        const cloth = cls === 'chest' && /coat|cloak|robe|vest|tunic|羽織|コート|ベスト|外套|毛皮/.test(id);
        const spiky = /thorn|棘/.test(id);
        if (cloth) { // 布/革の上衣: 肩から裾へ広がる柔らかいシルエット＋襟
          ctx.fillStyle = c.base; ctx.beginPath();
          ctx.moveTo(M - 10, 12); ctx.quadraticCurveTo(M, 8, M + 10, 12); ctx.lineTo(M + 13, 38); ctx.quadraticCurveTo(M, 42, M - 13, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = shade(c.base, 0.7); ctx.beginPath(); ctx.moveTo(M, 12); ctx.lineTo(M - 4, 40); ctx.lineTo(M + 4, 40); ctx.closePath(); ctx.fill(); // 前合わせの影
          ctx.fillStyle = c.accent; ctx.beginPath(); ctx.moveTo(M - 10, 12); ctx.lineTo(M - 4, 18); ctx.lineTo(M, 13); ctx.lineTo(M + 4, 18); ctx.lineTo(M + 10, 12); ctx.lineTo(M + 6, 11); ctx.lineTo(M, 15); ctx.lineTo(M - 6, 11); ctx.closePath(); ctx.fill(); // 襟
          break;
        }
        ctx.fillStyle = metalGradV(ctx, M - 14, M + 14, c.base);
        ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 14, 14); ctx.lineTo(M + 11, 34); ctx.lineTo(M, 40); ctx.lineTo(M - 11, 34); ctx.lineTo(M - 14, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.fillRect(M - 2, 12, 4, 26); ctx.fillRect(M - 12, 20, 24, 4);
        ctx.fillStyle = shade(c.base, 0.6); ctx.beginPath(); ctx.moveTo(M + 11, 34); ctx.lineTo(M, 40); ctx.lineTo(M, 36); ctx.closePath(); ctx.fill(); // 下端の陰
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M - 10, 16); ctx.lineTo(M - 2, 16); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        if (spiky) { ctx.fillStyle = shade(c.base, 0.4); for (let i = -10; i <= 10; i += 5) { ctx.beginPath(); ctx.moveTo(M + i, 14); ctx.lineTo(M + i + 2, 8); ctx.lineTo(M + i + 4, 14); ctx.closePath(); ctx.fill(); } } // 棘
        glint(ctx, M - 7, 15, 2.2); break;
      }
      case 'helmet': {
        if (/crown|王冠|王|tiara|circlet|pharaoh|冠/.test(id)) { // 王冠: 尖塔＋宝石
          ctx.fillStyle = metalGradV(ctx, M - 14, M + 14, c.base);
          ctx.beginPath(); ctx.moveTo(M - 14, M + 8); ctx.lineTo(M - 14, M - 2); ctx.lineTo(M - 8, M + 4); ctx.lineTo(M - 4, M - 8); ctx.lineTo(M, M + 2); ctx.lineTo(M + 4, M - 8); ctx.lineTo(M + 8, M + 4); ctx.lineTo(M + 14, M - 2); ctx.lineTo(M + 14, M + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.accent; [[-4, -8], [4, -8], [0, 2]].forEach(g => { ctx.beginPath(); ctx.arc(M + g[0], M + g[1], 2, 0, 7); ctx.fill(); });
          ctx.fillStyle = shade(c.base, 0.6); ctx.fillRect(M - 14, M + 6, 28, 3); glint(ctx, M - 4, M - 8, 2); break;
        }
        if (/cap|帽|hood|フード|頭巾|leather|straw|わら/.test(id)) { // 布/革の帽子・フード
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M + 2, 13, Math.PI, 0); ctx.quadraticCurveTo(M + 15, M + 10, M, M + 9); ctx.quadraticCurveTo(M - 15, M + 10, M - 13, M + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = shade(c.base, 0.7); ctx.beginPath(); ctx.ellipse(M, M + 8, 14, 3, 0, 0, Math.PI * 2); ctx.fill(); // つば
          ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(M - 4, M - 3, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        ctx.fillStyle = metalGradV(ctx, M - 14, M + 14, c.base);
        ctx.beginPath(); ctx.arc(M, M, 14, Math.PI, 0); ctx.lineTo(M + 14, M + 8); ctx.lineTo(M - 14, M + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(c.base, 0.5); ctx.fillRect(M - 14, M + 4, 28, 5); ctx.strokeRect(M - 14, M + 4, 28, 5); // 面
        ctx.fillStyle = c.accent; ctx.fillRect(M - 1.5, M - 14, 3, 10); // 飾り
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(M - 5, M - 4, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        glint(ctx, M - 6, M - 5, 2.2); break;
      }
      case 'potion': {
        ctx.fillStyle = '#cfe0ee'; ctx.fillRect(M - 4, 8, 8, 6); ctx.strokeRect(M - 4, 8, 8, 6); // 栓
        ctx.fillStyle = mix(c.base, '#ffffff', 0.1); ctx.beginPath(); ctx.moveTo(M - 5, 14); ctx.lineTo(M + 5, 14); ctx.lineTo(M + 9, 38); ctx.quadraticCurveTo(M, 44, M - 9, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.moveTo(M - 7, 26); ctx.lineTo(M + 7, 26); ctx.lineTo(M + 8.5, 37); ctx.quadraticCurveTo(M, 42, M - 8.5, 37); ctx.closePath(); ctx.fill(); // 中身
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(M - 4, 18, 2, 16); ctx.globalAlpha = 1; break;
      }
      case 'food': {
        if (/meat|肉|jerky|drumstick|frog|snake|steak/.test(id)) { // 骨付き肉
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.ellipse(M + 2, M, 11, 9, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#efe6d0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(M - 6, M + 6); ctx.lineTo(M - 13, M + 13); ctx.stroke();
          ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.arc(M - 13, M + 13, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(M - 15, M + 11, 2.5, 0, 7); ctx.fill();
          ctx.fillStyle = c.hi; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(M, M - 3, 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        if (/bread|パン|loaf|bun|pie|パイ|corn|とうもろこし|bar$|携行/.test(id)) { // パン/焼き物
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M - 13, M + 6); ctx.quadraticCurveTo(M - 13, M - 8, M, M - 8); ctx.quadraticCurveTo(M + 13, M - 8, M + 13, M + 6); ctx.quadraticCurveTo(M, M + 12, M - 13, M + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = shade(c.base, 0.6); ctx.lineWidth = 1.2; for (let i = -6; i <= 6; i += 4) { ctx.beginPath(); ctx.moveTo(M + i, M - 6); ctx.lineTo(M + i - 2, M - 2); ctx.stroke(); } break; // 切れ目
        }
        if (/soup|stew|スープ|シチュー|tea|茶|salad|サラダ|broth/.test(id)) { // 器に入った料理
          ctx.fillStyle = '#cdd8e6'; ctx.beginPath(); ctx.arc(M, M + 4, 13, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke(); // 器
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.ellipse(M, M + 3, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill(); // 中身
          ctx.fillStyle = c.hi; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(M - 4, M + 2, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        // 果物/その他(丸)
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
        const vt = def.vehicle;
        if (vt === 'boat') {
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(8, 24); ctx.lineTo(40, 24); ctx.lineTo(34, 36); ctx.lineTo(14, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(24, 8); ctx.stroke(); // マスト
          ctx.fillStyle = '#eef2f8'; ctx.beginPath(); ctx.moveTo(24, 9); ctx.lineTo(37, 22); ctx.lineTo(24, 22); ctx.closePath(); ctx.fill(); // 帆
        } else if (vt === 'plane' || vt === 'jet' || vt === 'bomber') {
          ctx.fillStyle = c.base; ctx.fillRect(22, 8, 4, 32); ctx.stroke(); // 胴
          const wingY = vt === 'bomber' ? 20 : 24, ww = vt === 'bomber' ? 20 : 15;
          ctx.fillStyle = mix(c.base, '#fff', 0.2); ctx.fillRect(24 - ww, wingY, ww * 2, 5); ctx.strokeRect(24 - ww, wingY, ww * 2, 5); // 主翼
          ctx.fillStyle = mix(c.base, '#fff', 0.2); ctx.fillRect(19, 34, 10, 4); // 尾翼
          ctx.fillStyle = '#9fd8ff'; ctx.fillRect(22, 11, 4, 5); // コックピット
          if (vt !== 'plane') { ctx.fillStyle = '#3a3f34'; ctx.fillRect(24 - ww + 2, wingY + 5, 3, 3); ctx.fillRect(24 + ww - 5, wingY + 5, 3, 3); } // エンジン/銃
        } else if (vt === 'carpet') {
          ctx.save(); ctx.translate(24, 24); ctx.rotate(-0.15);
          ctx.fillStyle = c.base; ctx.fillRect(-16, -8, 32, 16); ctx.strokeRect(-16, -8, 32, 16);
          ctx.strokeStyle = mix(c.base, '#fff', 0.5); ctx.lineWidth = 1.5; ctx.strokeRect(-13, -5, 26, 10);
          ctx.strokeStyle = c.base; for (let i = -14; i <= 14; i += 4) { ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i, 12); ctx.stroke(); } // 房
          ctx.restore();
        } else if (vt === 'tank') {
          ctx.fillStyle = '#2e3226'; ctx.fillRect(8, 30, 32, 8); ctx.strokeRect(8, 30, 32, 8); // 履帯
          ctx.fillStyle = c.base; ctx.fillRect(10, 22, 28, 10); ctx.strokeRect(10, 22, 28, 10); // 車体
          ctx.fillStyle = shade(c.base, 0.8); ctx.beginPath(); ctx.arc(24, 22, 7, Math.PI, 0); ctx.fill(); // 砲塔
          ctx.strokeStyle = '#2a3420'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(24, 20); ctx.lineTo(42, 16); ctx.stroke(); // 砲身
        } else if (vt === 'mech') {
          ctx.fillStyle = shade(c.base, 0.7); ctx.fillRect(16, 30, 5, 12); ctx.fillRect(27, 30, 5, 12); // 脚
          ctx.fillStyle = c.base; ctx.fillRect(15, 16, 18, 16); ctx.strokeRect(15, 16, 18, 16); // 胴
          ctx.fillStyle = mix(c.base, '#fff', 0.2); ctx.fillRect(10, 18, 5, 10); ctx.fillRect(33, 18, 5, 10); // 肩
          ctx.fillStyle = '#3a4250'; ctx.fillRect(19, 8, 10, 8); // 頭
          ctx.fillStyle = '#ff6a4a'; ctx.fillRect(21, 11, 6, 2); // バイザー
        } else { // car / buggy 等
          ctx.fillStyle = c.base; ctx.fillRect(8, 22, 32, 10); ctx.strokeRect(8, 22, 32, 10);
          ctx.fillStyle = mix(c.base, '#fff', 0.3); ctx.fillRect(15, 16, 16, 8); ctx.strokeRect(15, 16, 16, 8);
          ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(16, 34, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(32, 34, 4, 0, 7); ctx.fill();
        }
        break;
      }
      case 'block': {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M + 14, 18); ctx.lineTo(M + 14, 34); ctx.lineTo(M, 42); ctx.lineTo(M - 14, 34); ctx.lineTo(M - 14, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(c.base, 0.7); ctx.beginPath(); ctx.moveTo(M, 26); ctx.lineTo(M + 14, 18); ctx.lineTo(M + 14, 34); ctx.lineTo(M, 42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix(c.base, '#fff', 0.25); ctx.beginPath(); ctx.moveTo(M, 10); ctx.lineTo(M + 14, 18); ctx.lineTo(M, 26); ctx.lineTo(M - 14, 18); ctx.closePath(); ctx.fill(); break;
      }
      case 'bomb': {
        ctx.fillStyle = mix(c.base, '#000', 0.4); ctx.beginPath(); ctx.arc(M, M + 4, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(M - 4, M, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M + 6, M - 8); ctx.quadraticCurveTo(M + 12, M - 16, M + 8, M - 18); ctx.stroke();
        ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.arc(M + 8, M - 19, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'book': {
        ctx.fillStyle = c.accent; ctx.fillRect(12, 12, 24, 28); ctx.strokeRect(12, 12, 24, 28);
        ctx.fillStyle = mix(c.accent, '#fff', 0.7); ctx.fillRect(16, 14, 18, 24);
        ctx.strokeStyle = c.edge; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(18, 19 + i * 5); ctx.lineTo(32, 19 + i * 5); ctx.stroke(); } break;
      }
      case 'key': {
        // 鍵: 上部の輪(ボウ)＋軸(シャフト)＋下部の歯(ビット)。金属光沢＋アイテム色
        ctx.save();
        ctx.translate(M, M); ctx.rotate(-Math.PI / 5); // 斜めに構えて鍵らしく
        const km = metalGradV ? metalGradV(ctx, -18, 18, c.base) : c.base;
        ctx.lineWidth = 2; ctx.strokeStyle = c.edge || 'rgba(0,0,0,0.8)';
        // ボウ(持ち手の輪)
        ctx.fillStyle = km;
        ctx.beginPath(); ctx.arc(0, -14, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // 輪の抜き穴
        ctx.save(); ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(0, -14, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = c.edge || 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.arc(0, -14, 3.8, 0, Math.PI * 2); ctx.stroke();
        // シャフト(軸)
        ctx.fillStyle = km;
        ctx.beginPath(); ctx.rect(-2, -6, 4, 24); ctx.fill(); ctx.stroke();
        // ビット(歯) — 下端から右へ2枚
        ctx.beginPath(); ctx.rect(2, 12, 6, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(2, 6, 4, 3.5); ctx.fill(); ctx.stroke();
        // 光沢
        ctx.fillStyle = c.hi || '#fff'; ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(-3, -16, 1.8, 0, 7); ctx.fill();
        ctx.fillRect(-1.4, -4, 1, 14); ctx.globalAlpha = 1;
        ctx.restore();
        if (typeof glint === 'function') glint(ctx, M - 5, M - 10, 2);
        break;
      }
      case 'relic': {
        if (/ring|指輪|band|指環/.test(id)) { // 指輪: 金の輪＋宝石
          ctx.strokeStyle = metalGradV ? shade('#e8c54a', 1) : '#e8c54a'; ctx.lineWidth = 4;
          ctx.strokeStyle = '#d8b24a'; ctx.beginPath(); ctx.arc(M, M + 4, 11, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, M - 12); ctx.lineTo(M + 6, M - 5); ctx.lineTo(M, M + 1); ctx.lineTo(M - 6, M - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(M - 2, M - 6, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        if (/charm|talisman|護符|お守り|符|keep|coin/.test(id)) { // 護符: 紐付きの札/石
          ctx.strokeStyle = '#b89a5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M - 8, 10); ctx.lineTo(M, 16); ctx.lineTo(M + 8, 10); ctx.stroke(); // 紐
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M - 8, 16); ctx.lineTo(M + 8, 16); ctx.lineTo(M + 7, 40); ctx.lineTo(M - 7, 40); ctx.closePath(); ctx.fill(); ctx.stroke(); // 札
          ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M, 26, 3, 0, 7); ctx.fill(); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(M, 30); ctx.lineTo(M, 36); ctx.stroke(); break; // 符文
        }
        // 遺物: 鎖の付いたペンダント＋輝く宝石
        ctx.strokeStyle = mix(c.base, '#fff', 0.4); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(M, 16, 9, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = c.base; ctx.beginPath();
        ctx.moveTo(M, 22); ctx.lineTo(M + 10, 30); ctx.lineTo(M, 42); ctx.lineTo(M - 10, 30); ctx.closePath();
        ctx.fill(); ctx.strokeStyle = c.edge; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = c.hi; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(M, 22); ctx.lineTo(M - 10, 30); ctx.lineTo(M, 32); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(M - 3, 28, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case 'material': {
        // 素材の性質(id)で形を描き分ける。棒/結晶/鉱石/有機/粉/部品
        const mform = /_bar$|ingot|steel_plate|_plate$/.test(id) ? 'ingot'
          : /crystal|shard|core|gem|lumen|_metal$|moonshard/.test(id) ? 'crystal'
          : /ore|coal|stone|obsidian|sulfur/.test(id) ? 'ore'
          : /leather|hide|string|rope|silk|fiber|cloth|guts|feather|scale|chitin|spore|web|wool/.test(id) ? 'organic'
          : /powder|dust|ash|gunpowder/.test(id) ? 'powder'
          : /circuit|parts|glass|gear|cog|energy_cell/.test(id) ? 'parts'
          : 'auto';
        if (mform === 'ore') { // ごつごつした鉱石の塊(鉱脈色の斑点)
          ctx.fillStyle = shade('#6a6660', 1); ctx.beginPath(); ctx.moveTo(12, 30); ctx.lineTo(18, 16); ctx.lineTo(30, 14); ctx.lineTo(37, 26); ctx.lineTo(32, 38); ctx.lineTo(16, 39); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.base; [[20, 24, 4], [28, 22, 3], [24, 32, 3.5], [32, 30, 2.5]].forEach(g => { ctx.beginPath(); ctx.arc(g[0], g[1], g[2], 0, 7); ctx.fill(); }); glint(ctx, 22, 20, 2); break;
        } else if (mform === 'organic') { // 束ねた有機素材(革/繊維)
          ctx.fillStyle = c.base; roundBlob ? roundBlob(ctx) : null;
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.ellipse(M, M + 2, 13, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = shade(c.base, 0.6); ctx.lineWidth = 1.4; for (let i = -8; i <= 8; i += 4) { ctx.beginPath(); ctx.moveTo(M + i, M - 8); ctx.quadraticCurveTo(M + i + 2, M, M + i, M + 10); ctx.stroke(); }
          ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M - 13, M + 4); ctx.lineTo(M + 13, M + 4); ctx.stroke(); break; // 結び紐
        } else if (mform === 'powder') { // 小袋に入った粉
          ctx.fillStyle = shade('#7a6a4a', 1); ctx.beginPath(); ctx.moveTo(M - 10, 20); ctx.lineTo(M + 10, 20); ctx.lineTo(M + 12, 40); ctx.lineTo(M - 12, 40); ctx.closePath(); ctx.fill(); ctx.stroke(); // 袋
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.ellipse(M, 20, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); // 口の粉
          ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M - 8, 18); ctx.lineTo(M + 8, 18); ctx.stroke(); break;
        } else if (mform === 'parts') { // 機械部品(歯車/基板)
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M, 11, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = shade(c.base, 0.6); for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; ctx.fillRect(M + Math.cos(an) * 11 - 2, M + Math.sin(an) * 11 - 2, 4, 4); }
          ctx.fillStyle = '#0d1424'; ctx.beginPath(); ctx.arc(M, M, 4, 0, 7); ctx.fill(); glint(ctx, M - 4, M - 4, 2); break;
        }
        const h = hash(id);
        if (mform === 'ingot' || (mform === 'auto' && h % 2 !== 0)) {
          ctx.fillStyle = metalGradV(ctx, 10, 34, c.base); ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(30, 38); ctx.lineTo(10, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = mix(c.base, '#fff', 0.3); ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(31, 26); ctx.lineTo(11, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
          glint(ctx, 28, 28, 2.2); break;
        }
        if (h % 2 === 0 || mform === 'crystal') {
          ctx.fillStyle = c.base; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M + 12, 22); ctx.lineTo(M + 6, 40); ctx.lineTo(M - 6, 40); ctx.lineTo(M - 12, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.hi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M - 12, 22); ctx.lineTo(M, 26); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = shade(c.base, 0.62); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(M + 12, 22); ctx.lineTo(M + 6, 40); ctx.lineTo(M, 26); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; // 右下ファセット陰
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(M, 8); ctx.lineTo(M, 26); ctx.moveTo(M - 12, 22); ctx.lineTo(M, 26); ctx.lineTo(M + 12, 22); ctx.stroke(); // ファセット稜線
          glint(ctx, M - 4, 16, 2.6);
        } else {
          ctx.fillStyle = metalGradV(ctx, 10, 34, c.base); ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(30, 38); ctx.lineTo(10, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = mix(c.base, '#fff', 0.3); ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(34, 30); ctx.lineTo(31, 26); ctx.lineTo(11, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
          glint(ctx, 28, 28, 2.2);
        }
        break;
      }
      default: {
        ctx.fillStyle = c.base; ctx.beginPath(); ctx.arc(M, M, 12, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(M, M, 5, 0, 7); ctx.fill();
      }
    }
  }

  // アイコンは (id, rarity) キーでオフスクリーン描画→dataURL をキャッシュ。毎フレーム再描画しない。
  // gen 装備 × レアリティで組合せが多いため上限を設け、超えたら全破棄（再生成は安価・稀）
  const CACHE_MAX = 400;
  let cacheN = 0;
  function dataURL(id, roll) {
    const def = Game.ITEMS[id]; if (!def) return null;
    const key = id + (roll ? ':' + roll.rarity : '');
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext('2d');
    try { drawIcon(ctx, id, def, roll); finishIcon(ctx, roll); } catch (e) { return null; }
    const url = cv.toDataURL();
    if (cacheN >= CACHE_MAX) { for (const k in cache) delete cache[k]; cacheN = 0; }
    cache[key] = url; cacheN++; return url;
  }

  return { dataURL, classify };
})();
