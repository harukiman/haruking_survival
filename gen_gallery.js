// gen_gallery.js — 全アイテム/モブ/ボスの実画像を並べた図鑑HTML(gallery.html)を生成する。
// アイコンやスプライトは実行時にブラウザで手続き描画されるため、puppeteerで実際に描いてdataURL化する。
// 使い方: (ローカルサーバ起動後) node gen_gallery.js
const puppeteer = require('/Users/nekonaomichi/pachinko-goty/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  const errs = [];
  page.on('pageerror', e => errs.push('' + e.message));
  await page.goto('http://localhost:8799/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 700));

  const data = await page.evaluate(async () => {
    const G = window.Game;
    document.getElementById('btn-new').click();
    await new Promise(r => setTimeout(r, 500));

    // ---- アイテム: Icons.dataURL(id) を全件 ----
    const items = [];
    for (const id in G.ITEMS) {
      const d = G.ITEMS[id]; if (!d) continue;
      let img = null; try { img = G.Icons.dataURL(id, null); } catch (e) {}
      items.push({ id: id, name: d.name || id, img: img, cat: d.tool || (d.armor != null ? 'armor' : d.place != null ? 'build' : d.food != null ? 'food' : d.vehicle ? 'vehicle' : d.relic || d.offhand ? 'gear' : 'material') });
    }

    // ---- モブ/ボス: 1体ずつ生成→描画→ゲームcanvasから切り出し ----
    const TS = G.CFG.TILE_SIZE, p = G.state.player;
    const gcanvas = document.getElementById('game');
    const off = document.createElement('canvas'); off.width = 64; off.height = 64; const octx = off.getContext('2d');
    const mobs = [];
    const types = Object.keys(G.MOBS).filter(k => !G.MOBS[k].npc);
    for (const t of types) {
      const def = G.MOBS[t];
      G.state.mobs.length = 0;
      // プレイヤーの少し上に配置(HUD等と重ならない画面中央付近)
      const mx = p.x, my = p.y - TS * 2;
      const m = G.Mobs.spawnMob(t, mx, my);
      if (!m) { mobs.push({ id: t, name: def.name || t, boss: !!def.boss, img: null }); continue; }
      m.prevX = m.x; m.prevY = m.y; m.hurt = 0;
      // 2フレーム描画を待つ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sc = G.Camera.worldToScreen(m.x, m.y);
      const dpr = window.devicePixelRatio || 1;
      const sz = Math.max(40, (def.size || 16) * 2.6);
      octx.clearRect(0, 0, 64, 64);
      try {
        octx.drawImage(gcanvas, (sc.x - sz / 2) * dpr, (sc.y - sz / 2) * dpr, sz * dpr, sz * dpr, 0, 0, 64, 64);
        mobs.push({ id: t, name: def.name || t, boss: !!def.boss, hostile: !!def.hostile, img: off.toDataURL('image/png') });
      } catch (e) { mobs.push({ id: t, name: def.name || t, boss: !!def.boss, img: null }); }
    }
    G.state.mobs.length = 0;
    return { items, mobs };
  });

  await browser.close();
  if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));

  // ---- HTML 組み立て ----
  const esc = s => String(s).replace(/</g, '&lt;');
  const cell = (o) => `<figure class="cell"${o.boss ? ' data-boss="1"' : ''}>${o.img ? `<img src="${o.img}" alt="">` : '<div class="noimg">—</div>'}<figcaption>${esc(o.name)}</figcaption></figure>`;
  const cats = {};
  data.items.forEach(it => { (cats[it.cat] = cats[it.cat] || []).push(it); });
  const catLabel = { sword: '⚔ 武器', gun: '🔫 銃', pickaxe: '⛏ 道具', axe: '🪓 道具', staff: '🪄 杖', armor: '🛡 防具', gear: '💠 装身具/左手', build: '🧱 建築・設置', food: '🍖 食料', vehicle: '🚗 乗り物', material: '📦 素材・その他' };
  let h = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Haruking Survival — 図鑑ギャラリー</title><style>
body{background:#0c1018;color:#dfe6f0;font-family:system-ui,sans-serif;margin:0;padding:16px}
h1{text-align:center;color:#8fe0a0}h2{color:#ffd86b;border-bottom:1px solid #2c3a52;padding-bottom:4px;margin-top:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
.cell{margin:0;background:#151c28;border:1px solid #24304a;border-radius:8px;padding:6px 2px;text-align:center}
.cell[data-boss] {border-color:#ff5a4a;background:#1e1620}
.cell img{width:48px;height:48px;image-rendering:pixelated;object-fit:contain}
.cell .noimg{width:48px;height:48px;line-height:48px;margin:0 auto;color:#556}
figcaption{font-size:.66rem;color:#aeb8c8;margin-top:3px;word-break:break-word;line-height:1.2}
.muted{color:#7a8494;text-align:center;font-size:.8rem}
</style></head><body><h1>🗺 Haruking Survival — 図鑑ギャラリー</h1>
<p class="muted">全アイテム ${data.items.length} 種 ／ 全モブ・ボス ${data.mobs.length} 種（実際のゲーム描画）</p>`;
  const catOrder = ['sword', 'gun', 'staff', 'pickaxe', 'axe', 'armor', 'gear', 'vehicle', 'build', 'food', 'material'];
  const seen = {};
  h += `<h2>👾 モブ・ボス（${data.mobs.length}）</h2><div class="grid">` + data.mobs.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0)).map(cell).join('') + `</div>`;
  catOrder.concat(Object.keys(cats).filter(c => catOrder.indexOf(c) < 0)).forEach(c => {
    if (!cats[c] || seen[c]) return; seen[c] = 1;
    h += `<h2>${catLabel[c] || c}（${cats[c].length}）</h2><div class="grid">` + cats[c].map(cell).join('') + `</div>`;
  });
  h += `<p class="muted" style="margin-top:24px">— gen_gallery.js で自動生成（実ゲーム描画をキャプチャ）—</p></body></html>`;

  const out = path.join(__dirname, 'gallery.html');
  fs.writeFileSync(out, h);
  console.log('gallery written:', out, '(' + Math.round(h.length / 1024) + 'KB, items=' + data.items.length + ', mobs=' + data.mobs.length + ')');
})();
