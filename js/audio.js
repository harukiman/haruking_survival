// audio.js — Web Audio による手続きSFX＋状況連動BGM（アセット不要）
window.Game = window.Game || {};

Game.Audio = (function () {
  let ctx = null;
  let master = null, sfxGain = null, bgmGain = null;
  let enabled = true;
  let lastPlay = {};

  // BGM 状態（持続ドローン無し・16ステップのシーケンサ）
  const bgm = { started: false, mood: null, genre: null, filter: null, step: 0, nextStep: 0 };

  // ジャンル別プリセット（聞き心地よく・持続音なし）。状況→ジャンルで幅を出す
  const GENRES = {
    classic:  { root: 261.63, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 76,  wave: 'sine', cut: 1600, kick: false, bassEvery: 8, arp: [0, 4, 7, 11, 7, 4], arpEvery: 2, noteVol: 0.05, bassVol: 0.045, kickVol: 0 },
    animepop: { root: 293.66, scale: [0, 2, 4, 7, 9],        bpm: 120, wave: 'triangle', cut: 2600, kick: true, bassEvery: 4, arp: [0, 4, 7, 9, 7, 4], arpEvery: 1, noteVol: 0.045, bassVol: 0.04, kickVol: 0.10 },
    city:     { root: 261.63, scale: [0, 3, 5, 7, 10],       bpm: 92,  wave: 'sine', cut: 1400, kick: true, bassEvery: 4, arp: [0, 3, 7, 10], arpEvery: 2, noteVol: 0.038, bassVol: 0.05, kickVol: 0.07 },
    edm:      { root: 220.00, scale: [0, 3, 5, 7, 10],       bpm: 128, wave: 'sawtooth', cut: 2200, kick: true, bassEvery: 2, arp: [0, 0, 7, 5, 3, 3, 7, 10], arpEvery: 1, noteVol: 0.038, bassVol: 0.05, kickVol: 0.12 },
  };
  const MOOD_GENRE = { day: 'animepop', night: 'city', shadow: 'classic', boss: 'edm' };

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
      case 'splash': if (throttled('splash', 0.12)) { beep(420 + Math.random() * 80, 0.08, 'sine', 0.04); beep(240, 0.1, 'sine', 0.03); } break;
    }
  }

  // ===== BGM（ジャンル別シーケンサ・持続音なし）=====
  function startBGM() {
    if (!enabled) return; ensure(); if (!ctx || bgm.started) return;
    bgm.started = true;
    bgm.filter = ctx.createBiquadFilter(); bgm.filter.type = 'lowpass'; bgm.filter.frequency.value = 1800; bgm.filter.connect(bgmGain);
    bgm.step = 0; bgm.nextStep = ctx.currentTime + 0.1;
    setMood('day', true);
  }

  function setMood(mood, force) {
    if (!bgm.started || (!force && bgm.mood === mood)) return;
    bgm.mood = mood;
    bgm.genre = GENRES[MOOD_GENRE[mood] || 'animepop'];
    bgm.filter.frequency.setTargetAtTime(bgm.genre.cut, ctx.currentTime, 0.6);
  }

  function tone(freq, dur, wave, vol, when) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = wave; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(bgm.filter);
    osc.start(when); osc.stop(when + dur + 0.03);
  }
  function kickDrum(when, vol) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when); osc.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    osc.connect(g); g.connect(bgmGain);
    osc.start(when); osc.stop(when + 0.18);
  }

  // 16ステップのシーケンサ（main から毎フレーム呼ぶ）
  function tickBGM() {
    if (!enabled || !bgm.started || !ctx || !bgm.genre) return;
    const now = ctx.currentTime;
    while (bgm.nextStep <= now + 0.05) {
      const G = bgm.genre, st = bgm.step, when = bgm.nextStep;
      const stepDur = 60 / G.bpm / 2; // 8分音符
      // キック
      if (G.kick && st % 2 === 0) kickDrum(when, G.kickVol);
      // ベース
      if (st % G.bassEvery === 0) {
        const bdeg = G.scale[(st / G.bassEvery) % G.scale.length | 0];
        tone(G.root / 2 * Math.pow(2, bdeg / 12), stepDur * 1.6, 'triangle', G.bassVol, when);
      }
      // アルペジオ/メロディ
      if (st % G.arpEvery === 0) {
        const deg = G.arp[(st / G.arpEvery) % G.arp.length | 0];
        const oct = (st % 8 < 4) ? 1 : 2;
        tone(G.root * oct * Math.pow(2, deg / 12), stepDur * 0.9, G.wave, G.noteVol, when);
      }
      bgm.step = (st + 1) % 16;
      bgm.nextStep += stepDur;
    }
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
    if (bgmGain) bgmGain.gain.value = enabled ? 0.32 : 0;
    if (enabled) { ensure(); if (!bgm.started) startBGM(); }
    return enabled;
  }
  function isEnabled() { return enabled; }

  return { play, ensure, toggle, isEnabled, startBGM, tickBGM, updateMood, setMood };
})();
