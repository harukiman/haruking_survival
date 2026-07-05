// survival.js — HP/空腹・回復/餓死・ダメージ・死亡/リスポーン
window.Game = window.Game || {};

Game.Survival = (function () {
  // 警戒/快調フィードバックの再武装フラグ(セッション内。初回は盛大・以降は控えめ)
  let stamWarned = false, stamCued = false;
  let sanWarn1 = false, sanWarn2 = false, sanCued = false;
  let wasWellfed = false, wellfedToasted = false;
  let hungerCritCued = false;

  function update() {
    // 低HPの心拍音: HP25%未満で約1.6秒毎にドクン(設定 lowHpWarn がOFFなら鳴らさない)
    if (Game.state.tick % 48 === 0) {
      const php = Game.state.player;
      if (php.health > 0 && php.health < php.maxHealth * 0.25 && (!Game.Settings || Game.Settings.get('lowHpWarn') !== false)) Game.Audio.play('heartbeat');
    }
    // 焚き火の癒し: 焚き火/火鉢のそばで戦闘外(被弾後5秒以上)なら2秒毎にHP+1(上限は最大HPの80%)。
    // 「夜は火のそばで休む」というサバイバルの原風景に小さな実利を(世界反応性)
    if (Game.state.tick % 60 === 0) {
      const pp = Game.state.player;
      const outOfCombat = (Game.state.tick - (pp.lastHurtTick || 0)) > 150;
      if (outOfCombat && pp.health < pp.maxHealth * 0.8 && nearCampfire()) {
        pp.health = Math.min(pp.maxHealth * 0.8, pp.health + 1);
        if (Game.Render.spawnFloat && Game.state.tick % 120 === 0) Game.Render.spawnFloat(pp.x, pp.y - 22, '+1', '#9fd0a0');
        if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('campfire_heal', '🔥 焚き火のそばで休むとHPがゆっくり回復する(最大HPの80%まで・戦闘中は不可)');
      }
    }
    const p = Game.state.player;

    // 協力: ダウン&蘇生。致死ダメージで即死せず、仲間の救助を待つ状態(MP+仲間在席時のみ・die()から遷移)
    if (p.downed > 0) {
      p.downed--; p.health = Math.max(1, p.health);
      const TS = Game.CFG.TILE_SIZE, now = Date.now();
      let reviver = false;
      if (Game.Net && Game.Net.getPeers) { const peers = Game.Net.getPeers();
        for (const id in peers) { const pe = peers[id]; if (!pe || pe.tx == null) continue; if (pe.world && pe.world !== Game.state.worldName) continue; if (pe.lastSeen && now - pe.lastSeen > 8000) continue; if (Math.hypot(pe.tx - p.x, pe.ty - p.y) <= 3 * TS) { reviver = true; break; } }
      }
      if (reviver) {
        p.reviveT = (p.reviveT || 0) + 1;
        if (Game.state.tick % 6 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y - 8, '#8fe0a0', 2);
        if (p.reviveT >= 90) { // 3秒寄り添えば蘇生(HP半分)
          p.downed = 0; p.reviveT = 0; p.health = Math.round(p.maxHealth * 0.5); p.invuln = 60;
          if (Game.UI && Game.UI.toast) Game.UI.toast('✚ 仲間に助け起こされた！');
          if (Game.Audio) Game.Audio.play('levelup');
          Game.UI.refreshStats();
          return;
        }
      } else { p.reviveT = Math.max(0, (p.reviveT || 0) - 2); }
      if (p.downed <= 0) { p._bleedout = true; p.health = 0; die(); } // 時間切れ=本当の死へ
      Game.UI.refreshStats();
      return; // ダウン中は他の生存処理を止める
    }

    // 低HP警告音（鼓動・設定 lowHpWarn 尊重・play内で1.1sスロットル）
    if (p.health > 0 && p.health < p.maxHealth * 0.22 && Game.state.tick % 15 === 0 &&
        !(Game.Settings && Game.Settings.get('lowHpWarn') === false)) {
      Game.Audio.play('lowhp');
    }

    // 空腹減少（移動/採掘でやや速く）
    p.hungerTimer++;
    const moving = Game.Input.intent.dx !== 0 || Game.Input.intent.dy !== 0 || Game.Player.mining.active;
    let drainEvery = moving ? 110 : 170;
    const hs = Math.min(0.8, Game.Player.setBonus().hungerSlow + Game.Player.skillBonus().hungerSlow);
    if (hs) drainEvery = Math.round(drainEvery / (1 - hs)); // 革セットで空腹緩やか
    if (p.hungerTimer >= drainEvery) {
      p.hungerTimer = 0;
      if (p.hunger > 0) { p.hunger--; Game.UI.refreshStats(); }
    }
    // 空腹の危機警告(段階式・回復で再武装)。餓死前に必ず気づける
    if (p.hunger <= 20 && !p._hungerWarned) { p._hungerWarned = true; Game.UI.toast('🍖 お腹が空いた… 何か食べないと餓死する！'); if (Game.Audio) Game.Audio.play('lowhp'); }
    else if (p.hunger > 35 && p._hungerWarned) { p._hungerWarned = false; }
    if (p.hunger <= 8 && !p._hungerCrit) {
      p._hungerCrit = true;
      Game.UI.toast('🍖 餓死寸前だ！ 今すぐ何か口にしろ！');
      if (Game.Audio) Game.Audio.play('lowhp');
      if (!hungerCritCued) { hungerCritCued = true; if (Game.Render && Game.Render.flash) Game.Render.flash('rgba(200,120,30,0.22)'); }
    } else if (p.hunger > 25 && p._hungerCrit) { p._hungerCrit = false; }

    // スタミナ切れの気づき(初回は音付き・以降はトーストのみ。回復で再武装)
    if (p.stamina <= 10 && !stamWarned) {
      stamWarned = true;
      Game.UI.toast('💨 息が切れた… 少し歩みを緩めて呼吸を整えよう');
      if (!stamCued && Game.Audio) { stamCued = true; Game.Audio.play('lowhp'); }
    } else if (p.stamina > 45 && stamWarned) { stamWarned = false; }

    // 満腹(wellfed)になった瞬間の快調フィードバック(初回は盛大・以降は控えめな輝きのみ)
    const wfNow = !!(Game.Status && Game.Status.has('wellfed'));
    if (wfNow && !wasWellfed) {
      if (!wellfedToasted) {
        wellfedToasted = true;
        Game.UI.toast('🍗 満腹だ — 身体が温まり、傷の治りも早くなる');
        if (Game.Audio && Game.Audio.cue) Game.Audio.cue('shimmer');
      } else if (Game.Render && Game.Render.spawnParticles) {
        Game.Render.spawnParticles(p.x, p.y - 8, '#e0b04a', 5);
      }
    }
    wasWellfed = wfNow;

    // 回復 or 餓死
    p.regenTimer++;
    if (p.regenTimer >= 60) {
      p.regenTimer = 0;
      const wf = Game.Status && Game.Status.has('wellfed');
      const totem = nearHealTotem();
      const regenSkill = Game.Player.skillBonus().regen + (Game.Status ? Game.Status.buffSum().regen : 0) + (p.gearRegen || 0);
      if (regenSkill > 0 && p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + regenSkill); // スキル不屈＋再生の薬＋装備affix
      // 協力: 仲間の近く(8タイル)に居ると「連携」で士気が上がる。HP回復＋戦闘ボーナス(共闘の動機付け)
      let coopNear = false;
      if (Game.Net && Game.Net.isConnected && Game.Net.isConnected() && Game.Net.getPeers) {
        const peers = Game.Net.getPeers(), TS = Game.CFG.TILE_SIZE, now = Date.now();
        for (const id in peers) { const pe = peers[id]; if (!pe || pe.tx == null) continue; if (pe.world && pe.world !== Game.state.worldName) continue; if (pe.lastSeen && now - pe.lastSeen > 8000) continue; if (Math.hypot(pe.tx - p.x, pe.ty - p.y) <= 8 * TS) { coopNear = true; break; } }
        if (coopNear && p.health < p.maxHealth) { p.health = Math.min(p.maxHealth, p.health + 2); Game.Render.spawnParticles(p.x, p.y - 6, '#7fd0ff', 1); }
      }
      if (coopNear && !p.coopNear && Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('coop', '連携！ 仲間の近く(8マス)で戦うと攻撃力+2・会心+5%・HP微回復。はぐれず共闘しよう');
      p.coopNear = coopNear; // effAttack/会心率で参照する連携バフ(ソロでは常にfalse=無影響)
      if (totem && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + 3); // 癒しの祭壇
        Game.Render.spawnParticles(p.x, p.y - 6, '#7fd0a0', 1);
        Game.UI.refreshStats();
      } else if ((p.hunger > 70 || (wf && p.hunger > 40) || (p.stamina >= 70 && p.hunger > 0)) && p.health < p.maxHealth) {
        // 満腹 or スタミナが十分(=休息)なら HP 徐々に回復
        p.health = Math.min(p.maxHealth, p.health + (wf ? 2 : 1));
        Game.UI.refreshStats();
      } else if (p.hunger <= 0 && p.health > 0) {
        damage(1, 'starve');
      }
    }

    // 正気度（影世界で減少・光の護符/光源で緩和、光世界で回復）
    const T = Game.TUNE;
    if (Game.state.worldName === 'shadow') {
      let drain = T.SANITY_DRAIN * (1 + (Game.state.ngLevel || 0) * T.NG_SANITY_PER);
      if (Game.World.inDepths()) drain *= 2;     // 深層は正気消費2倍
      let immune = false;
      let sanityResist = false;
      for (const k in p.armor) {
        const a = p.armor[k]; if (!a) continue;
        const def = Game.ITEMS[a.id || a];
        if (!def) continue;
        if (def.immuneSanity) immune = true;
        else if (def.lumen) drain *= 0.4;
        if (a.roll && Game.Loot && Game.Loot.stats(a).sanityResist) sanityResist = true;
      }
      if (Game.Player.setBonus().sanityResist) sanityResist = true; // 影鋼セット
      if (Game.Player.skillFlag('sanityResist')) sanityResist = true; // スキル: 精神統一
      if (sanityResist) drain *= 0.5;
      if (immune) drain = 0;
      if (nearLight()) drain *= 0.3;
      // 深層突入のフィードバック
      const deep = Game.World.inDepths();
      if (deep !== Game.state.wasDeep) {
        if (deep) Game.UI.toast('影の深層へ踏み込んだ… 危険だが、闇は深いほど豊かだ');
        Game.state.wasDeep = deep;
        Game.UI.refreshWorld();
      }
      Game.state.sanity = Math.max(0, Game.state.sanity - drain);
      // 正気の警告(段階式・初回のみ音とフラッシュ付き。40超で再武装)
      const sn = Game.state.sanity;
      if (sn < 30 && !sanWarn1) {
        sanWarn1 = true;
        Game.UI.toast('🧠 正気が揺らいでいる… 光のそばで心を鎮めよう');
        if (!sanCued) { sanCued = true; if (Game.Audio) Game.Audio.play('lowhp'); if (Game.Render && Game.Render.flash) Game.Render.flash('rgba(120,60,180,0.16)'); }
      }
      if (sn < 12 && !sanWarn2) {
        sanWarn2 = true;
        Game.UI.toast('👁 闇が囁いている… 今すぐ光を！ 正気が尽きれば命が削れる');
        if (Game.Audio) Game.Audio.play('lowhp');
        if (Game.Render && Game.Render.flash) Game.Render.flash('rgba(110,40,170,0.26)');
      }
      if (sn > 40) { sanWarn1 = false; sanWarn2 = false; }
      if (Game.state.sanity < 10 && Game.Achievements) Game.Achievements.unlock('deep_sanity');
      const diff = Game.DIFFICULTIES[Game.state.difficulty] || Game.DIFFICULTIES.normal;
      if (diff.sanityKill && Game.state.sanity <= 0 && p.health > 0 && Game.state.tick % 50 === 0) damage(2, 'sanity');
    } else if (Game.state.sanity < T.SANITY_MAX) {
      Game.state.sanity = Math.min(T.SANITY_MAX, Game.state.sanity + 0.06);
    }
    // 状態異常・腐敗
    Game.Status.update();
    if (Game.state.tick % 600 === 0) spoilFood();
    if (Game.state.tick % 15 === 0) Game.UI.refreshStats();
  }

  // 生肉などが時間で腐る（グロ）
  function spoilFood() {
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) {
      const sl = s[i]; if (!sl) continue;
      const def = Game.ITEMS[sl.id];
      if (def && def.spoils && Math.random() < Game.TUNE.SPOIL_CHANCE) {
        sl.count--; if (sl.count <= 0) s[i] = null;
        Game.Inventory.add('rotten_meat', 1);
      }
    }
  }

  function nearHealTotem() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const o = Game.World.objAt(ptx + dx, pty + dy);
      if (o === Game.OBJ.HEALING_TOTEM || o === Game.OBJ.FOUNTAIN) return true; // 噴水も癒しの水辺
    }
    return false;
  }

  // 焚き火/火鉢の近く(3マス)か: 焚き火の癒し(HP緩回復)判定
  function nearCampfire() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const o = Game.World.objAt(ptx + dx, pty + dy);
      if (o === Game.OBJ.CAMPFIRE || o === Game.OBJ.BRAZIER) return true;
    }
    return false;
  }

  function nearLight() {
    const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (Game.LIGHT_LEVEL[Game.World.objAt(ptx + dx, pty + dy)]) return true;
    }
    return false;
  }

  function eat(amount) {
    const p = Game.state.player;
    p.hunger = Math.min(p.maxHunger, p.hunger + amount);
    Game.UI.refreshStats();
  }

  function damage(amount, source) {
    const p = Game.state.player;
    if (p.downed > 0) return false; // ダウン中は無敵(ブリードアウトのみ・救助を待つ)
    const physical = source !== 'starve' && source !== 'sanity' && source !== 'status';
    // 環境DoT(死の灰/寒さ/砂嵐/落雷/溺れ)は無敵時間を貫通し、毎秒確実に蝕む
    const envDot = source === 'fallout' || source === 'cold' || source === 'sand' || source === 'storm' || source === 'drown';
    // 乗り物搭乗中の被ダメは機体の耐久が大半を肩代わりするが、25%は搭乗者へ貫通する
    // (完全無敵だと地上戦が無意味化するため。装甲の中でも衝撃は伝わる)
    if (physical && source !== 'wreck' && p.vehicle && Game.Player.vehicleTakeDamage) {
      if (Game.Player.vehicleTakeDamage(amount)) {
        const bleed = Math.floor(amount * 0.25);
        if (bleed <= 0) return true;
        if (Game.UI && Game.UI.tipOnce) Game.UI.tipOnce('veh_bleed', '搭乗中も被ダメージの一部(25%)は搭乗者に貫通します。機体の装甲を過信しないこと');
        amount = bleed; // 残り25%を通常の被ダメ処理(無敵/防御)へ流す
      }
    }
    if (p.invuln > 0 && physical && !envDot) {
      // ジャスト回避: ロール無敵中に攻撃を受け流したら報酬(1ロール1回)
      if ((p.rolling || 0) > 0 && !p.rollRewarded) {
        p.rollRewarded = true;
        p.stamina = Math.min(p.maxStamina, p.stamina + 10); // スタミナ還元
        if (p.maxMp) p.mp = Math.min(p.maxMp, (p.mp || 0) + 8); // マナも少し還元
        // ジャスト回避の"手応え": 短いスローモー(敵を一瞬止める)＋フラッシュで読み合いを称揚
        Game.state.mobFreeze = Math.max(Game.state.mobFreeze || 0, 9);
        Game.state.hitstop = Math.max(Game.state.hitstop || 0, 3);
        if (Game.Render.flash) Game.Render.flash('rgba(140,220,255,0.14)');
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 24, 'JUST!', '#7fe0ff', true);
        if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#bfe8ff', 12);
        Game.Audio.play('dodge_just');
        // 反撃の好機: 1.5秒以内の近接攻撃が確定強打(×1.75+ふきとばし)。回避→反撃の読み合いを完成させる
        p.counterT = 90;
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 40, '反撃の好機!', '#ffd76a', true);
      }
      return false; // ブロック: 呼び出し側は状態異常/被弾演出も抑止すること
    }
    // 防具で軽減（飢餓・正気崩壊は無視）
    if (physical && !envDot) {
      const armor = Game.Player.totalArmor();
      amount = Math.max(1, amount - armor);
      // 装備耐久: 被弾で装備中の防具が消耗。0で「破損」(防御大幅低下・修理で復活)
      if (p.armor && Game.Loot.degrade) {
        for (const sl in p.armor) { const piece = p.armor[sl]; if (piece && Game.Loot.degrade(piece, 1) && Game.UI) Game.UI.toast('⚠ ' + Game.Loot.displayName(piece) + ' が破損した！ 修理を'); }
      }
    }
    p.health -= amount;
    p.deathCause = source; // 死因追跡（直近のダメージ源）
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 16, '-' + amount, '#ff6a6a');
    if (physical && !envDot) { p.invuln = 30; }
    if (physical) { Game.Audio.play('hurt'); if (Game.Render.hurtFlash) Game.Render.hurtFlash(); if (Game.Render.shake && amount >= 6) Game.Render.shake(Math.min(9, 3 + amount * 0.4)); }
    if (Game.UI.shakeHealthBar) Game.UI.shakeHealthBar(); // HPバーを揺らして被弾を明確に
    if (p.health <= 0) { p.health = 0; die(); }
    Game.UI.refreshStats();
    return true; // ダメージ成立
  }

  const CAUSE_LABEL = { starve: '餓死', sanity: '正気の崩壊', status: '状態異常', thorns: '棘の反射', mob: '魔物の襲撃', cold: '凍死', sand: '砂嵐', storm: '落雷', drown: '溺死', wreck: '乗り物の爆発', nuke: '戦術核の直撃', fallout: '死の灰', blast: '爆発に巻き込まれた' };
  // 死亡時にバーツを守る手段(守銭の護符)を所持/装備しているか
  function hasBtsGuard() {
    const p = Game.state.player;
    const ID = Game.ITEMS;
    if (p.accessory && ID[p.accessory.id] && ID[p.accessory.id].keepBts) return true;
    if (p.accessory2 && ID[p.accessory2.id] && ID[p.accessory2.id].keepBts) return true;
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) { if (s[i] && ID[s[i].id] && ID[s[i].id].keepBts) return true; }
    return false;
  }

  function die() {
    const p = Game.state.player;
    // 協力: MPで在席中の仲間が居れば、即死せず「ダウン」へ(救助待ち)。ソロ/仲間不在は従来通り即死。
    if (!p._bleedout && !p.downed && Game.Net && Game.Net.isConnected && Game.Net.isConnected() && Game.Net.getPeers) {
      const peers = Game.Net.getPeers(), now = Date.now(); let hasPeer = false;
      for (const id in peers) { const pe = peers[id]; if (!pe) continue; if (pe.world && pe.world !== Game.state.worldName) continue; if (pe.lastSeen && now - pe.lastSeen > 8000) continue; hasPeer = true; break; }
      if (hasPeer) {
        p.downed = 450; p.downedMax = 450; p.reviveT = 0; p.health = 1; p.invuln = 30; // 15秒のブリードアウト
        if (Game.UI && Game.UI.toast) Game.UI.toast('⛑ ダウン！ 仲間が近づけば助け起こしてくれる…(15秒)');
        if (Game.Audio) Game.Audio.play('lowhp');
        Game.UI.refreshStats();
        return;
      }
    }
    p._bleedout = false;
    if (Game.state.deathPending) return; // 二重発火防止
    Game.state.deathPending = true;
    if (Game.Save) Game.Save.autosave('force'); // 死亡時セーブ(進行を保全。autosave内でゲスト判定)
    // 死亡サマリーを表示してから復活（マルチ参加中は簡略に即復活）
    if (Game.UI && Game.UI.showDeath && !(Game.Net && Game.Net.isConnected())) {
      const best = Game.state.bestiary || {};
      let kills = 0; for (const k in best) kills += best[k];
      const survTicks = Game.state.tick - (p.lifeStart || 0);
      const dl = Game.DAY_LENGTH || 3600;
      const projLost = Math.floor(p.level / 3), projAfter = Math.max(1, p.level - projLost); // 復活後レベル(respawnと同式)
      const summary = {
        cause: CAUSE_LABEL[p.deathCause] || p.deathCause || '不明',
        level: p.level,
        levelAfter: projAfter, levelLost: projLost,
        days: Math.max(0, Math.floor(survTicks / dl)),
        mins: Math.max(0, Math.floor(survTicks / 30 / 60)),
        bosses: Game.Player.bossesDefeated ? Game.Player.bossesDefeated() : 0,
        kills: kills,
        gold: Game.Inventory.count('gold_bar'),
      };
      Game.state.paused = true;
      Game.Audio.play('hurt');
      Game.UI.showDeath(summary);
      return;
    }
    respawn();
  }

  function respawn() {
    Game.state.deathPending = false;
    Game.state.paused = false;
    const p = Game.state.player;
    p.downed = 0; p.reviveT = 0; p._bleedout = false; // ダウン状態をリセット
    // 乗車/攻撃の一時状態もリセット(乗ったまま復活・復活直後に前の掃射/詠唱が継続するのを防ぐ)
    p.vehicle = null; p.vThr = 0; p.missileSalvo = null; p.jetBurst = 0; p.casting = null; p.knockVX = 0; p.knockVY = 0;
    if (Game.Audio && Game.Audio.vehicleLoop) Game.Audio.vehicleLoop(null);
    p.lifeStart = Game.state.tick;
    const btsGuarded = hasBtsGuard(); // ドロップ前に判定(護符が落ちても今回の死は守られる)
    Game.UI.toast('力尽きた…リスポーンします');
    // 所持品の一部をその場にドロップ（守銭の護符など keepBts 品は落とさない）
    const TS = Game.CFG.TILE_SIZE;
    const s = Game.Inventory.slots();
    for (let i = 0; i < s.length; i++) {
      if (s[i] && !(Game.ITEMS[s[i].id] && Game.ITEMS[s[i].id].keepBts) && Math.random() < 0.5) {
        Game.state.drops.push({ id: s[i].id, count: s[i].count, roll: s[i].roll || null, x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30 });
        s[i] = null;
      }
    }
    // 死亡地点を記録: 落としたアイテムの回収導線(大マップに💀表示、接近で消える)
    Game.state.deathSpot = { x: p.x, y: p.y, world: Game.state.worldName, t: Game.state.tick };
    if (Game.Status) Game.Status.clearAll();
    // レベルは完全リセットせず 1/3 を失う（経験値ペナルティ）
    const lost = Math.floor(p.level / 3);
    if (lost > 0) {
      p.level = Math.max(1, p.level - lost);
      p.baseMaxHealth = 100 + (p.level - 1) * 2;
      p.xp = 0; p.xpNext = Game.Player.xpForLevel(p.level);
      Game.Player.applyEquipStats();
      Game.UI.toast('力尽きた… レベルが ' + lost + ' 失われた（Lv.' + p.level + '）');
    }
    // バーツ(通貨): 死亡で半分を失う。守銭の護符を持っていれば失わない
    if ((p.bts || 0) > 0) {
      if (btsGuarded) {
        Game.UI.toast('守銭の護符が輝いた — バーツ ' + p.bts + ' bts は失われない');
      } else {
        const before = p.bts; p.bts = Math.floor(p.bts / 2);
        Game.UI.toast('バーツを落とした… ' + before + ' → ' + p.bts + ' bts');
      }
    }
    p.health = p.maxHealth; p.hunger = Math.max(40, p.hunger);
    p.invuln = 60;
    // 協力: MPで同じ世界に生存中の仲間が居れば、その傍らに復活してはぐれない
    let spawnTx = Game.state.spawn.tx, spawnTy = Game.state.spawn.ty, atAlly = false;
    if (Game.Net && Game.Net.isConnected && Game.Net.isConnected() && Game.Net.getPeers) {
      const peers = Game.Net.getPeers(), TS = Game.CFG.TILE_SIZE, now = Date.now();
      let best = null;
      for (const id in peers) { const pe = peers[id]; if (!pe || pe.tx == null) continue; if (pe.world && pe.world !== Game.state.worldName) continue; if (pe.lastSeen && now - pe.lastSeen > 8000) continue; best = pe; break; }
      if (best) { spawnTx = Math.floor(best.tx / TS) + 1; spawnTy = Math.floor(best.ty / TS); atAlly = true; }
    }
    Game.Player.spawnAt(spawnTx, spawnTy);
    if (atAlly) Game.UI.toast('仲間のもとへ駆けつけた');
    Game.UI.refreshAll();
    // はじめて斃れ再び立ち上がったとき、記憶回廊「名もなき者」を解放
    if (Game.Story && !Game.Story.seen('traveler')) Game.Story.unlock('traveler', true);
  }

  return { update, eat, damage, die, respawn, nearLight };
})();
