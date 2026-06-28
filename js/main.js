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
      tick: 0,
      timeOfDay: 0.3,
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
      // active 参照（worlds[worldName] を指す）
      chunks: worlds.light.chunks,
      modifiedTiles: worlds.light.modifiedTiles,
      tileData: worlds.light.tileData,
      mobs: worlds.light.mobs,
      drops: worlds.light.drops,
    };
    return st;
  }

  function newGame(seedStr) {
    let seed = parseInt(seedStr, 10);
    if (!seedStr || isNaN(seed)) seed = (Math.floor(Math.random() * 1e9)) >>> 0;
    Game.state = freshState(seed);
    const sp = Game.WorldGen.findSpawn(Game.state.seed);
    Game.state.spawn = sp;
    Game.Player.spawnAt(sp.tx, sp.ty);
    // スターターアイテム
    Game.STARTER_ITEMS.forEach(function (it) { Game.Inventory.add(it.id, it.count); });
    startWorld();
  }

  function continueGame() {
    const data = Game.Save.load();
    if (!data) { newGame(''); return; }
    Game.state = freshState(data.seed);
    Game.state.tick = data.tick || 0;
    Game.state.spawn = data.spawn || { tx: 0, ty: 0 };
    Game.state.sanity = data.sanity != null ? data.sanity : Game.TUNE.SANITY_MAX;
    Game.state.hasShifted = !!data.hasShifted;
    Game.state.achievements = data.achievements || {};
    if (data.weather) Game.state.weather = data.weather;
    // 両世界の差分/タイルデータ復元
    const restoreWorld = function (name, wd) {
      if (!wd) return;
      const w = Game.state.worlds[name];
      if (wd.deltas) for (const k in wd.deltas) w.modifiedTiles.set(k, wd.deltas[k]);
      if (wd.tileData) for (const k in wd.tileData) w.tileData.set(k, wd.tileData[k]);
      if (wd.drops) wd.drops.forEach(function (d) { w.drops.push({ id: d.id, count: d.count, x: d.x, y: d.y }); });
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
    p.armor = sp.armor || { head: null, chest: null };
    // インベントリ
    if (data.inventory) {
      for (let i = 0; i < data.inventory.length && i < Game.state.inventory.length; i++) {
        const sl = data.inventory[i];
        Game.state.inventory[i] = sl ? { id: sl.id, count: sl.count } : null;
      }
    }
    startWorld();
  }

  function startWorld() {
    document.getElementById('title-screen').classList.add('hidden');
    Game.UI.showGameUI();
    Game.UI.refreshAll();
    Game.UI.updateMinimap();
    const pt = Game.Player.playerTile();
    Game.World.updateChunks(pt.tx, pt.ty);
    Game.Audio.ensure();
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
    const pt = Game.Player.playerTile();
    if (Game.state.tick % 10 === 0) Game.World.updateChunks(pt.tx, pt.ty);
    if (Game.state.tick % 20 === 0) Game.UI.updateMinimap();
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
    requestAnimationFrame(frame);
  }

  function initTitle() {
    const btnContinue = document.getElementById('btn-continue');
    if (!Game.Save.hasSave()) { btnContinue.classList.add('disabled'); btnContinue.disabled = true; }
    document.getElementById('btn-new').addEventListener('click', function () {
      if (Game.Save.hasSave() && !confirm('新しい世界を始めると現在のセーブは上書きされます。よろしいですか？')) return;
      Game.Save.clear();
      newGame(document.getElementById('seed-input').value.trim());
    });
    btnContinue.addEventListener('click', function () {
      if (this.disabled) return;
      continueGame();
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
