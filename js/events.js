// events.js — 動的ワールドイベント。emergent な「常に何かが起きる」サンドボックス演出
//   流星群(夜): 星のかけらが降る / 物資投下(昼): 補給物資のクレートが落ちてくる
//   流れ星(夜): 願いが小さな力に / 渡り鳥(昼): 未踏の方角を示す / 行商人の焚き火(夜): 灯りを訪ねて商い
//   地鳴り(昼): 近くの鉱脈を告げる / 朝霧: 夜明けの露が作物を潤す
window.Game = window.Game || {};

Game.Events = (function () {
  const SHOWER_DUR = 30 * 22;      // 流星群の継続(約22秒)
  const COOLDOWN = 30 * 100;       // イベント間の最短間隔(約100秒)
  const LAND_EVERY = 130;          // 落下流星の間隔tick→1回で約5発
  const MAX_LAND = 6;
  const STAR_DUR = 30 * 8;         // 流れ星(約8秒)
  const FLOCK_DUR = 30 * 13;       // 渡り鳥(約13秒)
  const MERCHANT_DUR = 30 * 75;    // 行商人の焚き火(約75秒)
  const QUAKE_DUR = 30 * 45;       // 地鳴りの鉱脈マーカー(約45秒)
  const RAINBOW_DUR = 30 * 55;     // 虹の宝(約55秒)

  const SUPPLY = ['bandage', 'cooked_meat', 'bread', 'torch', 'antidote'];
  const HORDE_POOL = ['zombie', 'skeleton', 'spider', 'slime', 'leech', 'bat', 'gazer', 'harpy', 'viper'];
  const WISH_BUFFS = ['swiftness', 'regen_buff', 'wellfed'];   // 既存バフのみ・控えめな持続
  const WISH_LABEL = { swiftness: '足取りが軽くなる', regen_buff: '傷が癒えていく', wellfed: '身体の芯が温かい' };
  const DIR_NAMES = ['東', '南東', '南', '南西', '西', '北西', '北', '北東']; // atan2 の八分円順
  const EVENT_NAME = { meteor: '☄️ 流星群', horde: '⚔️ 魔物の侵攻', supply: '📦 物資投下', star: '🌠 流れ星', flock: '🕊 渡り鳥', merchant: '🔥 行商人の焚き火', quake: '⛰ 地鳴りの残響', rainbow: '🌈 虹のたもと' };
  const EVENT_COLOR = { meteor: '#ffe27a', horde: '#ff6a5a', supply: '#caa86a', star: '#ffe9a0', flock: '#bfe0ff', merchant: '#ffab5a', quake: '#d8a05a', rainbow: '#8fd0ff' };

  let cd = 30 * 35;
  let active = null;
  let lastFogDay = -1;

  function reset() { cd = 30 * 35; active = null; lastFogDay = -1; }
  function current() { return active; }

  function update() {
    const s = Game.state; if (!s || s.paused) return;
    if (active) {
      switch (active.type) {
        case 'meteor': tickMeteor(s); break;
        case 'supply': tickSupply(s); break;
        case 'horde': tickHorde(s); break;
        case 'star': tickStar(s); break;
        case 'flock': tickFlock(s); break;
        case 'merchant': tickMerchant(s); break;
        case 'quake': tickQuake(s); break;
        case 'rainbow': tickRainbow(s); break;
      }
      return;
    }
    fogDawnCheck(s);
    if (cd > 0) { cd--; return; }
    if (s.worldName === 'light' && !s.bloodMoon && Game.DayNight) {
      const night = Game.DayNight.isNight();
      if (night) {
        const r = Math.random();
        if (r < 0.02) startMeteor();
        else if (r < 0.04) startHorde();
        else if (r < 0.052) startStar();
        else if (r < 0.062) startMerchant();
        else cd = 30 * 10;
      } else {
        const r = Math.random();
        if (r < 0.012) startGoldThief();
        else if (r < 0.027) startSupply();
        else if (r < 0.038) startFlock();
        else if (r < 0.046) startQuake();
        else if (r < 0.056 && s.weather && (s.weather.type === 'rain' || s.weather.type === 'clear')) startRainbow();
        else cd = 30 * 10;
      }
    } else {
      cd = 30 * 6;
    }
  }

  // ---- 朝霧: 夜明け直後、晴れなら稀に霧へ(1日1回判定)。天候は save 対象なので永続 ----
  function fogDawnCheck(s) {
    if (s.worldName !== 'light' || s.bloodMoon || !s.weather) return;
    const t = s.timeOfDay;
    if (t < 0.225 || t > 0.25) return;
    const day = Math.floor(s.tick / Game.DAY_LENGTH);
    if (day === lastFogDay) return;
    lastFogDay = day;
    if (s.weather.type === 'clear' && Math.random() < 0.3) {
      s.weather.type = 'fog';
      s.weather.timer = 1500 + Math.floor(Math.random() * 1200);
      if (Game.UI) Game.UI.toast('🌫 朝霧が立ちこめる… 露が作物を潤す静かな朝だ');
      if (Game.Audio && Game.Audio.cue) Game.Audio.cue('swell');
    }
  }

  // ---- 流れ星: 一筋の光が夜空を渡る。願いはささやかな力になる(既存バフ・控えめ) ----
  function startStar() {
    active = { type: 'star', t: STAR_DUR, wished: false };
    if (Game.UI) Game.UI.toast('🌠 流れ星だ…！ 消える前に願いを込めよう');
    if (Game.Audio && Game.Audio.cue) Game.Audio.cue('shimmer');
  }

  function tickStar(s) {
    const a = active; a.t--;
    if (!a.wished && a.t <= STAR_DUR - 50) {
      a.wished = true;
      if (Game.Status) {
        const pick = WISH_BUFFS[Math.floor(Math.random() * WISH_BUFFS.length)];
        Game.Status.apply(pick, pick === 'wellfed' ? 600 : 30 * 45);
        if (Game.UI) Game.UI.toast('✨ 願いが届いた — ' + (WISH_LABEL[pick] || '') + '…');
      }
      if (Game.Audio) Game.Audio.play('relic_get');
    }
    if (a.t <= 0) { active = null; cd = COOLDOWN; }
  }

  // ---- 渡り鳥の群れ: 未踏の方角へ飛んでいく。探索の道しるべ＋心が和む(正気ほんの少し回復) ----
  function unexploredDir() {
    // discovered のセクター記録('world:kind:sx,sy')を八分円で数え、最も記録が薄い方角を選ぶ(O(記録数))
    const s = Game.state, TS = Game.CFG.TILE_SIZE;
    const psx = Math.floor(s.player.x / TS / 40), psy = Math.floor(s.player.y / TS / 40);
    const cnt = [0, 0, 0, 0, 0, 0, 0, 0];
    const disc = s.discovered || {};
    for (const k in disc) {
      const parts = k.split(':');
      if (parts[0] !== s.worldName || !parts[2]) continue;
      const xy = parts[2].split(',');
      const dx = parseInt(xy[0], 10) - psx, dy = parseInt(xy[1], 10) - psy;
      if (!dx && !dy) continue;
      cnt[Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7]++;
    }
    let best = Math.floor(Math.random() * 8);
    for (let i = 0; i < 8; i++) if (cnt[i] < cnt[best]) best = i;
    return best;
  }

  function startFlock() {
    const oct = unexploredDir();
    const ang = oct * Math.PI / 4;
    const p = Game.state.player;
    active = { type: 'flock', t: FLOCK_DUR, ang: ang, x: p.x - Math.cos(ang) * 400, y: p.y - Math.sin(ang) * 400 - 120, spd: 3.6 };
    if (Game.TUNE) Game.state.sanity = Math.min(Game.TUNE.SANITY_MAX, Game.state.sanity + 3); // 心和む(控えめ)
    if (Game.UI) Game.UI.toast('🕊 渡り鳥の群れだ… 鳥たちは' + DIR_NAMES[oct] + 'の彼方へ向かっていく');
    if (Game.Audio && Game.Audio.cue) Game.Audio.cue('shimmer');
  }

  function tickFlock() {
    const a = active; a.t--;
    a.x += Math.cos(a.ang) * a.spd;
    a.y += Math.sin(a.ang) * a.spd;
    if (a.t <= 0) { active = null; cd = COOLDOWN; }
  }

  // ---- 行商人の焚き火: 夜だけ、近くに灯りがともる。訪ねれば旅商人と商いできる ----
  function startMerchant() {
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    let mx = p.x + TS * 6, my = p.y;
    for (let k = 0; k < 12; k++) {
      const ang = Math.random() * Math.PI * 2, d = 6 + Math.random() * 3;
      const tx = Math.floor(p.x / TS + Math.cos(ang) * d), ty = Math.floor(p.y / TS + Math.sin(ang) * d);
      if (Game.World.isWalkable(tx, ty)) { mx = tx * TS + TS / 2; my = ty * TS + TS / 2; break; }
    }
    active = { type: 'merchant', t: MERCHANT_DUR, x: mx, y: my };
    if (Game.UI) Game.UI.toast('🔥 遠くに焚き火の灯り… 行商人だ。夜が明ける前に訪ねよう');
    if (Game.Audio) Game.Audio.play('event_supply');
  }

  function tickMerchant(s) {
    const a = active; a.t--;
    const p = s.player;
    if (Math.hypot(p.x - a.x, p.y - a.y) < Game.CFG.TILE_SIZE * 1.7) {
      active = null; cd = COOLDOWN;
      if (Game.Audio) Game.Audio.play('relic_get');
      if (Game.UI && Game.UI.openTrade) Game.UI.openTrade();
      return;
    }
    if (a.t <= 0 || (Game.DayNight && !Game.DayNight.isNight())) {
      if (Game.UI) Game.UI.toast('行商人は焚き火を消し、夜の中へ去っていった…');
      active = null; cd = COOLDOWN;
    }
  }

  // ---- 地鳴り: 微振動が近くの鉱脈を告げる。震源マーカーを辿れば鉱石がある(採掘は通常通り) ----
  function startQuake() {
    const s = Game.state, TS = Game.CFG.TILE_SIZE, O = Game.OBJ;
    const ORE_SET = { [O.COAL_ORE]: 1, [O.IRON_ORE]: 1, [O.GOLD_ORE]: 1 };
    const p = s.player;
    if (Game.Render && Game.Render.shake) Game.Render.shake(6);
    if (Game.Audio && Game.Audio.cue) Game.Audio.cue('impact');
    // 一度きりの近傍走査(イベント開始時のみ・tick毎ではない)
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const R = 16;
    let bx = 0, by = 0, bd = Infinity;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 < 9 || d2 >= bd) continue; // 至近は除外・より近いもののみ
        if (ORE_SET[Game.World.objAt(ptx + dx, pty + dy)]) { bd = d2; bx = ptx + dx; by = pty + dy; }
      }
    }
    if (bd < Infinity) {
      active = { type: 'quake', t: QUAKE_DUR, lx: bx * TS + TS / 2, ly: by * TS + TS / 2 };
      if (Game.UI) Game.UI.toast('⛰ 地鳴りだ… 近くの岩盤から鉱脈の響きがする。震源を探せ');
    } else {
      if (Game.UI) Game.UI.toast('⛰ 地鳴りがした… 大地の唸りはすぐに収まった');
      cd = 30 * 40;
    }
  }

  function tickQuake(s) {
    const a = active; a.t--;
    const p = s.player;
    if (Math.hypot(p.x - a.lx, p.y - a.ly) < Game.CFG.TILE_SIZE * 2.2) {
      if (Game.UI) Game.UI.toast('⛏ ここだ — 岩の下に鉱脈が眠っている');
      if (Game.Render) Game.Render.spawnParticles(a.lx, a.ly, '#d8a05a', 10);
      if (Game.Audio) Game.Audio.play('mine');
      active = null; cd = COOLDOWN;
      return;
    }
    if (a.t <= 0) { active = null; cd = COOLDOWN; }
  }

  // ---- 虹のたもと: 雨上がりに虹が架かり、その根元に一時的な宝箱が現れる。行きたくなる報酬 ----
  function startRainbow() {
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    // 12〜18タイル先の歩ける陸地を探して宝箱を置く
    let placed = null;
    for (let a = 0; a < 14; a++) {
      const ang = Math.random() * Math.PI * 2, dist = (12 + Math.random() * 6) * TS;
      const tx = Math.floor((p.x + Math.cos(ang) * dist) / TS), ty = Math.floor((p.y + Math.sin(ang) * dist) / TS);
      if (Game.World.isWalkable(tx, ty) && Game.World.objAt(tx, ty) === Game.OBJ.NONE) { placed = { tx: tx, ty: ty }; break; }
    }
    if (!placed) { cd = 30 * 30; return; }
    Game.World.setObj(placed.tx, placed.ty, Game.OBJ.TREASURE_CHEST);
    active = { type: 'rainbow', t: RAINBOW_DUR, lx: placed.tx * TS + TS / 2, ly: placed.ty * TS + TS / 2, tx: placed.tx, ty: placed.ty };
    if (Game.UI) Game.UI.toast('🌈 虹が架かった… そのたもとに宝が現れたようだ。消える前に辿り着け');
    if (Game.Audio && Game.Audio.cue) Game.Audio.cue('shimmer');
  }
  function tickRainbow(s) {
    const a = active; a.t--;
    // 宝箱が開封/破壊されて消えたら虹も消える(報酬取得)
    if (Game.World.objAt(a.tx, a.ty) !== Game.OBJ.TREASURE_CHEST) { active = null; cd = COOLDOWN; return; }
    if (a.t <= 0) { // 時間切れで宝箱ごと消える
      if (Game.World.objAt(a.tx, a.ty) === Game.OBJ.TREASURE_CHEST) Game.World.setObj(a.tx, a.ty, Game.OBJ.NONE);
      if (Game.UI) Game.UI.toast('🌈 虹は消え、宝も陽炎のように失われた…');
      active = null; cd = COOLDOWN;
    }
  }

  // ---- 金喰い: 宝を抱えて逃げる稀少モブ。追って仕留めれば大量の金塊 ----
  function startGoldThief() {
    const p = Game.state.player, TS = Game.CFG.TILE_SIZE;
    const ang = Math.random() * Math.PI * 2, dist = 5 * TS;
    Game.Mobs.spawnMob('gold_thief', p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist);
    if (Game.UI) Game.UI.toast('✨ 金喰いが現れた！ 逃げる前に仕留めれば大量の金塊が手に入る');
    if (Game.Audio) Game.Audio.play('relic_get');
    cd = 30 * 25; // しばらく再発生させない
  }

  // ---- 魔物の侵攻 ----
  function startHorde() {
    active = { type: 'horde', t: 30 * 26, spawned: 0, toSpawn: 8 + Math.floor(Math.random() * 5), sinceSpawn: 999 };
    if (Game.UI) Game.UI.toast('⚔️ 魔物の侵攻だ！ 押し寄せる群れを退けろ');
    if (Game.Audio) Game.Audio.play('event_horde');
  }

  function spawnHordeMob() {
    const p = Game.state.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = (8 + Math.random() * 4) * Game.CFG.TILE_SIZE;
    const type = HORDE_POOL[Math.floor(Math.random() * HORDE_POOL.length)];
    Game.Mobs.spawnMob(type, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist);
  }

  function tickHorde(s) {
    const a = active; a.t--; a.sinceSpawn++;
    if (a.spawned < a.toSpawn && a.sinceSpawn >= 24) {
      spawnHordeMob(); a.spawned++;
      if (a.spawned < a.toSpawn && Math.random() < 0.5) { spawnHordeMob(); a.spawned++; }
      a.sinceSpawn = 0;
    }
    if (a.t <= 0) {
      if (Game.UI) Game.UI.toast('侵攻を退けた…');
      if (Game.Audio) Game.Audio.play('bounty_done');
      const p = s.player;
      if (Game.Player) Game.Player.gainXP(40);
      for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) s.drops.push({ id: 'gold_bar', count: 1, x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 40 });
      if (Game.Achievements) Game.Achievements.unlock('repel');
      active = null; cd = COOLDOWN;
    }
  }

  // ---- 流星群 ----
  function startMeteor() {
    active = { type: 'meteor', t: SHOWER_DUR, meteors: [], landed: 0, sinceLand: 0 };
    if (Game.UI) Game.UI.toast('☄️ 流星群だ！ 降り注ぐ星のかけらを集めよう');
    if (Game.Audio) Game.Audio.play('event_meteor');
  }

  function spawnMeteor(land) {
    const p = Game.state.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = land ? (120 + Math.random() * 240) : (60 + Math.random() * 420);
    const lx = p.x + Math.cos(ang) * dist;
    const ly = p.y + Math.sin(ang) * dist;
    const dur = 30 + Math.floor(Math.random() * 16);
    const sx = lx - (220 + Math.random() * 160);
    const sy = ly - (560 + Math.random() * 220);
    return { x: sx, y: sy, lx: lx, ly: ly, vx: (lx - sx) / dur, vy: (ly - sy) / dur, life: dur, land: !!land };
  }

  function tickMeteor(s) {
    const a = active; a.t--; a.sinceLand++;
    if (s.tick % 11 === 0) a.meteors.push(spawnMeteor(false));
    if (a.sinceLand >= LAND_EVERY && a.landed < MAX_LAND && a.t > 30) { a.meteors.push(spawnMeteor(true)); a.sinceLand = 0; }
    for (let i = a.meteors.length - 1; i >= 0; i--) {
      const m = a.meteors[i]; m.x += m.vx; m.y += m.vy; m.life--;
      if (m.life <= 0) { if (m.land) { meteorImpact(m); a.landed++; } a.meteors.splice(i, 1); }
    }
    if (a.t <= 0) { if (Game.UI) Game.UI.toast('流星群が去った…'); active = null; cd = COOLDOWN; }
  }

  function meteorImpact(m) {
    const R = Game.Render;
    if (R) { R.spawnParticles(m.lx, m.ly, '#ffd86b', 16); R.spawnParticles(m.lx, m.ly, '#fff4c0', 8); if (R.shake) R.shake(7); }
    if (Game.Audio) Game.Audio.play('thunder');
    const drops = Game.state.drops;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) drops.push({ id: 'star_metal', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Math.random() < 0.15) drops.push({ id: 'star_core', count: 1, x: m.lx + (Math.random() - 0.5) * 18, y: m.ly + (Math.random() - 0.5) * 18 });
    if (Math.random() < 0.3) drops.push({ id: 'gold_bar', count: 1, x: m.lx + (Math.random() - 0.5) * 22, y: m.ly + (Math.random() - 0.5) * 22 });
    if (Game.Achievements) Game.Achievements.unlock('stargazer');
  }

  // ---- 物資投下 ----
  function startSupply() {
    active = { type: 'supply', t: 30 * 14, crates: [], spawned: 0, toSpawn: 2 + Math.floor(Math.random() * 2), sinceSpawn: 999 };
    if (Game.UI) Game.UI.toast('📦 物資が投下された！ 落下地点へ急げ');
    if (Game.Audio) Game.Audio.play('event_supply');
  }

  function spawnCrate() {
    const p = Game.state.player;
    const ang = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 220;
    const lx = p.x + Math.cos(ang) * dist;
    const ly = p.y + Math.sin(ang) * dist;
    const dur = 42 + Math.floor(Math.random() * 16);
    return { x: lx, y: ly - 520, lx: lx, ly: ly, vy: 520 / dur, life: dur };
  }

  function tickSupply(s) {
    const a = active; a.t--; a.sinceSpawn++;
    if (a.spawned < a.toSpawn && a.sinceSpawn >= 60) { a.crates.push(spawnCrate()); a.spawned++; a.sinceSpawn = 0; }
    for (let i = a.crates.length - 1; i >= 0; i--) {
      const c = a.crates[i]; c.y += c.vy; c.life--;
      if (c.life <= 0) { supplyLand(c); a.crates.splice(i, 1); }
    }
    if (a.t <= 0 && a.crates.length === 0) { active = null; cd = COOLDOWN; }
  }

  function supplyLand(c) {
    const R = Game.Render;
    if (R) { R.spawnParticles(c.lx, c.ly, '#caa86a', 12); if (R.shake) R.shake(4); }
    if (Game.Audio) Game.Audio.play('place');
    const drops = Game.state.drops;
    const n = 2 + Math.floor(Math.random() * 3); // 2〜4
    for (let k = 0; k < n; k++) { const id = SUPPLY[Math.floor(Math.random() * SUPPLY.length)]; drops.push({ id: id, count: 1, x: c.lx + (Math.random() - 0.5) * 26, y: c.ly + (Math.random() - 0.5) * 26 }); }
    if (Math.random() < 0.5) drops.push({ id: 'gold_bar', count: 1, x: c.lx + (Math.random() - 0.5) * 18, y: c.ly + (Math.random() - 0.5) * 18 });
    if (Math.random() < 0.2) drops.push({ id: 'bomb', count: 1, x: c.lx + (Math.random() - 0.5) * 18, y: c.ly + (Math.random() - 0.5) * 18 });
    if (Game.Achievements) Game.Achievements.unlock('scavenger');
  }

  // ---- 描画 ----
  // 報酬地点(着弾流星/クレート)へ誘導: 画面内=脈動リング, 画面外=端の矢印
  function drawGuide(ctx, cam, v, wx, wy, color) {
    const s = cam.worldToScreen(wx, wy);
    const margin = 30;
    if (s.x >= margin && s.x <= v.w - margin && s.y >= margin && s.y <= v.h - margin) {
      const pulse = 3 + Math.sin(Game.state.tick * 0.2) * 2;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10 + pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      const cx = v.w / 2, cy = v.h / 2; const dx = s.x - cx, dy = s.y - cy;
      const ex = v.w / 2 - margin, ey = v.h / 2 - margin;
      const scale = Math.min(ex / Math.max(Math.abs(dx), 1), ey / Math.max(Math.abs(dy), 1));
      const ax = cx + dx * scale, ay = cy + dy * scale; const ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function draw(ctx) {
    if (!active) return;
    const cam = Game.Camera;
    ctx.save();
    if (active.type === 'meteor') {
      for (let i = 0; i < active.meteors.length; i++) {
        const m = active.meteors[i];
        const head = cam.worldToScreen(m.x, m.y);
        const tail = cam.worldToScreen(m.x - m.vx * 7, m.y - m.vy * 7);
        ctx.strokeStyle = 'rgba(255,232,160,0.55)'; ctx.lineWidth = m.land ? 3 : 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
        ctx.fillStyle = m.land ? '#fff' : '#ffe9a0';
        ctx.beginPath(); ctx.arc(head.x, head.y, m.land ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill();
        if (m.land) { ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (active.type === 'supply') {
      for (let i = 0; i < active.crates.length; i++) {
        const c = active.crates[i];
        const s = cam.worldToScreen(c.x, c.y);
        // パラシュート
        ctx.fillStyle = 'rgba(220,210,180,0.9)';
        ctx.beginPath(); ctx.arc(s.x, s.y - 22, 13, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(120,110,90,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 22); ctx.lineTo(s.x - 6, s.y - 6); ctx.moveTo(s.x + 12, s.y - 22); ctx.lineTo(s.x + 6, s.y - 6); ctx.stroke();
        // クレート
        ctx.fillStyle = '#9c6b3f'; ctx.fillRect(s.x - 7, s.y - 7, 14, 14);
        ctx.strokeStyle = '#5e3f23'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 7, s.y - 7, 14, 14);
        ctx.beginPath(); ctx.moveTo(s.x - 7, s.y); ctx.lineTo(s.x + 7, s.y); ctx.moveTo(s.x, s.y - 7); ctx.lineTo(s.x, s.y + 7); ctx.stroke();
      }
    } else if (active.type === 'star') {
      // 流れ星: 画面上部を右から左へ渡る一筋の光(スクリーン座標・カメラ非依存で確実に見える)
      const vv = Game.view;
      const frac = 1 - active.t / STAR_DUR;
      const sx = vv.w * (1.08 - frac * 1.22), sy = vv.h * (0.09 + frac * 0.07);
      const tx2 = sx + 46, ty2 = sy - 13;
      const grad = ctx.createLinearGradient(tx2, ty2, sx, sy);
      grad.addColorStop(0, 'rgba(255,236,170,0)'); grad.addColorStop(1, 'rgba(255,246,210,0.9)');
      ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath(); ctx.arc(sx, sy, 2.6 + Math.sin(Game.state.tick * 0.5) * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.28)';
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    } else if (active.type === 'flock') {
      // 渡り鳥: V字編隊。羽ばたきは sin で表現
      const a = active;
      const flap = Math.sin(Game.state.tick * 0.35) * 3.2;
      const ca = Math.cos(a.ang), sa = Math.sin(a.ang);
      for (let i = 0; i < 9; i++) {
        const row = Math.ceil(i / 2), side = (i % 2 === 0 ? 1 : -1) * (i === 0 ? 0 : 1);
        const bx = a.x - ca * row * 16 + (-sa) * side * row * 11;
        const by = a.y - sa * row * 16 + ca * side * row * 11;
        const sc = cam.worldToScreen(bx, by);
        if (sc.x < -30 || sc.x > Game.view.w + 30 || sc.y < -30 || sc.y > Game.view.h + 30) continue;
        ctx.strokeStyle = 'rgba(40,52,70,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sc.x - 5, sc.y - Math.abs(flap) * 0.6);
        ctx.quadraticCurveTo(sc.x, sc.y + flap, sc.x + 5, sc.y - Math.abs(flap) * 0.6);
        ctx.stroke();
      }
    } else if (active.type === 'merchant') {
      // 行商人の焚き火: ちらつく炎＋暖色の光＋商人の影
      const a = active;
      const sc = cam.worldToScreen(a.x, a.y);
      const flick = 0.85 + Math.sin(Game.state.tick * 0.6) * 0.1 + Math.sin(Game.state.tick * 0.23) * 0.05;
      const glow = ctx.createRadialGradient(sc.x, sc.y, 2, sc.x, sc.y, 46 * flick);
      glow.addColorStop(0, 'rgba(255,170,80,0.30)'); glow.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sc.x, sc.y, 46 * flick, 0, Math.PI * 2); ctx.fill();
      // 薪
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sc.x - 7, sc.y + 4); ctx.lineTo(sc.x + 7, sc.y + 1); ctx.moveTo(sc.x - 6, sc.y + 1); ctx.lineTo(sc.x + 6, sc.y + 4); ctx.stroke();
      // 炎(2枚重ね・ゆらぎ)
      const fh = 11 * flick;
      ctx.fillStyle = 'rgba(255,150,60,0.9)';
      ctx.beginPath(); ctx.moveTo(sc.x - 5, sc.y + 2); ctx.quadraticCurveTo(sc.x + Math.sin(Game.state.tick * 0.4) * 2, sc.y - fh, sc.x + 5, sc.y + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath(); ctx.moveTo(sc.x - 2.5, sc.y + 2); ctx.quadraticCurveTo(sc.x, sc.y - fh * 0.6, sc.x + 2.5, sc.y + 2); ctx.closePath(); ctx.fill();
      // 商人の影(焚き火の傍らに座る)
      ctx.fillStyle = 'rgba(52,40,58,0.9)';
      ctx.beginPath(); ctx.arc(sc.x + 16, sc.y - 6, 4, 0, Math.PI * 2); ctx.fill(); // 頭
      ctx.beginPath(); ctx.ellipse ? ctx.ellipse(sc.x + 16, sc.y + 2, 6, 7, 0, 0, Math.PI * 2) : ctx.arc(sc.x + 16, sc.y + 2, 6, 0, Math.PI * 2); ctx.fill(); // 胴
      ctx.fillStyle = 'rgba(120,90,60,0.9)'; ctx.fillRect(sc.x + 24, sc.y - 2, 7, 6); // 荷袋
    }

    const v = Game.view;
    // 魔物の侵攻: 画面端に脈動する赤い危機ヴィネット(緊張感)
    if (active.type === 'horde') {
      const pulse = 0.16 + Math.sin(Game.state.tick * 0.12) * 0.08;
      const g = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.34, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.62);
      g.addColorStop(0, 'rgba(180,20,20,0)');
      g.addColorStop(1, 'rgba(150,10,10,' + pulse.toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
    }
    // 虹: 宝箱の方向へ弧を描く(画面上部に半円)
    if (active.type === 'rainbow') {
      const sc = Game.Camera.worldToScreen(active.lx, active.ly);
      const cx = (sc.x + v.w / 2) / 2, cy = v.h * 0.95, rad = v.h * 0.7;
      const cols = ['#ff5a5a', '#ffab5a', '#ffe27a', '#7fe08a', '#5fb8ff', '#8f6fe0'];
      for (let i = 0; i < cols.length; i++) { ctx.strokeStyle = cols[i]; ctx.globalAlpha = 0.5; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, rad - i * 5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // 誘導マーカー: 報酬地点へ(侵攻は群れ自体が目標・流れ星/渡り鳥は空の演出なのでマーカー無し)
    const gcol = EVENT_COLOR[active.type] || '#caa86a';
    const targets = active.type === 'meteor' ? active.meteors.filter(function (m) { return m.land; })
      : active.type === 'supply' ? active.crates
      : active.type === 'merchant' ? [{ lx: active.x, ly: active.y }]
      : active.type === 'quake' ? [{ lx: active.lx, ly: active.ly }]
      : active.type === 'rainbow' ? [{ lx: active.lx, ly: active.ly }]
      : [];
    for (let i = 0; i < targets.length; i++) drawGuide(ctx, cam, v, targets[i].lx, targets[i].ly, gcol);

    // 上部バナー: イベント名＋残り時間(流れ星/渡り鳥は一瞬の情景なのでバナー無しで静かに)
    if (active.type === 'star' || active.type === 'flock') { ctx.restore(); return; }
    const secs = Math.max(0, Math.ceil(active.t / 30));
    const ename = EVENT_NAME[active.type] || 'イベント';
    const label = ename + '  残り ' + secs + 's';
    ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width; const bw = tw + 28, bx = v.w / 2 - bw / 2, by = 6;
    ctx.fillStyle = 'rgba(12,18,28,0.66)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 26, 8); ctx.fill(); } else ctx.fillRect(bx, by, bw, 26);
    ctx.fillStyle = gcol; ctx.fillText(label, v.w / 2, by + 13);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // デバッグ/検証用: イベントを即時発火(コンソール・スモークテストから)
  function force(name) {
    active = null;
    if (name === 'meteor') startMeteor();
    else if (name === 'supply') startSupply();
    else if (name === 'horde') startHorde();
    else if (name === 'star') startStar();
    else if (name === 'flock') startFlock();
    else if (name === 'merchant') startMerchant();
    else if (name === 'quake') startQuake();
    else if (name === 'rainbow') startRainbow();
    else if (name === 'goldthief') startGoldThief();
    return active ? active.type : null;
  }

  return { update, draw, reset, current, force };
})();
