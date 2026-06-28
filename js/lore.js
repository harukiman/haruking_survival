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
    { t: '碑文 其の十', b: '世界が裂けたあの日、秩序もまた砕けた。寄る辺を失くした者の幾人かは略奪へと走り、無法者となって荒野を彷徨う。' },
    { t: '碑文 其の十一', b: '影は獣をも蝕む。常ならぬ輝きを纏う個体——あれは影に侵され、力と引き換えに正気を失った成れの果てだ。' },
    { t: '碑文 其の十二', b: '最初の裂け目に抗った英雄たちがいた。彼らの指輪や護符には、いまも意志の残響が宿る。世に言う遺物とは、その形見である。' },
    { t: '碑文 其の十三', b: '影に深く染まり、固有の名を得た者を人は畏れて呼ぶ——チャンピオンと。討ち果たせば、その身に集めた古の力が遺されるという。' },
    { t: '碑文 其の十四', b: '生き残った村々は、討つべき者の首に賞金をかけた。掲示板に貼られた手配書は、狭間を渡る旅人への祈りでもある。' },
    { t: '碑文 其の十五', b: '無法者を束ねる頭目あり。影の王の威を借り、荒野に君臨する大物だ。その首が落ちる時、ひとつの時代が終わる。' },
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
