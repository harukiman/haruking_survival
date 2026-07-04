// combat.js — プレイヤーの近接攻撃
window.Game = window.Game || {};

Game.Combat = (function () {
  const TS = Game.CFG.TILE_SIZE;

  // 敵対モブが近接の間合いに居るか(コンボ中の採掘フォールバック防止用)
  function hostileInRange(p, rangePx) {
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m.def.hostile) continue;
      if (Math.hypot(m.x - p.x, m.y - p.y) <= rangePx + m.def.size * 0.5) return true;
    }
    return false;
  }

  // 攻撃入力時に呼ぶ。命中したら true（採掘より優先）
  function tryAttack() {
    const p = Game.state.player;
    const rangePx = Game.TUNE.ATTACK_RANGE * TS;
    // 戦車の主砲: 乗車中は攻撃ボタンで砲撃。戦車砲弾を消費し、着弾点で炸裂(範囲大ダメージ)
    if (p.vehicle === 'tank') {
      const tdef = Game.ITEMS.tank && Game.ITEMS.tank.tankCannon;
      if (!tdef) return true;
      if ((p.cannonCd || 0) > 0) return true;
      if (Game.Inventory.count('cannon_shell') <= 0) { if (Game.state.tick % 40 === 0) Game.UI.toast('戦車砲弾がない — クラフトして補充を'); return true; }
      Game.Inventory.remove('cannon_shell', 1);
      const it = Game.Input.intent; let tx, ty;
      if (it && it.usePointer && it.mouseTile) { tx = it.mouseTile.tx * TS + TS / 2; ty = it.mouseTile.ty * TS + TS / 2; }
      else { let dx = 0, dy = 0; if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1; else if (p.dir === 'left') dx = -1; else dx = 1; tx = p.x + dx * tdef.range * TS * 0.6; ty = p.y + dy * tdef.range * TS * 0.6; }
      Game.Projectiles.callMeteor(tx, ty, Game.Player.effAttack(tdef.dmg), tdef.radius);
      Game.Audio.play('boom_sfx'); if (Game.Render.shake) Game.Render.shake(6);
      if (Game.Render.spawnMuzzle) Game.Render.spawnMuzzle(p.x, p.y, Math.atan2(ty - p.y, tx - p.x), '#ffd86b', 1.5);
      if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(tx, ty, 14, 180); // 砲撃は着弾点にも大きな音
      p.cannonCd = tdef.cd;
      return true;
    }
    // 戦闘ロボの踏み鳴らし: 攻撃ボタンで自分中心の衝撃波(弾薬不要・CD付き)
    if (p.vehicle === 'mech') {
      const md = Game.ITEMS.battle_mech && Game.ITEMS.battle_mech.mechStomp;
      if (!md) return true;
      if ((p.cannonCd || 0) > 0) return true;
      const rr = md.r * TS, d = Game.Player.effAttack(md.dmg);
      const mobs2 = Game.state.mobs;
      for (let i = 0; i < mobs2.length; i++) { const m = mobs2[i]; if (m.def.friendly) continue; if (Math.hypot(m.x - p.x, m.y - p.y) <= rr + m.def.size * 0.5) Game.Mobs.damageMob(m, d, p.x, p.y, false); }
      if (Game.Render.spawnImpact) Game.Render.spawnImpact(p.x, p.y, '#cfd6e0');
      if (Game.Render.spawnParticles) Game.Render.spawnParticles(p.x, p.y, '#aab4c6', 14);
      if (Game.Render.shake) Game.Render.shake(7);
      Game.Audio.play('boom_sfx');
      if (Game.World.blastTerrain) Game.World.blastTerrain(p.x, p.y, md.r); // 踏み鳴らしで周囲の木/岩を破壊
      if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(p.x, p.y, 11, 150);
      p.cannonCd = md.cd;
      return true;
    }
    // 戦闘機の二連機関銃: 攻撃ボタンで前方へ弾丸を掃射(弾丸を消費)。高速連射・低CD
    if (p.vehicle === 'jet') {
      const jd = Game.ITEMS.fighter_jet && Game.ITEMS.fighter_jet.jetGun;
      if (!jd) return true;
      if ((p.cannonCd || 0) > 0) return true;
      // 増設した機関銃の基数だけ弾数が増える(基本2門+増設0-4=最大6門)。設置した数だけ掃射
      const mounted = (p.vehGuns && p.vehGuns.jet) || 0;
      const barrels = 2 + mounted;
      if (Game.Inventory.count('bullet') < barrels) { if (Game.state.tick % 40 === 0) Game.UI.toast('弾丸がない — 機関銃の弾を補充を'); return true; }
      Game.Inventory.remove('bullet', barrels);
      Game.Projectiles.fire(Game.Player.effAttack(jd.dmg), 'tracer', { count: barrels, spread: jd.spread + mounted * 0.03, speed: 12 });
      Game.Audio.play('gun_smg'); if (Game.Render.shake) Game.Render.shake(2);
      if (Game.Render.spawnMuzzle) { let fx = 0, fy = 0; if (p.dir === 'up') fy = -1; else if (p.dir === 'down') fy = 1; else if (p.dir === 'left') fx = -1; else fx = 1; Game.Render.spawnMuzzle(p.x + fx * 14, p.y + fy * 14, Math.atan2(fy, fx), '#ffe06a', 1.1); }
      if (Game.Mobs.alertNoise) Game.Mobs.alertNoise(p.x, p.y, 10, 120);
      p.cannonCd = jd.cd;
      return true;
    }
    // 爆撃機: 攻撃ボタンで搭載爆弾を投下(所持している爆弾を消費)。重い爆弾を優先
    if (p.vehicle === 'bomber') {
      if ((p.cannonCd || 0) > 0) return true;
      const bombIds = ['heavy_bomb', 'aerial_bomb'];
      let use = null; for (let i = 0; i < bombIds.length; i++) { if (Game.Inventory.count(bombIds[i]) > 0) { use = bombIds[i]; break; } }
      if (!use) { if (Game.state.tick % 40 === 0) Game.UI.toast('搭載爆弾がない — 爆弾をクラフトして搭載を'); return true; }
      const bd = Game.ITEMS[use].bomb;
      Game.Inventory.remove(use, 1);
      // 進行方向のやや後方(投下点)へ落下爆発。callMeteor で落ちる爆弾を演出
      let fx = 0, fy = 0; if (p.dir === 'up') fy = -1; else if (p.dir === 'down') fy = 1; else if (p.dir === 'left') fx = -1; else fx = 1;
      Game.Projectiles.callMeteor(p.x - fx * TS * 0.8, p.y - fy * TS * 0.8, Game.Player.effAttack(bd.dmg), bd.radius);
      Game.Audio.play('boom_sfx'); if (Game.Render.shake) Game.Render.shake(5);
      p.cannonCd = 28;
      return true;
    }
    if (p.attackCd > 0) {
      // 先行入力バッファ: CD残り~200ms(6tick)以内の入力は予約し、CD明けに自動発動(コンボが途切れない)
      if (p.attackCd <= 6) p.attackBuf = true;
      // 敵が間合いに居る間は true を返し、採掘へフォールバックさせない(連打中の入力食い/誤採掘防止)
      return hostileInRange(p, rangePx);
    }
    const mobs = Game.state.mobs;
    // 飛ぶ斬撃などの projectile 武器: 標的の有無に関わらず発射
    const _slot = Game.Inventory.selectedSlot(), _def = _slot && Game.ITEMS[_slot.id];
    // 流星召喚武器（流星の杖）: 範囲内の最寄り敵の頭上へ流星を落とす。敵が居なければ向いた先へ
    if (_def && _def.strike) {
      if (!Game.Player.spendMana(_def.mpCost || 18)) { if (Game.state.tick % 30 === 0) Game.UI.toast('マナが足りない'); return true; }
      const stk = _def.strike;
      const reach = (stk.range || 9) * TS;
      let bm = null, bd = Infinity;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= reach && d < bd) { bd = d; bm = m; } }
      let tx2, ty2;
      if (bm) { tx2 = bm.x; ty2 = bm.y; }
      else { let dx2 = 0, dy2 = 0; if (p.dir === 'up') dy2 = -1; else if (p.dir === 'down') dy2 = 1; else if (p.dir === 'left') dx2 = -1; else dx2 = 1; tx2 = p.x + dx2 * 4 * TS; ty2 = p.y + dy2 * 4 * TS; }
      Game.Projectiles.callMeteor(tx2, ty2, Math.round(Game.Player.effAttack(stk.dmg) * Game.Player.magicPower()), stk.radius);
      if (_def.wsfx) Game.Audio.play(_def.wsfx); else Game.Audio.play('swing');
      Game.Render.spawnSlash(p.x, p.y, p.dir, '#ffb24a');
      p.attackCd = stk.cd || Game.Player.attackCooldown();
      return true;
    }
    // 渦召喚武器（渦の杖）: 範囲内最寄り敵の位置に渦を生む。無標的なら向いた先
    if (_def && _def.vortex) {
      if (!Game.Player.spendMana(_def.mpCost || 22)) { if (Game.state.tick % 30 === 0) Game.UI.toast('マナが足りない'); return true; }
      const vx = _def.vortex;
      const reach = (vx.range || 8) * TS;
      let bm = null, bd = Infinity;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= reach && d < bd) { bd = d; bm = m; } }
      let tx2, ty2;
      if (bm) { tx2 = bm.x; ty2 = bm.y; }
      else { let dx2 = 0, dy2 = 0; if (p.dir === 'up') dy2 = -1; else if (p.dir === 'down') dy2 = 1; else if (p.dir === 'left') dx2 = -1; else dx2 = 1; tx2 = p.x + dx2 * 4 * TS; ty2 = p.y + dy2 * 4 * TS; }
      Game.Projectiles.callVortex(tx2, ty2, Math.round(Game.Player.effAttack(vx.dmg) * Game.Player.magicPower()), vx.radius, vx.dur);
      Game.Audio.play('whirl');
      Game.Render.spawnSlash(p.x, p.y, p.dir, '#b66ad0');
      p.attackCd = vx.cd || Game.Player.attackCooldown();
      return true;
    }
    // 溜め斬武器(居合/チャージ): 通常斬りはダメージ0。前回の攻撃から chg.min 秒以上「溜めて」から
    // 振ると、溜め時間が長いほど 会心率・ダメージ・ヒット数が上がる一撃を放つ。忍耐の武器。
    if (_def && _def.chg) {
      const chg = _def.chg;
      const now = Game.state.tick, TPS = 30;
      const last = p.chargeLastTick == null ? (now - 999 * TPS) : p.chargeLastTick;
      const elapsed = (now - last) / TPS; // 秒
      p.chargeLastTick = now; // このスイングで溜めをリセット
      // 向き
      let fx = 0, fy = 0; if (p.dir === 'up') fy = -1; else if (p.dir === 'down') fy = 1; else if (p.dir === 'left') fx = -1; else fx = 1;
      const rangePx2 = (chg.range || Game.TUNE.ATTACK_RANGE) * TS;
      let best = null, bd = Infinity;
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy); if (d > rangePx2 + m.def.size * 0.5) continue; if (d > 14 && (dx * fx + dy * fy) < 0) continue; if (d < bd) { bd = d; best = m; } }
      p.attackCd = chg.cd || Game.Player.attackCooldown();
      if (elapsed < (chg.min || 5)) {
        // 溜め不足: 手応えなし(ダメージ0)。視覚と音で「早すぎた」ことを伝える
        Game.Render.spawnSlash(p.x, p.y, p.dir, '#6a7a8a');
        Game.Audio.play('swing');
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 20, 'ため不足', '#8fa0b0');
        return true;
      }
      // 溜め完了: 時間で強化(min→max秒で 0→1)
      const f = Math.max(0, Math.min(1, (elapsed - (chg.min || 5)) / ((chg.max || 12) - (chg.min || 5))));
      const baseAtk = Game.Player.effAttack(chg.dmg || 20);
      const dmgMul = 1 + f * (chg.dmgScale || 3.0);       // 最大 4倍
      const critCh = (chg.critBase || 0.15) + f * (chg.critScale || 0.85); // 最大 ~100%
      const hits = 1 + Math.floor(f * (chg.hits || 3));    // 最大 4ヒット
      const col = f >= 0.999 ? '#ffe27a' : chg.color || '#ff9a4a';
      // 溜め切りの大演出
      Game.Render.spawnSlash(p.x, p.y, p.dir, col);
      Game.Render.shake(4 + Math.round(f * 8));
      if (f > 0.6 && Game.Render.flash) Game.Render.flash('rgba(255,220,140,' + (0.1 + f * 0.16).toFixed(3) + ')');
      Game.Audio.play(f > 0.8 ? 'crit' : 'swing');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 26, f >= 0.999 ? '真・一閃!' : '一閃', col, true);
      if (!best) return true; // 空振りでも溜めは解放される
      const canDirect = !(Game.Net.isConnected() && !Game.Net.host);
      // 範囲: 溜めが乗るほど周囲も巻き込む
      const cleave = f > 0.5;
      const victims = [];
      if (cleave) { for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; if (Math.hypot(m.x - best.x, m.y - best.y) <= rangePx2 * (0.5 + f * 0.6)) victims.push(m); } }
      else victims.push(best);
      for (let h = 0; h < hits; h++) {
        for (let i = 0; i < victims.length; i++) {
          const tg = victims[i]; if (!tg || tg.hp <= 0) continue;
          const isCrit = Math.random() < critCh;
          let dmg = Math.round(baseAtk * dmgMul * (isCrit ? (Game.TUNE.CRIT_MULT || 1.8) : 1));
          if (!canDirect) { Game.Net.sendHit(tg.id, dmg, p.x, p.y); Game.Render.spawnBlood(tg.x, tg.y, 4); }
          else Game.Mobs.damageMob(tg, dmg, p.x, p.y, isCrit);
          if (Game.Render.spawnImpact) Game.Render.spawnImpact(tg.x, tg.y, isCrit ? '#fff0a0' : col);
        }
      }
      return true;
    }
    // 隕石詠唱の杖: カーソル(or最寄り敵/正面)を指定し、長い詠唱の末に巨大隕石を落とす。
    // 詠唱中は無敵だがその場に停止する必要がある(動くと中断)。runSpecial ではなく状態(p.casting)で管理。
    if (_def && _def.castMeteor && !p.casting) {
      if (!Game.Player.spendMana(_def.mpCost || 45)) { if (Game.state.tick % 30 === 0) Game.UI.toast('マナが足りない — 詠唱には大きな魔力が要る'); return true; }
      const cm = _def.castMeteor;
      const it = Game.Input.intent;
      let tx2, ty2;
      if (it && it.usePointer && it.mouseTile) { tx2 = it.mouseTile.tx * TS + TS / 2; ty2 = it.mouseTile.ty * TS + TS / 2; }
      else {
        let bm = null, bd = Infinity, reach = (cm.range || 10) * TS;
        for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= reach && d < bd) { bd = d; bm = m; } }
        if (bm) { tx2 = bm.x; ty2 = bm.y; }
        else { let dx2 = 0, dy2 = 0; if (p.dir === 'up') dy2 = -1; else if (p.dir === 'down') dy2 = 1; else if (p.dir === 'left') dx2 = -1; else dx2 = 1; tx2 = p.x + dx2 * 5 * TS; ty2 = p.y + dy2 * 5 * TS; }
      }
      p.casting = { type: 'meteor', tx: tx2, ty: ty2, until: Game.state.tick + (cm.dur || 300), dur: (cm.dur || 300), radius: cm.radius || 4, dmg: Math.round(Game.Player.effAttack(cm.dmg || 120) * Game.Player.magicPower()), sfx: cm.sfx || 'whirl' };
      Game.Audio.play('whirl');
      if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 28, '詠唱開始…', '#ffb24a', true);
      p.attackCd = 20;
      return true;
    }
    let projFired = false;
    if (_def && _def.proj) {
      const pj = _def.proj;
      Game.Projectiles.fire(Game.Player.effAttack(pj.dmg || (Game.Loot.stats(_slot).atk)), pj.kind, { count: pj.count, spread: pj.spread, pierce: pj.pierce, chain: pj.chain, boomerang: pj.boomerang, speed: pj.speed, big: pj.big });
      if (_def.wsfx) Game.Audio.play(_def.wsfx);
      Game.Render.spawnSlash(p.x, p.y, p.dir, pj.kind === 'chain' ? '#fff07a' : pj.kind === 'pierce' ? '#7fe0ff' : '#cfefff');
      projFired = true;
    }
    // 向きベクトル
    let fx = 0, fy = 0;
    if (p.dir === 'up') fy = -1; else if (p.dir === 'down') fy = 1;
    else if (p.dir === 'left') fx = -1; else fx = 1;

    let best = null, bestD = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.friendly) continue; // 友好NPCは攻撃しない
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > rangePx + m.def.size * 0.5) continue;
      // 前方180°以内（または至近）
      const dot = (dx * fx + dy * fy);
      if (d > 14 && dot < 0) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    if (!best) {
      // 瞬歩武器は近接標的が無くても向いている方向へ踏み込める(ギャップクローザー)
      if (_def && _def.special && _def.special.type === 'blink') {
        const sp = _def.special, now2 = Game.state.tick;
        const slot0 = Game.Inventory.selectedSlot(), key2 = sp.type + ':' + (slot0 && slot0.id);
        if ((p.stamina || 0) >= (sp.stam || 12) && (p.spCd[key2] || 0) <= now2) {
          const st0 = Game.Loot.stats(slot0);
          const baseDmg0 = Game.Player.effAttack(st0.atk > 0 ? st0.atk : 1);
          p.spCd[key2] = now2 + (sp.cd || 18);
          const aim = blinkAim(p, sp);
          blinkStrike(p, sp, baseDmg0, aim[0], aim[1]);
          p.attackCd = Game.Player.attackCooldown();
          return true;
        }
      }
      // 近接標的が無くても、飛ぶ斬撃等は撃ったのでクールダウンを消費
      if (projFired) { p.attackCd = (_def.proj.cd) || Game.Player.attackCooldown(); Game.Audio.play('swing'); return true; }
      return false;
    }

    const slot = Game.Inventory.selectedSlot();
    const st = Game.Loot.stats(slot);
    // 武器ダメージにレベル/STR/スキル補正（同じ装備でもレベルで±）
    let dmg = Game.Player.effAttack(st.atk > 0 ? st.atk : 1);
    // 連撃ボーナス: コンボ中は攻撃力が少し上がる(2%/連・最大+20%)。攻めるほど気持ちよく(Hades/Dead Cells調)
    const comboMul = 1 + Math.min(0.20, (Game.state.combo || 0) * 0.02);
    dmg = Math.round(dmg * comboMul);
    const baseDmg = dmg; // 特殊効果のスケール基準(会心補正前)
    // 会心（クリティカル）: 基礎8% ＋ スキル ＋ 装備affix。クリ時 1.8x。パッシブ「集中」は確定会心
    const critCh = (Game.TUNE.BASE_CRIT || 0.08) + Game.Player.skillBonus().crit + (st.crit || 0) + (Game.Player.setBonus().crit || 0) + (p.coopNear ? 0.05 : 0);
    const focusCrit = Game.Player.focusArmed && Game.Player.focusArmed();
    const isCrit = focusCrit || Math.random() < critCh;
    if (isCrit) { dmg = Math.round(dmg * (Game.TUNE.CRIT_MULT || 1.8)); Game.Render.shake(7); Game.Audio.play('crit'); }
    if (focusCrit) Game.Player.consumeFocus();
    // 範囲攻撃: スキル「旋風斬り」 or 範囲武器(大剣/戦鎚)は範囲内の敵すべてに当てる
    const wdef = slot && Game.ITEMS[slot.id];
    const aoe = Game.Player.skillFlag('aoe') || (wdef && wdef.aoe);
    if (isCrit && Game.Render.spawnFloat) Game.Render.spawnFloat(best.x, best.y - 22, '会心!', '#ff5a4a', true);
    const targets = [];
    if (aoe) {
      for (let i = 0; i < mobs.length; i++) { const m = mobs[i]; if (m.def.friendly) continue; if (Math.hypot(m.x - p.x, m.y - p.y) <= rangePx + m.def.size * 0.5) targets.push(m); }
    } else targets.push(best);
    // アタックの踏み込み(ランジ): 標的方向へ少し踏み込み、当てた手応えを出す(壁は尊重)
    if (best) {
      const ldx = best.x - p.x, ldy = best.y - p.y, ll = Math.hypot(ldx, ldy) || 1;
      const step = Math.min(6, ll * 0.22), nx = p.x + ldx / ll * step, ny = p.y + ldy / ll * step;
      if (Game.World.isWalkable(Math.floor(nx / TS), Math.floor(ny / TS))) { p.x = nx; p.y = ny; }
    }
    const canDirect = !(Game.Net.isConnected() && !Game.Net.host); // マルチのゲスト中は直接ダメージ不可
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (!canDirect) { Game.Net.sendHit(tg.id, dmg, p.x, p.y); Game.Render.spawnBlood(tg.x, tg.y, 4); }
      else Game.Mobs.damageMob(tg, dmg, p.x, p.y, isCrit);
      // 命中スパーク(打撃の手応え): 接触点に白い火花。会心は強め
      if (Game.Render.spawnImpact) Game.Render.spawnImpact((p.x + tg.x) / 2, (p.y + tg.y) / 2, isCrit ? '#fff0a0' : '#ffffff');
    }
    // 上位武器の特殊効果(雷鳴/残光/衝撃波/吸命/纏い)。ホスト/ソロのみ(ゲストはダメージ権限なし)
    let kills = 0;
    if (canDirect) {
      for (let i = 0; i < targets.length; i++) if (targets[i].hp <= 0) kills++;
      runSpecial(p, wdef, slot, targets, best, baseDmg, kills, rangePx);
    }
    // 吸血（装備のvampiric＋スキル lifesteal）
    let ls = (st.lifesteal || 0) + Game.Player.skillBonus().lifesteal + (Game.Player.setBonus().lifesteal || 0);
    if (ls > 0 && p.health < p.maxHealth) {
      p.health = Math.min(p.maxHealth, p.health + Math.max(1, Math.round(dmg * ls)));
      Game.UI.refreshStats();
    }
    p.attackCd = (projFired && _def.proj.cd) ? _def.proj.cd : Game.Player.attackCooldown();
    Game.Render.spawnSlash(p.x, p.y, p.dir, st.atk >= 8 ? '#ffd86b' : '#ffffff');
    Game.Audio.play('swing');
    return true;
  }

  // ===== 上位近接武器の特殊効果(data-driven: ITEMS[].special) =====
  // 初回発動は盛大に・以降は控えめに(セッション毎リセット)
  const PROC_SEEN = {};
  function procFx(x, y, sp) {
    const first = !PROC_SEEN[sp.name]; PROC_SEEN[sp.name] = 1;
    const col = sp.color || '#ffe27a';
    if (Game.Render.spawnFloat) Game.Render.spawnFloat(x, y - 26, sp.name, col, first);
    if (first) {
      Game.Render.spawnParticles(x, y, col, 16);
      if (Game.Render.flash) Game.Render.flash('rgba(255,240,200,0.10)');
    }
  }

  // 敵対モブを近い順に最大 n 体(除外集合あり)
  function nearestHostiles(px, py, reachPx, n) {
    const out = [];
    const mobs = Game.state.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.friendly || m.def.npc || m.hp <= 0) continue;
      const d = Math.hypot(m.x - px, m.y - py);
      if (d <= reachPx) out.push([d, m]);
    }
    out.sort(function (a, b) { return a[0] - b[0]; });
    return out.slice(0, n).map(function (e) { return e[1]; });
  }

  function facingVec(p) { return p.dir === 'left' ? [-1, 0] : p.dir === 'right' ? [1, 0] : p.dir === 'up' ? [0, -1] : [0, 1]; }
  // 瞬歩斬の本体: (dirx,diry)方向へ sp.tiles マス瞬間移動し、軌跡上の敵に斬撃+(感電)+(出血DoT)。
  // 標的が無くても向いている方向へ踏み込める(ギャップクローザー)。スタミナ消費でインフレ防止。
  function blinkStrike(p, sp, baseDmg, dirx, diry) {
    const cost = sp.stam || 12;
    if ((p.stamina || 0) < cost) { if (Game.UI && Game.state.tick % 30 === 0) Game.UI.toast('スタミナ不足 — 瞬歩できない'); return false; }
    p.stamina = Math.max(0, p.stamina - cost);
    const dl = Math.hypot(dirx, diry) || 1, dx = dirx / dl, dy = diry / dl;
    const sx = p.x, sy = p.y, maxT = sp.tiles || 4;
    let ex = sx, ey = sy;
    for (let s = 1; s <= maxT; s++) {
      const nx = sx + dx * s * TS, ny = sy + dy * s * TS;
      if (!Game.World.isWalkable(Math.floor(nx / TS), Math.floor(ny / TS))) break;
      ex = nx; ey = ny;
    }
    const bd = Math.max(1, Math.round(baseDmg * (sp.pct || 0.85)));
    const shock = sp.shockPct ? Math.max(1, Math.round(baseDmg * sp.shockPct)) : 0;
    const corr = TS * (sp.width || 0.9), col = sp.color || '#8fd0ff';
    const segLen2 = ((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy)) || 1;
    for (let i = 0; i < Game.state.mobs.length; i++) {
      const m = Game.state.mobs[i]; if (m.def.friendly || m.def.npc || m.hp <= 0) continue;
      let t = ((m.x - sx) * (ex - sx) + (m.y - sy) * (ey - sy)) / segLen2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = sx + (ex - sx) * t, cy = sy + (ey - sy) * t;
      if (Math.hypot(m.x - cx, m.y - cy) <= corr + m.def.size * 0.4) {
        Game.Mobs.damageMob(m, bd, sx, sy, false);
        if (shock > 0) { Game.Mobs.damageMob(m, shock, sx, sy, false); Game.Render.spawnLightning(m.x + (Math.random() - 0.5) * 16, m.y - 120, m.x, m.y); }
        if (sp.bleed && Game.Mobs.applyBleed) { const bdmg = Math.max(1, Math.round(baseDmg * (sp.bleed.pct || 0.5))); Game.Mobs.applyBleed(m, bdmg, sp.bleed.dur || 90, sp.bleed.every || 30, col); }
        Game.Render.spawnImpact(m.x, m.y, col);
      }
    }
    p.x = ex; p.y = ey; p.invuln = Math.max(p.invuln || 0, 6);
    Game.Render.spawnParticles(sx, sy, col, 8); Game.Render.spawnParticles(ex, ey, col, 10);
    if (Game.Render.spawnSlash) Game.Render.spawnSlash(ex, ey, p.dir, col);
    Game.Audio.play('dodge_just');
    procFx(ex, ey, sp);
    return true;
  }
  // 向き優先で瞬歩先を決める: 射程内かつ前方寄りの最寄り敵へ、居なければ向いている方向へ
  function blinkAim(p, sp) {
    const fv = facingVec(p), reach = (sp.tiles || 4) * TS * 1.2, mobs = Game.state.mobs;
    let best = null, bd = Infinity;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i]; if (m.def.friendly || m.def.npc || m.hp <= 0) continue;
      const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
      if (d > reach) continue;
      if (d > 20 && (dx * fv[0] + dy * fv[1]) < 0) continue; // 背後は無視
      if (d < bd) { bd = d; best = m; }
    }
    return best ? [best.x - p.x, best.y - p.y] : fv;
  }
  function runSpecial(p, wdef, slot, targets, best, baseDmg, kills, rangePx) {
    const sp = wdef && wdef.special;
    if (!sp) return;
    const now = Game.state.tick;
    // 纏い(brand): CDなし。命中した敵全員に既存DoTを付与(炎上/凍え/毒)。演出は控えめ
    if (sp.type === 'brand') {
      for (let i = 0; i < targets.length; i++) {
        if (targets[i].hp <= 0) continue;
        Game.Mobs.applyDot(targets[i], sp.dot);
        Game.Render.spawnParticles(targets[i].x, targets[i].y, sp.color || '#ff7a3a', 3);
      }
      if (!PROC_SEEN[sp.name] && targets.length) procFx(best.x, best.y, sp);
      return;
    }
    // 吸命(reap): 撃破時のみ。小回復＋緑の粒子。短CDで多重撃破の暴発を防ぐ
    if (sp.type === 'reap') {
      if (!p.spCd) p.spCd = {};
      const rk = 'reap:' + slot.id;
      if (kills > 0 && (p.spCd[rk] || 0) <= now) {
        p.spCd[rk] = now + (sp.cd || 30);
        const heal = Math.max(2, Math.round(p.maxHealth * (sp.healPct || 0.03)));
        if (p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + heal);
        procFx(p.x, p.y, sp);
        if (Game.Render.spawnFloat) Game.Render.spawnFloat(p.x, p.y - 14, '+' + heal, '#8fe06a');
        Game.Render.spawnParticles(p.x, p.y, '#8fe06a', 6);
        Game.Audio.play('eat');
        Game.UI.refreshStats();
      }
      return;
    }
    // 以降はCD制(雷鳴/残光/衝撃波)
    if (!p.spCd) p.spCd = {};
    const key = sp.type + ':' + slot.id;
    if ((p.spCd[key] || 0) > now) return;
    if (sp.type === 'thunder') {
      // 周囲の敵 最大count体に天雷(武器攻撃力の pct 倍)
      const victims = nearestHostiles(p.x, p.y, 6 * TS, sp.count || 2);
      if (!victims.length) return;
      p.spCd[key] = now + (sp.cd || 90);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.5)));
      for (let i = 0; i < victims.length; i++) {
        const m = victims[i];
        Game.Render.spawnLightning(m.x + (Math.random() - 0.5) * 20, m.y - 170, m.x, m.y);
        Game.Render.spawnImpact(m.x, m.y, sp.color || '#ffe27a');
        Game.Mobs.damageMob(m, d, p.x, p.y, false);
      }
      Game.Audio.play('thunder');
      procFx(victims[0].x, victims[0].y, sp);
    } else if (sp.type === 'shock') {
      // 自分中心の衝撃波リング(半径 r タイル)。dot 指定があれば併せて付与
      p.spCd[key] = now + (sp.cd || 75);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.45)));
      const rr = (sp.r || 2.2) * TS;
      const victims = nearestHostiles(p.x, p.y, rr, 99);
      Game.Render.spawnImpact(p.x, p.y, sp.color || '#ffd86b');
      Game.Render.spawnParticles(p.x, p.y, sp.color || '#ffd86b', 12);
      Game.Render.shake(5);
      for (let i = 0; i < victims.length; i++) {
        const m = victims[i];
        Game.Mobs.damageMob(m, d, p.x, p.y, false);
        if (sp.dot) Game.Mobs.applyDot(m, sp.dot);
      }
      Game.Audio.play('boom_sfx');
      procFx(p.x, p.y, sp);
    } else if (sp.type === 'nova') {
      // 新星: 命中した敵を中心に元素の爆発。周囲へ pct 倍ダメージ＋DoT。標的に炸裂
      if (!best) return;
      p.spCd[key] = now + (sp.cd || 80);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.5)));
      const rr = (sp.r || 2.0) * TS;
      const victims = nearestHostiles(best.x, best.y, rr, 99);
      const col = sp.color || '#9fd8ff';
      Game.Render.spawnImpact(best.x, best.y, col);
      Game.Render.spawnParticles(best.x, best.y, col, 16);
      if (Game.Render.flash) Game.Render.flash('rgba(160,216,255,0.14)');
      for (let i = 0; i < victims.length; i++) { const m = victims[i]; if (m === best) continue; Game.Mobs.damageMob(m, d, best.x, best.y, false); if (sp.dot) Game.Mobs.applyDot(m, sp.dot); }
      if (sp.dot) Game.Mobs.applyDot(best, sp.dot);
      Game.Audio.play('boom_sfx');
      procFx(best.x, best.y, sp);
    } else if (sp.type === 'echo') {
      // 残光: 本命中の後、遅延した追撃を hits 回(それぞれ pct 倍)。player.update が消化
      if (!best || best.hp <= 0) return;
      p.spCd[key] = now + (sp.cd || 60);
      const d = Math.max(1, Math.round(baseDmg * (sp.pct || 0.4)));
      if (!p.echoQ) p.echoQ = [];
      const hits = sp.hits || 2;
      for (let i = 1; i <= hits; i++) p.echoQ.push({ t: now + i * 4, m: best, d: d, color: sp.color || '#ffe9f0' });
      procFx(best.x, best.y, sp);
    } else if (sp.type === 'blink') {
      // 瞬歩斬: スタミナが足りれば発動(足りなければCD据え置きで通常斬りのみ)
      if ((p.stamina || 0) < (sp.stam || 12)) return;
      p.spCd[key] = now + (sp.cd || 18);
      const aim = blinkAim(p, sp);
      blinkStrike(p, sp, baseDmg, aim[0], aim[1]);
    }
  }

  return { tryAttack };
})();
