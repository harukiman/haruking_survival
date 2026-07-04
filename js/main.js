// main.js — 起動・固定タイムステップループ・セーブ連携
window.Game = window.Game || {};

// 防御的ハードニング: 負の半径での arc 例外(IndexSizeError)を根絶（描画は0扱いで継続）
(function () {
  const proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (proto && !proto.__arcGuard) {
    proto.__arcGuard = 1;
    const oa = proto.arc;
    proto.arc = function (x, y, r, a, b, c) { return oa.call(this, x, y, (typeof r === 'number' && r < 0) ? 0 : r, a, b, c); };
    const oe = proto.ellipse;
    if (oe) proto.ellipse = function (x, y, rx, ry, rot, a, b, c) { return oe.call(this, x, y, rx < 0 ? 0 : rx, ry < 0 ? 0 : ry, rot, a, b, c); };
  }
})();

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
    const worlds = { light: mkWorld(), shadow: mkWorld(), space: mkWorld() };
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
      discovered: {},
      bossSeen: {},
      bestiary: {},
      eliteKills: 0,
      championKills: 0,
      bounty: null,
      bountyDone: 0,
      visitedBiomes: {},
      questIndex: 0,
      questDone: {},
      reunified: false,
      ngLevel: 0,
      wasDeep: false,
      difficulty: 'normal',
      zoom: 1,
      // active 参照（worlds[worldName] を指す）
      chunks: worlds.light.chunks,
      modifiedTiles: worlds.light.modifiedTiles,
      tileData: worlds.light.tileData,
      mobs: worlds.light.mobs,
      drops: worlds.light.drops,
      projectiles: [],
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
    if (Game.Story) Game.Story.unlock('prologue', false); // 序章を記憶回廊に登録(導入は別途オープニングで再生)
    // 初回ソロは アニメーション・オープニングを再生
    if (!ngLevel && !opts.net && Game.Cutscene) {
      Game.state.paused = true;
      Game.Cutscene.play(function () { Game.state.paused = false; });
    }
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

  // 保存してタイトルへ戻る（リロードで安全に初期化）
  Game.toTitle = function () {
    Game.Save.save();
    if (Game.Net && Game.Net.isConnected()) Game.Net.leave();
    location.reload();
  };
  Game.manualSave = function () {
    const ok = Game.Save.save();
    Game.UI.toast(ok ? '保存しました' : '保存に失敗しました');
  };

  // 周回（NG+）: 実績引継ぎ・難度上昇・新シード
  function startNGPlus() {
    const ng = (Game.state.ngLevel || 0) + 1;
    const diff = Game.state.difficulty || 'normal';
    Game.Save.clear();
    newGame('', { keepAchievements: true, ngLevel: ng, difficulty: diff });
    if (Game.Story) Game.Story.unlock('cycle', true); // 周回で記憶回廊「巡り還る刻」を解放
    if (Game.Save) Game.Save.autosave('force'); // 周回開始を即保存(リロードで周回が復元される)
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
    Game.state.discovered = data.discovered || {};
    Game.state.bossSeen = data.bossSeen || {};
    Game.state.bestiary = data.bestiary || {};
    Game.state.storySeen = data.storySeen || {};
    Game.state.eliteKills = data.eliteKills || 0;
    Game.state.championKills = data.championKills || 0;
    Game.state.bounty = data.bounty || null;
    Game.state.bountyDone = data.bountyDone || 0;
    Game.state.visitedBiomes = data.visitedBiomes || {};
    Game.state.questIndex = data.questIndex || 0;
    Game.state.questDone = data.questDone || {};
    Game.state.waypoints = data.waypoints || [];
    Game.state.explored = data.explored || {};
    Game.state.mapMarks = data.mapMarks || [];
    Game.state.reunified = !!data.reunified;
    Game.state.difficulty = data.difficulty || 'normal';
    Game.state.zoom = data.zoom || 1;
    if (data.weather) Game.state.weather = data.weather;
    // 両世界の差分/タイルデータ復元
    const restoreWorld = function (name, wd) {
      if (!wd) return;
      const w = Game.state.worlds[name];
      if (wd.deltas) for (const k in wd.deltas) w.modifiedTiles.set(k, wd.deltas[k]);
      if (wd.tileData) for (const k in wd.tileData) w.tileData.set(k, wd.tileData[k]);
      if (wd.drops) wd.drops.forEach(function (d) { w.drops.push({ id: d.id, count: d.count, x: d.x, y: d.y, roll: d.roll || null }); });
    };
    if (data.worlds) { restoreWorld('light', data.worlds.light); restoreWorld('shadow', data.worlds.shadow); restoreWorld('space', data.worlds.space); }
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
    p.accessory = sp.accessory || null;
    p.accessory2 = sp.accessory2 || null;
    p.offhand = sp.offhand || null;
    p.bts = sp.bts || 0;
    p.status = sp.status || {};
    p.str = sp.str || 0; p.vit = sp.vit || 0; p.dex = sp.dex || 0; p.skillPoints = sp.skillPoints || 0; p.skills = sp.skills || {};
    p.mags = sp.mags || {}; // 銃のマガジン装填数を復元(リロードのやり直しを防ぐ)
    p.loadouts = sp.loadouts || null; // 装備ロードアウト(5セット)を復元
    p.fuel = sp.fuel || {}; // 現代乗り物の燃料残量を復元
    p.maxMp = sp.maxMp || 100; p.mp = sp.mp != null ? sp.mp : p.maxMp; // マナ復元
    p.vehDur = sp.vehDur || {}; // 乗り物の耐久値を復元
    p.vehGuns = sp.vehGuns || {}; // 航空機の増設機関銃基数を復元
    Game.state.ngLevel = data.ngLevel || 0;
    Game.state._tips = data.tips || {}; // 表示済みヒントを復元(再表示防止)
    Game.state.fallout = data.fallout || []; // 死の灰ゾーンを復元
    // インベントリ（拡張済みなら容量も復元）
    if (data.inventory) {
      while (Game.state.inventory.length < data.inventory.length) Game.state.inventory.push(null);
      for (let i = 0; i < data.inventory.length && i < Game.state.inventory.length; i++) {
        const sl = data.inventory[i];
        Game.state.inventory[i] = sl ? { id: sl.id, count: sl.count, roll: sl.roll || null } : null;
      }
      p.invSlots = Game.state.inventory.length;
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
    if (Game.Settings) Game.Settings.apply();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  function update() {
    const intent = Game.Input.poll();
    if (Game.UI.refreshContext) Game.UI.refreshContext(); // ポーズ/オーバーレイ中も評価し文脈ボタンを確実に隠す
    if (Game.state.paused) return;
    if (Game.state.shiftCd > 0) Game.state.shiftCd--;
    Game.Player.update(intent);
    Game.Survival.update();
    Game.DayNight.update();
    Game.Events.update();
    Game.Mobs.update();
    Game.Projectiles.update();
    if (Game.state.tick % 30 === 0) Game.Farming.update();
    if (Game.state.tick % 30 === 15) Game.Quests.update();
    if (Game.Discovery && Game.state.tick % 15 === 7) Game.Discovery.scan();
    const pt = Game.Player.playerTile();
    if (Game.state.tick % 10 === 0) Game.World.updateChunks(pt.tx, pt.ty);
    if (Game.state.tick % 20 === 0) { Game.UI.updateMinimap(); if (Game.UI.isBigMapOpen && Game.UI.isBigMapOpen()) Game.UI.updateBigMap(); }
    // 銃装備中は常に残弾(装填/総予備)を画面表示。リロード中は毎3tick、通常は毎6tickで更新
    if (Game.UI.refreshAmmo && ((Game.state.player.reloadCd > 0 && Game.state.tick % 3 === 0) || Game.state.tick % 6 === 0)) Game.UI.refreshAmmo();
    if (Game.state.tick % 6 === 0 && Game.UI.refreshBossBar) Game.UI.refreshBossBar();
    if (Game.state.tick % 30 === 0 && Game.UI.refreshBounty) Game.UI.refreshBounty();
    if (Game.state.tick % 30 === 0) Game.Audio.updateMood();
    if (Game.state.tick % 80 === 0 && Game.Audio.ambientTick) Game.Audio.ambientTick(); // 環境音(鳥/虫/風)
    Game.state.tick++;
  }

  let fpsAcc = 0, fpsCnt = 0, fpsLast = 0;
  function updateFps(now) {
    const el = document.getElementById('fps'); if (!el) return;
    const show = Game.Settings && Game.Settings.get('showFps');
    if (!show) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    fpsCnt++;
    if (now - fpsLast >= 500) { const fps = Math.round(fpsCnt * 1000 / (now - fpsLast)); el.textContent = fps + ' fps'; fpsLast = now; fpsCnt = 0; }
  }

  function frame(now) {
    // 例外ガード: 1フレームの例外でrAFチェーンが切れて無言フリーズするのを防ぐ
    try {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        if (Game.state.hitstop > 0 && !Game.state.paused) { Game.state.hitstop--; acc -= STEP; steps++; continue; } // ヒットストップ: 強打の一瞬を凍結し重みを出す
        update(); acc -= STEP; steps++;
      }
      const alpha = Game.state.paused ? 1 : acc / STEP;
      Game.Render.draw(alpha);
      Game.Audio.tickBGM();
      Game.Net.tick();
      updateFps(now);
    } catch (e) {
      frameErrCount++;
      console.error('[frame]', e);
      if (frameErrCount <= 3 && Game.UI && Game.UI.toast) { try { Game.UI.toast('エラーが発生しました(継続中): ' + e.message); } catch (_) {} }
      acc = 0; // 壊れたフレームの負債を捨てて次フレームを綺麗に始める
    }
    requestAnimationFrame(frame);
  }
  let frameErrCount = 0;

  function initTitle() {
    const btnContinue = document.getElementById('btn-continue');
    function updateContinueBtn() {
      const has = Game.Save.hasSave();
      btnContinue.disabled = !has; btnContinue.classList.toggle('disabled', !has);
      const cc = document.querySelector('.cta-col'); if (cc) cc.classList.toggle('has-save', has); // セーブ持ちには「つづきから」を主導線に
    }
    // 複数セーブスロット選択(複数人が別々のデータで遊べる)
    function renderSlots() {
      const el = document.getElementById('save-slots'); if (!el || !Game.Save.slotCount) return;
      const n = Game.Save.slotCount(); let h = '<div class="slots-lbl">セーブ枠（人ごとに使い分け・名前は✎で変更）</div><div class="slots-row">';
      for (let i = 0; i < n; i++) {
        const info = Game.Save.slotInfo(i), cur = Game.Save.currentSlot() === i;
        const sub = info.exists ? ('Lv' + info.level + (info.ng ? ' NG+' + info.ng : '')) : '空き';
        const nm = (info.name || ('枠' + (i + 1))).replace(/</g, '&lt;');
        h += '<button class="slot-btn' + (cur ? ' on' : '') + '" data-slot="' + i + '">' + nm + '<span class="slot-sub">' + sub + '</span></button>';
      }
      h += '</div><button id="slot-rename" class="map-btn slot-rename">✎ 選択中の枠の名前を変更</button>';
      el.innerHTML = h;
      el.querySelectorAll('.slot-btn').forEach(function (b) { b.addEventListener('click', function () { Game.Save.setSlot(parseInt(b.dataset.slot, 10)); renderSlots(); updateContinueBtn(); }); });
      const rn = document.getElementById('slot-rename');
      if (rn) rn.addEventListener('click', function () {
        const i = Game.Save.currentSlot();
        const cur2 = Game.Save.slotName(i);
        const v = window.prompt('セーブ枠' + (i + 1) + ' の名前（最大16文字）', cur2);
        if (v != null) { Game.Save.setSlotName(i, v); renderSlots(); updateContinueBtn(); }
      });
    }
    renderSlots();
    updateContinueBtn();
    // タイトルから設定(音量/操作/コントローラ)を開けるように
    const toBtn = document.getElementById('btn-title-options');
    if (toBtn) toBtn.addEventListener('click', function () { if (Game.UI && Game.UI.toggleOptions) Game.UI.toggleOptions(); });
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
    // タイトルBGM: 初回タップ(ユーザージェスチャ)で 'title' ムード開始。
    // タイトル中は frame ループが未稼働のため専用インターバルで刻み、ゲーム開始後は frame に引き継いで停止
    const titleBgmStart = function () {
      document.removeEventListener('pointerdown', titleBgmStart);
      const ts = document.getElementById('title-screen');
      if (!ts || ts.classList.contains('hidden')) return; // すでにゲーム開始済みなら不要
      Game.Audio.startBGM('title');
      const iv = setInterval(function () {
        if (running) { clearInterval(iv); return; }
        Game.Audio.tickBGM();
      }, 50);
    };
    document.addEventListener('pointerdown', titleBgmStart);
    // マルチプレイ
    const roomInput = document.getElementById('room-input');
    const roomCode = function () { return (roomInput.value.trim() || ('haru' + Math.floor(Math.random() * 9000 + 1000))); };
    const nameInput = document.getElementById('name-input');
    const applyName = function () { const n = nameInput && nameInput.value.trim(); if (n) Game.Net.setName(n); };
    document.getElementById('btn-host').addEventListener('click', function () {
      if (!Game.Net.available()) { alert('マルチプレイの読み込み中、またはネット未接続です。少し待って再度お試しください。'); return; }
      const code = roomCode(); roomInput.value = code;
      applyName();
      Game.Save.clear();
      newGame(roomInput.value, { difficulty: chosenDiff, net: true });
      Game.Net.start(code, true);
    });
    document.getElementById('btn-join').addEventListener('click', function () {
      if (!Game.Net.available()) { alert('マルチプレイの読み込み中、またはネット未接続です。少し待って再度お試しください。'); return; }
      const code = roomCode(); roomInput.value = code;
      applyName();
      newGame('', { net: true });
      Game.Net.start(code, false);
    });
  }

  function initSaveHooks() {
    setInterval(function () { if (running && !document.hidden) Game.Save.autosave('periodic'); }, CFG.AUTOSAVE_MS);
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
