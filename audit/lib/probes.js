// audit/lib/probes.js — 再利用可能な計測プローブ群
// すべて page.evaluate ベース。数値はモバイル体験のハード基準:
//   タップターゲット < 44px = 違反 / 隣接ギャップ < 8px = 誤タップ危険
//   フォント < 12px = 違反, < 14px = 警告 / フィードバック > 250ms = 遅延, 無反応 1.5s = silent
'use strict';

// 可視インタラクティブ要素のタップターゲット走査
async function tapTargetScan(page, screenLabel) {
  return page.evaluate((screen) => {
    function visible(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null;
      // 祖先の hidden も検査
      for (let a = el; a; a = a.parentElement) { if (a.classList && a.classList.contains('hidden')) return null; }
      return r;
    }
    const els = Array.from(document.querySelectorAll('button, [onclick], .abtn, .dbtn, .slot, .hb-slot, input, select, [role="button"]'));
    const seen = new Set();
    const items = [];
    for (const el of els) {
      if (seen.has(el)) continue; seen.add(el);
      const r = visible(el); if (!r) continue;
      items.push({
        sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase()),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        text: (el.innerText || '').trim().slice(0, 24),
      });
    }
    const violations = items.filter(i => Math.min(i.w, i.h) < 44);
    // 隣接ペア (中心距離が近く外接ギャップ<8px)
    const adjacency = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
      const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
      const gap = Math.max(gapX, gapY);
      const overlap = gapX === 0 && gapY === 0;
      if (!overlap && gap < 8) adjacency.push({ a: a.sel, b: b.sel, gap: Math.round(gap) });
    }
    return { screen, total: items.length, violations, adjacency };
  }, screenLabel);
}

// 可視テキストのフォントサイズ走査
async function fontScan(page, screenLabel) {
  return page.evaluate((screen) => {
    const bad = [], warn = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    const seenText = new Set();
    while ((node = walker.nextNode())) {
      const el = node;
      if (!el.childNodes.length) continue;
      let hasText = false;
      for (const c of el.childNodes) if (c.nodeType === 3 && c.textContent.trim().length > 1) { hasText = true; break; }
      if (!hasText) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      let hiddenAnc = false;
      for (let a = el; a; a = a.parentElement) { if (a.classList && a.classList.contains('hidden')) { hiddenAnc = true; break; } }
      if (hiddenAnc) continue;
      const fs = parseFloat(cs.fontSize);
      const key = (el.id || el.className || el.tagName) + '|' + Math.round(fs);
      if (seenText.has(key)) continue; seenText.add(key);
      const entry = {
        sel: el.id ? '#' + el.id : (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()),
        fontPx: +fs.toFixed(1), text: (el.innerText || '').trim().slice(0, 30),
      };
      if (fs < 12) bad.push(entry); else if (fs < 14) warn.push(entry);
    }
    return { screen, violations: bad, warnings: warn };
  }, screenLabel);
}

// HUD 重なり検査: fixed/absolute の可視要素同士の交差
async function hudOverlapScan(page, screenLabel) {
  return page.evaluate((screen) => {
    const hud = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.id) continue; // id 付きの HUD 要素のみ対象 (ノイズ抑制)
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      let hiddenAnc = false;
      for (let a = el; a; a = a.parentElement) { if (a.classList && a.classList.contains('hidden')) { hiddenAnc = true; break; } }
      if (hiddenAnc) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      // 全画面キャンバス/コンテナ (面積>50%) は HUD ウィジェットではない
      if (r.width * r.height > innerWidth * innerHeight * 0.5) continue;
      // ボタン群コンテナ (子にボタンを持つ入れ物) は bbox が空白域を含むため個別ボタン側で評価
      if (el.querySelector && el.querySelector(':scope > button, :scope > .abtn, :scope > .dbtn')) continue;
      hud.push({ id: el.id, x: r.left, y: r.top, w: r.width, h: r.height });
    }
    const overlaps = [];
    for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) {
      const a = hud[i], b = hud[j];
      // 祖先子孫関係は除外
      const ea = document.getElementById(a.id), eb = document.getElementById(b.id);
      if (ea.contains(eb) || eb.contains(ea)) continue;
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const area = ix * iy;
      if (area > 4) overlaps.push({ a: a.id, b: b.id, areaPx: Math.round(area) });
    }
    return { screen, hudCount: hud.length, overlaps };
  }, screenLabel);
}

// テキストあふれ検査 (scrollWidth > clientWidth の可視要素)
async function overflowScan(page, screenLabel) {
  return page.evaluate((screen) => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!(el.innerText || '').trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let hiddenAnc = false;
      for (let a = el; a; a = a.parentElement) { if (a.classList && a.classList.contains('hidden')) { hiddenAnc = true; break; } }
      if (hiddenAnc) continue;
      if (cs.overflowX !== 'visible' && cs.overflowX !== '') continue; // 意図的スクロールは許容
      if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 20) {
        out.push({ sel: el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''), scrollW: el.scrollWidth, clientW: el.clientWidth, text: el.innerText.trim().slice(0, 30) });
      }
    }
    return { screen, overflows: out.slice(0, 20) };
  }, screenLabel);
}

