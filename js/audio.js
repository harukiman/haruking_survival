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
    // エリア別（協和・低音量・耳に優しく）
    space:    { root: 246.94, scale: [0, 2, 4, 6, 7, 9, 11],  bpm: 60,  wave: 'sine', cut: 1300, kick: false, bassEvery: 8, arp: [0, 4, 7, 11, 9, 7], arpEvery: 2, noteVol: 0.042, bassVol: 0.04, kickVol: 0 },     // 宇宙=幻想的(リディアン)
    desert:   { root: 277.18, scale: [0, 1, 4, 5, 7, 8, 11],  bpm: 100, wave: 'triangle', cut: 1900, kick: true, bassEvery: 4, arp: [0, 4, 5, 8, 7, 4], arpEvery: 2, noteVol: 0.04, bassVol: 0.045, kickVol: 0.06 }, // 砂漠=エキゾチック(ダブルハーモニック)
    snow:     { root: 261.63, scale: [0, 2, 4, 7, 9],         bpm: 66,  wave: 'sine', cut: 1200, kick: false, bassEvery: 8, arp: [0, 7, 9, 4, 7, 2], arpEvery: 2, noteVol: 0.04, bassVol: 0.038, kickVol: 0 },        // 雪原=静謐(ペンタ)
  };
  const MOOD_GENRE = { day: 'animepop', night: 'city', shadow: 'classic', boss: 'edm', space: 'space', desert: 'desert', snow: 'snow' };

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
      case 'gun_pistol': if (throttled('gp', 0.04)) { beep(820, 0.04, 'square', 0.09); beep(260, 0.07, 'sawtooth', 0.07); } break;
      case 'gun_smg':    if (throttled('gs', 0.02)) { beep(1050, 0.025, 'square', 0.06); beep(360, 0.05, 'sawtooth', 0.05); } break;
      case 'gun_rifle':  if (throttled('gr', 0.04)) { beep(680, 0.05, 'square', 0.1); beep(220, 0.1, 'sawtooth', 0.08); } break;
      case 'gun_shotgun': if (throttled('gsh', 0.1)) { beep(180, 0.14, 'sawtooth', 0.13); beep(90, 0.18, 'triangle', 0.1); if (ctx) noiseBurst(ctx.currentTime, 0.12, 0.18, 1800); } break;
      case 'gun_sniper': if (throttled('gsn', 0.1)) { beep(1300, 0.05, 'square', 0.12); beep(140, 0.22, 'sawtooth', 0.12); } break;
      case 'gun_rocket': if (throttled('gro', 0.1)) { beep(140, 0.18, 'sawtooth', 0.12); beep(70, 0.26, 'triangle', 0.1); } break;
      case 'boom_sfx':   beep(110, 0.3, 'sawtooth', 0.16); beep(60, 0.4, 'triangle', 0.13); if (ctx) noiseBurst(ctx.currentTime, 0.4, 0.22, 600); break;
      case 'slash_air':  if (throttled('sla', 0.06)) { beep(680, 0.06, 'sine', 0.06); beep(1200, 0.05, 'triangle', 0.05); } break;
      case 'beam':       if (throttled('bm', 0.05)) { beep(1400, 0.06, 'sine', 0.07); beep(700, 0.1, 'sawtooth', 0.05); } break;
      case 'thunder':    if (throttled('th', 0.08)) { beep(300, 0.05, 'square', 0.09); if (ctx) noiseBurst(ctx.currentTime, 0.12, 0.12, 3000, true); beep(120, 0.14, 'sawtooth', 0.08); } break;
      case 'whirl':      if (throttled('wh', 0.1)) { beep(420, 0.16, 'triangle', 0.06); beep(620, 0.12, 'sine', 0.04); } break;
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
    else if (Game.state.worldName === 'space') mood = 'space';
    else if (Game.state.worldName === 'shadow') mood = 'shadow';
    else {
      // 光世界: バイオームで雪原/砂漠を優先、それ以外は昼夜
      const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
      const g = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
      if (g === Game.TILE.SNOW) mood = 'snow';
      else if (g === Game.TILE.SAND && !Game.DayNight.isNight()) mood = 'desert';
      else if (Game.DayNight.isNight()) mood = 'night';
      else mood = 'day';
    }
    setMood(mood);
  }

  // ===== シネマティック演出音（OP/発射/発見ムービー用・オーケストラ風）=====
  const cine = { on: false, nodes: [], master: null };
  function cineStart() {
    if (!enabled) return; ensure(); if (!ctx) return;
    cineStop();
    cine.on = true;
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 2.6);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.setValueAtTime(500, t); filt.frequency.linearRampToValueAtTime(1900, t + 16);
    g.connect(master); filt.connect(g);
    cine.master = g; cine.nodes = [];
    // 低い持続コード（Cマイナー: ドラマ性）
    const chord = [65.41, 77.78, 98.00, 130.81];
    chord.forEach(function (f, i) {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (i % 2 ? 6 : -6);
      const og = ctx.createGain(); og.gain.value = 0.22 / (i + 1);
      o.connect(og); og.connect(filt); o.start(t); cine.nodes.push(o, og);
    });
    // うねる高弦
    const hi = ctx.createOscillator(); hi.type = 'sine'; hi.frequency.value = 523.25;
    const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t); hg.gain.linearRampToValueAtTime(0.05, t + 8);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15; const lg = ctx.createGain(); lg.gain.value = 8;
    lfo.connect(lg); lg.connect(hi.frequency); hi.connect(hg); hg.connect(filt); hi.start(t); lfo.start(t);
    cine.nodes.push(hi, hg, lfo, lg);
  }
  function cineStop() {
    if (!ctx) { cine.on = false; return; }
    cine.on = false; const t = ctx.currentTime;
    if (cine.master) { try { cine.master.gain.cancelScheduledValues(t); cine.master.gain.setValueAtTime(cine.master.gain.value, t); cine.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); } catch (e) {} }
    cine.nodes.forEach(function (n) { try { if (n.stop) n.stop(t + 1.0); } catch (e) {} });
    cine.nodes = []; cine.master = null;
  }
  function noiseBurst(t, dur, vol, cutoff, highpass) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = highpass ? 'highpass' : 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  function cue(name) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    if (name === 'boom' || name === 'impact') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(name === 'impact' ? 0.5 : 0.34, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.75);
      noiseBurst(t, 0.45, name === 'impact' ? 0.24 : 0.14, 420);
    } else if (name === 'riser') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + 2.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 2.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 2.5);
      noiseBurst(t, 2.2, 0.09, 3000, true);
    } else if (name === 'swell' || name === 'choir') {
      const chord = name === 'choir' ? [261.63, 329.63, 392.00, 523.25] : [196, 261.63, 329.63, 392];
      chord.forEach(function (fr, i) {
        const o = ctx.createOscillator(); o.type = name === 'choir' ? 'sine' : 'sawtooth'; o.frequency.value = fr; o.detune.value = (i % 2 ? 5 : -5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
        o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 2.5);
      });
    } else if (name === 'shimmer') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (fr, i) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        const g = ctx.createGain(); const st = t + i * 0.08; g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.085, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
        o.connect(g); g.connect(master); o.start(st); o.stop(st + 0.55);
      });
    } else if (name === 'crack') {
      noiseBurst(t, 0.5, 0.28, 2500);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5);
    }
  }

  let bgmVol = 0.6, sfxVol = 0.9;
  function setVolumes(bgm, sfx) {
    bgmVol = bgm; sfxVol = sfx; ensure();
    if (bgmGain) bgmGain.gain.value = enabled ? bgmVol * 0.5 : 0;
    if (sfxGain) sfxGain.gain.value = sfxVol;
  }
  function toggle() {
    enabled = !enabled;
    if (bgmGain) bgmGain.gain.value = enabled ? bgmVol * 0.5 : 0;
    if (!enabled) cineStop();
    if (enabled) { ensure(); if (!bgm.started) startBGM(); }
    return enabled;
  }
  function isEnabled() { return enabled; }

  return { play, ensure, toggle, isEnabled, startBGM, tickBGM, updateMood, setMood, cineStart, cineStop, cue, setVolumes };
})();
