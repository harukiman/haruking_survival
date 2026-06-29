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

  Game.QUESTS = [
    { id: 'gather', name: '生きる糧', desc: '木を採取する', check: () => A('first_wood') || cnt('wood') > 0 },
    { id: 'tool', name: '道具を手に', desc: 'ツルハシか剣を作る', check: () => hasAnyTool() },
    { id: 'night', name: '最初の夜', desc: '夜の敵を倒す', check: () => A('first_night') },
    { id: 'mirror', name: '鏡を磨く', desc: '影の欠片を集め影鏡を作る', check: () => A('first_mirror') || cnt('shadow_mirror') > 0 },
    { id: 'shift', name: '影へ渡る', desc: '影の世界へ渡る', check: () => A('first_shift') },
    { id: 'crystal', name: '闇の鉱石', desc: '影晶を3つ集める', check: () => cnt('shadow_crystal') >= 3 || A('shadow_gear') },
    { id: 'gear', name: '光を継ぐ者', desc: '影鋼の装備を作る', check: () => A('shadow_gear') },
    { id: 'seal', name: '封印を解く', desc: '共鳴遺跡を開く', check: () => A('resonance') },
    { id: 'boss', name: '主との対峙', desc: '影の主を倒す', check: () => A('boss_slain') },
    { id: 'lore', name: '碑文を辿る', desc: '石碑を5つ読む', check: () => (Game.Lore && Game.Lore.count() >= 5) },
    { id: 'reunify', name: '世界を還す', desc: '統合の核を作り二相を還す', check: () => Game.state.reunified },
  ];

  function current() {
    const i = Game.state.questIndex || 0;
    return i < Game.QUESTS.length ? Game.QUESTS[i] : null;
  }

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
        Game.UI.toast('🎯 目標達成: ' + q.name);
        Game.Audio.play('craft');
        advanced = true;
      } else break;
    }
    if (advanced) Game.UI.refreshQuest();
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
