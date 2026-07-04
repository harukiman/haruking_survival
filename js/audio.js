// audio.js — Web Audio による手続きSFX＋状況連動BGM（アセット不要）
// 洗練版: 2バスクロスフェードBGM / コード進行+シード変奏 / デチューン・スタック / センドディレイ /
//         天候アンビエンスループ / ボスランク連動強度 / 共有ノイズバッファ+同時発音キャップ(モバイル最適化)
window.Game = window.Game || {};

Game.Audio = (function () {
  let ctx = null;
  let master = null, sfxGain = null, bgmGain = null;
  let enabled = true;
  let lastPlay = {};

  // ---- モバイル向けリソース管理 ----
  let noiseBuf = null;             // 共有ホワイトノイズ(2秒) — 毎回のバッファ生成を排除
  let voices = 0;                  // 同時発音数
  const MAX_VOICES = 36;           // キャップ(超過時は装飾音をスキップ)
  function voiceOk() { return voices < MAX_VOICES; }
  function unreg() { voices = Math.max(0, voices - 1); }
  function reg(node) { voices++; node.onended = unreg; }

  // ---- センドエフェクト(フィードバックディレイ) — 空間と奥行き ----
  let sendIn = null;               // ここに繋ぐと残響がかかる

  // BGM 状態(2バスをクロスフェード・16ステップ×4小節のシーケンサ)
  const bgm = {
    started: false, mood: null, genre: null, step: 0, bar: 0, nextStep: 0,
    buses: null, bus: 0,           // buses[i] = { f: lowpass, g: xfadeゲイン }
    intensity: 0,                  // ボス強度 0..1 (tier/4)
    varSeed: 1,                    // 小節ごとのシード変奏用LCG
    duck: 1,                       // カットシーン中ダック係数
  };

  // ジャンル別プリセット。prog=小節ごとのルート移調(半音) — 4小節進行で反復感を薄める
  const GENRES = {
    classic:  { root: 261.63, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 76,  wave: 'sine', cut: 1600, kick: false, bassEvery: 8, arp: [0, 4, 7, 11, 7, 4], arpEvery: 2, noteVol: 0.05, bassVol: 0.045, kickVol: 0,    prog: [0, -3, 5, 7] },
    animepop: { root: 293.66, scale: [0, 2, 4, 7, 9],        bpm: 120, wave: 'triangle', cut: 2600, kick: true, bassEvery: 4, arp: [0, 4, 7, 9, 7, 4], arpEvery: 1, noteVol: 0.045, bassVol: 0.04, kickVol: 0.10, prog: [0, -3, 5, 7] },
    city:     { root: 261.63, scale: [0, 3, 5, 7, 10],       bpm: 88,  wave: 'sine', cut: 1300, kick: true, bassEvery: 4, arp: [0, 3, 7, 10], arpEvery: 2, noteVol: 0.038, bassVol: 0.05, kickVol: 0.07,  prog: [0, 8, 3, 10] },
    edm:      { root: 220.00, scale: [0, 3, 5, 7, 10],       bpm: 128, wave: 'sawtooth', cut: 2200, kick: true, bassEvery: 2, arp: [0, 0, 7, 5, 3, 3, 7, 10], arpEvery: 1, noteVol: 0.038, bassVol: 0.05, kickVol: 0.12, prog: [0, 8, 3, 10] },
    // エリア別（協和・低音量・耳に優しく）
    space:    { root: 246.94, scale: [0, 2, 4, 6, 7, 9, 11],  bpm: 60,  wave: 'sine', cut: 1300, kick: false, bassEvery: 8, arp: [0, 4, 7, 11, 9, 7], arpEvery: 2, noteVol: 0.042, bassVol: 0.04, kickVol: 0,   prog: [0, 2, -5, 7] },   // 宇宙=幻想的(リディアン)
    desert:   { root: 277.18, scale: [0, 1, 4, 5, 7, 8, 11],  bpm: 100, wave: 'triangle', cut: 1900, kick: true, bassEvery: 4, arp: [0, 4, 5, 8, 7, 4], arpEvery: 2, noteVol: 0.04, bassVol: 0.045, kickVol: 0.06, prog: [0, 1, 0, -4] }, // 砂漠=エキゾチック(ダブルハーモニック)
    snow:     { root: 261.63, scale: [0, 2, 4, 7, 9],         bpm: 66,  wave: 'sine', cut: 1200, kick: false, bassEvery: 8, arp: [0, 7, 9, 4, 7, 2], arpEvery: 2, noteVol: 0.04, bassVol: 0.038, kickVol: 0,     prog: [0, -3, 5, 0] },   // 雪原=静謐(ペンタ)
    meadow:   { root: 329.63, scale: [0, 2, 4, 7, 9],         bpm: 84,  wave: 'triangle', cut: 1700, kick: false, bassEvery: 8, arp: [0, 4, 7, 9, 7, 4], arpEvery: 2, noteVol: 0.042, bassVol: 0.04, kickVol: 0, prog: [0, -3, 5, 7] },   // 花の野=穏やかな田園(明るいペンタ)
    // メインテーマ(タイトル)=壮大で郷愁を誘う冒険の主題。光と影の二相を宿す(希望のリディアン+短調の陰り)。ベル主旋律+深いドローン+聖歌スウェル+遠い鼓動
    title:    { root: 293.66, scale: [0, 2, 4, 6, 7, 9, 11],  bpm: 72,  wave: 'sine', cut: 2200, kick: false, bassEvery: 8, arp: [0, 4, 7, 11, 9, 7, 4, 2], arpEvery: 2, noteVol: 0.05, bassVol: 0.036, kickVol: 0, prog: [0, 5, -3, 7], bell: true, send: 2.4, drone: 0.05, swell: 0.05, heartbeat: 0.05, padDetune: 10, padVol: 0.024 },
    // 新エリア3種(空島/古代都市/狭間) — 拡張フィールド(bell/pluck/drone/heartbeat/pulse/sub/hatRandom/swell/send/padDetune/padVol)は
    // tickBGM 側で存在チェックして使う。未指定ジャンルは従来と完全に同じ挙動
    sky:      { root: 349.23, scale: [0, 2, 4, 6, 7, 9, 11],  bpm: 76,  wave: 'sine', cut: 2400, kick: false, bassEvery: 16, arp: [0, 4, 6, 11, 9, 7], arpEvery: 4, noteVol: 0.045, bassVol: 0.028, kickVol: 0, prog: [0, 2, 7, 4],  bell: true, send: 2.2, pulse: 0.035, padDetune: 11, padVol: 0.021 }, // 空島=澄んだ浮遊感(リディアン・ベルリード・キックレス柔パルス・残響たっぷり)
    ruins:    { root: 220.00, scale: [0, 2, 3, 5, 7, 9, 10],  bpm: 66,  wave: 'triangle', cut: 1400, kick: false, bassEvery: 8, arp: [0, 3, 7, 10, 9, 7], arpEvery: 4, noteVol: 0.048, bassVol: 0.04, kickVol: 0, prog: [0, -2, 3, -2], pluck: true, drone: 0.045, heartbeat: 0.075 },                    // 古代都市=荘厳と郷愁(ドリアン・深いドローン+爪弾き・遠い鼓動)
    rift:     { root: 233.08, scale: [0, 1, 3, 6, 7, 10],     bpm: 70,  wave: 'sine', cut: 1100, kick: false, bassEvery: 8, arp: [0, 7, 6, 10, 7, 1], arpEvery: 4, noteVol: 0.036, bassVol: 0.03, kickVol: 0, prog: [0, 1, 0, -6],  sub: 0.06, hatRandom: true, swell: 0.05 },                          // 狭間=不穏(b2/三全音の色彩・サブパルス・不規則ハット・ノイズスウェル)
    // ボス専用クラシック系(強さ5段階)。弦(sawtooth)+ドローン+聖歌スウェルで荘厳。上位ほど速く/濃く/劇的に
    boss1:    { root: 196.00, scale: [0, 2, 3, 5, 7, 8, 10],  bpm: 94,  wave: 'sawtooth', cut: 1500, kick: true,  bassEvery: 4, arp: [0, 3, 7, 3, 0, 7, 3, 10], arpEvery: 2, noteVol: 0.044, bassVol: 0.05, kickVol: 0.07, prog: [0, -2, 5, 3],  drone: 0.05, padDetune: 8, padVol: 0.02 },      // C級=荘厳だが抑制(自然短調・弦+ドローン)
    boss2:    { root: 174.61, scale: [0, 2, 3, 5, 7, 8, 10],  bpm: 106, wave: 'sawtooth', cut: 1700, kick: true,  bassEvery: 2, arp: [0, 3, 7, 10, 7, 3, 5, 3], arpEvery: 1, noteVol: 0.042, bassVol: 0.055, kickVol: 0.09, prog: [0, 3, -2, 5], drone: 0.05, padDetune: 9, padVol: 0.022 },     // B級=駆り立てる弦
    boss3:    { root: 164.81, scale: [0, 2, 3, 5, 7, 8, 11],  bpm: 114, wave: 'sawtooth', cut: 1900, kick: true,  bassEvery: 2, arp: [0, 3, 7, 8, 11, 8, 7, 3], arpEvery: 1, noteVol: 0.04,  bassVol: 0.058, kickVol: 0.10, prog: [0, 5, 3, 7],  drone: 0.06, swell: 0.05, padDetune: 10, padVol: 0.024 },  // A級=壮麗(和声短調・聖歌スウェル)
    boss4:    { root: 155.56, scale: [0, 2, 3, 5, 7, 8, 11],  bpm: 122, wave: 'sawtooth', cut: 2100, kick: true,  bassEvery: 2, arp: [0, 7, 3, 8, 11, 7, 10, 11], arpEvery: 1, noteVol: 0.04, bassVol: 0.06, kickVol: 0.12, prog: [0, 3, 7, -2], drone: 0.06, swell: 0.06, padDetune: 11, padVol: 0.026 },   // S級=英雄的で激烈
    boss5:    { root: 146.83, scale: [0, 1, 3, 5, 7, 8, 11],  bpm: 134, wave: 'sawtooth', cut: 2300, kick: true,  bassEvery: 1, arp: [0, 3, 7, 11, 8, 7, 3, 1], arpEvery: 1, noteVol: 0.04, bassVol: 0.066, kickVol: 0.13, prog: [0, -1, 5, 7], drone: 0.07, swell: 0.07, heartbeat: 0.06, padDetune: 12, padVol: 0.028 }, // ラスボス=最高潮(b2の緊張・聖歌・鼓動・ダブルベース)
    // 影の世界=光と別ゲーの音。ロクリアン的な不協・深いドローン+サブ・不規則ハットで常に不穏
    shadowrealm: { root: 155.56, scale: [0, 1, 3, 5, 6, 8, 10], bpm: 68, wave: 'triangle', cut: 1150, kick: false, bassEvery: 8, arp: [0, 3, 6, 8, 6, 3], arpEvery: 4, noteVol: 0.04, bassVol: 0.046, kickVol: 0, prog: [0, -4, 1, -2], drone: 0.065, sub: 0.05, hatRandom: true, swell: 0.045 },
  };
  const MOOD_GENRE = { title: 'title', day: 'animepop', night: 'city', shadow: 'shadowrealm', cave: 'classic', boss: 'edm', space: 'space', desert: 'desert', snow: 'snow', meadow: 'meadow', sky: 'sky', ruins: 'ruins', rift: 'rift',
    boss1: 'boss1', boss2: 'boss2', boss3: 'boss3', boss4: 'boss4', boss5: 'boss5', shadowrealm: 'shadowrealm' };

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } // 行動→音の遅延を最小化
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
      // 共有ノイズバッファ(2秒) — 以後の全ノイズ音はこれを切り出して再利用
      try {
        const len = Math.floor(ctx.sampleRate * 2);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { noiseBuf = null; }
      // センドディレイ(1系統だけ常設・軽量): in → delay → lowpass → (wet→master, feedback→delay)
      try {
        sendIn = ctx.createGain(); sendIn.gain.value = 0.22;
        const dly = ctx.createDelay(0.7); dly.delayTime.value = 0.27;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
        const fb = ctx.createGain(); fb.gain.value = 0.34;
        const wet = ctx.createGain(); wet.gain.value = 0.5;
        sendIn.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(wet); wet.connect(master);
      } catch (e) { sendIn = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // BGM実効音量を一元適用(音量設定×ダック×ON/OFF)
  function applyBgmGain(tc) {
    if (!bgmGain || !ctx) return;
    const v = enabled ? bgmVol * 0.5 * bgm.duck : 0;
    try { bgmGain.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, tc || 0.3); }
    catch (e) { bgmGain.gain.value = v; }
  }

  // ===== SFX =====
  function beep(freq, dur, type, vol) {
    if (!enabled) return; ensure(); if (!ctx || !voiceOk()) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.003); // 鋭いアタック(パンチのある立ち上がり)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    reg(osc); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  // 遅延付きビープ（簡易アルペジオ/ファンファーレ用・sfxGain 経由で sfxVol 尊重）
  function sbeep(freq, dur, type, vol, delay) {
    if (!enabled) return; ensure(); if (!ctx || !voiceOk()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    reg(osc); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  // 重低音サブベース（ピッチが沈むサイン）。気持ちよい“ズン”を主要SFXに重ねる
  function subThump(hz, low, dur, vol) {
    if (!enabled) { return; } ensure(); if (!ctx || !voiceOk()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, low), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain); reg(o); o.start(t); o.stop(t + dur + 0.02);
  }
  // 共有バッファからノイズ片を再生(バッファ新規生成なし)。dest省略時は sfxGain
  function noisePiece(t, dur, vol, filtType, cutoff, Q, sharp, dest) {
    if (!ctx || !noiseBuf || !voiceOk() || vol <= 0) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const off = Math.random() * Math.max(0.01, noiseBuf.duration - dur - 0.05);
    const f = ctx.createBiquadFilter(); f.type = filtType || 'lowpass'; f.frequency.value = cutoff || 1200; if (Q) f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    if (sharp) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.3), t + dur * 0.3); // 鋭い立ち下がり
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    reg(src); src.start(t, off, dur + 0.03); src.stop(t + dur + 0.03);
  }
  // 旧API互換: 整形ノイズ(sfxGain経由)。decayPow>=2 は鋭い立ち上がり扱い
  function noiseShape(t, dur, vol, filtType, cutoff, Q, decayPow) {
    noisePiece(t, dur, vol, filtType, cutoff, Q, (decayPow || 1) >= 2, sfxGain);
  }
  // FPS風の発砲音: ①鋭いクラック(高域ノイズ) ②低域パンチ(急降下サイン+火薬ノイズ) ③反響テール
  function gunShot(o) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime; const v = (o.vol != null ? o.vol : 1);
    // ① クラック（鋭い立ち上がり）
    noiseShape(t, o.crackDur || 0.045, (o.crackVol || 0.5) * v, 'highpass', o.crackHz || 2600, 0.7, 3);
    // ② ボディ（ピッチ急降下のサインで“ドスッ”）
    if (voiceOk()) {
      const ob = ctx.createOscillator(), gb = ctx.createGain();
      const bd = o.bodyDur || 0.09;
      ob.type = 'sine'; ob.frequency.setValueAtTime(o.bodyHz || 230, t); ob.frequency.exponentialRampToValueAtTime(o.bodyLow || 55, t + bd);
      gb.gain.setValueAtTime((o.bodyVol || 0.42) * v, t); gb.gain.exponentialRampToValueAtTime(0.0001, t + bd);
      ob.connect(gb); gb.connect(sfxGain); reg(ob); ob.start(t); ob.stop(t + bd + 0.02);
    }
    // ②' 火薬の弾け（バンドパスノイズ）
    noiseShape(t, o.bodyDur || 0.09, (o.bodyVol || 0.42) * 0.7 * v, 'bandpass', o.midHz || 720, 1.2, 2);
    // ③ テール（反響）
    if (o.tailDur) noiseShape(t + 0.006, o.tailDur, (o.tailVol || 0.12) * v, 'lowpass', o.tailHz || 1400, 0, 1.5);
  }
  // 食べる/飲む音（食材ごとに質感を変える）。kind: 'crunch'|'meat'|'drink'|'soft'
  function eatSound(kind) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'drink') { // ごくごく
      for (let i = 0; i < 3; i++) { if (!voiceOk()) break; const tt = t + i * 0.11; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(300 - i * 30, tt); o.frequency.exponentialRampToValueAtTime(160, tt + 0.08); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.09, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1); o.connect(g); g.connect(sfxGain); reg(o); o.start(tt); o.stop(tt + 0.12); }
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
  // きらめき(拾得など): 上昇2音＋倍音ピング＋センド残響
  function sparkle(base, vol) {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      if (!voiceOk()) break;
      const tt = t + i * 0.045;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = base * [1, 1.335, 2][i];
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(vol * (1 - i * 0.22), tt + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.14);
      o.connect(g); g.connect(sfxGain); if (sendIn) g.connect(sendIn);
      reg(o); o.start(tt); o.stop(tt + 0.16);
    }
  }
  function play(name) {
    if (!enabled) return;
    switch (name) {
      case 'mine':   if (throttled('mine', 0.09)) { beep(180 + Math.random() * 40, 0.06, 'square', 0.05); if (ctx) noisePiece(ctx.currentTime, 0.035, 0.05, 'highpass', 2400, 0.8, true); } break;
      case 'break':  beep(120, 0.12, 'sawtooth', 0.1); beep(90, 0.16, 'triangle', 0.08); subThump(150, 50, 0.16, 0.12); if (ctx) noisePiece(ctx.currentTime, 0.12, 0.1, 'bandpass', 900, 1, true); break;
      case 'place':  beep(320, 0.08, 'square', 0.08); subThump(140, 60, 0.1, 0.1); break;
      case 'pickup': ensure(); sparkle(880, 0.075); break;
      case 'craft':  beep(520, 0.08, 'triangle', 0.1); beep(700, 0.1, 'triangle', 0.09); subThump(180, 70, 0.14, 0.09); break;
      case 'eat':    beep(280, 0.1, 'sine', 0.09); break;
      case 'hurt':   beep(150, 0.18, 'sawtooth', 0.12); if (ctx) noisePiece(ctx.currentTime, 0.1, 0.09, 'bandpass', 600, 1.2, true); break;
      case 'select': beep(440, 0.04, 'square', 0.05); break;
      case 'dodge_just': if (throttled('dj', 0.1) && ctx) { noiseBurst(ctx.currentTime, 0.14, 0.1, 2600, true); beep(1320, 0.05, 'sine', 0.08); beep(1760, 0.08, 'triangle', 0.07); } break; // ジャスト回避: 受け流しの一閃
      case 'cursor': if (throttled('cursor', 0.03)) { beep(660, 0.022, 'triangle', 0.035); } break;
      case 'tab':    if (throttled('tab', 0.04)) { beep(520, 0.03, 'sine', 0.045); beep(720, 0.03, 'sine', 0.03); } break;
      case 'swing':  if (throttled('swing', 0.1)) { beep(300, 0.05, 'triangle', 0.06); if (ctx) noisePiece(ctx.currentTime, 0.06, 0.035, 'bandpass', 1800, 1.5, true); } break;
      case 'hit':    beep(220, 0.07, 'square', 0.09); beep(160, 0.09, 'sawtooth', 0.06); subThump(120, 55, 0.1, 0.1); if (ctx) noisePiece(ctx.currentTime, 0.05, 0.11, 'bandpass', 950, 1, true); break;
      case 'mobdie': beep(200, 0.12, 'sawtooth', 0.1); beep(120, 0.16, 'triangle', 0.08); subThump(140, 45, 0.18, 0.12); break;
      case 'equip':  beep(400, 0.06, 'square', 0.07); beep(560, 0.06, 'square', 0.06); break;
      case 'levelup': beep(523, 0.1, 'triangle', 0.1); beep(659, 0.1, 'triangle', 0.1); beep(784, 0.14, 'triangle', 0.1); subThump(220, 80, 0.25, 0.1); if (ctx) sparkle(1046, 0.06); break;
      case 'shift':  beep(440, 0.25, 'sine', 0.12); beep(220, 0.35, 'sine', 0.1); beep(110, 0.45, 'triangle', 0.08); break;
      case 'event_meteor': sbeep(1200, 0.12, 'sine', 0.06, 0); sbeep(900, 0.14, 'sine', 0.06, 0.1); sbeep(1568, 0.1, 'triangle', 0.05, 0.2); sbeep(660, 0.32, 'sine', 0.05, 0.3); break;
      case 'event_supply': sbeep(392, 0.14, 'triangle', 0.08, 0); sbeep(523, 0.14, 'triangle', 0.08, 0.12); sbeep(659, 0.22, 'triangle', 0.09, 0.24); break;
      case 'event_horde': sbeep(110, 0.35, 'sawtooth', 0.12, 0); sbeep(98, 0.4, 'sawtooth', 0.12, 0.18); sbeep(82, 0.5, 'triangle', 0.1, 0.4); if (ctx) noiseBurst(ctx.currentTime, 0.5, 0.1, 400); break;
      case 'enchant': beep(620, 0.1, 'sine', 0.09); beep(820, 0.12, 'sine', 0.08); beep(1040, 0.16, 'triangle', 0.07); break;
      case 'dash':   if (throttled('dash', 0.25)) { beep(520, 0.07, 'sine', 0.05); if (ctx) noisePiece(ctx.currentTime, 0.09, 0.03, 'highpass', 3000, 0.7, false); } break;
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
      // 乗車: ドスッという乗り込み＋起動の上がり音
      case 'mount': beep(300, 0.06, 'square', 0.06); sbeep(430, 0.07, 'triangle', 0.05, 0.06); subThump(170, 65, 0.12, 0.09); break;
      // 降車: 下がり音＋着地
      case 'dismount': beep(380, 0.05, 'square', 0.05); sbeep(240, 0.08, 'triangle', 0.05, 0.05); subThump(150, 55, 0.1, 0.07); break;
      // リロード開始: マガジン抜き差しのクリック・クラック
      case 'reload': if (throttled('rl', 0.2)) { beep(520, 0.03, 'square', 0.05); sbeep(370, 0.04, 'square', 0.05, 0.08); if (ctx) noisePiece(ctx.currentTime, 0.05, 0.07, 'highpass', 3200, 0.8, true); } break;
      // リロード完了: スライドを引く金属音
      case 'reload_done': beep(640, 0.03, 'square', 0.06); sbeep(880, 0.04, 'square', 0.05, 0.05); if (ctx) { noisePiece(ctx.currentTime, 0.04, 0.08, 'highpass', 2800, 0.8, true); noisePiece(ctx.currentTime + 0.06, 0.05, 0.09, 'bandpass', 1500, 1.2, true); } break;
      case 'splash': if (throttled('splash', 0.12)) { beep(420 + Math.random() * 80, 0.08, 'sine', 0.04); beep(240, 0.1, 'sine', 0.03); } break;
      // 会心ヒット: 鋭い高音(影世界は僅かに低め)
      case 'crit': if (throttled('crit', 0.05)) { const sh = (Game.state && Game.state.worldName === 'shadow') ? 0.92 : 1; beep(1500 * sh, 0.05, 'square', 0.09); beep(2100 * sh, 0.045, 'triangle', 0.06); } break;
      // 精鋭撃破: 重厚な破砕
      case 'elite_die': beep(190, 0.16, 'sawtooth', 0.12); beep(110, 0.22, 'triangle', 0.1); if (ctx) noiseBurst(ctx.currentTime, 0.18, 0.12, 1400); break;
      // チャンピオン撃破: 荘厳な下降＋余韻
      case 'champion_die': sbeep(523, 0.12, 'triangle', 0.1, 0); sbeep(392, 0.14, 'triangle', 0.1, 0.07); sbeep(261, 0.2, 'triangle', 0.09, 0.15); if (ctx) noiseBurst(ctx.currentTime, 0.3, 0.14, 700); break;
      // 賞金達成: ファンファーレ風 上昇アルペジオ
      case 'bounty_done': sbeep(523, 0.1, 'triangle', 0.09, 0); sbeep(659, 0.1, 'triangle', 0.09, 0.09); sbeep(784, 0.12, 'triangle', 0.09, 0.18); sbeep(1046, 0.2, 'triangle', 0.1, 0.27); break;
      case 'quest_done': sbeep(587, 0.1, 'triangle', 0.08, 0); sbeep(740, 0.1, 'triangle', 0.08, 0.1); sbeep(880, 0.1, 'triangle', 0.08, 0.2); sbeep(1175, 0.22, 'sine', 0.09, 0.3); break; // 目標達成のファンファーレ(D-F#-A-D)
      // 遺物入手: きらめき
      case 'relic_get': sbeep(880, 0.09, 'sine', 0.07, 0); sbeep(1175, 0.09, 'sine', 0.06, 0.06); sbeep(1568, 0.14, 'triangle', 0.06, 0.12); if (ctx) sparkle(1568, 0.045); break;
      // 低HP警告: 鈍い鼓動(長めスロットル)
      case 'lowhp': if (throttled('lowhp', 1.1)) { beep(82, 0.12, 'sine', 0.11); sbeep(62, 0.16, 'sine', 0.09, 0.16); } break;
      // ポータル起動: 上昇ウーッシュ(サインの駆け上がり+高域ノイズ)＋きらめき
      case 'portal': if (throttled('portal', 0.3)) { ensure(); if (ctx) {
        const tp = ctx.currentTime;
        if (voiceOk()) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, tp); o.frequency.exponentialRampToValueAtTime(1400, tp + 0.7); g.gain.setValueAtTime(0.0001, tp); g.gain.linearRampToValueAtTime(0.07, tp + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, tp + 0.8); o.connect(g); g.connect(sfxGain); if (sendIn) g.connect(sendIn); reg(o); o.start(tp); o.stop(tp + 0.85); }
        noisePiece(tp, 0.7, 0.05, 'highpass', 1800, 0.7, false);
        sparkle(1175, 0.05);
      } } break;
      // ポータル到着: 柔らかなブルーム(重ねサイン)＋チャイム
      case 'portal_arrive': ensure(); if (ctx) { sbeep(523.25, 0.5, 'sine', 0.05, 0); sbeep(659.25, 0.5, 'sine', 0.045, 0.05); sbeep(783.99, 0.6, 'sine', 0.04, 0.1); sparkle(1568, 0.05); subThump(120, 60, 0.3, 0.06); } break;
      // 風の一薙ぎ(空島モブ用): 空気感のあるバンドパス+高域ノイズ
      case 'wind_gust': if (throttled('wgust', 0.25)) { ensure(); if (ctx) { noisePiece(ctx.currentTime, 0.5, 0.06, 'bandpass', 700, 0.8, false); noisePiece(ctx.currentTime + 0.08, 0.4, 0.04, 'highpass', 2200, 0.6, false); } } break;
      // 古代の低い石の共鳴(古代都市用): 沈むサイン＋こもったノイズ+残響
      case 'ancient_hum': if (throttled('ahum', 0.8)) { ensure(); if (ctx) {
        const ta = ctx.currentTime;
        if (voiceOk()) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(72, ta); o.frequency.linearRampToValueAtTime(66, ta + 1.1); g.gain.setValueAtTime(0.0001, ta); g.gain.linearRampToValueAtTime(0.08, ta + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, ta + 1.2); o.connect(g); g.connect(sfxGain); if (sendIn) g.connect(sendIn); reg(o); o.start(ta); o.stop(ta + 1.25); }
        noisePiece(ta, 0.9, 0.03, 'lowpass', 300, 0.8, false);
      } } break;
    }
  }

  // ===== BGM（2バス・クロスフェード・コード進行つきシーケンサ）=====
  function makeBus() {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0;
    f.connect(g); g.connect(bgmGain);
    return { f: f, g: g };
  }
  function startBGM(mood) {
    if (!enabled) return; ensure(); if (!ctx || bgm.started) return;
    bgm.started = true;
    bgm.buses = [makeBus(), makeBus()];
    bgm.bus = 0; bgm.buses[0].g.gain.value = 1;
    bgm.step = 0; bgm.bar = 0; bgm.nextStep = ctx.currentTime + 0.1;
    setMood(mood || 'day', true); // タイトル画面からは 'title' で開始できる
  }

  function setMood(mood, force) {
    if (!bgm.started || (!force && bgm.mood === mood)) return;
    const g2 = GENRES[MOOD_GENRE[mood] || 'animepop'];
    const first = force && !bgm.mood;
    bgm.mood = mood; bgm.genre = g2;
    const t = ctx.currentTime;
    if (first) { // 初回はアクティブバスをそのまま使う
      bgm.buses[bgm.bus].f.frequency.setValueAtTime(g2.cut, t);
      bgm.buses[bgm.bus].g.gain.setValueAtTime(1, t);
      return;
    }
    // クロスフェード: 旧バスの残響ごと滑らかに引き、次バスへ切替(バス2本を交互再利用=ノード増殖なし)
    const oldB = bgm.buses[bgm.bus], nb = 1 - bgm.bus, newB = bgm.buses[nb];
    oldB.g.gain.setTargetAtTime(0, t, 0.7);
    newB.f.frequency.setValueAtTime(g2.cut, t);
    newB.g.gain.setTargetAtTime(1, t, 0.9);
    bgm.bus = nb;
    bgm.bar = 0; bgm.step = 0; // 進行の頭から
  }

  // 小節ごとの決定論的変奏(LCG)。同じ小節番号なら同じ揺らぎ → 音楽的な一貫性を保ちつつ反復感を軽減
  function vrnd() {
    bgm.varSeed = (bgm.varSeed * 1664525 + 1013904223) >>> 0;
    return bgm.varSeed / 4294967296;
  }

  // リード音: デチューンした2オシレータ＋フィルタエンベロープ＋薄いセンド残響
  function tone(freq, dur, wave, vol, when) {
    if (!voiceOk() || vol <= 0) return;
    const bus = bgm.buses[bgm.bus];
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    const cut = bgm.genre ? bgm.genre.cut : 1600;
    f.frequency.setValueAtTime(cut * 1.9, when);
    f.frequency.exponentialRampToValueAtTime(Math.max(320, cut * 0.55), when + Math.min(0.3, dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = wave; o2.type = wave;
    o1.frequency.value = freq; o2.frequency.value = freq;
    o1.detune.value = -5; o2.detune.value = 5;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(bus.f);
    if (sendIn) g.connect(sendIn);
    reg(o1); o1.start(when); o1.stop(when + dur + 0.03);
    o2.start(when); o2.stop(when + dur + 0.03);
  }
  // ベース音: 単一オシレータ(バスフィルタ直結・低負荷)
  function bassTone(freq, dur, vol, when) {
    if (!voiceOk() || vol <= 0) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(bgm.buses[bgm.bus].f);
    reg(o); o.start(when); o.stop(when + dur + 0.03);
  }
  // ---- 新エリア用ボイス(sky/ruins/rift)。拡張フィールドを持つジャンルのみ tickBGM から呼ばれる ----
  // ベル音(空島): サイン基音+非整数倍音(2.76x)の金属的きらめき。send倍率でたっぷりの残響
  function bellTone(freq, dur, vol, when, send) {
    if (!voiceOk() || vol <= 0) return;
    const bus = bgm.buses[bgm.bus];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus.f);
    if (sendIn) { const sg = ctx.createGain(); sg.gain.value = send || 1; g.connect(sg); sg.connect(sendIn); }
    reg(o1); o1.start(when); o1.stop(when + dur + 0.05);
    o2.start(when); o2.stop(when + dur + 0.05);
  }
  // プラック音(古代都市): 急峻に閉じるフィルタの爪弾き。郷愁のモチーフ用
  function pluckTone(freq, dur, vol, when) {
    if (!voiceOk() || vol <= 0) return;
    const bus = bgm.buses[bgm.bus];
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, when);
    f.frequency.exponentialRampToValueAtTime(480, when + Math.min(0.18, dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    o.connect(f); f.connect(g); g.connect(bus.f);
    if (sendIn) g.connect(sendIn);
    reg(o); o.start(when); o.stop(when + dur + 0.03);
  }
  // ドローン(古代都市): 小節まるごと持続する深い低音(デチューン2osc・ゆっくり満ちる)
  function droneTone(freq, dur, vol, when) {
    if (!voiceOk() || vol <= 0) return;
    const bus = bgm.buses[bgm.bus];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq; o2.frequency.value = freq;
    o1.detune.value = -6; o2.detune.value = 6;
    o1.connect(g); o2.connect(g); g.connect(bus.f);
    reg(o1); o1.start(when); o1.stop(when + dur + 0.05);
    o2.start(when); o2.stop(when + dur + 0.05);
  }
  // 遠い鼓動(古代都市): 低く沈む lub-dub の片打ち
  function heartbeatKick(when, vol) {
    if (!voiceOk() || vol <= 0) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(88, when); o.frequency.exponentialRampToValueAtTime(36, when + 0.18);
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(g); g.connect(bgmGain);
    reg(o); o.start(when); o.stop(when + 0.25);
  }
  // 柔らかな脈(空島): キックの代わりのごく静かなタップ
  function softPulse(when, vol) {
    if (!voiceOk() || vol <= 0) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, when); o.frequency.exponentialRampToValueAtTime(110, when + 0.1);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    o.connect(g); g.connect(bgmGain);
    reg(o); o.start(when); o.stop(when + 0.28);
  }
  // サブパルス(狭間): 地の底で規則的に脈打つ低いサイン
  function subPulseTone(freq, dur, vol, when) {
    if (!voiceOk() || vol <= 0) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(bgmGain);
    reg(o); o.start(when); o.stop(when + dur + 0.03);
  }
  // フィルタノイズスウェル(狭間): ゆっくり満ちて引く不穏な息遣い
  function noiseSwellBgm(when, dur, vol) {
    if (!ctx || !noiseBuf || !voiceOk() || vol <= 0) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(300, when);
    f.frequency.exponentialRampToValueAtTime(1400, when + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f); f.connect(g); g.connect(bgmGain);
    if (sendIn) g.connect(sendIn);
    reg(src); src.start(when, Math.random()); src.stop(when + dur + 0.05);
  }

  function kickDrum(when, vol) {
    if (!voiceOk() || vol <= 0) return;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when); osc.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    osc.connect(g); g.connect(bgmGain);
    reg(osc); osc.start(when); osc.stop(when + 0.18);
  }
  function bgmHat(when, vol) {
    noisePiece(when, 0.04, vol || 0.028, 'highpass', 7000, 0, true, bgmGain);
  }
  function bgmSnare(when, vol) {
    noisePiece(when, 0.09, vol, 'bandpass', 1800, 0.9, true, bgmGain);
  }

  // 16ステップ×4小節のシーケンサ（main から毎フレーム呼ぶ）
  function tickBGM() {
    if (!enabled || !bgm.started || !ctx || !bgm.genre) return;
    const now = ctx.currentTime;
    while (bgm.nextStep <= now + 0.05) {
      const G = bgm.genre, st = bgm.step, when = bgm.nextStep;
      const inten = bgm.intensity;
      const stepDur = 60 / (G.bpm * (1 + 0.1 * inten)) / 2; // 8分音符。ボス強度でわずかに加速
      const shift = G.prog ? (G.prog[bgm.bar % G.prog.length] || 0) : 0; // 小節ごとの移調(コード進行)
      const rootNow = G.root * Math.pow(2, shift / 12);
      // キック(ボス強度でブースト＋8ステップ目にダブル)
      if (G.kick && st % 2 === 0) kickDrum(when, G.kickVol * (1 + 0.5 * inten));
      if (G.kick && inten >= 0.5 && st % 8 === 7) kickDrum(when, G.kickVol * 0.7);
      // 新エリア拡張リズム(該当フィールドを持つジャンルのみ発火・既存ジャンルは不変)
      if (G.heartbeat && st % 8 === 0) heartbeatKick(when, G.heartbeat);                      // 遠い鼓動: lub
      if (G.heartbeat && st % 8 === 1) heartbeatKick(when, G.heartbeat * 0.6);                // dub
      if (G.pulse && st % 8 === 0) softPulse(when, G.pulse);                                  // 空島: 柔らかな脈
      if (G.sub && st % 4 === 0) subPulseTone(rootNow / 4, stepDur * 2.4, G.sub, when);       // 狭間: サブパルス
      if (G.drone && st === 0) droneTone(rootNow / 4, stepDur * 16, G.drone, when);           // 古代都市: 小節ドローン
      if (G.swell && st === 0 && vrnd() < 0.6) noiseSwellBgm(when, stepDur * 12, G.swell);    // 狭間: ノイズスウェル(シード変奏で時々)
      if (G.hatRandom && vrnd() < 0.34) bgmHat(when, 0.016 + vrnd() * 0.014);                 // 狭間: 不規則ハット
      // スネア(ボス戦のみ・ランクで強く): 裏の4/12ステップ
      if (inten > 0.25 && (st === 4 || st === 12)) bgmSnare(when, 0.035 + 0.045 * inten);
      // ベース
      if (st % G.bassEvery === 0) {
        const bdeg = G.scale[(st / G.bassEvery) % G.scale.length | 0];
        bassTone(rootNow / 2 * Math.pow(2, bdeg / 12), stepDur * 1.6, G.bassVol, when);
      }
      // アルペジオ/メロディ(シード変奏: オクターブ跳躍・休符で単調さを崩す)
      if (st % G.arpEvery === 0) {
        const deg = G.arp[(st / G.arpEvery) % G.arp.length | 0];
        let oct = (st % 8 < 4) ? 1 : 2;
        const r = vrnd();
        if (r < 0.12 && st % 8 !== 0) { /* 休符 */ }
        else {
          if (r > 0.85) oct = oct === 1 ? 2 : 1; // たまに跳躍
          const fq = rootNow * oct * Math.pow(2, deg / 12);
          if (G.bell) bellTone(fq, stepDur * 3.2, G.noteVol, when, G.send);      // 空島: まばらなベルリード(長い余韻)
          else if (G.pluck) pluckTone(fq, stepDur * 1.6, G.noteVol, when);       // 古代都市: 爪弾きモチーフ
          else tone(fq, stepDur * 0.9, G.wave, G.noteVol, when);
        }
      }
      // パッド和音(半小節ごと): デチューン付き持続和音＋センド残響で厚みと奥行き
      if (st === 0 || st === 8) {
        const bus = bgm.buses[bgm.bus];
        for (let ci = 0; ci < 3; ci++) {
          if (!voiceOk()) break;
          const semi = ci === 0 ? (G.scale[0] || 0) : ci === 1 ? (G.scale[2] != null ? G.scale[2] : 4) : (G.scale[4] != null ? G.scale[4] : 7);
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = rootNow * Math.pow(2, semi / 12);
          const pdet = G.padDetune || 4; // 空島などはデチューン広め=空気感(既定4=従来通り)
          o.detune.value = ci === 1 ? pdet : ci === 2 ? -pdet : 0;
          g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(G.padVol || 0.016, when + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, when + stepDur * 8);
          o.connect(g); g.connect(bus.f); if (sendIn) g.connect(sendIn);
          reg(o); o.start(when); o.stop(when + stepDur * 8 + 0.05);
        }
      }
      // ハイハット(キックのあるジャンルの裏拍)。変奏でベロシティを揺らす
      if (G.kick && st % 2 === 1) bgmHat(when, 0.022 + vrnd() * 0.012 + 0.012 * inten);
      bgm.step = (st + 1) % 16;
      if (bgm.step === 0) { bgm.bar = (bgm.bar + 1) % 4; bgm.varSeed = ((bgm.bar + 1) * 2654435761) >>> 0; } // 小節頭で変奏を再シード(決定論)
      bgm.nextStep += stepDur;
    }
  }

  // ===== 乗り物エンジンループ(1系統を常設再利用・mount/dismountで音色を切替) =====
  // car=低い唸り / boat=水のチャグ / plane=高めのドローン / carpet=柔らかな輝きハム
  const VEH_LOOP = {
    car:    { osc: 'sawtooth', hz: 54,  oscVol: 0.5,  filt: 'lowpass',  cut: 240,  q: 0.7, noiseVol: 0.3,  lfoHz: 11,  lfoDepth: 0.22, vol: 0.05 },
    boat:   { osc: 'triangle', hz: 66,  oscVol: 0.45, filt: 'bandpass', cut: 520,  q: 0.8, noiseVol: 0.7,  lfoHz: 4.5, lfoDepth: 0.55, vol: 0.055 },
    plane:  { osc: 'sawtooth', hz: 122, oscVol: 0.5,  filt: 'bandpass', cut: 950,  q: 0.6, noiseVol: 0.45, lfoHz: 15,  lfoDepth: 0.1,  vol: 0.045 },
    carpet: { osc: 'sine',     hz: 194, oscVol: 0.35, filt: 'highpass', cut: 2600, q: 0.5, noiseVol: 0.16, lfoHz: 0.9, lfoDepth: 0.35, vol: 0.032 },
  };
  const veh = { want: null, inten: 0, built: false, osc: null, oscG: null, nF: null, nG: null, lfo: null, lfoG: null, gain: null };
  function buildVehicleLoop() {
    if (veh.built || !ctx || !noiseBuf) return;
    try {
      veh.gain = ctx.createGain(); veh.gain.gain.value = 0; veh.gain.connect(sfxGain);
      veh.osc = ctx.createOscillator(); veh.osc.type = 'sawtooth'; veh.osc.frequency.value = 54;
      veh.oscG = ctx.createGain(); veh.oscG.gain.value = 0.5;
      veh.osc.connect(veh.oscG); veh.oscG.connect(veh.gain);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; // 共有ノイズをループ再利用(新規バッファ生成なし)
      veh.nF = ctx.createBiquadFilter(); veh.nF.type = 'lowpass'; veh.nF.frequency.value = 240;
      veh.nG = ctx.createGain(); veh.nG.gain.value = 0.3;
      src.connect(veh.nF); veh.nF.connect(veh.nG); veh.nG.connect(veh.gain);
      veh.lfo = ctx.createOscillator(); veh.lfo.type = 'sine'; veh.lfo.frequency.value = 10;
      veh.lfoG = ctx.createGain(); veh.lfoG.gain.value = 0;
      veh.lfo.connect(veh.lfoG); veh.lfoG.connect(veh.gain.gain);
      veh.osc.start(); src.start(); veh.lfo.start();
      veh.built = true;
    } catch (e) { veh.built = false; veh.gain = null; }
  }
  function applyVehicleLoop() {
    if (!veh.built || !ctx) return;
    const t = ctx.currentTime, cfg = veh.want && VEH_LOOP[veh.want];
    if (!enabled || !cfg) {
      veh.gain.gain.setTargetAtTime(0.0001, t, 0.15);
      veh.lfoG.gain.setTargetAtTime(0, t, 0.15);
      return;
    }
    const k = 0.85 + 0.35 * veh.inten;              // 走行強度でわずかに回転数が上がる
    const v = cfg.vol * (0.7 + 0.5 * veh.inten);    // アイドル→巡航で音量も少しだけ
    veh.osc.type = cfg.osc; veh.osc.frequency.setTargetAtTime(cfg.hz * k, t, 0.12);
    veh.oscG.gain.setTargetAtTime(cfg.oscVol, t, 0.12);
    veh.nF.type = cfg.filt; veh.nF.frequency.setTargetAtTime(cfg.cut * k, t, 0.12); veh.nF.Q.value = cfg.q;
    veh.nG.gain.setTargetAtTime(cfg.noiseVol, t, 0.12);
    veh.lfo.frequency.setTargetAtTime(cfg.lfoHz * k, t, 0.12);
    veh.lfoG.gain.setTargetAtTime(v * cfg.lfoDepth, t, 0.2);
    veh.gain.gain.setTargetAtTime(v, t, 0.2);
  }
  // 公開API: Game.Audio.vehicleLoop(type|null, intensity 0..1)
  // 乗車で開始・降車(null)で停止。intensity=走行スロットル(音程/音量に連動)。冪等・毎tick呼んでも安全
  function vehicleLoop(type, intensity) {
    const want = VEH_LOOP[type] ? type : null;
    const inten = Math.max(0, Math.min(1, intensity || 0));
    const changed = want !== veh.want || Math.abs(inten - veh.inten) > 0.02;
    veh.want = want; veh.inten = inten;
    if (!veh.built) {
      if (!want || !enabled) return;
      ensure(); buildVehicleLoop();
      if (!veh.built) return;
      applyVehicleLoop(); return;
    }
    if (changed) applyVehicleLoop();
  }

  // ===== 天候アンビエンスレイヤー(雨/嵐/吹雪/砂嵐のループ・1系統を再利用) =====
  const wx = { gain: null, filter: null, type: null };
  function ensureWeatherLayer() {
    if (wx.gain || !ctx || !noiseBuf) return;
    try {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      wx.filter = ctx.createBiquadFilter(); wx.filter.type = 'bandpass'; wx.filter.frequency.value = 1400; wx.filter.Q.value = 0.5;
      wx.gain = ctx.createGain(); wx.gain.gain.value = 0;
      src.connect(wx.filter); wx.filter.connect(wx.gain); wx.gain.connect(master);
      src.start();
    } catch (e) { wx.gain = null; }
  }
  function setWeatherLayer(type) {
    if (!ctx) return;
    let vol = 0, freq = 1400, q = 0.5;
    if (!enabled) type = 'clear';
    if (type === 'rain') { vol = 0.045; freq = 1500; q = 0.4; }
    else if (type === 'storm') { vol = 0.07; freq = 1100; q = 0.4; }
    else if (type === 'blizzard') { vol = 0.055; freq = 420; q = 0.7; }
    else if (type === 'sandstorm') { vol = 0.05; freq = 640; q = 0.6; }
    if (vol > 0) ensureWeatherLayer();
    if (!wx.gain) return;
    if (wx.type === type) return;
    wx.type = type;
    const t = ctx.currentTime;
    wx.filter.frequency.setTargetAtTime(freq, t, 1.2);
    wx.filter.Q.setTargetAtTime(q, t, 1.2);
    wx.gain.gain.setTargetAtTime(vol, t, 1.5); // ゆっくり満ちる/引く
  }

  // 状況からムード判定して更新(ボスはランク=tierで強度スケール)
  function updateMood() {
    if (!bgm.started) return;
    let mood = 'day';
    const mobs = Game.state.mobs;
    let boss = false, tier = 0;
    let bossLvl = 0; // 1..5 のボスBGM段階(0=非ボス)
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      // 交戦中(engaged)のボス/中ボスのみボスBGMに移行。離脱で通常曲へ戻り、再接近で再びボス曲に
      if (m.engaged === false) continue;
      if (m.def.boss) {
        const tt = m.def.tier || 1; if (tt > tier) tier = tt; boss = true;
        // ラスボス(終焉の王)は最高段階5、tier4=4, ...tier1=1
        const lv = (m.type === 'endbringer') ? 5 : Math.max(1, Math.min(4, tt));
        if (lv > bossLvl) bossLvl = lv;
      } else if (m.def.midboss && bossLvl < 1) { bossLvl = 1; boss = true; } // 中ボス(D)は段階1
    }
    bgm.intensity = boss ? Math.min(1, (bossLvl || 1) / 5) : 0;
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    // エリアムード(空島/古代都市/狭間): 優先度は boss > エリア > バイオーム/昼夜。
    // World 側が currentAreaMood() を公開していない間は従来と完全に同一挙動
    let areaMood = null;
    if (!boss && Game.World && Game.World.currentAreaMood) {
      try {
        const am = Game.World.currentAreaMood();
        if (am && MOOD_GENRE[am]) areaMood = am;
      } catch (e) {}
    }
    if (boss) mood = 'boss' + (bossLvl || 1); // 強さ別クラシックBGM(boss1..boss5)
    else if (areaMood) mood = areaMood;
    else if (Game.state.worldName === 'space') mood = 'space';
    else if (Game.state.worldName === 'shadow') mood = 'shadow';
    else {
      // 光世界: ダンジョン>バイオーム(雪原/砂漠/花野)>昼夜
      const g = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
      if (g === Game.TILE.DUNGEON_FLOOR) mood = 'cave';
      else if (g === Game.TILE.SNOW) mood = 'snow';
      else if (g === Game.TILE.SAND && !Game.DayNight.isNight()) mood = 'desert';
      else if (g === Game.TILE.BLOOM && !Game.DayNight.isNight()) mood = 'meadow';
      else if (Game.DayNight.isNight()) mood = 'night';
      else mood = 'day';
    }
    setMood(mood);
    // 天候レイヤー(宇宙・ダンジョンでは無音)
    const wt = (Game.state.weather && Game.state.worldName !== 'space' && mood !== 'cave') ? Game.state.weather.type : 'clear';
    const ambOff = Game.Settings && Game.Settings.get('ambient') === false;
    setWeatherLayer(ambOff ? 'clear' : wt);
  }

  // ===== シネマティック演出音（OP/発射/発見ムービー用・オーケストラ風）=====
  const cine = { on: false, nodes: [], master: null };
  // ムード別のシネマ和音（根音Hz配列＋高弦の音）。場面に合うBGMを選ぶ
  // 各ムービー固有のテーマ。chord=持続和音, hi=うねる高弦, root/motif=主旋律(半音オフセット), mtempo=音長ms。
  // motif を持たせることで各ムービーに聴き分けられる「主題」が付き、共通感を解消
  const CINE_MOODS = {
    dramatic: { chord: [65.41, 77.78, 98.00, 130.81], hi: 523.25, root: 261.63, motif: [0, 3, 7, 3, 5, 3, 0, -2], mtempo: 460, mwave: 'triangle', mvol: 0.055 }, // Cマイナー: 緊張・ドラマ
    somber:   { chord: [55.00, 65.41, 82.41, 110.00], hi: 440.00, root: 220.00, motif: [0, 3, 5, 3, 0, -2, 0], mtempo: 620, mwave: 'sine', mvol: 0.05 },       // Aマイナー: 物語・哀愁(ゆったり)
    heroic:   { chord: [65.41, 82.41, 98.00, 130.81], hi: 659.25, root: 261.63, motif: [0, 4, 7, 12, 7, 9, 12], mtempo: 360, mwave: 'sawtooth', mvol: 0.05 },   // Cメジャー: 勝利のファンファーレ(上昇)
    mystic:   { chord: [61.74, 92.50, 110.00, 146.83], hi: 587.33, root: 293.66, motif: [0, 7, 5, 12, 7, 2], mtempo: 540, mwave: 'sine', mvol: 0.05 },           // 浮遊する神秘(sus)
    tense:    { chord: [61.74, 73.42, 87.31, 123.47], hi: 493.88, root: 246.94, motif: [0, 1, 0, 6, 0, -1], mtempo: 300, mwave: 'sawtooth', mvol: 0.06 },        // 減/b2: 不穏・ボス登場(刻む)
    aerial:   { chord: [87.31, 130.81, 174.61, 220.00], hi: 698.46, root: 349.23, motif: [0, 4, 7, 9, 12, 9, 7], mtempo: 420, mwave: 'sine', mvol: 0.05 },       // 空・光・浮遊(明るいベル)
    liminal:  { chord: [61.74, 65.41, 92.50, 123.47], hi: 466.16, root: 233.08, motif: [0, 1, 6, 7, 6, 1, 0, -5], mtempo: 500, mwave: 'triangle', mvol: 0.05 },  // 狭間の不気味さ(半音/三全音の彷徨)
    ancient:  { chord: [58.27, 73.42, 87.31, 116.54], hi: 466.16, root: 233.08, motif: [0, 3, 5, 7, 5, 3, 0], mtempo: 700, mwave: 'triangle', mvol: 0.052 },     // 古代都市: 荘厳と郷愁(ドリアンの爪弾き)
    wonder:   { chord: [65.41, 98.00, 130.81, 164.81], hi: 784.00, root: 392.00, motif: [0, 4, 7, 11, 12, 7], mtempo: 360, mwave: 'sine', mvol: 0.05 },          // 発見の驚き(きらめく上昇)
  };
  function cineStart(mood) {
    if (!enabled) return; ensure(); if (!ctx) return;
    cineStop();
    cine.on = true;
    bgm.duck = 0.15; applyBgmGain(0.5); // カットシーン中はBGMをダック(演出音を主役に)
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
    // 主旋律(モチーフ): ムービー固有のテーマを繰り返し奏で、共通感を解消
    if (M.motif && M.motif.length) {
      let step = 0;
      const playNote = function () {
        if (!cine.on || !ctx) return;
        const semi = M.motif[step % M.motif.length];
        cineMotifTone(M.root * Math.pow(2, semi / 12), M.mwave || 'triangle', M.mvol || 0.05);
        // フレーズ末で少し間を置き、単調さを避ける
        step++;
        const gap = (step % M.motif.length === 0) ? (M.mtempo || 500) * 1.6 : (M.mtempo || 500);
        cine.motifTimer = setTimeout(playNote, gap);
      };
      cine.motifTimer = setTimeout(playNote, 1100); // 主題は少し遅れて入る(和音が先)
    }
  }
  // カットシーンの主旋律1音(短い減衰の撥弦/ベル)。cine.master 経由でダック済みミックスに乗る
  function cineMotifTone(freq, wave, vol) {
    if (!ctx || !cine.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(cine.master);
    o.start(t); o.stop(t + 1.0);
  }
  function cineStop() {
    if (cine.motifTimer) { clearTimeout(cine.motifTimer); cine.motifTimer = null; }
    if (!ctx) { cine.on = false; bgm.duck = 1; return; }
    cine.on = false; const t = ctx.currentTime;
    bgm.duck = 1; applyBgmGain(0.8); // BGMをゆっくり復帰
    if (cine.master) { try { cine.master.gain.cancelScheduledValues(t); cine.master.gain.setValueAtTime(cine.master.gain.value, t); cine.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); } catch (e) {} }
    cine.nodes.forEach(function (n) { try { if (n.stop) n.stop(t + 1.0); } catch (e) {} });
    cine.nodes = []; cine.master = null;
  }
  function noiseBurst(t, dur, vol, cutoff, highpass) {
    noisePiece(t, dur, vol, highpass ? 'highpass' : 'lowpass', cutoff, 0, false, master);
  }
  function cue(name) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    if (name === 'boom' || name === 'impact') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(name === 'impact' ? 0.5 : 0.34, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(master); reg(o); o.start(t); o.stop(t + 0.75);
      noiseBurst(t, 0.45, name === 'impact' ? 0.24 : 0.14, 420);
    } else if (name === 'riser') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + 2.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 2.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      o.connect(f); f.connect(g); g.connect(master); reg(o); o.start(t); o.stop(t + 2.5);
      noiseBurst(t, 2.2, 0.09, 3000, true);
    } else if (name === 'swell' || name === 'choir') {
      const chord = name === 'choir' ? [261.63, 329.63, 392.00, 523.25] : [196, 261.63, 329.63, 392];
      chord.forEach(function (fr, i) {
        const o = ctx.createOscillator(); o.type = name === 'choir' ? 'sine' : 'sawtooth'; o.frequency.value = fr; o.detune.value = (i % 2 ? 5 : -5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
        o.connect(f); f.connect(g); g.connect(master); if (sendIn) g.connect(sendIn);
        reg(o); o.start(t); o.stop(t + 2.5);
      });
    } else if (name === 'shimmer') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (fr, i) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        const g = ctx.createGain(); const st = t + i * 0.08; g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.085, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
        o.connect(g); g.connect(master); if (sendIn) g.connect(sendIn);
        reg(o); o.start(st); o.stop(st + 0.55);
      });
    } else if (name === 'crack') {
      noiseBurst(t, 0.5, 0.28, 2500);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(master); reg(o); o.start(t); o.stop(t + 0.5);
    }
  }

  let bgmVol = 0.6, sfxVol = 0.9;
  function setVolumes(bgmV, sfxV) {
    bgmVol = bgmV; sfxVol = sfxV; ensure();
    applyBgmGain(0.1);
    if (sfxGain) sfxGain.gain.value = sfxVol;
  }
  function toggle() {
    enabled = !enabled;
    applyBgmGain(0.1);
    if (!enabled) { cineStop(); setWeatherLayer('clear'); }
    if (enabled) { ensure(); if (!bgm.started) startBGM(); }
    applyVehicleLoop(); // 乗車中のエンジンループもON/OFFに追従
    return enabled;
  }
  function isEnabled() { return enabled; }

  // ===== 環境音(昼=鳥/風, 夜=虫, 雨=ざわめき)。没入感を高める =====
  function birdChirp() {
    if (!ctx) return; const t = ctx.currentTime; const base = 2200 + Math.random() * 900;
    for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) { if (!voiceOk()) break; const tt = t + i * 0.09; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(base * (1 + i * 0.08), tt); o.frequency.exponentialRampToValueAtTime(base * 0.8, tt + 0.07); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09); o.connect(g); g.connect(master); reg(o); o.start(tt); o.stop(tt + 0.11); }
  }
  function cricket() {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) { if (!voiceOk()) break; const tt = t + i * 0.06; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 4600; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.022, tt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03); o.connect(g); g.connect(master); reg(o); o.start(tt); o.stop(tt + 0.04); }
  }
  function windGust() {
    if (!ctx || !noiseBuf || !voiceOk()) return;
    const t = ctx.currentTime, dur = 1.4 + Math.random();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; // 共有バッファをループで切り出し
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); reg(src); src.start(t, Math.random()); src.stop(t + dur);
  }
  // 洞窟/ダンジョンの水滴(残響付き)。閉所の不気味さを演出
  function caveDrip() {
    if (!ctx) return; const t = ctx.currentTime, base = 900 + Math.random() * 500;
    if (!voiceOk()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(master); if (sendIn) g.connect(sendIn); // センド残響で洞窟の反響を表現
    reg(o); o.start(t); o.stop(t + 0.2);
  }
  function ambientTick() {
    if (!enabled || !ctx) return;
    if (Game.Settings && Game.Settings.get('ambient') === false) return;
    if (!Game.state || Game.state.paused || Game.state.worldName === 'space') return;
    // ダンジョン内: 鳥/虫の代わりに水滴の残響
    if (Game.World && Game.World.groundAt && Game.Player && Game.Player.playerTile) {
      const pt = Game.Player.playerTile();
      if (Game.World.groundAt(pt.tx, pt.ty) === Game.TILE.DUNGEON_FLOOR) { if (Math.random() < 0.55) caveDrip(); return; }
    }
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
    if (kind === 'stone') { if (!voiceOk()) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(190 * p, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(g); g.connect(sfxGain); reg(o); o.start(t); o.stop(t + 0.07); }
    else if (kind === 'soft') { noisePiece(t, 0.05, 0.03, 'lowpass', 700 * p, 0, false); } // 砂/雪/土: こもった踏み
    else { // grass: 草の擦れ(高めのノイズ)＋僅かな踏み込み
      noisePiece(t, 0.045, 0.022, 'bandpass', 1900 * p, 1.1, true);
      if (voiceOk()) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(135 * p, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.016, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g); g.connect(sfxGain); reg(o); o.start(t); o.stop(t + 0.08); }
    }
  }
  // コンボ音: 連数で音程が上がる心地よいピップ。節目(10連ごと)は上昇アルペジオ
  function comboSound(n) {
    if (!enabled) return; ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    if (n % 10 === 0) { // 節目: 明るい上昇アルペジオ
      [0, 4, 7, 12].forEach(function (semi, i) { if (!voiceOk()) return; const tt = t + i * 0.05; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 523.25 * Math.pow(2, semi / 12); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.08, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.16); o.connect(g); g.connect(sfxGain); if (sendIn) g.connect(sendIn); reg(o); o.start(tt); o.stop(tt + 0.18); });
    } else { // 通常: 連数で半音ずつ上がる短いピップ(2オクターブで循環)
      if (!voiceOk()) return;
      const semi = (n - 1) % 24; const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, semi / 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g); g.connect(sfxGain); reg(o); o.start(t); o.stop(t + 0.12);
    }
  }
  function eat(kind) { eatSound(kind); }
  // 外部からのダック操作(会話UI等が使えるよう防御的に公開)。amount: 0..1 (省略=解除)
  function duckBGM(amount) {
    bgm.duck = (amount == null || amount >= 1) ? 1 : Math.max(0, amount);
    applyBgmGain(0.5);
  }
  return { play, eat, footstep, comboSound, ambientTick, ensure, toggle, isEnabled, startBGM, tickBGM, updateMood, setMood, cineStart, cineStop, cue, setVolumes, duckBGM, vehicleLoop };
})();
