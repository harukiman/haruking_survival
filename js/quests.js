// quests.js — 二相世界の物語を貫く目標（任意の進行指針）＋世界統合エンディング
window.Game = window.Game || {};

Game.Quests = (function () {
  const A = function (id) { return Game.Achievements && Game.Achievements.has(id); };
  const cnt = function (id) { return Game.Inventory.count(id); };

  function hasAnyTool() {
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) { const d = s[i] && Game.ITEMS[s[i].id]; if (d && (d.tool || d.attack)) return true; }
    return false;
  }

  // desc に getter を使い、進捗(x/n)を常に最新表示。ui.js は q.desc を読むだけで動的更新される
  Game.QUESTS = [
    { id: 'gather', name: '生きる糧', desc: '木を叩いて 木材 を手に入れる', check: () => A('first_wood') || cnt('wood') > 0 },
    { id: 'tool', name: '道具を手に', desc: 'クラフトで ツルハシ か 剣 を作る', check: () => hasAnyTool() },
    { id: 'night', name: '最初の夜', desc: '夜に現れる魔物を1体倒す', check: () => A('first_night') },
    { id: 'mirror', name: '鏡を磨く', get desc() { return '影の欠片と鉄で 影鏡 を作る（欠片 ' + Math.min(8, cnt('shadow_shard')) + '/8）'; }, check: () => A('first_mirror') || cnt('shadow_mirror') > 0 },
    { id: 'shift', name: '影へ渡る', desc: '影鏡を使い、影の世界へ渡る', check: () => A('first_shift') },
    { id: 'crystal', name: '闇の鉱石', get desc() { return '影の世界で 影晶 を採掘する（' + Math.min(3, cnt('shadow_crystal')) + '/3）'; }, check: () => cnt('shadow_crystal') >= 3 || A('shadow_gear') },
    { id: 'gear', name: '光を継ぐ者', desc: '影晶と鉄を炉で 影鋼 にし、影鋼の装備を作る', check: () => A('shadow_gear') },
    { id: 'seal', name: '封印を解く', desc: '光と影を共鳴させ、遺跡の封印を解く', check: () => A('resonance') },
    { id: 'boss', name: '主との対峙', desc: '影の主 を討ち倒す', check: () => A('boss_slain') },
    { id: 'lore', name: '碑文を辿る', get desc() { return '各地の石碑を読み解く（' + Math.min(5, (Game.Lore ? Game.Lore.count() : 0)) + '/5）'; }, check: () => (Game.Lore && Game.Lore.count() >= 5) },
    { id: 'reunify', name: '世界を還す', desc: '統合の核 を作り、使って二相の世界を還す', check: () => Game.state.reunified },
  ];

  function current() {
    const i = Game.state.questIndex || 0;
    return i < Game.QUESTS.length ? Game.QUESTS[i] : null;
  }

  // 達成の祝福ビート: トースト＋達成音＋きらめき＋頭上の演出(既存スタイルに合わせ控えめに華やか)
  function celebrate(q) {
    Game.UI.toast('🎯 目標達成: ' + q.name);
    Game.Audio.play('quest_done');
    if (Game.Audio.cue) Game.Audio.cue('shimmer');
    const p = Game.state.player;
    if (p && Game.Render) {
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 28, '目標達成', '#ffd86b', true);
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y - 10, '#ffd86b', 12);
    }
  }

  let lastTrack = '';
  function update() {
    if (!Game.state.questDone) Game.state.questDone = {};
    let advanced = false;
    while (true) {
      const q = current();
      if (!q) break;
      if (q.id === 'reunify') break; // 最終は儀式で達成
      if (q.check()) {
        Game.state.questDone[q.id] = 1;
        Game.state.questIndex = (Game.state.questIndex || 0) + 1;
        celebrate(q);
        advanced = true;
      } else break;
    }
    if (advanced) { Game.UI.refreshQuest(); if (Game.Save) Game.Save.autosave('quest'); } // 目標達成で自動保存
    else {
      // 進捗(x/n)が動いたら即トラッカー更新(達成待ちにしない)
      const q = current();
      const track = q ? q.name + '：' + q.desc : '';
      if (track !== lastTrack) { lastTrack = track; Game.UI.refreshQuest(); }
    }
  }

  // 世界統合エンディング（統合の核を使用）
  function reunify() {
    if (Game.state.reunified) { Game.UI.toast('世界は既にひとつに還った'); return; }
    if (Game.Inventory.count('unity_core') < 1) return;
    Game.Inventory.remove('unity_core', 1);
    Game.state.reunified = true;
    Game.state.questDone['reunify'] = 1;
    if (Game.Achievements) Game.Achievements.unlock('reunified');
    if (Game.Story) Game.Story.unlock('reunion', true); // 第六章 ― 還る世界
    Game.Render.flash('#ffffff');
    Game.Audio.play('levelup');
    const stats = {
      days: Math.floor(Game.state.tick / Game.DAY_LENGTH) + 1,
      level: Game.state.player.level,
      ach: Game.Achievements.count(),
      achTotal: Game.Achievements.total(),
    };
    Game.UI.showEnding(stats);
    Game.UI.refreshQuest();
  }

  return { current, update, reunify };
})();
