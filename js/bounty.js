// bounty.js — 賞金首(bounty)システム。掲示板で討伐依頼を受け、達成で報酬を得る独自ループ。
window.Game = window.Game || {};

Game.Bounty = (function () {
  // 賞金首の対象候補（非ボスの一般的な敵対モブ）
  const POOL = ['zombie', 'skeleton', 'spider', 'slime', 'bandit', 'boar', 'scorpion', 'bat',
    'leech', 'troll', 'harpy', 'frost_wolf', 'dune_serpent', 'mud_crawler', 'ember_imp',
    'hex_caster', 'gazer', 'bog_horror', 'wraith', 'cursed_armor'];

  function eligible() { return POOL.filter(function (id) { return Game.MOBS && Game.MOBS[id]; }); }

  function makeName() {
    const N = Game.CHAMPION_NAMES || { title: ['名うての'], name: ['ならず者'] };
    return N.title[Math.floor(Math.random() * N.title.length)] + N.name[Math.floor(Math.random() * N.name.length)];
  }

  function generate() {
    // 低確率(~20%)で通常賞金首の代わりに「大物(boss)」討伐依頼
    if (Game.MOBS && Game.MOBS.wanted_boss && Math.random() < 0.20) {
      return {
        big: true, target: 'wanted_boss', targetName: '賞金首の大物', bossName: makeName(),
        need: 1, count: 0, rewardGold: 12 + Math.floor(Math.random() * 9),
        rewardItem: { id: 'wisdom_tome', count: 1 }, done: false, spawned: false,
      };
    }
    // 納品依頼(~25%): 討伐以外のループ。採集素材を集めて掲示板へ納める
    if (Math.random() < 0.25) {
      const DELIVER = [
        { id: 'wood', n: [12, 20] }, { id: 'stone', n: [12, 20] }, { id: 'coal', n: [8, 14] },
        { id: 'iron_ore', n: [6, 10] }, { id: 'hide', n: [5, 9] }, { id: 'raw_meat', n: [5, 9] },
        { id: 'berry', n: [8, 14] }, { id: 'slime_ball', n: [6, 10] }, { id: 'shadow_shard', n: [4, 8] },
      ].filter(function (d) { return Game.ITEMS[d.id]; });
      const d = DELIVER[Math.floor(Math.random() * DELIVER.length)];
      const need2 = d.n[0] + Math.floor(Math.random() * (d.n[1] - d.n[0] + 1));
      const rewardGold2 = Math.max(2, Math.round(need2 / 4) + 1 + Math.floor(Math.random() * 2));
      let rewardItem2 = null; const r2 = Math.random();
      if (r2 < 0.15) rewardItem2 = { id: 'wisdom_tome', count: 1 };
      else if (r2 < 0.45) rewardItem2 = { id: 'xp_orb', count: 1 };
      return { deliver: d.id, targetName: Game.ITEMS[d.id].name, need: need2, count: 0, rewardGold: rewardGold2, rewardItem: rewardItem2, done: false };
    }
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
    if (b.big) { Game.UI.toast('★ 大物の手配書！「' + b.bossName + '」を討て——掲示板で受けよ'); Game.Audio.play('select'); return; }
    if (b.deliver) { Game.UI.toast('納品依頼: 「' + b.targetName + '」を ' + b.need + ' 個集めて掲示板へ！ 報酬 ' + rewardText(b)); Game.Audio.play('select'); return; }
    Game.UI.toast('賞金首: 「' + b.targetName + '」を ' + b.need + ' 体討伐せよ！ 報酬 ' + rewardText(b));
    Game.Audio.play('select');
  }

  // 大物ボスを出現させる(複数アフィックス＋固有名＋専用カラー)
  function spawnBoss(b) {
    const p = Game.state.player;
    Game.Mobs.spawnMob('wanted_boss', p.x + 130, p.y);
    const mobs = Game.state.mobs, m = mobs[mobs.length - 1];
    if (m && m.type === 'wanted_boss') {
      b.spawned = true;
      m.bountyBoss = true; m.championName = b.bossName;
      const opts = ['regened', 'blazing', 'thorns', 'swift'].filter(function (k) { return Game.ELITE_AFFIXES[k]; });
      m.eliteAffix = opts[Math.floor(Math.random() * opts.length)];
      const others = opts.filter(function (k) { return k !== m.eliteAffix; });
      m.eliteAffix2 = others[Math.floor(Math.random() * others.length)];
      if ((m.eliteAffix === 'swift' || m.eliteAffix2 === 'swift') && Game.ELITE_AFFIXES.swift) m.eliteSpeedMult = Game.ELITE_AFFIXES.swift.speed;
      m.auraRGB = [255, 80, 80];
    }
    Game.UI.toast('賞金首の大物「' + b.bossName + '」が現れた！ 討ち取れ');
    if (Game.UI.refreshBounty) Game.UI.refreshBounty();
  }

  // killMob から対象討伐を通知
  function notifyKill(type) {
    const b = Game.state && Game.state.bounty;
    if (!b || b.done || type !== b.target) return;
    if (b.big) {
      // 大物討伐: 即時 大報酬
      b.count = b.need; b.done = true;
      Game.Inventory.add('gold_bar', b.rewardGold);
      Game.Inventory.add('xp_orb', 1);
      if (b.rewardItem) Game.Inventory.add(b.rewardItem.id, b.rewardItem.count);
      Game.state.bountyDone = (Game.state.bountyDone || 0) + 1; if (Game.state.bountyDone >= 10 && Game.Achievements) Game.Achievements.unlock('bounty_veteran');
      if (Game.state.bountyDone === 1 && Game.Story) Game.Story.unlock('bounty', true); // 初討伐で記憶回廊「手配書の風」
      if (Game.Save) Game.Save.autosave('bounty'); // 賞金達成で自動保存
      if (Game.Achievements) Game.Achievements.unlock('bounty_king');
      Game.UI.toast('★ 賞金首の大物を討伐！ 金塊 x' + b.rewardGold + ' ＋ 財宝を得た');
      Game.Audio.play('bounty_done');
      Game.state.bounty = generate(); // 次の依頼へ
      if (!Game.state.bounty.big) announce(Game.state.bounty);
      else Game.UI.toast('新たな大物の手配書が掲示板に貼り出された');
      Game.UI.refreshAll();
      if (Game.UI.refreshBounty) Game.UI.refreshBounty();
      return;
    }
    b.count++;
    if (b.count >= b.need) {
      b.done = true;
      Game.UI.toast('賞金首討伐完了！ 掲示板で報酬を受け取れ');
      Game.Audio.play('bounty_done');
    } else {
      Game.UI.toast(b.targetName + ' を討伐 (' + b.count + '/' + b.need + ')');
    }
    if (Game.UI.refreshBounty) Game.UI.refreshBounty();
  }

  // 掲示板との対話
  function open() {
    if (Game.state) { Game.state._tips = Game.state._tips || {}; Game.state._tips.bounty_seen = 1; } // 導線ヒントの達成フラグ
    let b = Game.state.bounty;
    // 大物依頼: ボスが居なければ出現させる(初回/リロード後)
    if (b && b.big && !b.done) {
      const alive = Game.state.mobs.some(function (m) { return m.type === 'wanted_boss'; });
      if (!alive) spawnBoss(b);
      else Game.UI.toast('賞金首の大物「' + b.bossName + '」を討て！');
      return;
    }
    // 納品依頼: 掲示板で所持数を確認し、足りていれば納品して報酬
    if (b && b.deliver && !b.done) {
      const have = Game.Inventory.count(b.deliver);
      if (have >= b.need) {
        Game.Inventory.remove(b.deliver, b.need);
        b.done = true; // done経路と同じ報酬フローへ落とす
      } else {
        Game.UI.toast('納品依頼: ' + b.targetName + ' ' + have + '/' + b.need + '　集めて掲示板へ(報酬 ' + rewardText(b) + ')');
        return;
      }
    }
    if (b && b.done) {
      Game.Inventory.add('gold_bar', b.rewardGold);
      if (b.rewardItem) Game.Inventory.add(b.rewardItem.id, b.rewardItem.count);
      Game.UI.toast('★ 賞金を受け取った — ' + rewardText(b));
      Game.Audio.play('bounty_done');
      if (Game.Render.spawnFloat) { const p = Game.state.player; Game.Render.spawnFloat(p.x, p.y - 18, '賞金 +' + b.rewardGold, '#e8c54a', true); }
      Game.state.bountyDone = (Game.state.bountyDone || 0) + 1; if (Game.state.bountyDone >= 10 && Game.Achievements) Game.Achievements.unlock('bounty_veteran');
      if (Game.state.bountyDone === 1 && Game.Story) Game.Story.unlock('bounty', true); // 初討伐で記憶回廊「手配書の風」
      if (Game.Save) Game.Save.autosave('bounty'); // 賞金達成で自動保存
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
