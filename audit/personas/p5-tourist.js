// P5 システム観光: 全 UI 画面を開いてスクショ + タップターゲット/フォント/あふれ走査。
// 最後にセーブ/ロード往復の整合検査。
'use strict';
const probes = require('../lib/probes');

async function run(ctx) {
  const { page, seed, runner, H } = ctx;
  await H.boot(ctx, { seed });

  // 検査対象画面: [ラベル, 開く, 閉じる]
  const SCREENS = [
    ['inventory', "() => Game.UI.toggleInventory()", "() => Game.UI.toggleInventory()"],
    ['stats', "() => Game.UI.toggleStats()", "() => Game.UI.toggleStats()"],
    ['bigmap', "() => Game.UI.toggleBigMap()", "() => Game.UI.toggleBigMap()"],
    ['options', "() => Game.UI.toggleOptions()", "() => Game.UI.toggleOptions()"],
    ['shop', "() => { Game.state.player.bts = 120; Game.UI.openShop(); }", "() => { const b = document.getElementById('btn-close-trade'); if (b) b.click(); }"],
  ];

  const screens = [];
  for (const [label, openFn, closeFn] of SCREENS) {
    const entry = { label };
    try {
      await page.evaluate((src) => (new Function('return (' + src + ')')())(), openFn);
      await new Promise(r => setTimeout(r, 500));
      await runner.shot(page, `screen-${label}`);
      entry.tapTargets = await probes.tapTargetScan(page, label);
      entry.fonts = await probes.fontScan(page, label);
      entry.overflow = await probes.overflowScan(page, label);
      // 閉じる手段の明瞭性: 可視の閉じるボタンがあるか
      entry.closeAffordance = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent && /閉|×|✕|close|戻る/i.test(b.innerText + b.id));
        return btns.map(b => ({ id: b.id || b.innerText.slice(0, 8), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
      });
      await page.evaluate((src) => (new Function('return (' + src + ')')())(), closeFn);
      await new Promise(r => setTimeout(r, 350));
      // 本当に閉じたか (ゲームに戻れないUIは致命的)
      entry.closedOk = await page.evaluate(() => !Game.state.paused || !document.querySelector('.screen:not(.hidden), .modal:not(.hidden)'));
      entry.ok = true;
    } catch (e) {
      entry.ok = false; entry.error = String(e && e.message || e);
      // 復帰を試みる
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { if (Game.state) Game.state.paused = false; }).catch(() => {});
    }
    screens.push(entry);
  }
  runner.result.probes['screens.tour'] = { ok: true, data: screens };

  // クラフト画面 (インベントリ内タブの可能性) — インベントリを開いた状態で走査済みのため
  // ここでは夜の HUD 可読性を追加確認
  await runner.probe('night.readability', async () => {
    await page.evaluate(() => { Game.state.tick = 20400; });
    await new Promise(r => setTimeout(r, 1200));
    await runner.shot(page, 'night-hud');
    return probes.fontScan(page, 'night-hud');
  });
  await page.evaluate(() => { Game.state.tick = 6000; }); // 昼に戻す

  // アイテム多数所持時のインベントリ表示 (ハクスラ要素の実運用状態)
  await runner.probe('inventory.loaded', async () => {
    await page.evaluate(() => {
      const ids = ['wood', 'stone', 'iron_ore', 'apple', 'berry', 'iron_sword', 'leather_helmet', 'cooked_meat', 'torch', 'shadow_shard'];
      for (const id of ids) { try { Game.Inventory.add(id, 5); } catch (e) {} }
      try { Game.Inventory.addInstance({ id: 'iron_sword', count: 1, roll: Game.Loot.roll ? Game.Loot.roll('iron_sword', 2) : null }); } catch (e) {}
      Game.UI.toggleInventory();
    });
    await new Promise(r => setTimeout(r, 500));
    await runner.shot(page, 'inventory-loaded');
    const scan = await probes.tapTargetScan(page, 'inventory-loaded');
    const overflow = await probes.overflowScan(page, 'inventory-loaded');
    await page.evaluate(() => Game.UI.toggleInventory());
    return { scan, overflow };
  });

  // セーブ/ロード往復 (最後: reload を伴うため)
  await runner.probe('save.roundtrip', () => probes.saveLoadRoundtrip(page));
  await runner.shot(page, 'after-load');
}

module.exports = { run };