// 行動→フィードバック遅延。action は page 内で実行する関数文字列。
// 反応 = 新しい toast / 頭上フロート追加 / 対象 DOM の mutation。
async function feedbackLatency(page, label, actionFn) {
  return page.evaluate(async (lbl, fnSrc) => {
    const A = window.__audit;
    const t0 = performance.now();
    const toastsBefore = A.toasts.length;
    (new Function('return (' + fnSrc + ')')())();
    // 1.5s 以内の最初の反応を待つ
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 50));
      if (A.toasts.length > toastsBefore) {
        return { label: lbl, latencyMs: Math.round(A.toasts[toastsBefore].t - t0), via: 'toast', msg: A.toasts[toastsBefore].msg.slice(0, 40) };
      }
    }
    return { label: lbl, latencyMs: null, via: 'none', silent: true };
  }, label, actionFn.toString());
}

// スタック検出: 移動意図がある間の変位を監視
async function stuckCheck(page, seconds) {
  return page.evaluate(async (sec) => {
    const TS = Game.CFG.tileSize || 32;
    const samples = [];
    for (let i = 0; i <= sec; i++) {
      const p = Game.state.player;
      samples.push({ x: p.x, y: p.y, t: i });
      if (i < sec) await new Promise(r => setTimeout(r, 1000));
    }
    let worst = Infinity;
    for (let i = 4; i < samples.length; i++) {
      const d = Math.hypot(samples[i].x - samples[i - 4].x, samples[i].y - samples[i - 4].y) / TS;
      if (d < worst) worst = d;
    }
    return { samples: samples.length, minDisplacementTilesPer4s: +(worst === Infinity ? -1 : worst).toFixed(2), stuck: worst < 0.5 };
  }, seconds);
}

// セーブ/ロード往復の整合検査
async function saveLoadRoundtrip(page) {
  const before = await page.evaluate(() => {
    Game.Save.save();
    const s = Game.state, p = s.player;
    return {
      inv: s.inventory.filter(Boolean).map(i => i.id + 'x' + i.count).sort(),
      questIndex: s.questIndex || 0, level: p.level, xp: p.xp, bts: p.bts,
      hp: Math.round(p.health), world: s.worldName, tick: s.tick,
    };
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.Game && Game.CFG && document.getElementById('btn-continue'), { timeout: 20000 });
  await page.evaluate(() => document.getElementById('btn-continue').click());
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { if (Game.Cutscene && Game.Cutscene.skip) try { Game.Cutscene.skip(); } catch (e) {} if (Game.state) Game.state.paused = false; });
  await page.waitForFunction(() => Game.state && Game.state.player, { timeout: 15000 });
  const after = await page.evaluate(() => {
    const s = Game.state, p = s.player;
    return {
      inv: s.inventory.filter(Boolean).map(i => i.id + 'x' + i.count).sort(),
      questIndex: s.questIndex || 0, level: p.level, xp: p.xp, bts: p.bts,
      hp: Math.round(p.health), world: s.worldName, tick: s.tick,
    };
  });
  const diffs = [];
  for (const k of ['questIndex', 'level', 'xp', 'bts', 'world']) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diffs.push({ field: k, before: before[k], after: after[k] });
  }
  if (before.inv.join(',') !== after.inv.join(',')) diffs.push({ field: 'inventory', before: before.inv, after: after.inv });
  return { ok: diffs.length === 0, diffs, before, after };
}

// プレイフィールド遮蔽検査: 自機周辺の中央帯 (接敵視認に必要な領域) を
// 不透明オーバーレイ (toast/hint-pill/チップ等) がどれだけ覆っているか
async function playfieldOcclusionScan(page, screenLabel) {
  return page.evaluate((screen) => {
    // 中央帯 = 横中央 76% × 縦 26%-62% (自機は画面中心、上方向の接敵コリドー含む)
    const band = { x: innerWidth * 0.12, y: innerHeight * 0.26, w: innerWidth * 0.76, h: innerHeight * 0.36 };
    const occluders = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.id && !(el.classList && el.classList.length)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      let hiddenAnc = false;
      for (let a = el; a; a = a.parentElement) { if (a.classList && a.classList.contains('hidden')) { hiddenAnc = true; break; } }
      if (hiddenAnc) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 14) continue;
      if (r.width * r.height > innerWidth * innerHeight * 0.5) continue; // 全画面コンテナ除外
      // 背景がほぼ透明な要素は遮蔽と見なさない
      const bg = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      const alpha = bg ? (bg[1].split(',')[3] !== undefined ? parseFloat(bg[1].split(',')[3]) : 1) : 0;
      if (alpha < 0.35) continue;
      const ix = Math.max(0, Math.min(r.left + r.width, band.x + band.w) - Math.max(r.left, band.x));
      const iy = Math.max(0, Math.min(r.top + r.height, band.y + band.h) - Math.max(r.top, band.y));
      const area = ix * iy;
      if (area > 400) occluders.push({ sel: el.id ? '#' + el.id : '.' + el.classList[0], areaPx: Math.round(area), bgAlpha: +alpha.toFixed(2) });
    }
    const bandArea = band.w * band.h;
    const total = occluders.reduce((s, o) => s + o.areaPx, 0);
    return { screen, occluders, coveragePct: +(100 * Math.min(total, bandArea) / bandArea).toFixed(1) };
  }, screenLabel);
}

module.exports = { tapTargetScan, fontScan, hudOverlapScan, overflowScan, feedbackLatency, stuckCheck, saveLoadRoundtrip, playfieldOcclusionScan };
