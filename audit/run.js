// audit/run.js — ペルソナプレイテスト実行 CLI
// 使い方: node audit/run.js [--persona p1] [--seed 12345] [--wave 01]
//   ペルソナ省略時は p1〜p5 を逐次実行 (FPS計測ノイズ防止のため並列にしない)
'use strict';
const path = require('path');
const fs = require('fs');
const H = require('./lib/harness');

const argv = process.argv.slice(2);
function arg(name, dflt) { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; }

const wave = arg('wave', '00');
const seed = parseInt(arg('seed', '12345'), 10);
const only = arg('persona', null);

const ALL = ['p1-firsttime', 'p2-touch', 'p3-combat', 'p4-progression', 'p5-tourist'];
const targets = only ? ALL.filter(p => p.startsWith(only)) : ALL;
if (!targets.length) { console.error('unknown persona: ' + only); process.exit(2); }

(async () => {
  const waveDir = path.join(__dirname, 'wave-' + wave);
  const summary = { wave, seed, ranAt: new Date().toISOString(), personas: {} };
  let anyFatal = false;

  for (const name of targets) {
    const mod = require('./personas/' + name + '.js');
    const runner = H.makeRunner(name, waveDir);
    const ctx = await H.launch();
    const t0 = Date.now();
    console.log(`[${name}] start (seed=${seed})`);
    try {
      await mod.run({ ...ctx, seed, runner, H });
    } catch (e) {
      runner.result.fatal = String(e && e.message || e);
      anyFatal = true;
      console.error(`[${name}] FATAL: ${runner.result.fatal}`);
    }
    const out = runner.finish(ctx);
    await ctx.browser.close();
    const probes = runner.result.probes;
    const failed = Object.keys(probes).filter(k => !probes[k].ok);
    summary.personas[name] = {
      seconds: Math.round((Date.now() - t0) / 1000),
      probes: Object.keys(probes).length, probeFailures: failed,
      pageErrors: ctx.errors.length, fatal: runner.result.fatal || null,
      result: path.relative(path.join(__dirname, '..'), out),
    };
    console.log(`[${name}] done in ${summary.personas[name].seconds}s — probes=${Object.keys(probes).length} failures=${failed.length} pageErrors=${ctx.errors.length}`);
  }

  fs.writeFileSync(path.join(waveDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('WAVE SUMMARY: ' + JSON.stringify(summary, null, 2));
  process.exit(anyFatal ? 1 : 0);
})();
