// audit/lib/harness.js — 自動プレイテスト監査の共通土台
// smoke.js の起動パターンの上位互換。全プローブは try/catch で隔離し、
// 1つの失敗がペルソナ実行全体を殺さないことを保証する。
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');

// 公開リポのためユーザー名入り絶対パス禁止。env で上書き可。
const PUPPETEER_DIR = process.env.PUPPETEER_DIR ||
  path.join(os.homedir(), 'pachinko-goty', 'node_modules', 'puppeteer-core');
const puppeteer = require(PUPPETEER_DIR);
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:8799/index.html';

const VIEWPORT = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function launch() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  const errors = [];
  // headless 環境の AudioContext ノイズは既知 (実機無関係) のため除外
  const envNoise = /AudioContext encountered an error/;
  page.on('pageerror', e => { if (!envNoise.test(e.message)) errors.push({ type: 'pageerror', msg: String(e.message), t: Date.now() }); });
  page.on('console', m => { if (m.type() === 'error' && !envNoise.test(m.text())) errors.push({ type: 'console.error', msg: m.text(), t: Date.now() }); });
  const cdp = await page.target().createCDPSession();
  return { browser, page, errors, cdp };
}

// タイトル画面到達までのタイムスタンプ (time-to-playable 計測の前半)
async function gotoTitle(ctx) {
  const { page } = ctx;
  const ts = { navStart: Date.now() };
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  ts.loaded = Date.now();
  await page.waitForFunction(() => window.Game && Game.CFG && document.getElementById('btn-new'), { timeout: 20000 });
  ts.engineReady = Date.now();
  return ts;
}

// 新規ゲーム開始。skipIntro:true でカットシーンを即スキップ (P1 以外の既定)
async function startGame(ctx, opts) {
  opts = opts || {};
  const { page } = ctx;
  const ts = {};
  await page.evaluate((seed) => {
    const s = document.getElementById('seed-input'); if (s) s.value = String(seed);
    document.getElementById('btn-new').click();
  }, opts.seed != null ? opts.seed : 12345);
  ts.newGameClicked = Date.now();
  if (opts.skipIntro !== false) {
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      if (Game.Cutscene && Game.Cutscene.skip) try { Game.Cutscene.skip(); } catch (e) {}
      if (Game.state) Game.state.paused = false;
    });
    await page.waitForFunction(() => Game.state && Game.state.tick > 5 && !Game.state.paused, { timeout: 20000, polling: 200 })
      .catch(() => { ts.tickStallAtBoot = true; });
    ts.playable = Date.now();
  }
  return ts;
}

// 互換ヘルパ: タイトル到達 → 計測注入 → 開始
async function boot(ctx, opts) {
  opts = opts || {};
  const t1 = await gotoTitle(ctx);
  await instrument(ctx.page);
  const t2 = await startGame(ctx, opts);
  return Object.assign(t1, t2);
}

// ページ内計測フック注入: toast/tips ストリーム、FPSサンプラ、エラーミラー
async function instrument(page) {
  await page.evaluate(() => {
    if (window.__audit) return;
    const A = window.__audit = { toasts: [], tips: [], errors: [], fps: null };
    if (Game.UI && Game.UI.toast) {
      const orig = Game.UI.toast;
      Game.UI.toast = function (msg) { A.toasts.push({ msg: String(msg), t: performance.now() }); return orig.apply(this, arguments); };
    }
    if (Game.UI && Game.UI.tipOnce) {
      const origTip = Game.UI.tipOnce;
      Game.UI.tipOnce = function (key, msg) { A.tips.push({ key: String(key), msg: String(msg || ''), t: performance.now() }); return origTip.apply(this, arguments); };
    }
    window.addEventListener('error', e => A.errors.push(String(e.message)));
    A.startFps = function () {
      const s = A.fps = { deltas: [], last: performance.now(), on: true };
      function loop(t) { if (!s.on) return; s.deltas.push(t - s.last); s.last = t; requestAnimationFrame(loop); }
      requestAnimationFrame(loop);
    };
    A.stopFps = function () {
      const s = A.fps; if (!s) return null;
      s.on = false;
      const d = s.deltas.slice(2); // 起動直後の外れ値を除外
      if (!d.length) return null;
      const sorted = d.slice().sort((a, b) => a - b);
      const sum = d.reduce((a, b) => a + b, 0);
      return {
        frames: d.length,
        avgMs: +(sum / d.length).toFixed(2),
        p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        worstMs: +sorted[sorted.length - 1].toFixed(2),
        longFrames50ms: d.filter(x => x > 50).length,
        approxFps: +(1000 / (sum / d.length)).toFixed(1),
      };
    };
  });
}

// CDP 経由の実タッチイベント (バージョン差異に依存しない)
function makeTouch(cdp) {
  async function dispatch(type, points) {
    await cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map(p => ({ x: p.x, y: p.y, radiusX: 6, radiusY: 6, force: 1, id: p.id || 1 })),
    });
  }
  return {
    tap: async (x, y) => { await dispatch('touchStart', [{ x, y }]); await new Promise(r => setTimeout(r, 60)); await dispatch('touchEnd', []); },
    // ドラッグ: 開始点から dx,dy へ steps 分割で移動し holdMs 維持
    drag: async (x, y, dx, dy, holdMs, steps) => {
      steps = steps || 6;
      await dispatch('touchStart', [{ x, y }]);
      for (let i = 1; i <= steps; i++) {
        await dispatch('touchMove', [{ x: x + dx * i / steps, y: y + dy * i / steps }]);
        await new Promise(r => setTimeout(r, 30));
      }
      if (holdMs) await new Promise(r => setTimeout(r, holdMs));
      await dispatch('touchEnd', []);
    },
    // 押しっぱなし開始/終了 (採掘ホールド用)
    down: async (x, y) => dispatch('touchStart', [{ x, y }]),
    move: async (x, y) => dispatch('touchMove', [{ x, y }]),
    up: async () => dispatch('touchEnd', []),
  };
}

// ペルソナ実行コンテキスト。probe(name, fn) が結果 JSON への隔離書き込みを担う。
function makeRunner(persona, waveDir) {
  const shotsDir = path.join(waveDir, 'shots');
  const resultsDir = path.join(waveDir, 'results');
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  let shotN = 0;
  const result = { persona, startedAt: new Date().toISOString(), probes: {}, shots: [], pageErrors: [] };

  return {
    result,
    shot: async (page, label) => {
      shotN++;
      const name = `${persona}-${String(shotN).padStart(2, '0')}-${label}.png`;
      await page.screenshot({ path: path.join(shotsDir, name) });
      result.shots.push(name);
      return name;
    },
    probe: async (name, fn) => {
      try {
        const v = await fn();
        result.probes[name] = { ok: true, data: v === undefined ? null : v };
        return v;
      } catch (e) {
        result.probes[name] = { ok: false, error: String(e && e.message || e) };
        return null;
      }
    },
    finish: (ctx) => {
      result.pageErrors = ctx.errors;
      result.finishedAt = new Date().toISOString();
      const out = path.join(resultsDir, `${persona}.json`);
      fs.writeFileSync(out, JSON.stringify(result, null, 2));
      return out;
    },
  };
}

module.exports = { launch, boot, gotoTitle, startGame, instrument, makeTouch, makeRunner, URL, VIEWPORT };
