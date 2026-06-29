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
    meadow:   { root: 329.63, scale: [0, 2, 4, 7, 9],         bpm: 84,  wave: 'triangle', cut: 1700, kick: false, bassEvery: 8, arp: [0, 4, 7, 9, 7, 4], arpEvery: 2, noteVol: 0.042, bassVol: 0.04, kickVol: 0 },     // 花の野=穏やかな田園(明るいペンタ)
  };
  const MOOD_GENRE = { day: 'animepop', night: 'city', shadow: 'classic', boss: 'edm', space: 'space', desert: 'desert', snow: 'snow', meadow: 'meadow' };

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { enabled = false; return; }
      master = ctx.createGain(); master.gain.value = 0.9;
      // マスターにコンプレッサを挿入し全体を引き締め・パンチを出す(気持ちよさ向上)
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 26; comp.ratio.value = 3.2; comp.attack.value = 0.004; comp.release.value = 0.2;
        master.connect(comp); comp.connect(ctx.destination);
      } catch (e) { master.connect(ctx.destination); }
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
  // 遅延付きビープ（簡易アルペジオ/ファンファーレ用・sfxGain 経由で sfxVol 尊重）
  function sbeep(freq, dur, type, vol, delay) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  // 重低音サブベース（ピッチが沈むサイン）。気持ちよい“ズン”を主要SFXに重ねる
  function subThump(hz, low, dur, vol) {
    if (!enabled) { return; } ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, low), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  // 整形ノイズ（sfxGain経由で音量設定を尊重）。decayPow を上げるほど立ち上がりが鋭い
  function noiseShape(t, dur, vol, filtType, cutoff, Q, decayPow) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    const p = decayPow || 1;
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, p);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = filtType; f.frequency.value = cutoff; if (Q) f.Q.value = Q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur + 0.02);
  }
  // FPS風の発砲音: ①鋭いクラック(高域ノイズ) ②低域パンチ(急降下サイン+火薬ノイズ) ③反響テール
  function gunShot(o) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime; const v = (o.vol != null ? o.vol : 1);
    // ① クラック（鋭い立ち上がり）
    noiseShape(t, o.crackDur || 0.045, (o.crackVol || 0.5) * v, 'highpass', o.crackHz || 2600, 0.7, 3);
    // ② ボディ（ピッチ急降下のサインで“ドスッ”）
    const ob = ctx.createOscillator(), gb = ctx.createGain();
    const bd = o.bodyDur || 0.09;
    ob.type = 'sine'; ob.frequency.setValueAtTime(o.bodyHz || 230, t); ob.frequency.exponentialRampToValueAtTime(o.bodyLow || 55, t + bd);
    gb.gain.setValueAtTime((o.bodyVol || 0.42) * v, t); gb.gain.exponentialRampToValueAtTime(0.0001, t + bd);
    ob.connect(gb); gb.connect(sfxGain); ob.start(t); ob.stop(t + bd + 0.02);
    // ②' 火薬の弾け（バンドパスノイズ）
    noiseShape(t, bd, (o.bodyVol || 0.42) * 0.7 * v, 'bandpass', o.midHz || 720, 1.2, 2);
    // ③ テール（反響）
    if (o.tailDur) noiseShape(t + 0.006, o.tailDur, (o.tailVol || 0.12) * v, 'lowpass', o.tailHz || 1400, 0, 1.5);
  }
  // 食べる/飲む音（食材ごとに質感を変える）。kind: 'crunch'|'meat'|'drink'|'soft'
  function eatSound(kind) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'drink') { // ごくごく
      for (let i = 0; i < 3; i++) { const tt = t + i * 0.11; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(300 - i * 30, tt); o.frequency.exponentialRampToValueAtTime(160, tt + 0.08); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.09, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1); o.connect(g); g.connect(sfxGain); o.start(tt); o.stop(tt + 0.12); }
    } else if (kind === 'meat') { // むしゃっ（低めの噛みつき×2）
      noiseShape(t, 0.09, 0.16, 'bandpass', 500, 1.4, 2);
      noiseShape(t + 0.13, 0.08, 0.12, 'bandpass', 420, 1.4, 2);
    } else if (kind === 'soft') { // もぐもぐ（やわらかい）
      noiseShape(t, 0.07, 0.1, 'lowpass', 900, 0, 1.6);
      noiseShape(t + 0.12, 0.06, 0.08, 'lowpass', 800, 0, 1.6);
    } else { // crunch: しゃりしゃり（高域の歯切れよい連続噛み）
      for (let i = 0; i < 3; i++) noiseShape(t + i * 0.085, 0.045, 0.15 - i * 0.02, 'highpass', 3200 + Math.random() * 800, 0.8, 2.5);
    }
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
      case 'break':  beep(120, 0.12, 'sawtooth', 0.1); beep(90, 0.16, 'triangle', 0.08); subThump(150, 50, 0.16, 0.12); break;
      case 'place':  beep(320, 0.08, 'square', 0.08); subThump(140, 60, 0.1, 0.1); break;
      case 'pickup': beep(660, 0.06, 'sine', 0.07); beep(880, 0.06, 'sine', 0.05); break;
      case 'craft':  beep(520, 0.08, 'triangle', 0.1); beep(700, 0.1, 'triangle', 0.09); subThump(180, 70, 0.14, 0.09); break;
      case 'eat':    beep(280, 0.1, 'sine', 0.09); break;
      case 'hurt':   beep(150, 0.18, 'sawtooth', 0.12); break;
      case 'select': beep(440, 0.04, 'square', 0.05); break;
      case 'cursor': if (throttled('cursor', 0.03)) { beep(660, 0.022, 'triangle', 0.035); } break;
      case 'tab':    if (throttled('tab', 0.04)) { beep(520, 0.03, 'sine', 0.045); beep(720, 0.03, 'sine', 0.03); } break;
      case 'swing':  if (throttled('swing', 0.1)) beep(300, 0.05, 'triangle', 0.06); break;
      case 'hit':    beep(220, 0.07, 'square', 0.09); beep(160, 0.09, 'sawtooth', 0.06); subThump(120, 55, 0.1, 0.1); break;
      case 'mobdie': beep(200, 0.12, 'sawtooth', 0.1); beep(120, 0.16, 'triangle', 0.08); subThump(140, 45, 0.18, 0.12); break;
      case 'equip':  beep(400, 0.06, 'square', 0.07); beep(560, 0.06, 'square', 0.06); break;
      case 'levelup': beep(523, 0.1, 'triangle', 0.1); beep(659, 0.1, 'triangle', 0.1); beep(784, 0.14, 'triangle', 0.1); subThump(220, 80, 0.25, 0.1); break;
      case 'shift':  beep(440, 0.25, 'sine', 0.12); beep(220, 0.35, 'sine', 0.1); beep(110, 0.45, 'triangle', 0.08); break;
      case 'event_meteor': sbeep(1200, 0.12, 'sine', 0.06, 0); sbeep(900, 0.14, 'sine', 0.06, 0.1); sbeep(1568, 0.1, 'triangle', 0.05, 0.2); sbeep(660, 0.32, 'sine', 0.05, 0.3); break;
      case 'event_supply': sbeep(392, 0.14, 'triangle', 0.08, 0); sbeep(523, 0.14, 'triangle', 0.08, 0.12); sbeep(659, 0.22, 'triangle', 0.09, 0.24); break;
      case 'event_horde': sbeep(110, 0.35, 'sawtooth', 0.12, 0); sbeep(98, 0.4, 'sawtooth', 0.12, 0.18); sbeep(82, 0.5, 'triangle', 0.1, 0.4); if (ctx) noiseBurst(ctx.currentTime, 0.5, 0.1, 400); break;
      case 'enchant': beep(620, 0.1, 'sine', 0.09); beep(820, 0.12, 'sine', 0.08); beep(1040, 0.16, 'triangle', 0.07); break;
      case 'dash':   if (throttled('dash', 0.25)) beep(520, 0.07, 'sine', 0.05); break;
      case 'gun':    if (throttled('gun', 0.05)) gunShot({ crackHz: 2500, crackVol: 0.45, crackDur: 0.04, bodyHz: 240, bodyLow: 60, bodyVol: 0.42, bodyDur: 0.08, midHz: 760, tailDur: 0.07, tailVol: 0.1, tailHz: 1500 }); break;
      case 'gun_pistol': if (throttled('gp', 0.04)) gunShot({ crackHz: 2400, crackVol: 0.46, crackDur: 0.04, bodyHz: 250, bodyLow: 62, bodyVol: 0.44, bodyDur: 0.08, midHz: 780, tailDur: 0.07, tailVol: 0.1, tailHz: 1500 }); break;
      case 'gun_smg':    if (throttled('gs', 0.02)) gunShot({ crackHz: 3000, crackVol: 0.34, crackDur: 0.022, bodyHz: 290, bodyLow: 80, bodyVol: 0.3, bodyDur: 0.04, midHz: 920, tailDur: 0.025, tailVol: 0.06, tailHz: 1700, vol: 0.9 }); break;
      case 'gun_rifle':  if (throttled('gr', 0.04)) gunShot({ crackHz: 2800, crackVol: 0.52, crackDur: 0.045, bodyHz: 205, bodyLow: 50, bodyVol: 0.5, bodyDur: 0.1, midHz: 660, tailDur: 0.12, tailVol: 0.14, tailHz: 1300 }); break;
      case 'gun_shotgun': if (throttled('gsh', 0.1)) gunShot({ crackHz: 1700, crackVol: 0.5, crackDur: 0.06, bodyHz: 150, bodyLow: 40, bodyVol: 0.62, bodyDur: 0.16, midHz: 440, tailDur: 0.2, tailVol: 0.2, tailHz: 900, vol: 1.05 }); break;
      case 'gun_sniper': if (throttled('gsn', 0.1)) gunShot({ crackHz: 3200, crackVol: 0.6, crackDur: 0.05, bodyHz: 185, bodyLow: 44, bodyVol: 0.56, bodyDur: 0.14, midHz: 600, tailDur: 0.32, tailVol: 0.17, tailHz: 1100, vol: 1.12 }); break;
      case 'gun_rocket': if (throttled('gro', 0.1)) gunShot({ crackHz: 900, crackVol: 0.3, crackDur: 0.1, bodyHz: 135, bodyLow: 36, bodyVol: 0.56, bodyDur: 0.26, midHz: 320, tailDur: 0.3, tailVol: 0.2, tailHz: 700, vol: 1.05 }); break;
      case 'boom_sfx':   beep(110, 0.3, 'sawtooth', 0.16); beep(60, 0.4, 'triangle', 0.13); if (ctx) noiseBurst(ctx.currentTime, 0.4, 0.22, 600); break;
      case 'slash_air':  if (throttled('sla', 0.06)) { beep(680, 0.06, 'sine', 0.06); beep(1200, 0.05, 'triangle', 0.05); } break;
      case 'beam':       if (throttled('bm', 0.05)) { beep(1400, 0.06, 'sine', 0.07); beep(700, 0.1, 'sawtooth', 0.05); } break;
      case 'thunder':    if (throttled('th', 0.08)) { beep(300, 0.05, 'square', 0.09); if (ctx) noiseBurst(ctx.currentTime, 0.12, 0.12, 3000, true); beep(120, 0.14, 'sawtooth', 0.08); } break;
      case 'whirl':      if (throttled('wh', 0.1)) { beep(420, 0.16, 'triangle', 0.06); beep(620, 0.12, 'sine', 0.04); } break;
      case 'engine': if (throttled('engine', 0.3)) beep(110, 0.2, 'sawtooth', 0.05); break;
      case 'splash': if (throttled('splash', 0.12)) { beep(420 + Math.random() * 80, 0.08, 'sine', 0.04); beep(240, 0.1, 'sine', 0.03); } break;
      // 会心ヒット: 鋭い高音(影世界は僅かに低め)
      case 'crit': if (throttled('crit', 0.05)) { const sh = (Game.state && Game.state.worldName === 'shadow') ? 0.92 : 1; beep(1500 * sh, 0.05, 'square', 0.09); beep(2100 * sh, 0.045, 'triangle', 0.06); } break;
      // 精鋭撃破: 重厚な破砕
      case 'elite_die': beep(190, 0.16, 'sawtooth', 0.12); beep(110, 0.22, 'triangle', 0.1); if (ctx) noiseBurst(ctx.currentTime, 0.18, 0.12, 1400); break;
      // チャンピオン撃破: 荘厳な下降＋余韻
      case 'champion_die': sbeep(523, 0.12, 'triangle', 0.1, 0); sbeep(392, 0.14, 'triangle', 0.1, 0.07); sbeep(261, 0.2, 'triangle', 0.09, 0.15); if (ctx) noiseBurst(ctx.currentTime, 0.3, 0.14, 700); break;
      // 賞金達成: ファンファーレ風 上昇アルペジオ
      case 'bounty_done': sbeep(523, 0.1, 'triangle', 0.09, 0); sbeep(659, 0.1, 'triangle', 0.09, 0.09); sbeep(784, 0.12, 'triangle', 0.09, 0.18); sbeep(1046, 0.2, 'triangle', 0.1, 0.27); break;
      // 遺物入手: きらめき
      case 'relic_get': sbeep(880, 0.09, 'sine', 0.07, 0); sbeep(1175, 0.09, 'sine', 0.06, 0.06); sbeep(1568, 0.14, 'triangle', 0.06, 0.12); break;
      // 低HP警告: 鈍い鼓動(長めスロットル)
      case 'lowhp': if (throttled('lowhp', 1.1)) { beep(82, 0.12, 'sine', 0.11); sbeep(62, 0.16, 'sine', 0.09, 0.16); } break;
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
  function bgmHat(when) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 0.03));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.028, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    src.connect(f); f.connect(g); g.connect(bgmGain); src.start(when); src.stop(when + 0.06);
  }
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
      // パッド和音(半小節ごと): 温かみのある持続和音で厚みを出す
      if (st === 0 || st === 8) {
        const chord = [G.scale[0] || 0, G.scale[2] != null ? G.scale[2] : 4, G.scale[4] != null ? G.scale[4] : 7];
        chord.forEach(function (semi) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = G.root * Math.pow(2, semi / 12);
          g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.016, when + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, when + stepDur * 8);
          o.connect(g); g.connect(bgm.filter); o.start(when); o.stop(when + stepDur * 8 + 0.05);
        });
      }
      // ハイハット(キックのあるジャンルの裏拍)で躍動感
      if (G.kick && st % 2 === 1) bgmHat(when);
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
      else if (g === Game.TILE.BLOOM && !Game.DayNight.isNight()) mood = 'meadow';
      else if (Game.DayNight.isNight()) mood = 'night';
      else mood = 'day';
    }
    setMood(mood);
  }

  // ===== シネマティック演出音（OP/発射/発見ムービー用・オーケストラ風）=====
  const cine = { on: false, nodes: [], master: null };
  // ムード別のシネマ和音（根音Hz配列＋高弦の音）。場面に合うBGMを選ぶ
  const CINE_MOODS = {
    dramatic: { chord: [65.41, 77.78, 98.00, 130.81], hi: 523.25 },   // Cマイナー: 緊張・ドラマ
    somber:   { chord: [55.00, 65.41, 82.41, 110.00], hi: 440.00 },   // Aマイナー: 物語・哀愁
    heroic:   { chord: [65.41, 82.41, 98.00, 130.81], hi: 659.25 },   // Cメジャー: 勝利・高揚
    mystic:   { chord: [61.74, 92.50, 110.00, 146.83], hi: 587.33 },  // 浮遊する神秘(sus)
    tense:    { chord: [61.74, 73.42, 87.31, 123.47], hi: 493.88 },   // 減和音: 不穏・ボス登場
  };
  function cineStart(mood) {
    if (!enabled) return; ensure(); if (!ctx) return;
    cineStop();
    cine.on = true;
    const t = ctx.currentTime;
    const M = CINE_MOODS[mood] || CINE_MOODS.dramatic;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 2.6);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.setValueAtTime(500, t); filt.frequency.linearRampToValueAtTime(1900, t + 16);
    g.connect(master); filt.connect(g);
    cine.master = g; cine.nodes = [];
    // 低い持続コード（ムードで調を変える）
    M.chord.forEach(function (f, i) {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (i % 2 ? 6 : -6);
      const og = ctx.createGain(); og.gain.value = 0.22 / (i + 1);
      o.connect(og); og.connect(filt); o.start(t); cine.nodes.push(o, og);
    });
    // うねる高弦
    const hi = ctx.createOscillator(); hi.type = 'sine'; hi.frequency.value = M.hi;
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

  // ===== 環境音(昼=鳥/風, 夜=虫, 雨=ざわめき)。没入感を高める =====
  function birdChirp() {
    if (!ctx) return; const t = ctx.currentTime; const base = 2200 + Math.random() * 900;
    for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) { const tt = t + i * 0.09; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(base * (1 + i * 0.08), tt); o.frequency.exponentialRampToValueAtTime(base * 0.8, tt + 0.07); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09); o.connect(g); g.connect(master); o.start(tt); o.stop(tt + 0.11); }
  }
  function cricket() {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) { const tt = t + i * 0.06; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 4600; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.022, tt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03); o.connect(g); g.connect(master); o.start(tt); o.stop(tt + 0.04); }
  }
  function windGust() {
    if (!ctx) return; const t = ctx.currentTime, dur = 1.4 + Math.random();
    const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  function ambientTick() {
    if (!enabled || !ctx) return;
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    if (!Game.state || Game.state.paused || Game.state.worldName === 'space') return;
    const night = Game.DayNight && Game.DayNight.isNight && Game.DayNight.isNight();
    const wet = Game.state.weather && (Game.state.weather.type === 'rain' || Game.state.weather.type === 'snow');
    const r = Math.random();
    if (Game.state.worldName === 'shadow') { if (r < 0.25) windGust(); return; } // 影=不穏な風のみ
    if (night) { if (r < 0.5) cricket(); else if (r < 0.62) windGust(); }
    else { if (r < 0.32) birdChirp(); else if (r < 0.5) windGust(); }
    if (wet && Math.random() < 0.4) windGust();
  }
  // 地形連動の控えめな足音(繰り返し前提なので非常に小音量)。foot: 0/1で左右の微差
  function footstep(kind, foot) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime, p = foot ? 1.06 : 0.94;
    if (kind === 'stone') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(190 * p, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.07); }
    else if (kind === 'soft') { const len = Math.floor(ctx.sampleRate * 0.05); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const src = ctx.createBufferSource(); src.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 * p; const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + 0.06); }
    else { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(135 * p, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.08); }
  }
  function eat(kind) { eatSound(kind); }
  return { play, eat, footstep, ambientTick, ensure, toggle, isEnabled, startBGM, tickBGM, updateMood, setMood, cineStart, cineStop, cue, setVolumes };
})();
