// story.js — 物語(記憶回廊)。Souls/Elden 調の章立てロアとシネマティック再生
window.Game = window.Game || {};

// 各章: scenes は {text, col(背景), col2(粒子), icon(象徴), d(ms)}
Game.STORY = [
  { id: 'prologue', title: '序章 ― 一なりし世界', trigger: '物語の始まり', col: '#2a3a55', scenes: [
    { text: 'はじまりに、世界はひとつだった。\n光と影は同じ大地に根を張り、昼と夜は手を取り合って巡っていた。', col: '#26405e', col2: '#cfe0ff', icon: '🌗', d: 5200 },
    { text: 'その均衡を、誰もが「永遠」と信じていた。\n——祈りが、生まれてしまうまでは。', col: '#1e2c44', col2: '#9fb0ff', icon: '☀', d: 4600 },
  ] },
  { id: 'sundering', title: '第一章 ― 二つの祈り', trigger: '初めて影の世界へ渡ったとき', col: '#3a2a55', scenes: [
    { text: 'ある者は「永遠の昼」を願った。陰りを憎み、安らぎより栄光を求めて。', col: '#4a3a1e', col2: '#ffd86b', icon: '☀', d: 4800 },
    { text: '別の者は「安らぎの夜」を欲した。眩さに疲れ、静寂の中に救いを見て。', col: '#1e2444', col2: '#9fb0ff', icon: '🌙', d: 4800 },
    { text: '相反するふたつの祈りは大地を引き裂き、世界は光と影、二つの相へと割れた。\n裂け目から零れたものこそ——影晶。世界の傷の結晶である。', col: '#3a2a55', col2: '#b884e8', icon: '💔', d: 5400 },
  ] },
  { id: 'shadow_king', title: '第二章 ― 玉座の影', trigger: '影の主を打ち倒したとき', col: '#3a1f5e', scenes: [
    { text: '裂けた世界の最も深い影に、ひとつの願いが形を得て坐していた。', col: '#2a1840', col2: '#c060ff', icon: '👑', d: 4600 },
    { text: '「光なき世界こそ、真の安寧」——影の主。\n最初に夜を願った者の、成れの果て。砕かれてなお、その願いは罅となって世界に残響する。', col: '#3a1f5e', col2: '#b478e6', icon: '🌑', d: 5600 },
  ] },
  { id: 'hunger', title: '第三章 ― 飢えの底', trigger: '飢餓の獣を打ち倒したとき', col: '#4a1028', scenes: [
    { text: '裂け目に堕ちた魂は、やがて己が何者であったかを忘れる。\n残るのはただ、満たされぬ渇き。', col: '#4a1028', col2: '#ff6a8a', icon: '🩸', d: 4800 },
    { text: '喰らい、喰らい、なお飢える獣。\n——それは、世界が失ったものの大きさそのものだった。', col: '#3a0c20', col2: '#ff8aa0', icon: '🦷', d: 4600 },
  ] },
  { id: 'abyss', title: '第四章 ― 深淵の竜', trigger: '深淵の竜を打ち倒したとき', col: '#2a1850', scenes: [
    { text: '影の最果て、光の記憶すら届かぬ淵に、古き竜が翼を畳んでいた。', col: '#2a1850', col2: '#a060e0', icon: '🐉', d: 4800 },
    { text: '竜は問う——「光なき場所で、お前はなお進むのか」。\nその牙を継ぐ者は、闇を裂く咆哮を手にする。', col: '#1e1040', col2: '#c884f0', icon: '🌌', d: 5000 },
  ] },
  { id: 'star', title: '第五章 ― 天の守り人', trigger: '星の守護者を打ち倒したとき', col: '#1e3a5e', scenes: [
    { text: '大地が裂けた衝撃は、天の一部すら剥がして彼方へ飛ばした。\n剥がれた空は星々の世界となり、守り人がそれを抱いた。', col: '#1e3a5e', col2: '#bfe0ff', icon: '✦', d: 5200 },
    { text: '「星の理を乱す者を、われは許さぬ」。\n——だが理とは、ときに壊して問い直すためにある。', col: '#16304e', col2: '#cfe8ff', icon: '🌠', d: 4800 },
  ] },
  { id: 'reunion', title: '第六章 ― 還る世界', trigger: '二相を再びひとつに還したとき', col: '#3a5e3a', scenes: [
    { text: '楔を打て。光と影、同じ場所に。\nさすれば離れた岸は、再び結ばれよう——碑はそう告げていた。', col: '#3a5e3a', col2: '#aef07a', icon: '⚭', d: 5000 },
    { text: '割れた世界が、ゆっくりと息を合わせる。\n光も影も、もはや争わず——あなたの手が、それを成した。', col: '#2e5030', col2: '#cfffb0', icon: '🌗', d: 5200 },
  ] },
  { id: 'endbringer', title: '終章 ― 終焉、そして始まり', trigger: '終焉の王を打ち倒したとき', col: '#5e1f33', scenes: [
    { text: '世界の罅という罅から、終焉が形を成す。\n「裂けた世界よ、我が手で終わらせてやろう」', col: '#5e1f33', col2: '#ff6a8a', icon: '🜲', d: 5200 },
    { text: '終焉の王は、光と影に還った。\n終わりとは、ひとつの始まりの別名にすぎない。', col: '#3a1424', col2: '#ffb0c4', icon: '🗝', d: 5000 },
    { text: 'これを読む者よ——物語の続きを綴るのは、もはや碑ではない。\nお前自身だ。', col: '#2a2440', col2: '#ffe9a0', icon: '✶', d: 5400 },
  ] },
];

Game.Story = (function () {
  function set() { return Game.state.storySeen || (Game.state.storySeen = {}); }
  function byId(id) { for (let i = 0; i < Game.STORY.length; i++) if (Game.STORY[i].id === id) return Game.STORY[i]; return null; }
  function seen(id) { return !!set()[id]; }
  function play(id) {
    const f = byId(id); if (!f || !Game.Cutscene || !Game.Cutscene.playStory) return;
    Game.state.paused = true;
    Game.Cutscene.playStory(f, function () { Game.state.paused = false; });
  }
  // 初解放: 記録して自動再生(マルチのゲストは再生しない)。既見なら何もしない
  function unlock(id, autoplay) {
    const f = byId(id); if (!f || seen(id)) return false;
    set()[id] = 1;
    if (Game.UI && Game.UI.toast) Game.UI.toast('📖 記憶回廊に物語が刻まれた — ' + f.title);
    if (autoplay && !(Game.Net && Game.Net.isConnected() && !Game.Net.host)) play(id);
    return true;
  }
  function list() {
    return Game.STORY.map(function (f) {
      return { id: f.id, title: f.title, trigger: f.trigger, seen: seen(f.id), text: f.scenes.map(function (s) { return s.text; }).join('\n\n') };
    });
  }
  function count() { let n = 0; const s = set(); for (const k in s) if (s[k]) n++; return n; }
  return { unlock, play, seen, list, count };
})();
