// main.js — 起動・固定タイムステップループ・セーブ連携
window.Game = window.Game || {};

(function () {
  const CFG = Game.CFG;
  const STEP = 1000 / CFG.STEP_HZ;
  let acc = 0, last = 0, running = false;

  function setupCanvas() {
    Game.canvas = document.getElementById('game');
    Game.ctx = Game.canvas.getContext('2d');
    Game.view = { w: 0, h: 0 };
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR);
    const w = window.innerWidth, h = window.innerHeight;
    Game.canvas.style.width = w + 'px';
    Game.canvas.style.height = h + 'px';
    Game.canvas.width = Math.floor(w * dpr);
    Game.canvas.height = Math.floor(h * dpr);
    Game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Game.view.w = w; Game.view.h = h;
  }

  function mkWorld() {
    return { chunks: new Map(), modifiedTiles: new Map(), tileData: new Map(), mobs: [], drops: [] };
  }

  function freshState(seed) {
    const worlds = { light: mkWorld(), shadow: mkWorld() };
    const st = {
      seed: seed >>> 0,
      tick: Math.floor(0.33 * Game.DAY_LENGTH), // 朝から開始（夜・敵から始めない）
      timeOfDay: 0.33,
      player: Game.Player.makeDefault(),
      camera: { x: 0, y: 0 },
      inventory: Game.Inventory.makeEmpty(),
      spawn: { tx: 0, ty: 0 },
      openChest: null,
      weather: { type: 'clear', timer: 600 },
      paused: false,
      // 二相世界
      worldName: 'light',
      worlds: worlds,
      shiftCd: 0,
      sanity: Game.TUNE.SANITY_MAX,
      hasShifted: false,
      achievements: {},
      lore: {},
      riftBank: null,
      resonated: {},
      questIndex: 0,
      questDone: {},
      reunified: false,
      ngLevel: 0,
      wasDeep: false,
      difficulty: 'normal',
      // active 参照（worlds[worldName] を指す）
      chunks: worlds.light.chunks,
      modifiedTiles: worlds.light.modifiedTiles,
      tileData: worlds.light.tileData,
      mobs: worlds.light.mobs,
      drops: worlds.light.drops,
    };
    return st;
  }

  function newGame(seedStr, opts) {
    opts = opts || {};
    let seed = parseInt(seedStr, 10);
    if (!seedStr || isNaN(seed)) seed = (Math.floor(Math.random() * 1e9)) >>> 0;
    const keepAch = opts.keepAchievements && Game.state ? Game.state.achievements : null;
    const ngLevel = opts.ngLevel || 0;
    Game.state = freshState(seed);
    Game.state.ngLevel = ngLevel;
    Game.state.difficulty = opts.difficulty || 'normal';
    if (keepAch) Game.state.achievements = keepAch;
    const sp = Game.WorldGen.findSpawn(Game.state.seed);
    Game.state.spawn = sp;
    Game.Player.spawnAt(sp.tx, sp.ty);
    // スターターアイテム
    Game.STARTER_ITEMS.forEach(function (it) { Game.Inventory.add(it.id, it.count); });
    startWorld();
    if (!ngLevel && !opts.net) Game.UI.showIntro(); // 初回ソロのみ物語導入
  }

  // マルチプレイ: ホストの世界(シード+差分)を採用して再構築
  function adoptNetWorld(d) {
    Game.state = freshState(d.seed);
    Game.state.tick = d.tick || 0;
    if (d.light) for (const k in d.light) Game.state.worlds.light.modifiedTiles.set(k, d.light[k]);
    if (d.shadow) for (const k in d.shadow) Game.state.worlds.shadow.modifiedTiles.set(k, d.shadow[k]);
    Game.World.setActiveWorld('light');
    const sp = Game.WorldGen.findSpawn(Game.state.seed);
    Game.state.spawn = sp; Game.Player.spawnAt(sp.tx, sp.ty);
    Game.STARTER_ITEMS.forEach(function (it) { Game.Inventory.add(it.id, it.count); });
    startWorld();
    Game.UI.toast('仲間の世界に合流しました');
  }
  Game.adoptNetWorld = adoptNetWorld;

  // 周回（NG+）: 実績引継ぎ・難度上昇・新シード
  function startNGPlus() {
    const ng = (Game.state.ngLevel || 0) + 1;
    const diff = Game.state.difficulty || 'normal';
    Game.Save.clear();
    newGame('', { keepAchievements: true, ngLevel: ng, difficulty: diff });
    Game.UI.toast('周回 NG+' + ng + ' 開始 — 影はさらに濃く、戦利品はさらに豊かに');
  }
  Game.startNGPlus = startNGPlus;

  function continueGame() {
    const data = Game.Save.load();
    if (!data) { newGame(''); return; }
    Game.state = freshState(data.seed);
    Game.state.tick = data.tick || 0;
    Game.state.spawn = data.spawn || { tx: 0, ty: 0 };
    Game.state.sanity = data.sanity != null ? data.sanity : Game.TUNE.SANITY_MAX;
    Game.state.hasShifted = !!data.hasShifted;
    Game.state.achievements = data.achievements || {};
    Game.state.lore = data.lore || {};
    Game.state.riftBank = data.riftBank || null;
    Game.state.resonated = data.resonated || {};
    Game.state.questIndex = data.questIndex || 0;
    Game.state.questDone = data.questDone || {};
    Game.state.reunified = !!data.reunified;
    Game.state.difficulty = data.difficulty || 'normal';
    if (data.weather) Game.state.weather = data.weather;
    // 両世界の差分/タイルデータ復元
    const restoreWorld = function (name, wd) {
      if (!wd) return;
      const w = Game.state.worlds[name];
      if (wd.deltas) for (const k in wd.deltas) w.modifiedTiles.set(k, wd.deltas[k]);
      if (wd.tileData) for (const k in wd.tileData) w.tileData.set(k, wd.tileData[k]);
      if (wd.drops) wd.drops.forEach(function (d) { w.drops.push({ id: d.id, count: d.count, x: d.x, y: d.y, roll: d.roll || null }); });
    };
    if (data.worlds) { restoreWorld('light', data.worlds.light); restoreWorld('shadow', data.worlds.shadow); }
    else if (data.deltas) { restoreWorld('light', { deltas: data.deltas, tileData: data.tileData, drops: data.drops }); } // v2互換
    // アクティブ世界をセット
    Game.World.setActiveWorld(data.worldName || 'light');
    // プレイヤー
    const p = Game.state.player, sp = data.player || {};
    p.x = sp.x || 0; p.y = sp.y || 0; p.prevX = p.x; p.prevY = p.y;
    p.dir = sp.dir || 'down';
    p.health = sp.health != null ? sp.health : 100;
    p.maxHealth = sp.maxHealth || 100;
    p.hunger = sp.hunger != null ? sp.hunger : 100;
    p.maxHunger = sp.maxHunger || 100;
    p.hotbarIndex = sp.hotbarIndex || 0;
    p.xp = sp.xp || 0; p.level = sp.level || 1; p.xpNext = sp.xpNext || 5;
    p.baseMaxHealth = sp.baseMaxHealth || sp.maxHealth || 100;
    p.armor = sp.armor || { head: null, chest: null };
    Game.state.ngLevel = data.ngLevel || 0;
    // インベントリ
    if (data.inventory) {
      for (let i = 0; i < data.inventory.length && i < Game.state.inventory.length; i++) {
        const sl = data.inventory[i];
        Game.state.inventory[i] = sl ? { id: sl.id, count: sl.count, roll: sl.roll || null } : null;
      }
    }
    Game.Player.applyEquipStats();
    startWorld();
  }

  function startWorld() {
    document.getElementById('title-screen').classList.add('hidden');
    Game.UI.showGameUI();
    Game.UI.refreshAll();
    Game.Quests.update();
    Game.UI.refreshQuest();
    Game.UI.updateMinimap();
    const pt = Game.Player.playerTile();
    Game.World.updateChunks(pt.tx, pt.ty);
    Game.Audio.ensure();
    Game.Audio.startBGM();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  function update() {
    const intent = Game.Input.poll();
    if (Game.state.paused) return;
    if (Game.state.shiftCd > 0) Game.state.shiftCd--;
    Game.Player.update(intent);
    Game.Survival.update();
    Game.DayNight.update();
    Game.Mobs.update();
    if (Game.state.tick % 30 === 0) Game.Farming.update();
    if (Game.state.tick % 30 === 15) Game.Quests.update();
    const pt = Game.Player.playerTile();
    if (Game.state.tick % 10 === 0) Game.World.updateChunks(pt.tx, pt.ty);
    if (Game.state.tick % 20 === 0) Game.UI.updateMinimap();
    if (Game.state.tick % 30 === 0) Game.Audio.updateMood();
    Game.state.tick++;
  }

  function frame(now) {
    let dt = now - last; last = now;
    if (dt > 250) dt = 250;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) { update(); acc -= STEP; steps++; }
    const alpha = Game.state.paused ? 1 : acc / STEP;
    Game.Render.draw(alpha);
    Game.Audio.tickBGM();
    Game.Net.tick();
    requestAnimationFrame(frame);
  }

  function initTitle() {
    const btnContinue = document.getElementById('btn-continue');
    if (!Game.Save.hasSave()) { btnContinue.classList.add('disabled'); btnContinue.disabled = true; }
    // 難易度セレクタ
    let chosenDiff = 'normal';
    const diffBtns = document.querySelectorAll('#diff-row .diff-btn');
    const diffDesc = document.getElementById('diff-desc');
    diffBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        chosenDiff = b.getAttribute('data-diff');
        diffBtns.forEach(function (o) { o.classList.toggle('selected', o === b); });
        const d = Game.DIFFICULTIES[chosenDiff]; if (d && diffDesc) diffDesc.textContent = d.desc;
      });
    });
    document.getElementById('btn-new').addEventListener('click', function () {
      if (Game.Save.hasSave() && !confirm('新しい世界を始めると現在のセーブは上書きされます。よろしいですか？')) return;
      Game.Save.clear();
      newGame(document.getElementById('seed-input').value.trim(), { difficulty: chosenDiff });
    });
    btnContinue.addEventListener('click', function () {
      if (this.disabled) return;
      continueGame();
    });
    // マルチプレイ
    const roomInput = document.getElementById('room-input');
    const roomCode = function () { return (roomInput.value.trim() || ('haru' + Math.floor(Math.random() * 9000 + 1000))); };
    document.getElementById('btn-host').addEventListener('click', function () {
      if (!Game.Net.available()) { alert('マルチプレイの読み込み中、またはネット未接続です。少し待って再度お試しください。'); return; }
      const code = roomCode(); roomInput.value = code;
      Game.Save.clear();
      newGame(roomInput.value, { difficulty: chosenDiff, net: true });
      Game.Net.start(code, true);
    });
    document.getElementById('btn-join').addEventListener('click', function () {
      if (!Game.Net.available()) { alert('マルチプレイの読み込み中、またはネット未接続です。少し待って再度お試しください。'); return; }
      const code = roomCode(); roomInput.value = code;
      newGame('', { net: true });
      Game.Net.start(code, false);
    });
  }

  function initSaveHooks() {
    setInterval(function () { if (running && !document.hidden) Game.Save.save(); }, CFG.AUTOSAVE_MS);
    window.addEventListener('beforeunload', function () { if (running) Game.Save.save(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && running) Game.Save.save(); });
  }

  function boot() {
    setupCanvas();
    Game.Tiles.init();
    Game.UI.init();
    Game.Input.init();
    initTitle();
    initSaveHooks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
