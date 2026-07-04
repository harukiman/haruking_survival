// player.js — 状態・移動・衝突・採掘/設置・対話・戦闘・装備・成長
window.Game = window.Game || {};

Game.Player = (function () {
  const TS = Game.CFG.TILE_SIZE;
  const R = 11; // 当たり判定半径(px)

  const mining = { active: false, tx: 0, ty: 0, obj: 0, progress: 0 };

  // 乗り物の加速/減速カーブ(最高速は従来と同一・立ち上がりと惰性だけを付与。バランス不変)
  const VEH_ACCEL = { car: 0.085, buggy: 0.10, boat: 0.055, plane: 0.05, carpet: 0.075, tank: 0.045, mech: 0.08, jet: 0.06, bomber: 0.045 };
  const VEH_DRAG = { car: 0.85, buggy: 0.83, boat: 0.93, plane: 0.9, carpet: 0.88, tank: 0.9, mech: 0.86, jet: 0.92, bomber: 0.9 };
  const VEH_TRAIL = { car: '#c9b189', buggy: '#d8a060', boat: '#bfe2f5', plane: '#e6ecf5', carpet: '#e0bcf0', tank: '#5a5a44', mech: '#8a94a6', jet: '#dfe8f4', bomber: '#c8cebe' };
  const FUEL_VEHICLES = { car: 1, buggy: 1, plane: 1, tank: 1, mech: 1, jet: 1, bomber: 1 }; // 燃料で走る現代の乗り物(ボート/絨毯は燃料不要)
  const VEH_MAXDUR = { car: 120, buggy: 90, plane: 140, boat: 70, tank: 240, mech: 180, jet: 130, bomber: 160 }; // 耐久値(絨毯=魔法は不壊)。0で大破爆発
  // 口径ごとの着弾スパーク色/薬莢色(演出のみ・性能不変)
  const CALIBER_FX = {
    ammo_9mm: { imp: '#ffd86a', casing: '#d8b25a' },
    ammo_556: { imp: '#cfe8ff', casing: '#c9b45a' },
    ammo_762: { imp: '#ffb060', casing: '#b58a3c' },
    shell_12g: { imp: '#ff9a6a', casing: '#c04a3a' },
    ammo_50: { imp: '#ffffff', casing: '#a88a50' },
    bullet: { imp: '#ffd86a', casing: '#d8b25a' },
  };

  function makeDefault() {
    return {
      x: 0, y: 0, prevX: 0, prevY: 0,
      dir: 'down', speed: 2.4,
      health: 100, maxHealth: 100,
      hunger: 100, maxHunger: 100,
      hungerTimer: 0, regenTimer: 0,
      invuln: 0, hotbarIndex: 0,
      attackCd: 0,
      reloadCd: 0, reloadInfo: null, mags: {}, // 銃のマガジン(装填弾数)管理
      xp: 0, level: 1, xpNext: 24, invSlots: 45, bts: 0,
      baseMaxHealth: 100,
      stamina: 100, maxStamina: 100,
      mp: 100, maxMp: 100, // マナ(杖/魔法系の消費資源)
      breath: 360, maxBreath: 360, // 遊泳の呼吸ゲージ(12秒)
      vehicle: null, // null|'car'|'boat'|'plane'|'buggy'
      fuel: {}, // 現代乗り物の燃料(type→残量)
      vehGuns: {}, // 航空機に増設した機関銃の基数(type→0..4)
      armor: { head: null, chest: null }, // {id, roll} インスタンス
      accessory: null, accessory2: null, // 遺物(relic) {id} ×2枠
      offhand: null, // 左手スロット(盾/呼吸器などユーティリティ装備を保持して常時機能)
      // RPGステータス（スキルポイントで振る）
      str: 0, vit: 0, dex: 0, skillPoints: 0, skills: {},
    };
  }

  function spawnAt(tx, ty) {
    const p = Game.state.player;
    p.x = tx * TS + TS / 2; p.y = ty * TS + TS / 2;
    p.prevX = p.x; p.prevY = p.y;
  }

  function blocked(wx, wy) {
    const v = Game.state.player.vehicle;
    if (v === 'plane' || v === 'carpet' || v === 'jet' || v === 'bomber') return false; // 飛行機・戦闘機・爆撃機・絨毯は全障害を越える
    const pts = [[wx - R, wy - R], [wx + R, wy - R], [wx - R, wy + R], [wx + R, wy + R]];
    for (let i = 0; i < pts.length; i++) {
      const tx = Math.floor(pts[i][0] / TS), ty = Math.floor(pts[i][1] / TS);
      if (Game.World.isWalkable(tx, ty)) continue;
      // ボートは水上を進める
      if (v === 'boat') { const g = Game.World.groundAt(tx, ty); if (g === Game.TILE.WATER || g === Game.TILE.DEEP_WATER) continue; }
      // 徒歩は深水を遊泳できる(呼吸ゲージで制限=長距離横断は不可、外洋の島や海底ダンジョンには船が要る)
      else if (!v) { const g = Game.World.groundAt(tx, ty); if (g === Game.TILE.DEEP_WATER) continue; }
      return true;
    }
    return false;
  }

  // ===== パッシブスキル(自動発動): Survival.damage を一度だけラップして被弾トリガーを得る =====
  // (script読込順で player.js が先のため、初回updateで遅延フック。survival.js自体は不変更)
  let passiveHooked = false;
  function ensurePassiveHooks() {
    if (passiveHooked || !Game.Survival || !Game.Survival.damage) return;
    passiveHooked = true;
    const origDamage = Game.Survival.damage;
    Game.Survival.damage = function (amount, source) {
      const p = Game.state.player;
      const physical = source !== 'starve' && source !== 'sanity' && source !== 'status';
      // 執念: 致死ダメージを1度だけHP1で耐える(CD3分・セッション毎)
      if (p && p.health > 0 && !(physical && p.invuln > 0) && skillFlag('tenacity') && (p.tenacityCd || 0) <= Game.state.tick) {
        const eff = physical ? Math.max(1, amount - totalArmor()) : amount;
        if (eff >= p.health) {
          p.health = eff + 1; // 直後の減算で HP1 が残る
          p.tenacityCd = Game.state.tick + 5400;
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 30, '執念!', '#ffd86b', true);
          if (Game.Render.flash) Game.Render.flash('rgba(255,216,107,0.22)');
          Game.Render.spawnParticles(p.x, p.y, '#ffd86b', 14);
          Game.Audio.play('relic_get');
          Game.UI.toast('執念 — 致死の一撃をHP1で耐えた！');
        }
      }
      const r = origDamage(amount, source);
      if (r !== false && p) {
        p.lastHurtTick = Game.state.tick;
        if (p.focusArmed) { p.focusArmed = false; if (Game.UI.refreshStats) Game.UI.refreshStats(); } // 被弾で集中は途切れる
        // 逆襲: HP30%未満で被弾時、周囲に衝撃波(CD30秒)。ホスト/ソロのみ
        if (physical && p.health > 0 && p.health < p.maxHealth * 0.3 && skillFlag('counter')
          && (p.counterCd || 0) <= Game.state.tick && !(Game.Net.isConnected() && !Game.Net.host)) {
          p.counterCd = Game.state.tick + 900;
          const cd2 = Math.max(4, Math.round(currentWeaponAtk() * 0.6));
          const mobs = Game.state.mobs;
          for (let i = 0; i < mobs.length; i++) {
            const m = mobs[i];
            if (m.def.friendly || m.def.npc || m.hp <= 0) continue;
            if (Math.hypot(m.x - p.x, m.y - p.y) <= 2.2 * TS) Game.Mobs.damageMob(m, cd2, p.x, p.y, false);
          }
          if (Game.Render.spawnImpact) Game.Render.spawnImpact(p.x, p.y, '#9fd8ff');
          Game.Render.spawnParticles(p.x, p.y, '#9fd8ff', 12);
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 26, '逆襲!', '#9fd8ff', !p.counterSeen);
          p.counterSeen = 1;
          Game.Render.shake(5);
          Game.Audio.play('boom_sfx');
        }
      }
      return r;
    };
  }

  // パッシブ(集中/追い風)と残光追撃キューの毎tick処理
  function updatePassives(p) {
    // 残光(echo)追撃: combat.js が積んだ遅延ヒットを消化
    if (p.echoQ && p.echoQ.length) {
      for (let i = p.echoQ.length - 1; i >= 0; i--) {
        const e = p.echoQ[i];
        if (Game.state.tick < e.t) continue;
        p.echoQ.splice(i, 1);
        const m = e.m;
        if (m && m.hp > 0 && Game.state.mobs.indexOf(m) >= 0) {
          Game.Render.spawnSlash(m.x, m.y, p.dir, e.color || '#ffe9f0');
          Game.Render.spawnParticles(m.x, m.y, e.color || '#ffe9f0', 4);
          Game.Audio.play('slash_air');
          Game.Mobs.damageMob(m, e.d, p.x, p.y, false);
        }
      }
    }
    // 追い風: 敵撃破(図鑑カウント増加)で3秒 移動+8%。スタックせずタイマー更新のみ
    if ((p.tailwindT || 0) > 0) p.tailwindT--;
    if (skillFlag('tailwind')) {
      const bs = Game.state.bestiary || {};
      let tot = 0; for (const k in bs) tot += bs[k];
      if (p.killBase == null) p.killBase = tot;
      if (tot > p.killBase) {
        p.killBase = tot;
        const fresh = (p.tailwindT || 0) <= 0;
        p.tailwindT = 90;
        if (fresh) { // 発動の瞬間のみ表示(更新時は無演出=スパム防止)
          if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 24, '追い風', '#7fe0a0');
          Game.Render.spawnParticles(p.x, p.y, '#7fe0a0', 5);
        }
      }
    } else p.killBase = null;
    // 集中: 10秒(300tick)無被弾で次の一撃が会心確定。武装完了の瞬間だけ知らせる
    if (skillFlag('focus')) {
      const idleFrom = Math.max(p.lastHurtTick || 0, p.focusUse || 0);
      const armed = Game.state.tick - idleFrom >= 300;
      if (armed && !p.focusArmed) {
        p.focusArmed = true;
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 24, '集中', '#7fe0ff');
        Game.Render.spawnParticles(p.x, p.y, '#7fe0ff', 5);
        Game.Audio.play('select');
      }
    } else p.focusArmed = false;
  }
  function focusArmed() { return !!Game.state.player.focusArmed; }
  function consumeFocus() {
    const p = Game.state.player;
    p.focusArmed = false; p.focusUse = Game.state.tick;
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 30, '集中一閃!', '#7fe0ff', true);
  }

  function update(intent) {
    const p = Game.state.player;
    ensurePassiveHooks();
    updatePassives(p);
    if (Game.state.vehWreck) updateWreck(); // 大破カウントダウン→爆発
    if (p.cannonCd > 0) p.cannonCd--; // 戦車主砲のクールダウン
    p.prevX = p.x; p.prevY = p.y;

    let dx = intent.dx, dy = intent.dy;
    let len = Math.hypot(dx, dy);
    // 隕石詠唱: その場に停止して無敵で詠唱、完了で巨大隕石。動くと中断
    if (p.casting) {
      if (len > 0.05 || (p.health <= 0)) { // 移動入力 or 死亡で中断
        Game.UI.toast('詠唱が中断された'); if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 24, '中断', '#8fa0b0');
        p.casting = null;
      } else {
        dx = 0; dy = 0; len = 0;                       // その場停止
        p.invuln = Math.max(p.invuln || 0, 8);         // 詠唱中は無敵
        const c = p.casting, now = Game.state.tick;
        const prog = 1 - Math.max(0, (c.until - now) / c.dur);
        // 詠唱演出: 対象地点に集束する光と、足元の魔法陣
        if (now % 6 === 0 && Game.Render.spawnParticles) { Game.Render.spawnParticles(c.tx + (Math.random() - 0.5) * 60, c.ty - 40 - Math.random() * 40, '#ffb24a', 2); Game.Render.spawnParticles(p.x, p.y, '#ffd88a', 2); }
        if (now % 30 === 0 && Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 26, '詠唱 ' + Math.round(prog * 100) + '%', '#ffb24a');
        if (Game.Render.markMeteorTarget) Game.Render.markMeteorTarget(c.tx, c.ty, c.radius, prog);
        if (now >= c.until) {
          Game.Projectiles.callMeteor(c.tx, c.ty, c.dmg, c.radius);
          if (Game.Render.flash) Game.Render.flash('rgba(255,180,90,0.3)'); if (Game.Render.shake) Game.Render.shake(12);
          Game.Audio.play('boom_sfx');
          p.casting = null;
        }
      }
    }
    // 就寝中に動いたら目を覚ます(MP: 全員就寝待ちから離脱)
    if (p.sleeping && len > 0.05) { p.sleeping = false; }
    // MP: 同じ世界の全員が就寝したら朝へ
    if (p.sleeping) checkGroupSleep();
    // ダッシュ（スタミナ消費）
    const moving = len > 0;
    const dashing = intent.dash && moving && p.stamina > 0;
    // 回避ロール: 専用入力で短距離の素早い回避＋無敵フレーム
    if (p.rollCd > 0) p.rollCd--;
    if (intent.roll && (p.rollCd || 0) <= 0 && (p.rolling || 0) <= 0 && p.stamina >= 20 && !p.vehicle) {
      let rx = dx, ry = dy;
      if (len < 0.01) { rx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0; ry = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0; }
      const rl = Math.hypot(rx, ry) || 1; p.rollDX = rx / rl; p.rollDY = ry / rl;
      p.rolling = 12; p.rollCd = 45; p.invuln = Math.max(p.invuln || 0, 18); p.stamina = Math.max(0, p.stamina - 20); p.rollRewarded = false;
      Game.Audio.play('dash');
      Game.Render.spawnParticles(p.x, p.y, '#ffffff', 6); // ロール開始の白い砂煙(無敵時間の始まりを視認)
    }
    if (dashing) { p.stamina = Math.max(0, p.stamina - 1.1); }
    else if (p.stamina < p.maxStamina) { p.stamina = Math.min(p.maxStamina, p.stamina + (moving ? 0.3 : 0.7)); }
    // マナ自然回復(戦闘中も緩やかに戻る)。マナ回復スキルで加速
    if (p.mp == null) { p.mp = p.maxMp || 100; }
    if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + 0.35 + (skillBonus().manaRegen || 0));
    let spd = p.speed * (dashing ? 1.85 : 1);
    // 燃料: 現代の乗り物は走行で燃料を消費。尽きると推進力を失う(ガソリンで給油)
    if (p.vehicle && FUEL_VEHICLES[p.vehicle]) {
      if (!p.fuel) p.fuel = {};
      const f = p.fuel[p.vehicle] || 0;
      if (f <= 0) { if (moving && Game.state.tick % 90 === 0) Game.UI.toast('⛽ 燃料切れ… ガソリンを補給しよう'); }
      else if (moving) {
        p.fuel[p.vehicle] = Math.max(0, f - 0.06);
        if (p.fuel[p.vehicle] === 0) { Game.UI.toast('⛽ 燃料が尽きた！'); if (Game.Audio) Game.Audio.play('select'); }
      }
    }
    const outOfFuel = p.vehicle && FUEL_VEHICLES[p.vehicle] && !(p.fuel && p.fuel[p.vehicle] > 0);
    if (p.vehicle === 'car') spd = p.speed * 2.3;
    else if (p.vehicle === 'buggy') spd = p.speed * 2.5;
    else if (p.vehicle === 'plane') spd = p.speed * 2.7;
    else if (p.vehicle === 'carpet') spd = p.speed * 2.4;
    else if (p.vehicle === 'boat') spd = p.speed * 1.5;
    else if (p.vehicle === 'tank') spd = p.speed * 1.6;
    else if (p.vehicle === 'mech') spd = p.speed * 2.0;
    else if (p.vehicle === 'jet') spd = p.speed * 3.1;
    else if (p.vehicle === 'bomber') spd = p.speed * 2.5;
    if (outOfFuel) spd *= 0.12; // 燃料切れは失速(徒歩以下)
    // 浅瀬は減速＋水音（乗り物なし・徒歩のみ）
    const gUnder = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
    if (Game.Achievements && Game.Achievements.visitBiome && Game.state.worldName === 'light') Game.Achievements.visitBiome(gUnder);
    // ダンジョン侵入時に自動セーブ(進入のたび一度)。床がダンジョンに変わった瞬間を検出
    const inDun = gUnder === Game.TILE.DUNGEON_FLOOR;
    if (inDun && !p._inDungeon) { p._inDungeon = true; Game.state.dungeonEntry = { x: p.x, y: p.y, world: Game.state.worldName }; if (Game.Save) Game.Save.autosave('dungeon'); if (Game.Story && !Game.Story.seen('depths')) Game.Story.unlock('depths', true); }
    else if (!inDun && p._inDungeon) { p._inDungeon = false; }
    const onWater = !p.vehicle && gUnder === Game.TILE.WATER;
    if (onWater) spd *= 0.5;
    // 発着場: 乗り物で上に停まると燃料・耐久がゆっくり回復
    if (p.vehicle && Game.state.tick % 20 === 0) {
      const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
      if (Game.World.objAt(ptx, pty) === Game.OBJ.LANDING_PAD) {
        if (FUEL_VEHICLES[p.vehicle]) { if (!p.fuel) p.fuel = {}; p.fuel[p.vehicle] = Math.min(120, (p.fuel[p.vehicle] || 0) + 2); }
        if (VEH_MAXDUR[p.vehicle] != null) { if (!p.vehDur) p.vehDur = {}; p.vehDur[p.vehicle] = Math.min(VEH_MAXDUR[p.vehicle], (p.vehDur[p.vehicle] == null ? VEH_MAXDUR[p.vehicle] : p.vehDur[p.vehicle]) + 2); }
        if (Game.Render.spawnParticles && Game.state.tick % 40 === 0) Game.Render.spawnParticles(p.x, p.y, '#7fd0ff', 2);
      }
    }
    // 遊泳(深水): 呼吸ゲージが減り、尽きると溺れて継続ダメージ。地上/ボート/浅瀬で急速回復。
    const submerged = !p.vehicle && gUnder === Game.TILE.DEEP_WATER;
    if (p.breath == null) p.breath = p.maxBreath || 360;
    if (submerged && p.waterBreath) {
      spd *= 0.7; // 呼吸器あり: 溺れず自在に潜れる(遊泳はやや遅い程度)
      p.breath = p.maxBreath || 360;
    } else if (submerged) {
      spd *= 0.6;
      p.breath = Math.max(0, p.breath - 1);
      if (Game.state.tick % 10 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(p.x + (Math.random() - 0.5) * 8, p.y - 6, '#bfe2f5', 1); // 気泡
      if (p.breath <= 0 && Game.state.tick % 18 === 0) {
        Game.Survival.damage(4, 'drown');
        if (Game.Render.flash) Game.Render.flash('rgba(30,80,160,0.22)');
      }
      if (p.breath === Math.floor((p.maxBreath || 360) * 0.34) && Game.UI) Game.UI.toast('💨 息が続かない… 早く水面へ！');
    } else if (p.breath < (p.maxBreath || 360)) {
      p.breath = Math.min(p.maxBreath || 360, p.breath + 5); // 地上で急速回復
    }
    // 毒の沼地: 足が重く、稀に毒を受ける（徒歩のみ）
    if (!p.vehicle && gUnder === Game.TILE.SWAMP) {
      spd *= 0.72;
      if (Game.Status && Game.state.tick % 30 === 0 && Math.random() < 0.06) Game.Status.add('poison', 120);
    }
    // 火山地帯: 稀に火傷（徒歩のみ・耐火装備が無い限り）
    if (!p.vehicle && gUnder === Game.TILE.VOLCANIC) {
      if (Game.Status && Game.state.tick % 30 === 0 && Math.random() < 0.05) Game.Status.add('burn', 90);
    }
    // 砂嵐/吹雪は足が重い（飛行中は影響なし）
    const wt = Game.state.weather && Game.state.weather.type;
    if ((wt === 'sandstorm' || wt === 'blizzard') && p.vehicle !== 'plane' && p.vehicle !== 'carpet') spd *= 0.7;
    if (!p.vehicle) spd *= (1 + skillBonus().moveSpd + setBonus().moveSpd + (p.gearMoveSpd || 0) + (Game.Status ? Game.Status.buffSum().spd : 0)); // スキル健脚＋俊足の薬＋装備affix＋セット効果
    if (!p.vehicle && (p.tailwindT || 0) > 0) spd *= 1.08; // パッシブ「追い風」: 撃破後3秒 移動+8%
    // 乗り物: スロットル(0..1)を積分して加速/減速カーブを作る。最高速そのものは不変
    if (p.vehicle) {
      if (moving) {
        p.vThr = Math.min(1, (p.vThr || 0) + (VEH_ACCEL[p.vehicle] || 0.08));
        p.vDirX = dx / len; p.vDirY = dy / len; // 惰性用に進行方向を記憶
      } else {
        p.vThr = (p.vThr || 0) * (VEH_DRAG[p.vehicle] || 0.88);
        if (p.vThr < 0.04) p.vThr = 0;
      }
    } else p.vThr = 0;
    // エンジンループ音を実走行状態に同期(冪等・セーブ復帰やワールド移動後も自動整合)
    if (Game.Audio.vehicleLoop && Game.state.tick % 6 === 0) Game.Audio.vehicleLoop(p.vehicle || null, p.vThr || 0);
    if ((p.rolling || 0) > 0) {
      // 回避ロール中: 固定方向へ高速移動（壁は通常同様に停止）＋砂煙
      p.rolling--;
      const rspd = p.speed * 3.2 * (1 + skillBonus().moveSpd * 0.5);
      p.dir = Math.abs(p.rollDX) > Math.abs(p.rollDY) ? (p.rollDX < 0 ? 'left' : 'right') : (p.rollDY < 0 ? 'up' : 'down');
      const rnx = p.x + p.rollDX * rspd; if (!blocked(rnx, p.y)) p.x = rnx;
      const rny = p.y + p.rollDY * rspd; if (!blocked(p.x, rny)) p.y = rny;
      if (Game.state.tick % 2 === 0) Game.Render.spawnParticles(p.x, p.y, '#cfe0ff', 2);
    } else if (moving) {
      dx /= len; dy /= len;
      // 弾幕撃ち(ストレイフ): 銃を撃っている間は移動しても射撃方向を固定する(横移動＝ストレイフ)
      const _sel = Game.Inventory.selectedSlot(), _sd = _sel && Game.ITEMS[_sel.id];
      const firingGun = (intent.mine || intent.fire) && _sd && _sd.tool === 'gun';
      if (!firingGun) p.dir = intent.dir || p.dir; // 射撃中は向きを更新しない=照準ロック
      const ox = p.x, oy = p.y;
      const mvSpd = p.vehicle ? spd * (0.3 + 0.7 * p.vThr) : spd; // 乗り物は出だし30%→滑らかに最高速へ
      const nx = p.x + dx * mvSpd;
      if (!blocked(nx, p.y)) p.x = nx;
      const ny = p.y + dy * mvSpd;
      if (!blocked(p.x, ny)) p.y = ny;
      // スタック対策: 動こうとしているのに両軸とも進めない状態が続いたら歩ける場所へ救出
      if (Math.abs(p.x - ox) < 0.01 && Math.abs(p.y - oy) < 0.01 && !p.vehicle) {
        p.stuckT = (p.stuckT || 0) + 1;
        if (p.stuckT > 18 && Game.World.rescueStuck) { Game.World.rescueStuck(); p.stuckT = 0; }
      } else p.stuckT = 0;
      if (dashing && Game.state.tick % 4 === 0) Game.Render.spawnParticles(p.x, p.y, '#cfe0ff', 1);
      if (onWater && Game.state.tick % 16 === 0) { Game.Audio.play('splash'); Game.Render.spawnParticles(p.x, p.y + 8, '#a8d0f0', 3); }
      else if (!p.vehicle && !onWater && Game.Audio.footstep && Game.state.tick % (dashing ? 9 : 14) === 0) {
        const pt = playerTile(), g = Game.World.groundAt(pt.tx, pt.ty), T = Game.TILE;
        const kind = (g === T.STONE || g === T.DUNGEON_FLOOR || g === T.VOLCANIC) ? 'stone' : (g === T.SAND || g === T.SNOW || g === T.DIRT) ? 'soft' : 'grass';
        Game.Audio.footstep(kind, Math.floor(Game.state.tick / 14) % 2);
      }
      // 走行トレイル: 車=砂埃 / ボート=航跡 / 飛行機・絨毯=淡い雲(3tickに1粒・低コスト)
      if (p.vehicle && (p.vThr || 0) > 0.2 && Game.state.tick % 3 === 0) {
        Game.Render.spawnParticles(p.x - (p.vDirX || 0) * 10, p.y - (p.vDirY || 0) * 10 + (p.vehicle === 'boat' ? 5 : 7), VEH_TRAIL[p.vehicle] || '#cfd6e0', 1);
        if (p.vehicle === 'boat' && Game.state.tick % 21 === 0) Game.Audio.play('splash');
      }
    } else if (p.vehicle && (p.vThr || 0) > 0) {
      // 惰性: 入力を離しても即停止せず滑らかに減速(最後の進行方向へ滑る)
      const cs = spd * (0.3 + 0.7 * p.vThr) * p.vThr;
      const cx = p.x + (p.vDirX || 0) * cs; if (!blocked(cx, p.y)) p.x = cx;
      const cy = p.y + (p.vDirY || 0) * cs; if (!blocked(p.x, cy)) p.y = cy;
      if ((p.vThr || 0) > 0.3 && Game.state.tick % 4 === 0) Game.Render.spawnParticles(p.x - (p.vDirX || 0) * 10, p.y - (p.vDirY || 0) * 10 + 6, VEH_TRAIL[p.vehicle] || '#cfd6e0', 1);
      p.stuckT = 0;
    } else p.stuckT = 0;

    if (p.invuln > 0) p.invuln--;
    if (p.attackCd > 0) p.attackCd--;
    // 発砲反動キックの復元(視覚のみ・数tickで元位置へ戻すためゲームプレイ影響なし)
    if ((p.recoilN || 0) > 0) {
      p.recoilN--;
      const rbx = p.x - (p.recoilX || 0); if (!blocked(rbx, p.y)) p.x = rbx;
      const rby = p.y - (p.recoilY || 0); if (!blocked(p.x, rby)) p.y = rby;
      if (p.recoilN <= 0) { p.recoilX = 0; p.recoilY = 0; }
    }
    // 先行入力バッファ: CDが明けた瞬間に予約済みの一撃を自動発動(近接/杖のみ。銃はtryFire側で管理)
    if (p.attackCd <= 0 && p.attackBuf) {
      p.attackBuf = false;
      const bufSel = Game.Inventory.selectedItemDef();
      if (!bufSel || (bufSel.tool !== 'gun' && bufSel.tool !== 'warp' && bufSel.tool !== 'grapple' && !bufSel.throw)) Game.Combat.tryAttack();
    }
    // リロード進行: 完了したら予備弾を消費してマガジンへ装填
    if (p.reloadCd > 0) {
      p.reloadCd--;
      if (p.reloadCd === 0 && p.reloadInfo) {
        const ri = p.reloadInfo; p.reloadInfo = null;
        const reserve = Game.Inventory.count(ri.ammo);
        const take = Math.min(ri.need, reserve);
        if (take > 0) { Game.Inventory.remove(ri.ammo, take); p.mags[ri.gid] = (p.mags[ri.gid] || 0) + take; Game.Audio.play('reload_done'); Game.UI.toast('リロード完了 — ' + (Game.ITEMS[ri.ammo] ? Game.ITEMS[ri.ammo].name : ri.ammo) + ' ' + p.mags[ri.gid] + '発'); }
        Game.UI.refreshHotbar();
      }
    }

    // 左クリック/採掘ボタン: 銃→発射、なければ攻撃→採掘
    if (intent.mine) {
      const sel = Game.Inventory.selectedItemDef();
      if (sel && sel.tool === 'gun') { tryFire(sel); mining.active = false; }
      else if (sel && sel.tool === 'staff') { tryStaff(sel); mining.active = false; }
      else if (sel && sel.tool === 'warp') { tryWarp(); mining.active = false; }
      else if (sel && sel.tool === 'grapple') { tryGrapple(); mining.active = false; }
      else if (sel && sel.throw) { tryThrow(sel); mining.active = false; }
      else if (Game.Combat.tryAttack()) { mining.active = false; mining.progress = 0; }
      else mineTick();
    } else { mining.active = false; if (mining.progress > 0) mining.progress -= 0.5; }

    // 右クリック/設置ボタン: 対話/設置/使用
    if (intent.place) interact();
    // 開く/使うボタン: 近隣のチェスト等を開く（無ければ通常操作）
    if (intent.use) useNearby();

    // とげダメージ（サボテン等）
    checkHazard();

    updateDrops();
  }

  function playerTile() {
    const p = Game.state.player;
    return { tx: Math.floor(p.x / TS), ty: Math.floor(p.y / TS) };
  }

  function candidateTile() {
    const i = Game.Input.intent;
    if (i.usePointer && i.mouseTile) return { tx: i.mouseTile.tx, ty: i.mouseTile.ty };
    const pt = playerTile();
    const d = Game.state.player.dir;
    let ox = 0, oy = 0;
    if (d === 'up') oy = -1; else if (d === 'down') oy = 1;
    else if (d === 'left') ox = -1; else if (d === 'right') ox = 1; else oy = 1;
    return { tx: pt.tx + ox, ty: pt.ty + oy };
  }

  function targetTile() {
    const c = candidateTile();
    if (!c) return null;
    const pt = playerTile();
    const dist = Math.max(Math.abs(c.tx - pt.tx), Math.abs(c.ty - pt.ty));
    const inReach = dist <= Game.CFG.REACH;
    const obj = Game.World.objAt(c.tx, c.ty);
    const meta = Game.OBJ_META[obj];
    const selDef = Game.Inventory.selectedItemDef();
    const mineable = obj !== Game.OBJ.NONE && meta && meta.mineable;
    const placeableEmpty = selDef && selDef.place !== undefined && obj === Game.OBJ.NONE;
    return { tx: c.tx, ty: c.ty, obj: obj, inReach: inReach, valid: inReach && (mineable || placeableEmpty) };
  }

  function toolTierFor(toolType) {
    const sel = Game.Inventory.selectedItemDef();
    if (sel && sel.tool === toolType) return sel.tier;
    return 0;
  }

  function mineTick() {
    const t = targetTile();
    if (!t || !t.inReach) { mining.active = false; return; }
    const obj = t.obj;
    const meta = Game.OBJ_META[obj];
    // 封印壁は破壊不可（二相連動で解く）。ヒント提示
    if (obj === Game.OBJ.SEAL_WALL) {
      mining.active = false;
      if (Game.state.tick % 40 === 0) Game.UI.toast('固い封印だ… 影の世界の同じ場所に「共鳴核」があるはず');
      return;
    }
    if (obj === Game.OBJ.NONE || !meta || !meta.mineable) { mining.active = false; return; }

    // ダンジョンの壁は「破城のツルハシ(siege)」を装備している時のみ破壊可能（壁抜き不可）
    if (meta.dungeonWall) {
      const sel0 = Game.Inventory.selectedItemDef();
      if (!sel0 || !sel0.siege) {
        mining.active = false; mining.progress = 0;
        if (Game.state.tick % 40 === 0) Game.UI.toast('壁が硬すぎる… 「破城のツルハシ」が必要だ');
        return;
      }
    }

    // 設置物(OBJ番号100以上=プレイヤー設置/建材)は、近くに敵がいる間は採掘しない（戦闘中の誤破壊防止）
    if (obj >= 100) {
      const mobs = Game.state.mobs, px = Game.state.player.x, py = Game.state.player.y;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def && m.def.hostile && Math.hypot(m.x - px, m.y - py) < 2.6 * TS) { mining.active = false; mining.progress = 0; return; } }
    }

    // 幻影鉱脈は正気度が低いときだけ掘れる
    if (meta.phantom && Game.state.sanity >= 40) { mining.active = false; return; }
    // マイクラ踏襲: ツルハシが要る対象(石/鉱石)は素手では掘れない。上位素材は上位ツルハシが要る
    const selT = Game.Inventory.selectedItemDef();
    if (meta.tool === 'pickaxe' && !(selT && selT.tool === 'pickaxe')) {
      mining.active = false; mining.progress = 0;
      if (Game.state.tick % 30 === 0) Game.UI.toast('ツルハシが必要だ（素手で石は掘れない）。木を集めて木のツルハシを作ろう');
      return;
    }
    const tierUsed = toolTierFor(meta.tool);
    if (tierUsed < meta.tier) {
      mining.active = false; mining.progress = 0;
      if (Game.state.tick % 30 === 0) Game.UI.toast(meta.tier >= 3 ? '更に上位のツルハシが必要' : 'もっと良い道具（上位のツルハシ）が必要');
      return;
    }
    if (mining.tx !== t.tx || mining.ty !== t.ty || mining.obj !== obj) {
      mining.progress = 0; mining.tx = t.tx; mining.ty = t.ty; mining.obj = obj;
    }
    mining.active = true;
    const sel = Game.Inventory.selectedItemDef();
    const matched = sel && sel.tool === meta.tool;
    const speed = (matched ? (1 + sel.tier) : 0.6) + skillBonus().mining;
    mining.progress += speed;
    if (Game.state.tick % 6 === 0) Game.Audio.play('mine');
    // 採掘中の破片(対象タイルからチップが飛ぶ)＋進捗のひび
    if (Game.state.tick % 4 === 0 && Game.Render.spawnParticles) {
      const wx = t.tx * TS + TS / 2, wy = t.ty * TS + TS / 2;
      const col = (meta.dust) || (Game.TILE_COLOR && Game.TILE_COLOR[obj]) || '#b0a890';
      Game.Render.spawnParticles(wx, wy, col, 3);
    }
    if (mining.progress >= meta.hp) { breakBlock(t.tx, t.ty, obj, meta); mining.active = false; mining.progress = 0; }
  }

  function breakBlock(tx, ty, obj, meta) {
    // チェスト/宝箱の中身を放出
    if (obj === Game.OBJ.CHEST || obj === Game.OBJ.TREASURE_CHEST) {
      const d = Game.World.getTileData(tx, ty);
      if (d && d.chest) d.chest.forEach(function (sl) {
        if (sl) Game.state.drops.push({ id: sl.id, count: sl.count, x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
      });
    }
    if (obj === Game.OBJ.WAYPOINT_STONE) removeWaypoint(tx, ty); // 道標を壊したら登録解除
    if (meta.dualPlaced) Game.World.setObjBothWorlds(tx, ty, Game.OBJ.NONE);
    else Game.World.setObj(tx, ty, Game.OBJ.NONE);
    Game.Net.broadcastEdit(tx, ty, Game.OBJ.NONE, Game.state.worldName);
    const wx = tx * TS + TS / 2, wy = ty * TS + TS / 2;
    if (meta.drops) {
      for (let i = 0; i < meta.drops.length; i++) {
        const d = meta.drops[i];
        const n = Game.Utils.randInt(Math.random, d.n[0], d.n[1]);
        for (let k = 0; k < n; k++) {
          Game.state.drops.push({ id: d.item, count: 1, x: wx + (Math.random() - 0.5) * 14, y: wy + (Math.random() - 0.5) * 14 });
        }
      }
    }
    const col = (Game.ITEMS[meta.drops && meta.drops[0] && meta.drops[0].item] || {}).color || '#999';
    Game.Render.spawnParticles(wx, wy, col, 14);
    Game.Render.spawnParticles(wx, wy, '#ffffff', 4); // 砕けの白い飛沫
    if (Game.Render.shake && meta.tier >= 2) Game.Render.shake(3); // 硬い鉱石は手応え
    if (meta.phantom && Game.Achievements) Game.Achievements.unlock('madness_sight');
    if (meta.resonator) Game.World.resonate(tx, ty);  // 共鳴核破壊→封印解除
    Game.Audio.play('break');
  }

  // 対話/設置/使用
  // 「開く/使う」ボタン用: 近隣の対話可能オブジェクト(チェスト等)を探して開く。無ければ通常interact
  // 古の祭壇: 触れると一時的な祝福(長時間バフ)を授かる。同じ祭壇は一定時間で再充填
  const ALTAR_BLESSINGS = [
    { type: 'strength', name: '力の祝福' },
    { type: 'swiftness', name: '俊足の祝福' },
    { type: 'ironskin', name: '守りの祝福' },
    { type: 'regen_buff', name: '再生の祝福' },
  ];
  function activateAltar(tx, ty) {
    const p = Game.state.player;
    const now = Game.state.tick;
    const d = Game.World.getTileData(tx, ty) || {};
    const cd = 30 * 240; // 約8分で再充填
    if (d.altarUsed && now - d.altarUsed < cd) { Game.UI.toast('古の祭壇の力はまだ満ちていない…'); return; }
    d.altarUsed = now; Game.World.setTileData(tx, ty, d);
    const bl = ALTAR_BLESSINGS[Math.floor(Math.random() * ALTAR_BLESSINGS.length)];
    Game.Status.apply(bl.type, 30 * 180); // 3分
    applyEquipStats();
    Game.Render.spawnParticles(p.x, p.y - 6, '#ffe9a0', 18);
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 20, bl.name, '#ffe9a0', true);
    Game.Audio.play('relic_get');
    Game.UI.toast('古の祭壇に触れた — ' + bl.name + 'を授かった');
    if (Game.Achievements) Game.Achievements.unlock('blessed');
    Game.UI.refreshAll();
  }

  // 近接する対話対象とラベルを返す（文脈アクションボタン用。実行はしない）
  function contextAction() {
    if (!Game.state) return null;
    const npc = Game.Mobs.nearbyNPC(2.2 * TS);
    if (npc) return { label: '💬 話す' };
    const O = Game.OBJ, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const off = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const LAB = {};
    LAB[O.CHEST] = '📦 開ける'; LAB[O.TREASURE_CHEST] = '💎 宝箱を開ける'; LAB[O.RIFT_ANCHOR] = '🧰 共有保管庫';
    LAB[O.BOUNTY_BOARD] = '📜 賞金を見る'; LAB[O.STELA] = '🪧 石碑を読む'; LAB[O.WISH_ALTAR] = '🌟 祈る';
    LAB[O.SHADOW_ALTAR] = '🩸 ボスを呼ぶ'; LAB[O.ENCHANT_TABLE] = '✨ 付呪'; LAB[O.BED] = '🛌 眠る';
    for (let i = 0; i < off.length; i++) {
      const o = Game.World.objAt(ptx + off[i][0], pty + off[i][1]);
      if (LAB[o]) return { label: LAB[o] };
    }
    return null;
  }

  function useNearby() {
    const npc = Game.Mobs.nearbyNPC(2.2 * TS);
    if (npc) { Game.Mobs.interactNPC(npc); return; }
    const O = Game.OBJ, p = Game.state.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const off = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < off.length; i++) {
      const tx = ptx + off[i][0], ty = pty + off[i][1], o = Game.World.objAt(tx, ty);
      if (o === O.CHEST) { Game.UI.openChest(tx, ty); return; }
      if (o === O.TREASURE_CHEST) { openTreasure(tx, ty); return; }
      if (o === O.RIFT_ANCHOR) { Game.UI.openSharedChest(tx, ty); return; }
      if (o === O.BOUNTY_BOARD) { Game.Bounty.open(tx, ty); return; }
      if (o === O.STELA) { Game.Lore.read(tx, ty); return; }
      if (o === O.WISH_ALTAR) { activateAltar(tx, ty); return; }
      if (o === O.WIND_ALTAR) { skyTravel(tx, ty); return; }
      if (o === O.RETURN_ALTAR) { skyReturn(); return; }
      if (o === O.ANCIENT_GATE) { ruinTravel(tx, ty); return; }
      if (o === O.RETURN_GATE) { ruinReturn(); return; }
      if (o === O.RIFT_TEAR) { riftTravel(tx, ty); return; }
      if (o === O.RIFT_RETURN) { riftReturn(); return; }
      if (o === O.WAYPOINT_STONE) { if (Game.UI.openWaypoints) Game.UI.openWaypoints(); return; }
      if (o === O.SHADOW_ALTAR) { Game.Mobs.summonBoss(tx, ty); return; }
      if (o === O.ENCHANT_TABLE) { Game.UI.openEnchant(); return; }
      if (o === O.EXIT_PORTAL) { dungeonExitWarp(); return; }
      if (o === O.BED) { sleep(); return; }
    }
    interact(); // 近隣に対話対象が無ければ通常操作（手持ち使用/設置など）
  }

  // ===== 空島(スカイエンクレーブ)への往還 =====
  // 風の祭壇: 「風の羽根」を掲げると固有ムービー→空島へテレポート。羽根未所持ならレシピを案内
  function skyTravel(tx, ty) {
    if (Game.state.paused) return;
    if (Game.Inventory.count('wind_feather') <= 0) {
      Game.UI.toast('風の祭壇… 「風の羽根」を掲げれば空へ昇れそうだ（羽根5＋光素2で作れる）');
      if (Game.Story && Game.Story.hintRecipe) Game.Story.hintRecipe('wind_feather');
      return;
    }
    Game.Inventory.remove('wind_feather', 1);
    Game.state.paused = true;
    Game.Cutscene.playSkyArrival(function () {
      const a = Game.WorldGen.skyArrival(Game.state.seed);
      // 帰還祭壇のタイルデータに出発地を刻む(セーブされる=リロード後も正しい場所へ戻る)
      const ra = Game.WorldGen.skyReturnAltar(Game.state.seed);
      Game.World.setTileData(ra.tx, ra.ty, { skyFromTx: tx, skyFromTy: ty + 1 });
      Game.World.teleport(a.tx, a.ty);
      Game.state.paused = false;
      if (Game.Story && Game.Story.unlock) Game.Story.unlock('skyisles', true); if (Game.Achievements) Game.Achievements.unlock('reach_sky'); // 記憶回廊「雲の岸」
    });
  }
  // 帰還の祭壇: 短い降下ムービー→出発した地上の祭壇脇へ戻る(記録が無ければスポーンへ)
  function skyReturn() {
    if (Game.state.paused) return;
    const ra = Game.WorldGen.skyReturnAltar(Game.state.seed);
    const td = Game.World.getTileData(ra.tx, ra.ty);
    Game.state.paused = true;
    Game.Cutscene.playSkyReturn(function () {
      let dx, dy;
      if (td && td.skyFromTx != null) { dx = td.skyFromTx; dy = td.skyFromTy; }
      else { dx = Game.state.spawn.tx; dy = Game.state.spawn.ty; }
      Game.World.teleport(dx, dy);
      Game.state.paused = false;
    });
  }

  // ===== 古代都市への往還 =====
  // 古の門: 「古の鍵」を掲げると固有ムービー→都市へテレポート。鍵未所持なら案内
  function ruinTravel(tx, ty) {
    if (Game.state.paused) return;
    if (Game.Inventory.count('gate_key') <= 0) {
      Game.UI.toast('古の門… 「古の鍵」を掲げれば都市へ通じる（金鉱3＋光素2で作れる）');
      return;
    }
    Game.Inventory.remove('gate_key', 1);
    Game.state.paused = true;
    Game.Cutscene.playRuinArrival(function () {
      const a = Game.WorldGen.ruinArrival(Game.state.seed);
      const rg = Game.WorldGen.ruinReturnGate(Game.state.seed);
      Game.World.setTileData(rg.tx, rg.ty, { ruinFromTx: tx, ruinFromTy: ty + 1 });
      Game.World.teleport(a.tx, a.ty);
      Game.state.paused = false;
      if (Game.Story && Game.Story.unlock) Game.Story.unlock('ruincity', true); if (Game.Achievements) Game.Achievements.unlock('reach_ruins'); // 記憶回廊「沈黙の都」
    });
  }
  // 還りの門: 短い帰還ムービー→出発した地上の門脇へ(記録が無ければスポーンへ)
  function ruinReturn() {
    if (Game.state.paused) return;
    const rg = Game.WorldGen.ruinReturnGate(Game.state.seed);
    const td = Game.World.getTileData(rg.tx, rg.ty);
    Game.state.paused = true;
    Game.Cutscene.playRuinReturn(function () {
      let dx, dy;
      if (td && td.ruinFromTx != null) { dx = td.ruinFromTx; dy = td.ruinFromTy; }
      else { dx = Game.state.spawn.tx; dy = Game.state.spawn.ty; }
      Game.World.teleport(dx, dy);
      Game.state.paused = false;
    });
  }

  // じょうろ: 周囲2タイルの作物を1段階育てる(気持ちよい世話ループ)
  function waterNearbyCrops() {
    const p = Game.state.player, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = ptx + dx, ty = pty + dy;
      const d = Game.World.getTileData(tx, ty);
      if (d && d.crop && d.crop.stage < 3) { d.crop.stage++; d.crop.timer = 0; n++; if (Game.Render.spawnParticles) Game.Render.spawnParticles(tx * TS + TS / 2, ty * TS + TS / 2, '#7fb8d8', 5); }
    }
    if (n > 0) { Game.Audio.play('place'); Game.UI.toast('水をやった — ' + n + '株が育った'); }
    else Game.UI.toast('近くに育つ作物がない');
  }

  // ===== 道標(ファストトラベル) =====
  const BIOME_NAME = { 0: '海辺', 1: '水辺', 2: '砂浜', 3: '草原', 4: '森', 5: '荒地', 6: '岩場', 7: '雪原', 8: '地下', 9: '沼地', 10: '火山', 11: '茸の森', 12: '花野', 13: '空島', 15: '古代都市', 16: '狭間' };
  function registerWaypoint(tx, ty) {
    if (!Game.state.waypoints) Game.state.waypoints = [];
    const world = Game.state.worldName;
    if (Game.state.waypoints.some(function (w) { return w.tx === tx && w.ty === ty && w.world === world; })) return;
    const g = Game.World.groundAt(tx, ty);
    const wl = world === 'shadow' ? '影・' : world === 'space' ? '宇宙・' : '';
    const n = Game.state.waypoints.filter(function (w) { return w.world === world; }).length + 1;
    const name = wl + (BIOME_NAME[g] || '道標') + ' ' + n;
    Game.state.waypoints.push({ tx: tx, ty: ty, world: world, name: name });
    Game.UI.toast('道標「' + name + '」を登録した');
    if (Game.Audio.cue) Game.Audio.cue('shimmer');
  }
  function removeWaypoint(tx, ty) {
    if (!Game.state.waypoints) return;
    const world = Game.state.worldName;
    Game.state.waypoints = Game.state.waypoints.filter(function (w) { return !(w.tx === tx && w.ty === ty && w.world === world); });
  }
  // 道標へ瞬間移動。同一世界のみ(異世界は影渡り/門で)。演出付き
  function travelToWaypoint(wp) {
    if (!wp || Game.state.paused) return;
    if (wp.world !== Game.state.worldName) { Game.UI.toast('別の世界の道標へは直接渡れない'); return; }
    Game.Audio.play('dash'); if (Game.Render.spawnParticles) Game.Render.spawnParticles(Game.state.player.x, Game.state.player.y, '#7fd0e0', 16);
    Game.World.teleport(wp.tx, wp.ty);
    if (Game.Render.spawnParticles) Game.Render.spawnParticles(Game.state.player.x, Game.state.player.y, '#c8f0f8', 16);
    if (Game.Audio.cue) Game.Audio.cue('shimmer');
  }

  // ===== 狭間への往還(影世界内で完結) =====
  // 狭間の裂け目: 「虚ろな鍵」を掲げると固有ムービー→狭間へテレポート(影世界内)
  function riftTravel(tx, ty) {
    if (Game.state.paused) return;
    if (Game.Inventory.count('void_key') <= 0) {
      Game.UI.toast('狭間の裂け目… 「虚ろな鍵」を掲げれば世界の隙間へ落ちる（影核1＋光素3で作れる）');
      return;
    }
    Game.Inventory.remove('void_key', 1);
    Game.state.paused = true;
    Game.Cutscene.playRiftArrival(function () {
      const a = Game.WorldGen.riftArrival(Game.state.seed);
      const rt = Game.WorldGen.riftReturnTear(Game.state.seed);
      Game.World.setTileData(rt.tx, rt.ty, { riftFromTx: tx, riftFromTy: ty + 1 });
      Game.World.teleport(a.tx, a.ty);
      Game.state.paused = false;
      if (Game.Story && Game.Story.unlock) Game.Story.unlock('riftvoid', true); if (Game.Achievements) Game.Achievements.unlock('reach_rift'); // 記憶回廊「世界の隙間」
    });
  }
  function riftReturn() {
    if (Game.state.paused) return;
    const rt = Game.WorldGen.riftReturnTear(Game.state.seed);
    const td = Game.World.getTileData(rt.tx, rt.ty);
    Game.state.paused = true;
    Game.Cutscene.playRiftReturn(function () {
      let dx, dy;
      if (td && td.riftFromTx != null) { dx = td.riftFromTx; dy = td.riftFromTy; }
      else { dx = Game.state.spawn.tx; dy = Game.state.spawn.ty; }
      Game.World.teleport(dx, dy);
      Game.state.paused = false;
    });
  }

  function interact() {
    // 友好NPC（謎の旅人）が近ければ対話優先
    const npc = Game.Mobs.nearbyNPC(2.2 * TS);
    if (npc) { Game.Mobs.interactNPC(npc); return; }
    const t = targetTile();
    const hasTile = !!(t && t.inReach);
    const obj = hasTile ? Game.World.objAt(t.tx, t.ty) : Game.OBJ.NONE;

    // --- タイル対象の操作（狙っている時のみ・優先）---
    if (hasTile) {
      if (obj === Game.OBJ.CHEST) { Game.UI.openChest(t.tx, t.ty); return; }
      if (obj === Game.OBJ.TREASURE_CHEST) { openTreasure(t.tx, t.ty); return; }
      if (obj === Game.OBJ.RIFT_ANCHOR) { Game.UI.openSharedChest(t.tx, t.ty); return; }
      if (obj === Game.OBJ.STELA) { Game.Lore.read(t.tx, t.ty); return; }
      if (obj === Game.OBJ.WISH_ALTAR) { activateAltar(t.tx, t.ty); return; }
      if (obj === Game.OBJ.BOUNTY_BOARD) { Game.Bounty.open(t.tx, t.ty); return; }
      if (obj === Game.OBJ.SHADOW_ALTAR) { Game.Mobs.summonBoss(t.tx, t.ty); return; }
      if (obj === Game.OBJ.ENCHANT_TABLE) { Game.UI.openEnchant(); return; }
      if (obj === Game.OBJ.EXIT_PORTAL) { dungeonExitWarp(); return; }
      if (obj === Game.OBJ.ROCKET) { Game.Rocket.board(); return; }
      if (obj === Game.OBJ.BED) { sleep(); return; }
      if (obj === Game.OBJ.WHEAT && Game.Farming.isGrown(t.tx, t.ty)) { Game.Farming.harvest(t.tx, t.ty); return; }
    }

    const sel = Game.Inventory.selectedSlot();
    const def = sel ? Game.ITEMS[sel.id] : null;
    if (!def) return;

    // --- 手持ちアイテムの使用（タイル不要・モバイルでも確実に使える）---
    if (def.ending) { Game.Quests.reunify(); return; }
    if (def.vehicle) {
      const p = Game.state.player;
      if (p.vehicle === def.vehicle) {
        p.vehicle = null; p.vThr = 0;
        Game.Audio.play('dismount');
        if (Game.Audio.vehicleLoop) Game.Audio.vehicleLoop(null);
        Game.Render.spawnParticles(p.x, p.y + 6, '#cfd6e0', 4);
        Game.UI.toast(def.name + ' から降りた');
      } else {
        p.vehicle = def.vehicle; p.vThr = 0;
        if (VEH_MAXDUR[def.vehicle] != null) { if (!p.vehDur) p.vehDur = {}; if (p.vehDur[def.vehicle] == null) p.vehDur[def.vehicle] = VEH_MAXDUR[def.vehicle]; }
        if (FUEL_VEHICLES[def.vehicle] && Game.UI.tipOnce) Game.UI.tipOnce('fuel', '⛽給油: ガソリンをホットバーで選び「使う」(PC=右クリック / スマホ=設置ボタン / パッド=□)。修理キットで耐久回復。発着場でも自動回復');
        Game.Audio.play('mount');
        if (Game.Audio.vehicleLoop) Game.Audio.vehicleLoop(def.vehicle, 0);
        Game.Render.spawnParticles(p.x, p.y + 6, '#cfd6e0', 5);
        Game.UI.toast(def.name + ' に乗った');
      }
      return;
    }
    if (def.shift) { Game.World.shift(); return; }
    if (def.waterCan) { waterNearbyCrops(); return; }
    if (def.respec) { const n = respec(); Game.Inventory.remove(sel.id, 1); Game.UI.toast('記憶の書を読んだ — スキルを振り直した（' + n + 'P返却）'); Game.UI.refreshAll(); return; }
    if (def.fuel) {
      const pp = Game.state.player;
      if (!pp.vehicle || !FUEL_VEHICLES[pp.vehicle]) { Game.UI.toast('燃料は現代の乗り物に乗車中のみ補給できる'); return; }
      if (!pp.fuel) pp.fuel = {};
      pp.fuel[pp.vehicle] = (pp.fuel[pp.vehicle] || 0) + def.fuel;
      Game.Inventory.remove(sel.id, 1); Game.Audio.play('craft');
      Game.UI.toast('⛽ 給油した（燃料 +' + def.fuel + '）'); Game.UI.refreshAll(); return;
    }
    if (def.repair) {
      const pp = Game.state.player;
      if (!pp.vehicle || VEH_MAXDUR[pp.vehicle] == null) { Game.UI.toast('修理キットは現代の乗り物に乗車中のみ使える'); return; }
      if (!pp.vehDur) pp.vehDur = {};
      const max = VEH_MAXDUR[pp.vehicle];
      pp.vehDur[pp.vehicle] = Math.min(max, (pp.vehDur[pp.vehicle] == null ? max : pp.vehDur[pp.vehicle]) + def.repair);
      Game.Inventory.remove(sel.id, 1); Game.Audio.play('craft');
      Game.UI.toast('🔧 機体を修理した（耐久 ' + Math.round(pp.vehDur[pp.vehicle]) + '/' + max + '）'); Game.UI.refreshAll(); return;
    }
    if (def.food || def.cures || def.buff || def.skillTome || def.xpGain || def.invExpand || def.summonBoss || def.opensShop || def.recall || def.stasis) { Game.Inventory.useSelected(); return; }
    if (def.installGun) {
      const pp = Game.state.player;
      if (pp.vehicle !== 'jet') { Game.UI.toast('機関銃は戦闘機に搭乗中のみ増設できる'); return; }
      if (!pp.vehGuns) pp.vehGuns = {};
      if ((pp.vehGuns[pp.vehicle] || 0) >= 4) { Game.UI.toast('機関銃は最大4基まで'); return; }
      pp.vehGuns[pp.vehicle] = (pp.vehGuns[pp.vehicle] || 0) + 1;
      Game.Inventory.remove(sel.id, 1); Game.Audio.play('craft');
      Game.UI.toast('🔫 機関銃を増設（' + pp.vehGuns[pp.vehicle] + '/4基）'); Game.UI.refreshAll(); return;
    }
    if (def.offhand) { equipOffhand(); return; }
    if (def.armor) { equipSelectedArmor(); return; }
    if (def.relic) { equipRelic(); return; }

    // --- 以降はタイルが必要（耕作/植える/設置）---
    if (!hasTile) return;
    if (def.tool === 'hoe' && obj === Game.OBJ.NONE) {
      const g = Game.World.groundAt(t.tx, t.ty);
      if (g === Game.TILE.GRASS || g === Game.TILE.DIRT || g === Game.TILE.FOREST) { Game.Farming.till(t.tx, t.ty); return; }
    }
    if (def.plant !== undefined && obj === Game.OBJ.FARMLAND) {
      Game.Farming.plant(t.tx, t.ty); Game.Inventory.remove(sel.id, 1); Game.UI.refreshAll(); return;
    }
    if (def.place !== undefined) placeObject(t, def, sel);
  }

  function placeObject(t, def, sel) {
    if (t.obj !== Game.OBJ.NONE) return;
    const pt = playerTile();
    const targetMeta = Game.OBJ_META[def.place];
    if (targetMeta && targetMeta.solid && t.tx === pt.tx && t.ty === pt.ty) return;
    const g = Game.World.groundAt(t.tx, t.ty);
    // 橋は水上に架けられる。それ以外は深い水に設置不可
    const targetMetaB = Game.OBJ_META[def.place];
    if (g === Game.TILE.DEEP_WATER && !(targetMetaB && targetMetaB.bridge)) return;
    // 両世界リンク設置物（裂け目の楔）
    if (targetMeta && targetMeta.dualPlaced) Game.World.setObjBothWorlds(t.tx, t.ty, def.place);
    else Game.World.setObj(t.tx, t.ty, def.place);
    if (def.place === Game.OBJ.CHEST) Game.World.setTileData(t.tx, t.ty, { chest: new Array(27).fill(null) });
    if (def.place === Game.OBJ.SAPLING) Game.World.setTileData(t.tx, t.ty, { sapling: { timer: 0 } });
    if (def.place === Game.OBJ.WAYPOINT_STONE) registerWaypoint(t.tx, t.ty);
    Game.Net.broadcastEdit(t.tx, t.ty, def.place, Game.state.worldName);
    Game.Inventory.remove(sel.id, 1);
    Game.Audio.play('place');
    Game.UI.refreshAll();
  }

  // 宝箱を開ける。初回は低確率で「ミミック(擬態した魔物)」が飛び出す
  function openTreasure(tx, ty) {
    let d = Game.World.getTileData(tx, ty);
    if (!d || !d.chest) {
      if (!d || !d.mimicChecked) {
        d = d || {}; d.mimicChecked = 1;
        if (Math.random() < 0.12) {
          Game.World.setTileData(tx, ty, d);
          Game.World.setObj(tx, ty, Game.OBJ.NONE); // 宝箱は魔物だった→消える
          Game.Mobs.spawnMob('mimic', tx * TS + TS / 2, ty * TS + TS / 2);
          Game.Audio.play('hit');
          Game.UI.toast('宝箱は擬態した魔物だった！');
          if (Game.Achievements) Game.Achievements.unlock('mimic_bait');
          return;
        }
      }
      d.chest = makeTreasureLoot();
      Game.World.setTileData(tx, ty, d);
    }
    Game.UI.openChest(tx, ty);
  }

  function makeTreasureLoot() {
    const arr = new Array(27).fill(null);
    const space = Game.state.worldName === 'space';
    const pool = space
      ? [['star_metal', 2, 6], ['star_core', 1, 2], ['lumen', 3, 8], ['shadow_steel', 2, 5]]
      : [['lumen', 2, 5], ['shadow_steel', 1, 3], ['shadow_crystal', 2, 5], ['gold_ore', 2, 6], ['shadow_core', 1, 2], ['iron', 2, 5]];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const it = pool[Math.floor(Math.random() * pool.length)];
      arr[i] = { id: it[0], count: it[1] + Math.floor(Math.random() * (it[2] - it[1] + 1)) };
    }
    // 宝箱には rolled装備を1つ（やや良質）
    const gearPool = space
      ? ['cosmic_blade', 'star_cannon', 'gravity_boots', 'shadow_chest']
      : ['iron_sword', 'iron_chest', 'iron_helmet', 'shadow_blade', 'shadow_helmet'];
    const gid = gearPool[Math.floor(Math.random() * gearPool.length)];
    arr[n] = { id: gid, count: 1, roll: Game.Loot.roll(gid, 0.3 + Game.Loot.lootBonus()) };
    // 金塊＋低確率で遺物
    arr[n + 1] = { id: 'gold_bar', count: 1 + Math.floor(Math.random() * 3) };
    if (Game.RELIC_IDS && Math.random() < 0.12) arr[n + 2] = { id: Game.RELIC_IDS[Math.floor(Math.random() * Game.RELIC_IDS.length)], count: 1 };
    if (Math.random() < 0.08) arr[n + 3] = { id: 'expand_pouch', count: 1 }; // 稀に拡張のポーチ
    if (Math.random() < 0.06) arr[n + 4] = { id: 'siege_pick', count: 1 };   // ごく稀に破城のツルハシ
    return arr;
  }

  // 選択中(ホットバー)の防具を装備。前装備はインベントリへ戻す
  function equipSelectedArmor() {
    const p = Game.state.player;
    const idx = p.hotbarIndex;
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.armor || !def.slot) return;
    const prev = p.armor[def.slot];
    p.armor[def.slot] = { id: slot.id, roll: slot.roll || null };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1, roll: prev.roll || null } : null;
    applyEquipStats();
    Game.Audio.play('equip');
    Game.UI.toast(Game.Loot.displayName(p.armor[def.slot]) + ' を装備');
    Game.UI.refreshAll();
  }

  // 選択中の銃のID（マガジン管理キー）
  function selGunId() { const sl = Game.Inventory.selectedSlot(); return sl ? sl.id : null; }
  function magCap(sel) { return sel.mag || 12; }
  function magLoaded(sel) { const gid = selGunId(); return (gid && Game.state.player.mags) ? (Game.state.player.mags[gid] || 0) : 0; }

  // リロード開始（予備弾があれば）。実際の装填は reloadCd 完了時。
  function startReload(sel, gid) {
    const p = Game.state.player;
    if (p.reloadCd > 0) return false;
    const cap = magCap(sel);
    const cur = p.mags[gid] || 0;
    if (cur >= cap) return false;
    const reserve = Game.Inventory.count(sel.ammo);
    if (reserve <= 0) { if (Game.state.tick % 30 === 0) Game.UI.toast('弾切れ — ' + (Game.ITEMS[sel.ammo] ? Game.ITEMS[sel.ammo].name : sel.ammo) + ' が必要'); return false; }
    p.reloadCd = sel.reloadTime || 48; // ~1.6秒 @30Hz
    p.reloadMax = p.reloadCd; // 進捗バー用の総時間
    p.reloadInfo = { gid: gid, ammo: sel.ammo, need: cap - cur };
    Game.Audio.play('reload'); // マガジン交換のクリック音(発砲音と区別)
    Game.UI.toast('リロード中… 🔄');
    Game.UI.refreshHotbar();
    return true;
  }
  // 手動リロード（Rキー等）
  function reloadCurrent() {
    const sel = Game.Inventory.selectedItemDef(); const gid = selGunId();
    if (sel && sel.tool === 'gun' && gid) startReload(sel, gid);
  }

  function tryFire(sel) {
    const p = Game.state.player;
    if (p.reloadCd > 0) return;       // リロード中は撃てない
    if (p.attackCd > 0) return;
    if (!p.mags) p.mags = {};
    const gid = selGunId(); if (!gid) return;
    let loaded = p.mags[gid];
    if (loaded == null) { // 初回はマガジン未装填 → 予備弾から自動装填
      if (Game.Inventory.count(sel.ammo) > 0) { startReload(sel, gid); return; }
      p.mags[gid] = 0; loaded = 0;
    }
    if (loaded <= 0) { if (Game.UI.tipOnce) Game.UI.tipOnce('reload', '弾を撃ち切ると自動でリロード(予備弾が必要)。予備弾は素材(鉄+火薬)クラフトやショップで補充。手動リロードはRキー'); startReload(sel, gid); return; } // 空 → リロード
    // パッシブ「節約」: 12%で弾薬を消費しない(表示は1秒スロットルでスパム防止)
    if (skillFlag('conserve') && Math.random() < 0.12) {
      if (Game.state.tick - (p.conserveFx || 0) > 30) {
        p.conserveFx = Game.state.tick;
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 22, '節約', '#9fd8a0');
      }
    } else p.mags[gid] = loaded - 1; // マガジンから1発消費
    const kind = sel.bkind || 'bullet';
    const pellets = sel.pellets || 1;
    let dmg = effAttack(sel.fireDmg || 6); // 銃もLv/STR補正
    // 会心: 近接と同じ判定を遠距離にも適用(クリ時 1.8x ＋ 音/反動)。パッシブ「集中」は確定会心
    const critCh = (Game.TUNE.BASE_CRIT || 0.08) + skillBonus().crit + (setBonus().crit || 0);
    const focusCrit = focusArmed();
    const isCrit = focusCrit || Math.random() < critCh;
    if (focusCrit) consumeFocus();
    if (isCrit) { dmg = Math.round(dmg * (Game.TUNE.CRIT_MULT || 1.8)); Game.Audio.play('crit'); if (Game.Render.shake) Game.Render.shake(5); }
    const cfx = CALIBER_FX[sel.ammo] || null; // 口径別の着弾/薬莢演出(性能不変)
    const ang = Game.Projectiles.aimAngle ? Game.Projectiles.aimAngle() : 0;
    for (let i = 0; i < pellets; i++) {
      const spr = pellets > 1 ? (Math.random() - 0.5) * (sel.spread || 0.5) : (sel.spread || 0);
      Game.Projectiles.fire(dmg, kind, { spread: spr, explosive: sel.explosive || 0, speed: sel.bspeed, crit: isCrit, impact: cfx ? cfx.imp : null });
    }
    p.attackCd = sel.cd || 12;
    if (Game.UI.tipOnce) Game.UI.tipOnce('gun_strafe', '銃は撃ちながら移動できます（ストレイフ）。射撃中は射撃方向が固定されます');
    // マズルフラッシュ(銃口の閃光)。銃種で色/大きさを変える
    if (Game.Render.spawnMuzzle) {
      const mcol = sel.bkind === 'laser' || sel.bkind === 'pierce' ? (sel.color || '#9fd8ff') : (sel.bkind === 'rocket' ? '#ff9a3c' : '#ffe06a');
      const msc = sel.pellets ? 1.5 : (sel.explosive ? 1.6 : (sel.cd <= 6 ? 0.8 : 1));
      Game.Render.spawnMuzzle(p.x + Math.cos(ang) * 16, p.y + Math.sin(ang) * 16, ang, mcol, msc);
    }
    // 薬莢排出: 銃の横へ弾ける小片(ロケット/エネルギー系は出ない)
    if (cfx && kind !== 'rocket') {
      const cx2 = Math.cos(ang + Math.PI / 2), cy2 = Math.sin(ang + Math.PI / 2);
      Game.Render.spawnParticles(p.x + cx2 * 9, p.y + cy2 * 9 - 4, cfx.casing, 1);
    } else {
      Game.Render.spawnParticles(p.x, p.y, '#ffe9a0', 2);
    }
    // 反動キック: 撃った瞬間だけ照準の逆へ僅かに沈み、数tickで自動復元(視覚のみ)
    const kick = sel.explosive ? 3 : sel.pellets ? 2.4 : (sel.cd >= 30 ? 2.6 : (sel.cd <= 6 ? 0.7 : 1.3));
    const kkx = -Math.cos(ang) * kick, kky = -Math.sin(ang) * kick;
    if (!blocked(p.x + kkx, p.y + kky)) {
      p.x += kkx; p.y += kky;
      p.recoilN = 3; p.recoilX = kkx / 3; p.recoilY = kky / 3;
    }
    // 重火器は反動で画面が揺れる(スナイパー/ロケット/ショットガン=高cdや爆発)
    if (Game.Render.shake) { const recoil = sel.explosive ? 7 : sel.pellets ? 5 : (sel.cd >= 30 ? 6 : 0); if (recoil) Game.Render.shake(recoil); }
    Game.Audio.play(sel.gunsfx || 'gun');
    // 銃声は騒音: 周囲の敵を警戒させ引き寄せる(爆発武器ほど遠くまで響く)。近接/採掘は静か
    if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(p.x, p.y, sel.explosive ? 16 : sel.pellets ? 11 : 9, 150);
    if (p.mags[gid] <= 0 && Game.Inventory.count(sel.ammo) > 0) startReload(sel, gid); // 0になったら自動リロード
    Game.UI.refreshHotbar();
  }

  function tryStaff(sel) {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    // 流星/渦召喚の杖は近接攻撃ロジック側(Combat)で標的に効果を生む
    if (sel.strike || sel.vortex) { Game.Combat.tryAttack(); return; }
    if (Game.UI.tipOnce) Game.UI.tipOnce('mana', '杖などの魔法はマナ(🔮)を消費します。マナ系スキルで最大値/威力/回復を強化できます');
    if (!spendMana(sel.mpCost || 10)) { if (Game.state.tick % 30 === 0) Game.UI.toast('マナが足りない'); return; } // 魔法弾はマナ消費
    Game.Projectiles.fire(Math.round((sel.fireDmg || 12) * magicPower()), sel.magic || 'fire');
    p.attackCd = 16;
    Game.Render.spawnParticles(p.x, p.y, sel.magic === 'frost' ? '#9fd8ff' : '#ff7a3c', 4);
    Game.Audio.play('gun');
  }
  function tryThrow(sel) {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    const slot = Game.Inventory.selectedSlot(); if (!slot) return; // 投擲アイテムのID取得
    const t = sel.throw;
    Game.Projectiles.fire(t.dmg, t.kind, { explosive: t.explosive, speed: t.speed, chain: t.chain, count: t.count, spread: t.spread });
    Game.Inventory.remove(slot.id, 1);
    p.attackCd = 26; Game.Audio.play(t.kind === 'chain' ? 'thunder' : 'gun_rocket'); Game.UI.refreshHotbar();
  }
  function tryWarp() {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    let dx = 0, dy = 0; const it = Game.Input.intent;
    if (it.usePointer && it.mouseTile) { dx = (it.mouseTile.tx * TS + TS / 2) - p.x; dy = (it.mouseTile.ty * TS + TS / 2) - p.y; }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1; else if (p.dir === 'left') dx = -1; else dx = 1; }
    const len = Math.hypot(dx, dy) || 1; const dist = 6 * TS;
    let tx = p.x + dx / len * dist, ty = p.y + dy / len * dist;
    // 着地点が塞がっていたら手前に詰める
    for (let s = 6; s >= 1; s--) {
      const cx = p.x + dx / len * s * TS, cy = p.y + dy / len * s * TS;
      if (!blocked(cx, cy)) { tx = cx; ty = cy; break; }
    }
    Game.Render.spawnParticles(p.x, p.y, '#b06ad0', 10);
    p.x = tx; p.y = ty; p.prevX = tx; p.prevY = ty;
    Game.Render.spawnParticles(tx, ty, '#d8b0ff', 10);
    p.attackCd = 24; Game.Audio.play('shift');
  }

  // グラップリングフック: 狙った方向へ最大12タイル先の固形(壁/木/岩)に鉤を打ち、その手前まで一気に手繰り寄せる。
  // 水やギャップを越える爽快な移動。固形が無ければ空振り(短い前進のみ)。
  function tryGrapple() {
    const p = Game.state.player;
    if (p.attackCd > 0) return;
    let dx = 0, dy = 0; const it = Game.Input.intent;
    if (it.usePointer && it.mouseTile) { dx = (it.mouseTile.tx * TS + TS / 2) - p.x; dy = (it.mouseTile.ty * TS + TS / 2) - p.y; }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1; else if (p.dir === 'left') dx = -1; else dx = 1; }
    const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
    const MAX = 12;
    // 手前から外側へ走査し、最初の固形タイルを鉤の着点に。その1タイル手前が着地点
    let anchorS = 0;
    for (let s = 2; s <= MAX; s++) {
      const cx = p.x + ux * s * TS, cy = p.y + uy * s * TS;
      const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
      if (!Game.World.isWalkable(tx, ty)) { anchorS = s; break; }
    }
    if (!anchorS) { Game.UI.toast && (p.grapMiss = (p.grapMiss || 0) + 1); Game.Audio.play('dash'); p.attackCd = 14; return; } // 空振り
    // 着地点: 鉤の1タイル手前で歩ける最遠地点
    let land = null;
    for (let s = anchorS - 1; s >= 1; s--) {
      const cx = p.x + ux * s * TS, cy = p.y + uy * s * TS;
      if (Game.World.isWalkable(Math.floor(cx / TS), Math.floor(cy / TS))) { land = { x: cx, y: cy }; break; }
    }
    if (!land) { Game.Audio.play('dash'); p.attackCd = 14; return; }
    // 鉤の線を描く演出(発射→着点)
    const ax = p.x + ux * anchorS * TS, ay = p.y + uy * anchorS * TS;
    if (Game.Render.spawnLightning) Game.Render.spawnLightning(p.x, p.y, ax, ay); // 鉤の索(既存の線描画を流用)
    Game.Render.spawnParticles(ax, ay, '#ccb088', 8);
    p.x = land.x; p.y = land.y; p.prevX = land.x; p.prevY = land.y;
    Game.Render.spawnParticles(land.x, land.y, '#e8d0a0', 10);
    p.attackCd = 20; Game.Audio.play('dash'); if (Game.Audio.cue) Game.Audio.cue('shimmer');
  }

  function equipFromInventory(idx) {
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.armor || !def.slot) return;
    const p = Game.state.player;
    const prev = p.armor[def.slot];
    p.armor[def.slot] = { id: slot.id, roll: slot.roll || null };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1, roll: prev.roll || null } : null;
    applyEquipStats();
    Game.Audio.play('equip');
    Game.UI.toast(Game.Loot.displayName(p.armor[def.slot]) + ' を装備');
    Game.UI.refreshAll();
  }

  // 遺物(relic)アクセサリーを装備（スロット1つ・入替式）
  // 左手(オフハンド)スロットへ装備。盾/呼吸器などユーティリティを保持して常時機能させる
  function equipOffhand(idx) {
    const p = Game.state.player;
    if (idx == null) idx = p.hotbarIndex;
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.offhand) return;
    const prev = p.offhand;
    p.offhand = { id: slot.id };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1 } : null;
    applyEquipStats();
    Game.Audio.play('relic_get');
    Game.UI.toast(def.name + ' を左手に装備');
    Game.UI.refreshAll();
  }
  function equipRelic(idx) {
    const p = Game.state.player;
    if (idx == null) idx = p.hotbarIndex;
    const slot = Game.Inventory.slots()[idx];
    if (!slot) return;
    const def = Game.ITEMS[slot.id];
    if (!def || !def.relic) return;
    // 空いている遺物枠へ。両方埋まっていれば1枠目を入替
    const key = !p.accessory ? 'accessory' : (!p.accessory2 ? 'accessory2' : 'accessory');
    const prev = p[key];
    p[key] = { id: slot.id };
    Game.Inventory.slots()[idx] = prev ? { id: prev.id, count: 1 } : null;
    applyEquipStats();
    Game.Audio.play('relic_get');
    if (p.accessory && p.accessory2 && Game.Achievements) Game.Achievements.unlock('dual_relic');
    Game.UI.toast(def.name + ' を装備（遺物）');
    Game.UI.refreshAll();
  }

  // ===== 装備ロードアウト(5セット保存・切替) =====
  function gearSnapshot() {
    const p = Game.state.player, a = p.armor || {};
    const cp = it => it ? { id: it.id, roll: it.roll || null } : null;
    return { head: cp(a.head), chest: cp(a.chest), accessory: cp(p.accessory), accessory2: cp(p.accessory2) };
  }
  function rollKey(it) { return it ? it.id + '|' + JSON.stringify(it.roll || null) : ''; }
  // インベントリから ref に一致する1個を取り出して返す(見つからなければnull)
  function takeFromInv(ref) {
    if (!ref) return null;
    const s = Game.Inventory.slots(); const k = rollKey(ref);
    for (let i = 0; i < s.length; i++) {
      if (s[i] && rollKey(s[i]) === k) {
        const out = { id: s[i].id, roll: s[i].roll || null };
        if (s[i].count > 1) s[i].count--; else s[i] = null;
        return out;
      }
    }
    return null;
  }
  function unequipAllSilent() {
    const p = Game.state.player, a = p.armor || {};
    ['head', 'chest'].forEach(function (key) {
      const it = a[key]; if (!it) return;
      if (it.roll) Game.Inventory.addInstance({ id: it.id, roll: it.roll }); else Game.Inventory.add(it.id, 1);
      a[key] = null;
    });
    ['accessory', 'accessory2'].forEach(function (key) { if (p[key]) { Game.Inventory.add(p[key].id, 1); p[key] = null; } });
  }
  function saveLoadout(n) {
    const p = Game.state.player; if (!p.loadouts) p.loadouts = [null, null, null, null, null];
    p.loadouts[n] = gearSnapshot();
    Game.Audio.play('craft'); Game.UI.toast('装備セット ' + (n + 1) + ' を保存しました');
    if (Game.Save) Game.Save.autosave('loadout'); Game.UI.refreshAll();
  }
  function applyLoadout(n) {
    const p = Game.state.player; if (!p.loadouts || !p.loadouts[n]) { Game.UI.toast('セット ' + (n + 1) + ' は空です（保存してください）'); return; }
    const want = p.loadouts[n];
    unequipAllSilent(); // 現装備を一旦インベントリへ
    const a = p.armor || (p.armor = {});
    a.head = takeFromInv(want.head); a.chest = takeFromInv(want.chest);
    p.accessory = takeFromInv(want.accessory); p.accessory2 = takeFromInv(want.accessory2);
    applyEquipStats(); Game.Audio.play('equip'); Game.UI.toast('装備セット ' + (n + 1) + ' を装備'); Game.UI.refreshAll();
  }

  // 装備スロットを外してインベントリへ戻す。key: head/chest/accessory/accessory2
  function unequipSlot(key) {
    const p = Game.state.player;
    let item = null;
    if (key === 'head' || key === 'chest') { item = p.armor && p.armor[key]; }
    else if (key === 'accessory' || key === 'accessory2' || key === 'offhand') { item = p[key]; }
    if (!item) return false;
    const stack = (key === 'accessory' || key === 'accessory2' || key === 'offhand') ? { id: item.id, count: 1 } : { id: item.id, roll: item.roll || null };
    const ok = item.roll ? Game.Inventory.addInstance(stack) : (Game.Inventory.add(stack.id, 1) === 0);
    if (!ok) { Game.UI.toast('インベントリに空きがない'); return false; }
    if (key === 'head' || key === 'chest') p.armor[key] = null; else p[key] = null;
    applyEquipStats();
    Game.Audio.play('equip');
    Game.UI.refreshAll();
    return true;
  }

  function totalArmor() {
    const a = Game.state.player.armor;
    let s = 0;
    for (const k in a) if (a[k]) s += Game.Loot.stats(a[k]).armor;
    return s + (Game.state.player.gearOffhandArmor || 0) + setBonus().armor + levelArmorBonus() + skillBonus().armor + (Game.Status ? Game.Status.buffSum().armor : 0);
  }

  // 装備セット効果（head+chestが同セット）
  function setBonus() {
    const a = Game.state.player.armor;
    const out = { armor: 0, sanityResist: false, hungerSlow: 0, crit: 0, lifesteal: 0, moveSpd: 0, name: null };
    const hid = a.head && a.head.id, cid = a.chest && a.chest.id;
    if (!hid || !cid) return out;
    for (const k in Game.SETS) {
      const s = Game.SETS[k];
      if (s.items.indexOf(hid) >= 0 && s.items.indexOf(cid) >= 0) {
        if (s.armor) out.armor += s.armor;
        if (s.sanityResist) out.sanityResist = true;
        if (s.crit) out.crit += s.crit;
        if (s.lifesteal) out.lifesteal += s.lifesteal;
        if (s.moveSpd) out.moveSpd += s.moveSpd;
        if (s.hungerSlow) out.hungerSlow = Math.max(out.hungerSlow, s.hungerSlow);
        out.name = s.name;
      }
    }
    return out;
  }

  // 撃破したユニークボス種数（恒久報酬/称号の基礎）
  function bossesDefeated() {
    const best = (Game.state && Game.state.bestiary) || {}; let n = 0;
    for (const k in best) { const d = Game.MOBS[k]; if (d && d.boss && !d.npc && best[k] > 0) n++; }
    return n;
  }
  function bossTitle() {
    const n = bossesDefeated();
    if (n >= 13) return '万魔を統べる者';
    if (n >= 11) return '終焉に挑みし者';
    if (n >= 9) return '二相の覇者';
    if (n >= 6) return '魔物狩りの達人';
    if (n >= 3) return '歴戦の討伐者';
    if (n >= 1) return 'ボスハンター';
    return '旅人';
  }

  // 装備由来の最大HP等を反映（VIT＋レベル＋ボス討伐の恒久報酬も加味）
  function applyEquipStats() {
    const p = Game.state.player;
    let hpBonus = 0, gm = 0, gs = 0, gr = 0, gx = 0, gt = 0, ammoMul = 1, reflect = 0;
    for (const k in p.armor) if (p.armor[k]) { const st = Game.Loot.stats(p.armor[k]); const d = Game.ITEMS[p.armor[k].id] || {}; hpBonus += st.hp; gm += st.moveSpd || 0; gs += st.staminaMax || 0; gr += st.regen || 0; gx += st.xpBoost || 0; gt += (st.thorns || 0) + (d.thornsFixed || 0); if (d.ammoStack) ammoMul = Math.max(ammoMul, d.ammoStack); if (d.reflect) reflect += d.reflect; }
    // 装身具(accessory)＋左手(offhand)の反射盾・潜水呼吸器も合流
    let dive = false, ohArmor = 0;
    [p.accessory, p.accessory2, p.offhand].forEach(function (acc) { if (!acc) return; const d = Game.ITEMS[acc.id || acc]; if (!d) return; if (d.reflect) reflect += d.reflect; if (d.diveGear) dive = true; if (d.ohArmor) ohArmor += d.ohArmor; });
    p.waterBreath = dive; p.gearOffhandArmor = ohArmor;
    // 防具affixの実用チャンネルを集約(移動/スタミナ/HP回復/経験/棘反射/弾薬上限/ダメ反射)。stats/skill/setと重畳
    p.gearMoveSpd = gm; p.gearRegen = gr; p.gearXpBoost = gx; p.gearThorns = Math.min(0.6, gt); // 棘は上限60%(過剰反射防止)
    p.gearAmmoMul = ammoMul; p.gearReflect = Math.min(0.8, reflect); // 反射は上限80%
    const base = p.baseMaxHealth || 100;
    const sb = skillBonus();
    p.maxHealth = base + hpBonus + (p.vit || 0) * 5 + sb.hp + bossesDefeated() * 5; // ボス討伐ごとに最大HP+5
    p.maxStamina = 100 + sb.staminaMax + gs;
    p.maxMp = 100 + (sb.manaMax || 0);
    if (p.mp == null || p.mp > p.maxMp) p.mp = p.maxMp;
    if (p.health > p.maxHealth) p.health = p.maxHealth;
    if (p.stamina > p.maxStamina) p.stamina = p.maxStamina;
  }

  // ===== RPG: レベル/ステ/スキルツリーによる補正 =====
  function skillBonus() {
    const p = Game.state.player;
    const sk = p.skills || {};
    const o = { atk: 0, armor: 0, hp: 0, lifesteal: 0, moveSpd: 0, crit: 0, mining: 0, hungerSlow: 0, regen: 0, staminaMax: 0, xpBoost: 0 };
    for (const id in sk) {
      if (!sk[id]) continue; const n = Game.SKILL_BY_ID[id]; if (!n) continue;
      for (const k in n.eff) { if (k === 'flag') continue; o[k] = (o[k] || 0) + n.eff[k]; }
    }
    // 遺物(relic)アクセサリー2枠の効果を合流
    [p.accessory, p.accessory2].forEach(function (acc) {
      if (!acc) return; const d = Game.ITEMS[acc.id || acc]; if (d && d.relic) for (const k in d.relic) o[k] = (o[k] || 0) + d.relic[k];
    });
    return o;
  }
  function skillFlag(f) {
    const sk = Game.state.player.skills || {};
    for (const id in sk) { if (sk[id] && Game.SKILL_BY_ID[id] && Game.SKILL_BY_ID[id].eff.flag === f) return true; }
    return false;
  }
  function levelDmgBonus() { const p = Game.state.player; return (p.str || 0) + Math.floor((p.level - 1) * 0.5); }
  function levelArmorBonus() { const p = Game.state.player; return Math.floor(p.level / 4); }
  function attackCooldown() { const p = Game.state.player; return Math.max(7, Math.round(Game.TUNE.ATTACK_COOLDOWN * (1 - (p.dex || 0) * 0.02))); }
  function effAttack(baseAtk) { return Math.max(1, baseAtk + levelDmgBonus() + skillBonus().atk + (Game.Status ? Game.Status.buffSum().atk : 0)); }
  // 魔法系: マナ消費(スキルでコスト減)。足りなければ false。magicPower は魔法ダメージ倍率
  function manaCost(base) { const p = Game.state.player; return Math.max(1, Math.round(base * (1 - (skillBonus().manaCostCut || 0)))); }
  function spendMana(base) { const p = Game.state.player; const c = manaCost(base); if ((p.mp || 0) < c) return false; p.mp -= c; if (Game.UI.refreshStats) Game.UI.refreshStats(); return true; }
  function magicPower() { return 1 + (skillBonus().magicPower || 0); }
  // 装備比較用: 現在手持ち武器の実効攻撃 / 指定スロットの装備防御
  function currentWeaponAtk() {
    const sl = Game.Inventory.slots()[Game.state.player.hotbarIndex];
    const d = sl && Game.ITEMS[sl.id];
    return (d && d.attack != null) ? effAttack(Game.Loot.stats(sl).atk) : effAttack(1);
  }
  function equippedArmorAt(slot) { const a = Game.state.player.armor[slot]; return a ? Game.Loot.stats(a).armor : 0; }

  function spendStat(stat) {
    const p = Game.state.player;
    if (p.skillPoints <= 0) return false;
    if (stat !== 'str' && stat !== 'vit' && stat !== 'dex') return false;
    p[stat] = (p[stat] || 0) + 1; p.skillPoints--;
    applyEquipStats(); Game.UI.refreshStats && Game.UI.refreshStats();
    Game.Audio.play('levelup'); return true;
  }
  // ツリー: 前提を満たし、ポイント足りれば習得
  function canUnlock(id) {
    const p = Game.state.player, n = Game.SKILL_BY_ID[id];
    if (!n || p.skills[id]) return false;
    if (p.skillPoints < n.cost) return false;
    for (let i = 0; i < n.req.length; i++) if (!p.skills[n.req[i]]) return false;
    return true;
  }
  function unlockSkill(id) {
    const p = Game.state.player, n = Game.SKILL_BY_ID[id];
    if (!n || !canUnlock(id)) return false;
    p.skills[id] = 1; p.skillPoints -= n.cost;
    applyEquipStats(); if (p.health > p.maxHealth) p.health = p.maxHealth;
    Game.UI.refreshStats && Game.UI.refreshStats(); Game.Audio.play('enchant'); return true;
  }
  function respec() {
    const p = Game.state.player;
    let refunded = (p.str || 0) + (p.vit || 0) + (p.dex || 0);
    for (const id in p.skills) { if (p.skills[id] && Game.SKILL_BY_ID[id]) refunded += Game.SKILL_BY_ID[id].cost; }
    p.str = 0; p.vit = 0; p.dex = 0; p.skills = {}; p.skillPoints += refunded;
    applyEquipStats(); if (p.health > p.maxHealth) p.health = p.maxHealth;
    Game.UI.refreshStats && Game.UI.refreshStats();
    return refunded;
  }

  // 乗り物の耐久: 乗車中の被ダメは機体が肩代わり。0で大破シーケンス開始(搭乗者は放出)
  function vehicleTakeDamage(amount) {
    const p = Game.state.player;
    if (!p.vehicle || VEH_MAXDUR[p.vehicle] == null) return false; // 生身で受ける
    if (!p.vehDur) p.vehDur = {};
    if (p.vehDur[p.vehicle] == null) p.vehDur[p.vehicle] = VEH_MAXDUR[p.vehicle];
    p.vehDur[p.vehicle] = Math.max(0, p.vehDur[p.vehicle] - amount);
    if (Game.Render.shake) Game.Render.shake(Math.min(7, 2 + amount * 0.3));
    if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#ffb24a', 4);
    const dur = p.vehDur[p.vehicle], max = VEH_MAXDUR[p.vehicle];
    if (dur <= 0) startWreck(p.vehicle);
    else if (dur <= max * 0.3 && Game.state.tick % 45 === 0) { if (Game.Audio) Game.Audio.play('select'); Game.UI.toast('⚠ 機体が損傷している… 修理キットを'); }
    return true; // 機体が肩代わり=搭乗者は無傷
  }
  // 大破: 搭乗者を放出→5秒間の異音警告→一定範囲に大爆発(範囲内プレイヤーは即死)
  function startWreck(type) {
    const p = Game.state.player;
    p.vehicle = null; p.vThr = 0;
    if (Game.Audio && Game.Audio.vehicleLoop) Game.Audio.vehicleLoop(null);
    // 手持ちの当該乗り物アイテムを1つ破壊
    Game.Inventory.remove(type, 1);
    if (p.vehDur) delete p.vehDur[type];
    Game.state.vehWreck = { x: p.x, y: p.y, t: 150, type: type }; // 5秒(30fps)
    Game.UI.toast('💥 機体が大破する！ 5秒後に爆発——今すぐ離れろ！');
    if (Game.Audio) Game.Audio.play('event_horde');
    if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#ff5a2a', 24);
  }
  // 毎フレーム: 大破カウントダウン(異音)→爆発
  function updateWreck() {
    const w = Game.state.vehWreck; if (!w) return;
    w.t--;
    // 異音(周期を詰めて緊迫)＋煙
    const beatEvery = w.t < 40 ? 6 : w.t < 90 ? 12 : 20;
    if (w.t % beatEvery === 0 && Game.Audio) Game.Audio.play('select');
    if (Game.state.tick % 5 === 0 && Game.Render.spawnParticles) Game.Render.spawnParticles(w.x + (Math.random() - 0.5) * 20, w.y - 4, '#555', 2);
    if (w.t <= 0) {
      const TS = Game.CFG.TILE_SIZE, p = Game.state.player;
      const lethalR = 3 * TS, dmgR = 5.5 * TS;
      if (Game.Render.flash) Game.Render.flash('rgba(255,140,60,0.5)');
      if (Game.Render.shake) Game.Render.shake(14);
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(w.x, w.y, '#ff8a3c', 40);
      if (Game.Audio) Game.Audio.play('boom_sfx');
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d <= lethalR) Game.Survival.damage(9999, 'wreck');          // 至近=即死
      else if (d <= dmgR) Game.Survival.damage(Math.round(40 * (1 - (d - lethalR) / (dmgR - lethalR))), 'wreck');
      // 周囲のモブも巻き込む
      const mobs = Game.state.mobs;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (Math.hypot(m.x - w.x, m.y - w.y) <= dmgR) Game.Mobs.damageMob(m, 120, w.x, w.y, false); }
      if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(w.x, w.y, 16, 240); // 大爆発は遠くまで響く
      Game.state.vehWreck = null;
    }
  }
  // 最深部の「帰還の渦」: 入ってきた入口へ即ワープ(達成後の帰り道を短縮)
  function dungeonExitWarp() {
    const p = Game.state.player, e = Game.state.dungeonEntry;
    if (!e || e.world !== Game.state.worldName) { Game.UI.toast('入口の記録が見つからない…そのまま歩いて戻ろう'); return; }
    Game.Render.spawnParticles(p.x, p.y, '#9fd8ff', 20);
    p.x = e.x; p.y = e.y; p.prevX = e.x; p.prevY = e.y;
    Game.Render.spawnParticles(p.x, p.y, '#9fd8ff', 20);
    if (Game.Audio) Game.Audio.play('shift');
    Game.UI.toast('🌀 帰還の渦に飛び込み、ダンジョンの入口へ戻った');
  }
  function morningSkip() {
    const p = Game.state.player;
    const cur = Game.state.tick % Game.DAY_LENGTH;
    const morning = Math.floor(0.30 * Game.DAY_LENGTH);
    Game.state.tick += ((morning - cur) + Game.DAY_LENGTH) % Game.DAY_LENGTH;
    p.health = Math.min(p.maxHealth, p.health + 20);
  }
  function sleep() {
    const p = Game.state.player;
    // リスポーン地点をこのベッドに更新（死亡時はここへ戻る）
    const pt = playerTile();
    Game.state.spawn = { tx: pt.tx, ty: pt.ty };
    if (Game.Lighting.ambientDarkness() < 0.3) {
      p.sleeping = false;
      Game.UI.toast('リスポーン地点をここに設定した（昼は眠れない）');
      Game.Audio.play('select'); Game.UI.refreshAll(); return;
    }
    // マルチプレイ: マイクラ式に「同じ世界の全員が眠ると朝になる」。一人でも起きていれば待機
    if (Game.Net.isConnected()) {
      if (p.sleeping) { p.sleeping = false; Game.UI.toast('目を覚ました'); Game.Audio.play('select'); Game.UI.refreshAll(); return; }
      p.sleeping = true;
      const c = Game.Net.sleepCount(); // [asleep, total]
      Game.Audio.play('select');
      if (c[0] >= c[1]) { // 自分で最後の一人 → すぐ判定される
        Game.UI.toast('全員が眠りについた… 朝になる');
      } else {
        Game.UI.toast('💤 眠りについた（' + c[0] + '/' + c[1] + '）… 全員が眠ると朝になる。もう一度ベッドで起きる');
      }
      Game.UI.refreshAll(); return;
    }
    // ソロ: 即座に朝へ
    morningSkip();
    Game.Audio.play('craft');
    Game.UI.toast('おやすみ… 朝になった（リスポーン地点をここに設定）');
    Game.UI.refreshAll();
  }
  // 毎フレーム判定: MPで同じ世界の全員が就寝したら朝へ(各クライアントが独立に検知し同じ朝時刻へ収束)
  function checkGroupSleep() {
    const p = Game.state.player;
    if (!p || !p.sleeping || !Game.Net.isConnected()) return;
    if (Game.Lighting.ambientDarkness() < 0.3) { p.sleeping = false; return; } // 朝になったら解除
    if (Game.Net.allAsleep()) {
      morningSkip();
      p.sleeping = false;
      Game.Audio.play('craft');
      Game.UI.toast('🌅 全員が眠り、夜が明けた');
      Game.UI.refreshAll();
    }
  }

  // レベル必要EXP曲線（序盤は緩やか・レベルが上がるほど急峻に=cubic尾。最大Lv9999まで破綻しない）
  // lv1≈24, lv10≈300, lv20≈1075, lv50≈7240, lv100≈35715 と上位ほど加速度的に重くなる
  function xpForLevel(lv) { return Math.round(15 + lv * 7 + lv * lv * 2.0 + lv * lv * lv * 0.015); }

  function gainXP(n) {
    const p = Game.state.player;
    if (p.level >= (Game.MAX_LEVEL || 9999)) { p.xp = 0; return; }
    p.xp += Math.max(1, Math.round(n * (1 + skillBonus().xpBoost + (p.gearXpBoost || 0))));
    while (p.xp >= p.xpNext && p.level < (Game.MAX_LEVEL || 9999)) {
      p.xp -= p.xpNext; p.level++; p.xpNext = xpForLevel(p.level);
      p.baseMaxHealth = (p.baseMaxHealth || 100) + 2;
      p.skillPoints = (p.skillPoints || 0) + 2; // レベルごとにスキルポイント
      applyEquipStats();
      p.health = p.maxHealth;
      Game.Audio.play('levelup');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 20, 'LEVEL UP!', '#6fd0ff', true);
      // 祝祭の演出: 金色の粒子＋光輪＋フラッシュ
      if (Game.Render.spawnParticles) { Game.Render.spawnParticles(p.x, p.y, '#ffe27a', 22); Game.Render.spawnParticles(p.x, p.y, '#ffffff', 10); }
      if (Game.Render.spawnLevelRing) Game.Render.spawnLevelRing(p.x, p.y);
      if (Game.Render.flash) Game.Render.flash('rgba(255,225,130,0.18)');
      Game.UI.toast('レベルアップ！ Lv.' + p.level + '（スキルP +2）');
      if (Game.Achievements) { if (p.level >= 5) Game.Achievements.unlock('level5'); if (p.level >= 20) Game.Achievements.unlock('level20'); if (p.level >= 50) Game.Achievements.unlock('level50'); }
      if (p.level >= 10 && Game.Story && !Game.Story.seen('dawn')) Game.Story.unlock('dawn', true); // 一人前になった証として記憶回廊「黎明」
      if (Game.Save) Game.Save.autosave('levelup'); // 節目イベント: レベルアップで自動保存(4秒スロットル)
    }
    Game.UI.refreshStats();
  }

  function checkHazard() {
    const p = Game.state.player;
    if (p.invuln > 0) return;
    const pt = playerTile();
    const o = Game.World.objAt(pt.tx, pt.ty);
    const meta = Game.OBJ_META[o];
    if (meta && meta.touchDamage) Game.Survival.damage(meta.touchDamage, 'hazard');
  }

  function updateDrops() {
    const p = Game.state.player;
    const drops = Game.state.drops;
    const PR = Game.CFG.PICKUP_RADIUS;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const dx = p.x - d.x, dy = p.y - d.y;
      const dist = Math.hypot(dx, dy);
      // インベントリに空きが無い品は引き寄せず拾わない（地面に残す）
      if (!Game.Inventory.hasRoomFor(d.id, !!d.roll)) {
        if (dist < 22 && Game.state.tick % 60 === 0) Game.UI.toast('インベントリがいっぱい！');
        continue;
      }
      // 吸い込み演出: 近いほど加速する掃除機式の引き寄せ(気持ちよい回収)
      const magR = PR * 4;
      if (dist < magR) {
        const pull = 0.10 + (1 - dist / magR) * 0.42;
        d.x += dx * pull; d.y += dy * pull;
        d.suck = Math.min(1, (d.suck || 0) + 0.12); // 描画側で尾/縮小に使える
      }
      if (dist < 16) {
        if (d.roll) {
          if (Game.Inventory.addInstance(d)) {
            drops.splice(i, 1); Game.Audio.play('pickup'); Game.UI.refreshHotbar();
            Game.UI.toast('入手: ' + Game.Loot.displayName(d) + '（' + Game.Loot.rarityName(d) + '）');
          }
        } else {
          const overflow = Game.Inventory.add(d.id, d.count);
          if (overflow === 0) { drops.splice(i, 1); Game.Audio.play('pickup'); Game.UI.refreshHotbar(); }
          else d.count = overflow;
        }
      }
    }
  }

  return {
    makeDefault, spawnAt, update, targetTile, mining, playerTile, breakBlock,
    interact, useNearby, gainXP, totalArmor, setBonus, sleep, checkGroupSleep, vehicleTakeDamage, updateWreck, equipSelectedArmor, equipFromInventory, equipRelic, equipOffhand, unequipSlot, applyEquipStats, bossesDefeated, bossTitle, travelToWaypoint,
    effAttack, spendMana, manaCost, magicPower, attackCooldown, levelDmgBonus, levelArmorBonus, spendStat, unlockSkill, respec,
    skillBonus, skillFlag, canUnlock, currentWeaponAtk, equippedArmorAt, xpForLevel,
    reloadCurrent, magLoaded, magCap, selGunId, contextAction,
    saveLoadout, applyLoadout,
    focusArmed, consumeFocus,
  };
})();
