// P4 進行フォロワー: クエスト11段階を順に達成し「意図された体験」を監査する。
// 各段階: トラッカー表示/文言/あふれ → 達成条件を満たす → 祝福演出の発火を確認。
'use strict';
const probes = require('../lib/probes');

// 各クエストの達成条件を満たす操作 (ページ内で実行される)
const STEP_ACTIONS = {
  gather: "() => Game.Inventory.add('wood', 2)",
  tool: "() => Game.Inventory.add('wood_sword', 1)",
  night: "() => Game.Achievements.unlock('first_night')",
  mirror: "() => { Game.Inventory.add('shadow_shard', 8); Game.Inventory.add('shadow_mirror', 1); }",
  shift: "() => Game.Achievements.unlock('first_shift')",
  crystal: "() => Game.Inventory.add('shadow_crystal', 3)",
  gear: "() => Game.Achievements.unlock('shadow_gear')",
  seal: "() => Game.Achievements.unlock('resonance')",
  boss: "() => Game.Achievements.unlock('boss_slain')",
  lore: "() => { const l = Game.state.lore || (Game.state.lore = {}); for (let i = 0; i < 5; i++) l[i] = 1; }",
};

async function run(ctx) {
  const { page, seed, runner, H } = ctx;
  await H.boot(ctx, { seed });

  const steps = [];
  for (let i = 0; i < 12; i++) {
    const st = await page.evaluate(() => {
      const q = Game.QUESTS[Game.state.questIndex || 0] || null;
      const qt = document.getElementById('quest-tracker');
      const qtext = document.getElementById('quest-text');
      return q ? {
        id: q.id, name: q.name, desc: q.desc,
        trackerVisible: !!(qt && qt.offsetParent && !qt.classList.contains('hidden')),
        trackerText: qtext ? qtext.innerText : null,
        trackerOverflow: qtext ? (qtext.scrollWidth > qtext.clientWidth + 4 || qtext.scrollHeight > qtext.clientHeight + 4) : null,
        index: Game.state.questIndex || 0,
      } : null;
    });
    if (!st) break;
    if (st.id === 'reunify') { steps.push({ ...st, note: '最終儀式クエスト — 表示のみ確認' }); break; }

    await runner.shot(page, `quest-${String(st.index).padStart(2, '0')}-${st.id}`);

    const action = STEP_ACTIONS[st.id];
    if (!action) { steps.push({ ...st, error: 'no action defined' }); break; }

    const adv = await page.evaluate(async (fnSrc, prevIndex) => {
      const A = window.__audit;
      const toastsBefore = A.toasts.length;
      const t0 = performance.now();
      (new Function('return (' + fnSrc + ')')())();
      // クエスト update はゲームループ内で走る — 前進を待つ。
      // 実績→ストーリー章のムービーが自動再生され paused になるため、
      // せっかちなプレイヤーと同様スキップして進む (発生回数は記録)
      let storySkips = 0;
      for (let k = 0; k < 80; k++) {
        await new Promise(r => setTimeout(r, 100));
        if (Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying()) {
          try { Game.Cutscene.skip(); storySkips++; } catch (e) {}
          await new Promise(r => setTimeout(r, 200));
        }
        if (Game.state.paused && !(Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying())) {
          // ムービー終了後も paused が残るケースの保険
          await new Promise(r => setTimeout(r, 400));
          if (Game.state.paused) Game.state.paused = false;
        }
        if ((Game.state.questIndex || 0) > prevIndex) break;
      }
      const advanced = (Game.state.questIndex || 0) > prevIndex;
      const celebration = A.toasts.slice(toastsBefore).map(t => t.msg).filter(m => m.includes('目標達成'));
      return { advanced, latencyMs: Math.round(performance.now() - t0), storySkips, celebrationToast: celebration[0] || null };
    }, action, st.index);

    steps.push({ ...st, ...adv });
    if (!adv.advanced) break;
    await new Promise(r => setTimeout(r, 400));
  }

  runner.result.probes['quest.chain'] = { ok: true, data: { steps, completed: steps.filter(s => s.advanced).length, total: 11 } };
  await runner.shot(page, 'quest-final-state');

  // 全達成後のトラッカー状態 + エンディング導線
  await runner.probe('quest.endState', () => page.evaluate(() => {
    const qt = document.getElementById('quest-tracker');
    return {
      questIndex: Game.state.questIndex || 0,
      trackerVisible: !!(qt && qt.offsetParent && !qt.classList.contains('hidden')),
      trackerText: (document.getElementById('quest-text') || {}).innerText || null,
    };
  }));

  // 進行中に一度もヒントが出なかった段階の検出材料
  await runner.probe('quest.hintCoverage', () => page.evaluate(() => ({
    tipsFired: window.__audit.tips.map(t => t.key),
    toastCount: window.__audit.toasts.length,
  })));
}

module.exports = { run };
