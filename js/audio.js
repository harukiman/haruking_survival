// audio.js — Web Audio による手続きSFX＋状況連動BGM（アセット不要）
window.Game = window.Game || {};

Game.Audio = (function () {
  let ctx = null;
  let master = null, sfxGain = null, bgmGain = null;
  let enabled = true;
  let lastPlay = {};

  // BGM 状態
  const bgm = { started: false, mood: null, pads: [], filter: null, nextNote: 0, cfg: null };

  // 穏やかで協和的なペンタトニック。耳障りにならないよう sine 主体・低音量・ゆったり
  const MOODS = {
    day:    { root: 261.63, scale: [0, 2, 4, 7, 9],  tempo: 2.8, wave: 'sine', padVol: 0.028, noteVol: 0.03, detune: 2 },
    night:  { root: 196.00, scale: [0, 3, 5, 7, 10], tempo: 3.4, wave: 'sine', padVol: 0.032, noteVol: 0.026, detune: 2 },
    shadow: { root: 174.61, scale: [0, 3, 5, 7, 10], tempo: 3.0, wave: 'sine', padVol: 0.034, noteVol: 0.026, detune: 3 },
    boss:   { root: 196.00, scale: [0, 3, 5, 7, 10], tempo: 1.5, wave: 'triangle', padVol: 0.03, noteVol: 0.03, detune: 3 },
  };

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { enabled = false; return; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
      bgmGain = ctx.createGain(); bgmGain.gain.value = enabled ? 0.32 : 0; bgmGain.connect(master);
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ===== SFX =====
  function beep(freq, dur, type, vol) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function throttled(name, ms) {
    const now = (ctx && ctx.currentTime) || (performance.now() / 1000);
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now; return true;
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
      case 'swing':  if (throttled('swing', 0.1)) beep(300, 0.05, 'triangle', 0.06); break;
      case 'hit':    beep(220, 0.07, 'square', 0.09); beep(160, 0.09, 'sawtooth', 0.06); break;
      case 'mobdie': beep(200, 0.12, 'sawtooth', 0.1); beep(120, 0.16, 'triangle', 0.08); break;
      case 'equip':  beep(400, 0.06, 'square', 0.07); beep(560, 0.06, 'square', 0.06); break;
      case 'levelup': beep(523, 0.1, 'triangle', 0.1); beep(659, 0.1, 'triangle', 0.1); beep(784, 0.14, 'triangle', 0.1); break;
      case 'shift':  beep(440, 0.25, 'sine', 0.12); beep(220, 0.35, 'sine', 0.1); beep(110, 0.45, 'triangle', 0.08); break;
      case 'enchant': beep(620, 0.1, 'sine', 0.09); beep(820, 0.12, 'sine', 0.08); beep(1040, 0.16, 'triangle', 0.07); break;
      case 'dash':   if (throttled('dash', 0.25)) beep(520, 0.07, 'sine', 0.05); break;
      case 'gun':    if (throttled('gun', 0.05)) { beep(900, 0.04, 'square', 0.08); beep(300, 0.08, 'sawtooth', 0.07); } break;
      case 'engine': if (throttled('engine', 0.3)) beep(110, 0.2, 'sawtooth', 0.05); break;
    }
  }

  // ===== BGM（手続き生成・状況連動）=====
  function startBGM() {
    if (!enabled) return; ensure(); if (!ctx || bgm.started) return;
    bgm.started = true;
    bgm.filter = ctx.createBiquadFilter(); bgm.filter.type = 'lowpass'; bgm.filter.frequency.value = 900; bgm.filter.connect(bgmGain);
    // 3声のパッド（root, 5th, octave）
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; g.gain.value = 0; osc.connect(g); g.connect(bgm.filter); osc.start();
      bgm.pads.push({ osc: osc, gain: g });
    }
    setMood('day', true);
  }

  function setMood(mood, force) {
    if (!bgm.started || (!force && bgm.mood === mood)) return;
    bgm.mood = mood;
    const cfg = MOODS[mood] || MOODS.day; bgm.cfg = cfg;
    const t = ctx.currentTime;
    const freqs = [cfg.root, cfg.root * 1.5, cfg.root * 2];
    for (let i = 0; i < bgm.pads.length; i++) {
      const pad = bgm.pads[i];
      pad.osc.type = cfg.wave;
      pad.osc.frequency.setTargetAtTime(freqs[i], t, 0.6);
      pad.osc.detune.setTargetAtTime((i - 1) * cfg.detune, t, 0.6);
      pad.gain.gain.setTargetAtTime(cfg.padVol, t, 0.8);
    }
    bgm.filter.frequency.setTargetAtTime(mood === 'shadow' ? 700 : mood === 'boss' ? 2200 : 1400, t, 0.8);
  }

  // 旋律スケジューラ（main から毎フレーム呼ぶ）
  function tickBGM() {
    if (!enabled || !bgm.started || !ctx || !bgm.cfg) return;
    const now = ctx.currentTime;
    if (now < bgm.nextNote) return;
    const cfg = bgm.cfg;
    const deg = cfg.scale[Math.floor(Math.random() * cfg.scale.length)];
    const oct = Math.random() < 0.4 ? 2 : 1;
    const freq = cfg.root * oct * Math.pow(2, deg / 12);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = cfg.wave;
    osc.frequency.value = freq;
    const dur = cfg.tempo * (0.5 + Math.random() * 0.5);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(cfg.noteVol, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g); g.connect(bgm.filter);
    osc.start(now); osc.stop(now + dur + 0.05);
    bgm.nextNote = now + cfg.tempo * (0.8 + Math.random() * 0.8);
  }

  // 状況からムード判定して更新
  function updateMood() {
    if (!bgm.started) return;
    let mood = 'day';
    const mobs = Game.state.mobs;
    let boss = false;
    for (let i = 0; i < mobs.length; i++) if (mobs[i].def.boss) { boss = true; break; }
    if (boss) mood = 'boss';
    else if (Game.state.worldName === 'shadow') mood = 'shadow';
    else if (Game.DayNight.isNight()) mood = 'night';
    setMood(mood);
  }

  function toggle() {
    enabled = !enabled;
    if (bgmGain) bgmGain.gain.value = enabled ? 0.5 : 0;
    if (enabled) { ensure(); if (!bgm.started) startBGM(); }
    return enabled;
  }
  function isEnabled() { return enabled; }

  return { play, ensure, toggle, isEnabled, startBGM, tickBGM, updateMood, setMood };
})();
