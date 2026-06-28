// lore.js — 石碑のロア断片（世界が二相に裂けた物語）
window.Game = window.Game || {};

Game.Lore = (function () {
  Game.LORE = [
    { t: '碑文 其の一', b: 'はじまり、世界はひとつだった。光も影も、同じ大地の上で手をつないでいた。' },
    { t: '碑文 其の二', b: 'ある者が「永遠の昼」を望み、別の者が「安らぎの夜」を欲した。願いは大地を二つに裂いた。' },
    { t: '碑文 其の三', b: '裂け目から零れ落ちたのが影晶。影の側にだけ実を結ぶ、世界の傷の結晶である。' },
    { t: '碑文 其の四', b: '影に長く身を置く者は、やがて視えぬものを視る。狂気とは、もうひとつの真実への扉だ。' },
    { t: '碑文 其の五', b: '光を掲げよ。影の住人は灯を恐れ、灯のもとでのみ人は己を保てる。' },
    { t: '碑文 其の六', b: '影鏡は二つの世界を映す。割れた世界を渡る唯一の橋、そして戻れぬ者への墓標。' },
    { t: '碑文 其の七', b: '影の最も深き処に、王が眠る。世界を裂いた最初の願いが、形を得たものだという。' },
    { t: '碑文 其の八', b: '楔を打て。二つの世界の同じ場所に。さすれば離れた岸は、再び結ばれよう。' },
    { t: '碑文 其の九', b: 'いつか、誰かが二相を一つに還す。それは破壊か、救いか——碑は、ただ問いを残す。' },
  ];

  function set() { return Game.state.lore || (Game.state.lore = {}); }
  function indexFor(tx, ty) { return Math.floor(Game.Utils.hash3(tx, ty, Game.state.seed + 4242) * Game.LORE.length) % Game.LORE.length; }

  function read(tx, ty) {
    const i = indexFor(tx, ty);
    const frag = Game.LORE[i];
    const first = !set()[i];
    set()[i] = 1;
    Game.UI.showLore(frag.t, frag.b, count(), Game.LORE.length);
    if (first) { Game.Audio.play('craft'); if (Game.Achievements && count() >= Game.LORE.length) Game.Achievements.unlock('lore_complete'); }
  }

  function count() { return Object.keys(set()).length; }

  return { read, count };
})();
