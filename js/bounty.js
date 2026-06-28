// bounty.js — 賞金首(bounty)システム。掲示板で討伐依頼を受け、達成で報酬を得る独自ループ。
window.Game = window.Game || {};

Game.Bounty = (function () {
  // 賞金首の対象候補（非ボスの一般的な敵対モブ）
  const POOL = ['zombie', 'skeleton', 'spider', 'slime', 'bandit', 'boar', 'scorpion', 'bat',
    'leech', 'troll', 'harpy', 'frost_wolf', 'dune_serpent', 'mud_crawler', 'ember_imp',
    'hex_caster', 'gazer', 'bog_horror', 'wraith', 'cursed_armor'];

  function eligible() { return POOL.filter(function (id) { return Game.MOBS && Game.MOBS[id]; }); }

  function generate() {
    const pool = eligible();
    const target = pool[Math.floor(Math.random() * pool.length)];
    const def = Game.MOBS[target];
    const xp = def.xp || 3;
    const need = 3 + Math.floor(Math.random() * 4); // 3〜6体
    // 報酬金塊: 強さ(xp)と必要数に応じた控えめな額
    const rewardGold = Math.max(2, Math.round((xp * need) / 6) + 1 + Math.floor(Math.random() * 2));
    // レア報酬: 低確率で知恵の書/経験の宝珠
    let rewardItem = null;
    const roll = Math.random();
    if (roll < 0.15) rewardItem = { id: 'wisdom_tome', count: 1 };
    else if (roll < 0.45) rewardItem = { id: 'xp_orb', count: 1 };
    return { target: target, targetName: def.name, need: need, count: 0, rewardGold: rewardGold, rewardItem: rewardItem, done: false };
  }

  function rewardText(b) {
    let r = '金塊 x' + b.rewardGold;
    if (b.rewardItem) { const d = Game.ITEMS[b.rewardItem.id]; r += ' ＋ ' + (d ? d.name : b.rewardItem.id); }
    return r;
  }

  function announce(b) {
    Game.UI.toast('賞金首: 「' + b.targetName + '」を ' + b.need + ' 体討伐せよ！ 報酬 ' + rewardText(b));
    Game.Audio.play('select');
  }

  // killMob から対象討伐を通知
  function notifyKill(type) {
    const b = Game.state && Game.state.bounty;
    if (!b || b.done || type !== b.target) return;
    b.count++;
    if (b.count >= b.need) {
      b.done = true;
      Game.UI.toast('賞金首討伐完了！ 掲示板で報酬を受け取れ');
      Game.Audio.play('levelup');
    } else {
      Game.UI.toast(b.targetName + ' を討伐 (' + b.count + '/' + b.need + ')');
    }
    if (Game.UI.refreshBounty) Game.UI.refreshBounty();
  }

  // 掲示板との対話
  function open() {
    let b = Game.state.bounty;
    if (b && b.done) {
      Game.Inventory.add('gold_bar', b.rewardGold);
      if (b.rewardItem) Game.Inventory.add(b.rewardItem.id, b.rewardItem.count);
      Game.UI.toast('★ 賞金を受け取った — ' + rewardText(b));
      Game.Audio.play('enchant');
      if (Game.Render.spawnFloat) { const p = Game.state.player; Game.Render.spawnFloat(p.x, p.y - 18, '賞金 +' + b.rewardGold, '#e8c54a', true); }
      Game.state.bountyDone = (Game.state.bountyDone || 0) + 1;
      Game.state.bounty = generate(); // 次の依頼を即発行
      announce(Game.state.bounty);
      Game.UI.refreshAll();
      if (Game.UI.refreshBounty) Game.UI.refreshBounty();
      return;
    }
    if (!b) {
      Game.state.bounty = generate();
      announce(Game.state.bounty);
      if (Game.UI.refreshBounty) Game.UI.refreshBounty();
      return;
    }
    // 進行中
    Game.UI.toast('賞金首: ' + b.targetName + ' を討伐 (' + b.count + '/' + b.need + ')　報酬 ' + rewardText(b));
  }

  return { generate, notifyKill, open, rewardText };
})();
