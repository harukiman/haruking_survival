// audio.js — Web Audio による手続きSFX（アセット不要）
window.Game = window.Game || {};

Game.Audio = (function () {
  let ctx = null;
  let enabled = true;
  let lastPlay = {};

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { enabled = false; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function beep(freq, dur, type, vol) {
    if (!enabled) return;
    ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // throttle 連発防止
  function throttled(name, ms) {
    const now = (ctx && ctx.currentTime) || (performance.now() / 1000);
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now;
    return true;
  }

  function play(name) {
    if (!enabled) return;
    switch (name) {
      case 'mine':   if (throttled('mine', 0.09)) beep(180 + Math.random() * 40, 0.06, 'square', 0.05); break;
      case 'break':  beep(120, 0.12, 'sawtooth', 0.1); beep(90, 0.16, 'triangle', 0.08); break;
      case 'place':  beep(320, 0.08, 'square', 0.08); break;
      case 'pickup': beep(660, 0.06, 'sine', 0.07); beep(880, 0.06, 'sine', 0.05); break;
      case 'craft':  beep(520, 0.08, 'triangle', 0.1); beep(700, 0.1, 'triangle', 0.09); break;
      case 'eat':    beep(280, 0.1, 'sine', 0.09); break;
      case 'hurt':   beep(150, 0.18, 'sawtooth', 0.12); break;
      case 'select': beep(440, 0.04, 'square', 0.05); break;
    }
  }

  function toggle() { enabled = !enabled; return enabled; }

  return { play, ensure, toggle };
})();
