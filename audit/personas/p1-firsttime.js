// P1 初見プレイヤー (0-3分): カットシーンをスキップせず見届け、
// 「何をすればいいかわかるか」「最初の操作に反応があるか」を計測する。
'use strict';
const probes = require('../lib/probes');

async function run(ctx) {
  const { page, cdp, seed, runner, H } = ctx;
  const touch = H.makeTouch(cdp);

  const ts = await runner.probe('boot.title', () => H.gotoTitle(ctx));
  await runner.shot(page, 'title');
  await runner.probe('title.tapTargets', () => probes.tapTargetScan(page, 'title'));
  await runner.probe('title.fonts', () => probes.fontScan(page, 'title'));
  await H.instrument(page);

  // 新規開始 → カットシーンを"見る" (タイムラインスクショ + 長さ計測)
  const cut = await runner.probe('cutscene.watch', async () => {
    await page.evaluate((s) => {
      const el = document.getElementById('seed-input'); if (el) el.value = String(s);
      document.getElementById('btn-new').click();
    }, seed);
    const t0 = Date.now();
    const marks = [3, 8, 15, 30, 60, 90];
    let ended = null, skipBtnSeen = false;
    for (const m of marks) {
      while (Date.now() - t0 < m * 1000) {
        await new Promise(r => setTimeout(r, 300));
        const st = await page.evaluate(() => ({
          playing: !!(Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying()),
          paused: Game.state ? Game.state.paused : true,
          skipVisible: !!(document.getElementById('cutscene-skip') && document.getElementById('cutscene-skip').offsetParent),
        }));
        if (st.skipVisible) skipBtnSeen = true;
        if (!st.playing && !st.paused) { ended = (Date.now() - t0) / 1000; break; }
      }
      if (ended != null) break;
      await runner.shot(page, `cutscene-${m}s`);
    }
    if (ended == null) {
      // 90秒超は初見体験として長すぎ → 強制スキップして続行 (それ自体を記録)
      await page.evaluate(() => { if (Game.Cutscene && Game.Cutscene.skip) Game.Cutscene.skip(); if (Game.state) Game.state.paused = false; });
      ended = -1;
    }
    return { durationSec: ended, skipButtonSeen: skipBtnSeen, over90s: ended === -1 };
  });

  await page.waitForFunction(() => Game.state && !Game.state.paused, { timeout: 15000 }).catch(() => {});
  await runner.shot(page, 'first-control');

  // 操作可能になった直後: クエストトラッカーは見えるか / ヒントは出たか
  await runner.probe('onboarding.guidance', () => page.evaluate(() => {
    const qt = document.getElementById('quest-tracker');
    const qVisible = !!(qt && qt.offsetParent && !qt.classList.contains('hidden'));
    return {
      questTrackerVisible: qVisible,
      questText: qVisible ? (document.getElementById('quest-text') || {}).innerText || '' : '',
      tipsFiredSoFar: window.__audit.tips.map(t => t.key),
      toastsSoFar: window.__audit.toasts.map(t => t.msg).slice(0, 10),
    };
  }));

  // 初見の探索: 仮想ジョイスティックで4方向に歩く (実タッチ) + スタック検出
  await runner.probe('wander.stuck', async () => {
    const dirs = [[0, -90], [90, 0], [0, 90], [-90, 0]];
    const stuckP = probes.stuckCheck(page, 16);
    for (let rep = 0; rep < 2; rep++) {
      for (const [dx, dy] of dirs) await touch.drag(110, 620, dx, dy, 1500, 5);
    }
    return await stuckP;
  });
  await runner.shot(page, 'after-wander');

  // 最初のアクション: 画面上の採掘ボタンを実タップ → 何か反応するか
  await runner.probe('firstAction.feedback', async () => {
    const btn = await page.evaluate(() => {
      const b = document.getElementById('btn-mine'); if (!b || !b.offsetParent) return null;
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!btn) return { error: 'btn-mine not visible' };
    const before = await page.evaluate(() => ({ toasts: window.__audit.toasts.length, t: performance.now() }));
    await touch.tap(btn.x, btn.y);
    await new Promise(r => setTimeout(r, 1200));
    return page.evaluate((prev) => {
      const A = window.__audit;
      const newToasts = A.toasts.slice(prev.toasts).map(t => ({ msg: t.msg.slice(0, 40), latencyMs: Math.round(t.t - prev.t) }));
      return { newToasts, silent: newToasts.length === 0 };
    }, before);
  });

  // 3分時点までの HUD 状態
  await runner.probe('hud.calm', () => probes.hudOverlapScan(page, 'gameplay-calm'));
  await runner.probe('fonts.gameplay', () => probes.fontScan(page, 'gameplay'));
  await runner.probe('tapTargets.gameplay', () => probes.tapTargetScan(page, 'gameplay'));
  await runner.shot(page, 'gameplay-3min-state');

  // 初見が最初に死ぬ時: 空腹/夜の到来タイミング感 — 状態だけ記録
  await runner.probe('pacing.state', () => page.evaluate(() => ({
    tick: Game.state.tick,
    timeOfDay: Game.state.timeOfDay,
    isNight: Game.DayNight.isNight ? Game.DayNight.isNight() : null,
    hp: Game.state.player.health, hunger: Game.state.player.hunger,
    questIndex: Game.state.questIndex || 0,
    tips: window.__audit.tips.length, toasts: window.__audit.toasts.length,
  })));
}

module.exports = { run };
