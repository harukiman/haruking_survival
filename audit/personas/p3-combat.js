// P3 戦闘ガントレット: 装備を整え夜の混戦を作り、FPS・被弾可読性・
// フィードバック・toastスパム・死亡体験を計測する。
'use strict';
const probes = require('../lib/probes');

async function run(ctx) {
  const { page, cdp, seed, runner, H } = ctx;
  const touch = H.makeTouch(cdp);
  await H.boot(ctx, { seed });

  // 平常時 FPS ベースライン (昼・静穏)
  await runner.probe('fps.baseline', async () => {
    await page.evaluate(() => window.__audit.startFps());
    await new Promise(r => setTimeout(r, 6000));
    return page.evaluate(() => window.__audit.stopFps());
  });

  // 装備支給 (中盤想定の適正装備 — インフレさせない)
  await runner.probe('setup.gear', () => page.evaluate(() => {
    Game.Inventory.add('iron_sword', 1);
    Game.Inventory.add('iron_helmet', 1);
    Game.Inventory.add('iron_chest', 1);
    Game.Inventory.add('cooked_meat', 8);
    const p = Game.state.player;
    p.level = 8; p.maxHealth = 140; p.health = 140;
    return { inv: Game.state.inventory.filter(Boolean).map(i => i.id) };
  }));

  // 夜を強制 + モブ 25 体スポーン
  await runner.probe('setup.nightChaos', () => page.evaluate(() => {
    Game.state.tick = 20400; // timeOfDay ≈ 0.85 → 夜
    const p = Game.state.player;
    const types = ['zombie', 'skeleton', 'spider', 'slime', 'wraith'];
    let spawned = 0;
    for (let i = 0; i < 25; i++) {
      const a = (i / 25) * Math.PI * 2, d = 90 + (i % 5) * 30;
      try { Game.Mobs.spawnMob(types[i % types.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); spawned++; } catch (e) {}
    }
    return { spawned, mobs: Game.state.worlds[Game.state.worldName].mobs.length };
  }));
  await new Promise(r => setTimeout(r, 800));
  await runner.shot(page, 'night-chaos-start');

  // 混戦 FPS + 実タッチで戦闘 (採掘ボタン連打 + 移動)
  await runner.probe('fps.chaos', async () => {
    await page.evaluate(() => window.__audit.startFps());
    const btn = await page.evaluate(() => {
      const b = document.getElementById('btn-mine'); if (!b || !b.offsetParent) return null;
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if (btn) await touch.tap(btn.x, btn.y);
      await touch.drag(110, 620, (Math.sin(Date.now() / 500) * 80) | 0, (Math.cos(Date.now() / 700) * 80) | 0, 250, 3);
    }
    return page.evaluate(() => window.__audit.stopFps());
  });
  await runner.shot(page, 'night-chaos-mid');

  // 可読性検査 (混戦中): HUD重なり + 中央帯遮蔽 + toastスパム率
  await runner.probe('hud.chaosOverlap', () => probes.hudOverlapScan(page, 'combat-chaos'));
  await runner.probe('hud.playfieldOcclusion', () => probes.playfieldOcclusionScan(page, 'combat-chaos'));
  await runner.probe('toast.spamRate', () => page.evaluate(() => {
    const A = window.__audit;
    const now = performance.now();
    const last15s = A.toasts.filter(t => now - t.t < 15000);
    return { totalToasts: A.toasts.length, last15s: last15s.length, perSec: +(last15s.length / 15).toFixed(2), sample: last15s.slice(0, 8).map(t => t.msg.slice(0, 30)) };
  }));

  // 攻撃ヒットのフィードバック: 最寄りモブのHPが減るか + 何らかの演出反応
  await runner.probe('combat.hitFeedback', async () => {
    return page.evaluate(async () => {
      const p = Game.state.player;
      const mobs = Game.state.worlds[Game.state.worldName].mobs;
      if (!mobs.length) return { error: 'no mobs' };
      let nearest = mobs[0], nd = Infinity;
      for (const m of mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < nd) { nd = d; nearest = m; } }
      // 隣接位置へ移動して向きを合わせ攻撃
      p.x = nearest.x - 20; p.y = nearest.y; p.dir = 'right';
      const hpBefore = nearest.hp != null ? nearest.hp : nearest.health;
      const t0 = performance.now();
      for (let i = 0; i < 6; i++) { try { Game.Combat.tryAttack(); } catch (e) {} await new Promise(r => setTimeout(r, 260)); }
      const hpAfter = nearest.hp != null ? nearest.hp : nearest.health;
      return { distance: Math.round(nd), hpBefore, hpAfter, damaged: hpAfter < hpBefore, elapsedMs: Math.round(performance.now() - t0) };
    });
  });
  await runner.shot(page, 'combat-close');

  // 被弾側の明瞭性: HP が減った時に何が起きるか記録
  await runner.probe('combat.playerHitClarity', () => page.evaluate(async () => {
    const p = Game.state.player;
    const before = p.health;
    p.invuln = 0;
    await new Promise(r => setTimeout(r, 4000));
    return { hpBefore: Math.round(before), hpAfter: Math.round(p.health), tookDamage: p.health < before };
  }));

  // 死亡体験: HP0 → 死亡画面 → 蘇生ボタンのタップターゲット → 復帰
  await runner.probe('death.experience', async () => {
    await page.evaluate(() => { Game.state.player.health = 0; });
    const appeared = await page.waitForFunction(
      () => { const d = document.getElementById('death-screen'); return d && !d.classList.contains('hidden') && d.offsetParent; },
      { timeout: 8000, polling: 200 }
    ).then(() => true).catch(() => false);
    if (!appeared) return { deathScreenAppeared: false };
    await runner.shot(page, 'death-screen');
    const scan = await probes.tapTargetScan(page, 'death-screen');
    const fonts = await probes.fontScan(page, 'death-screen');
    const btn = await page.evaluate(() => {
      const b = document.getElementById('btn-death-revive'); if (!b) return null;
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    let revived = false;
    if (btn) {
      await touch.tap(btn.x, btn.y);
      revived = await page.waitForFunction(() => Game.state && Game.state.player.health > 0 && !Game.state.paused, { timeout: 8000, polling: 250 })
        .then(() => true).catch(() => false);
    }
    await runner.shot(page, 'after-revive');
    return { deathScreenAppeared: true, reviveWorked: revived, tapViolations: scan.violations, fontViolations: fonts.violations };
  });
}

module.exports = { run };
