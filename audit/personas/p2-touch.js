// P2 タッチ操作: 全操作を実タッチイベントで行い、エルゴノミクスを計測する。
// ジョイスティック方向精度 / デッドゾーン / ボタン連打 / 左手モード / 誤タップ危険。
'use strict';
const probes = require('../lib/probes');

async function run(ctx) {
  const { page, cdp, seed, runner, H } = ctx;
  const touch = H.makeTouch(cdp);
  await H.boot(ctx, { seed });
  await runner.shot(page, 'gameplay-start');

  // 8方向ジョイスティック: ドラッグ方向と実際の移動方向が一致するか
  await runner.probe('joystick.direction8', async () => {
    const results = [];
    const dirs = [
      ['E', 90, 0], ['W', -90, 0], ['S', 0, 90], ['N', 0, -90],
      ['NE', 64, -64], ['NW', -64, -64], ['SE', 64, 64], ['SW', -64, 64],
    ];
    for (const [name, dx, dy] of dirs) {
      const before = await page.evaluate(() => ({ x: Game.state.player.x, y: Game.state.player.y }));
      await touch.drag(110, 620, dx, dy, 1200, 5);
      const after = await page.evaluate(() => ({ x: Game.state.player.x, y: Game.state.player.y }));
      const mx = after.x - before.x, my = after.y - before.y;
      const moved = Math.hypot(mx, my);
      const expectedAngle = Math.atan2(dy, dx), actualAngle = Math.atan2(my, mx);
      let angErr = Math.abs(expectedAngle - actualAngle) * 180 / Math.PI;
      if (angErr > 180) angErr = 360 - angErr;
      results.push({ dir: name, movedPx: Math.round(moved), angleErrorDeg: moved > 4 ? Math.round(angErr) : null, noMove: moved <= 4 });
      await new Promise(r => setTimeout(r, 150));
    }
    return { results, failures: results.filter(r => r.noMove || (r.angleErrorDeg != null && r.angleErrorDeg > 30)) };
  });

  // デッドゾーン: 最小何 px のドラッグで動き出すか
  await runner.probe('joystick.deadzone', async () => {
    for (const d of [4, 8, 12, 18, 26, 36, 48]) {
      const before = await page.evaluate(() => ({ x: Game.state.player.x, y: Game.state.player.y }));
      await touch.drag(110, 620, d, 0, 900, 3);
      const after = await page.evaluate(() => ({ x: Game.state.player.x, y: Game.state.player.y }));
      if (Math.hypot(after.x - before.x, after.y - before.y) > 4) return { minDragPx: d };
      await new Promise(r => setTimeout(r, 120));
    }
    return { minDragPx: null, neverMoved: true };
  });
  await runner.shot(page, 'joystick-active');

  // アクションボタン群の実タップ: 位置取得 → タップ → 反応確認 (UIが開く/閉じる等)
  await runner.probe('buttons.tapResponse', async () => {
    const out = [];
    for (const id of ['btn-inv', 'btn-roll', 'btn-mine', 'btn-place']) {
      const r = await page.evaluate((bid) => {
        const b = document.getElementById(bid); if (!b || !b.offsetParent) return null;
        const rc = b.getBoundingClientRect(); return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, w: rc.width, h: rc.height };
      }, id);
      if (!r) { out.push({ id, visible: false }); continue; }
      const beforeShot = await page.evaluate(() => document.body.innerHTML.length);
      await touch.tap(r.x, r.y);
      await new Promise(r2 => setTimeout(r2, 400));
      const changed = await page.evaluate((prev) => document.body.innerHTML.length !== prev, beforeShot);
      out.push({ id, visible: true, w: Math.round(r.w), h: Math.round(r.h), domReacted: changed });
      // インベントリ等が開いたら閉じる
      await page.evaluate(() => {
        const inv = document.getElementById('inv-screen') || document.getElementById('inventory');
        for (const bid of ['btn-close-inv']) { const b = document.getElementById(bid); if (b && b.offsetParent) b.click(); }
      });
      await new Promise(r2 => setTimeout(r2, 250));
    }
    return out;
  });

  // 連打耐性: 採掘/回避を交互に高速タップしてページエラーが出ないか
  await runner.probe('buttons.mash', async () => {
    const rects = await page.evaluate(() => {
      const o = {};
      for (const id of ['btn-mine', 'btn-roll']) {
        const b = document.getElementById(id); if (b && b.offsetParent) { const r = b.getBoundingClientRect(); o[id] = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      }
      return o;
    });
    const errBefore = ctx.errors.length;
    for (let i = 0; i < 20; i++) {
      if (rects['btn-mine']) await touch.tap(rects['btn-mine'].x, rects['btn-mine'].y);
      if (rects['btn-roll']) await touch.tap(rects['btn-roll'].x, rects['btn-roll'].y);
    }
    await new Promise(r => setTimeout(r, 600));
    return { taps: 40, newErrors: ctx.errors.length - errBefore };
  });
  await runner.shot(page, 'after-mash');

  // 通常レイアウトの走査
  await runner.probe('layout.tapTargets', () => probes.tapTargetScan(page, 'touch-normal'));
  await runner.probe('layout.hudOverlap', () => probes.hudOverlapScan(page, 'touch-normal'));

  // 左手モード: 切替 → 再走査 + スクショ
  await runner.probe('layout.leftHanded', async () => {
    await page.evaluate(() => { document.body.classList.add('left-handed'); });
    await new Promise(r => setTimeout(r, 300));
    const scan = await probes.tapTargetScan(page, 'touch-lefthand');
    return scan;
  });
  await runner.shot(page, 'left-handed');
  await page.evaluate(() => { document.body.classList.remove('left-handed'); });

  // 画面下端 (ホームインジケータ領域) との干渉確認用スクショ
  await runner.probe('layout.bottomEdge', () => page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#touch-controls *, #hotbar, .hb-slot')) {
      if (!el.id && !el.classList.length) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 4 && r.bottom > innerHeight - 12) out.push({ sel: el.id ? '#' + el.id : '.' + el.classList[0], bottomGap: Math.round(innerHeight - r.bottom) });
    }
    return { tooCloseToEdge: out };
  }));
}

module.exports = { run };
