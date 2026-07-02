// net.js — Trystero P2P 協力プレイ（サーバー不要・GitHub Pagesのまま数人接続）
// マルチ快適化: ホスト消失ウォッチドッグ / 有界リジョイン / スキップ同期(snapshot piggyback) /
// 参加・退出トースト(名前付き) / 静止時の位置送信間引き / 全ハンドラ try-catch 防御。
// ここでの状態は全てモジュール内 transient（Game.state には一切書かず、セーブに混入しない）。
window.Game = window.Game || {};

Game.Net = (function () {
  let room = null;
  let sendPos = null, sendEdit = null, sendHello = null, sendWorld = null, sendChat = null;
  let sendMobsA = null, sendHitA = null, sendReadyA = null, sendGiveA = null;
  let pendingDeaths = [], pendingLaunch = false, pendingDiscovery = null, pendingCutEnd = false;
  let isHost = false, connected = false, mobInterval = null;
  let originalHost = false; // 自分がルーム作成者か（分裂解消の優先権）
  let myName = '旅人' + Math.floor(Math.random() * 9000 + 1000);
  let selfId = null, hostId = null; // ホスト移譲(自動昇格)用
  const peers = {}; // id -> {x,y,dir,world,name,lastSeen,_greeted}  ※transient

  // --- ホスト生存監視 / 再接続（すべて transient） ---
  const HOST_TIMEOUT = 8000;   // スナップショット(150ms間隔)がこの時間途絶えたらホスト消失とみなす
  const WATCH_EVERY = 2000;
  const REJOIN_MAX = 2;        // 自分の回線断→復帰時の有界リジョイン回数
  let watchdog = null, lastHostSeen = 0, netState = 'ok'; // ok|offline|rejoin
  let rejoinAttempts = 0, lastCode = null, internalRejoin = false;
  // 発射カットシーンのスキップ同期（ホスト権威: グリーフィング防止のためホストのみ全員スキップ権限）
  let launchWatch = 0, launchWatchT = 0;   // host: 0=なし 1=開始待ち 2=再生中
  let expectLaunchEnd = 0;                 // client: 発射受信時刻（ce受理の窓）

  function available() { return !!window.__trystero; }
  function getPeers() { return peers; }
  function peerCount() { return connected ? Object.keys(peers).length : 0; }
  function isConnected() { return connected; }
  function setName(n) { if (n) { myName = n; if (connected && sendHello) try { sendHello({ name: myName }); } catch (e) {} } }

  // 受信ハンドラ防御: 不正パケット1つでセッションが死なないように
  function safe(tag, fn) {
    return function (d, id) { try { fn(d, id); } catch (e) { console.warn('[net] handler error (' + tag + '):', e && e.message ? e.message : e); } };
  }

  function statusText() {
    if (!connected) return '';
    if (netState !== 'ok') return '再接続中…';
    const n = Object.keys(peers).length;
    return n === 0 ? '接続中' : n + '人と冒険中';
  }
  // UI更新 + バッジ文言を状況表示に（ui.js の '(n)人' 表示を接続状態つきで上書き）
  function refreshNetUI() {
    if (Game.UI && Game.UI.refreshNet) Game.UI.refreshNet();
    try {
      const c = document.getElementById('net-count');
      if (c && connected) c.textContent = statusText();
    } catch (e) {}
  }

  function start(code, host) {
    if (!available()) { Game.UI.toast('マルチプレイ準備中… ネット接続を確認してください'); return false; }
    if (connected) leave();
    isHost = host;
    originalHost = host;
    const T = window.__trystero;
    selfId = (T && T.selfId) || null;
    hostId = host ? selfId : null; // ホストは自分、参加者はworld受信時に確定
    lastCode = code;
    if (!internalRejoin) { rejoinAttempts = 0; netState = 'ok'; }
    lastHostSeen = Date.now(); // 接続直後の猶予
    try {
      room = T.joinRoom({ appId: 'haruking_survival_mp' }, code);
    } catch (e) { Game.UI.toast('接続に失敗しました'); return false; }

    const a1 = room.makeAction('pos');   sendPos = a1[0];
    const a2 = room.makeAction('edit');  sendEdit = a2[0];
    const a3 = room.makeAction('hello'); sendHello = a3[0];
    const a4 = room.makeAction('world'); sendWorld = a4[0];
    const a5 = room.makeAction('chat');  sendChat = a5[0];
    const a6 = room.makeAction('mobs');  sendMobsA = a6[0];
    const a7 = room.makeAction('hit');   sendHitA = a7[0];
    const a9 = room.makeAction('ready');  sendReadyA = a9[0];
    const a10 = room.makeAction('give');  sendGiveA = a10[0];
    a10[1](safe('give', function (d, id) { // アイテム受け取り（1対1の受け渡し）
      if (!Game.state) return;
      if (d.roll) Game.Inventory.addInstance({ id: d.id, roll: d.roll });
      else Game.Inventory.add(d.id, d.count || 1);
      Game.UI.refreshAll && Game.UI.refreshAll();
      Game.UI.toast((peers[id] && peers[id].name || '仲間') + ' から ' + (Game.ITEMS[d.id] ? Game.ITEMS[d.id].name : d.id) + ' を受け取った');
    }));
    a9[1](safe('ready', function (d, id) { // client→host: 発射準備 / 発見通知
      if (!isHost) return;
      if (d && d.disc) { if (Game.Discovery) Game.Discovery.onRemote(d.disc); pendingDiscovery = d.disc; } // ホスト再生＋他クライアントへ中継
      else Game.Rocket.peerReady(id);
    }));

    a1[1](safe('pos', function (d, id) {
      const p = peers[id] || (peers[id] = {});
      if (p.x == null) { p.x = d.x; p.y = d.y; }
      p.tx = d.x; p.ty = d.y; p.dir = d.dir; p.world = d.world; p.lastSeen = Date.now();
      if (id === hostId) lastHostSeen = Date.now(); // ホストのposも生存証明
    }));
    a3[1](safe('hello', function (d, id) {
      const p = peers[id] || (peers[id] = {});
      p.name = d.name; p.lastSeen = Date.now();
      // リジョイン時の分身除去: 同名で5秒以上更新の無い旧エントリを掃除
      for (const oid in peers) {
        if (oid !== id && peers[oid].name === d.name && (!peers[oid].lastSeen || Date.now() - peers[oid].lastSeen > 5000)) delete peers[oid];
      }
      if (!p._greeted) { p._greeted = 1; Game.UI.toast((d.name || 'プレイヤー') + ' が参加しました'); refreshNetUI(); }
    }));
    a4[1](safe('world', function (d, id) { if (id) { hostId = id; lastHostSeen = Date.now(); } if (!isHost) adoptWorld(d); })); // 送信元=現ホストを記録
    a2[1](safe('edit', function (d) { applyRemoteEdit(d.tx, d.ty, d.o, d.w); }));
    a5[1](safe('chat', function (d, id) { Game.UI.toast((peers[id] && peers[id].name || '旅人') + ': ' + d.t); }));
    a6[1](safe('mobs', function (d, id) { // client: 敵スナップショット＋死亡ドロップ＋発射/発見/スキップ同期
      if (isHost) {
        // 分裂解消: 昇格ホスト同士/旧ホスト復帰の競合は「元ホスト > ID小」で自動収束
        if (!originalHost && (d.oh || (id && selfId && id < selfId))) demoteToClient(id);
        return;
      }
      if (id) hostId = id;
      lastHostSeen = Date.now();
      if (netState !== 'ok') { netState = 'ok'; rejoinAttempts = 0; Game.UI.toast('再接続しました'); refreshNetUI(); }
      Game.Mobs.applyMobSnapshot(d.m);
      if (d.d) for (let i = 0; i < d.d.length; i++) Game.Mobs.spawnNetDrops(d.d[i].x, d.d[i].y, d.d[i].items);
      if (d.launch) { expectLaunchEnd = Date.now(); Game.Rocket.onRemoteLaunch(); } // ホストの発射に同期
      if (d.ce && expectLaunchEnd && Date.now() - expectLaunchEnd < 180000) { // ホストがスキップ→全員前進（冪等: 再生中のみ）
        expectLaunchEnd = 0;
        if (Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying()) Game.Cutscene.skip();
      }
      if (d.disc && Game.Discovery) Game.Discovery.onRemote(d.disc); // ランドマーク発見を同時再生
    }));
    a7[1](safe('hit', function (d) { if (isHost) Game.Mobs.applyRemoteHit(d.id, d.dmg, d.x, d.y); })); // host: 被ダメ要求

    room.onPeerJoin(safe('join', function (id) {
      peers[id] = peers[id] || {}; // 参加直後から在籍を把握(ホスト移譲の選出を確実に)
      try { sendHello({ name: myName }, id); } catch (e) {}
      if (isHost) try { sendWorld(worldSnapshot(), id); } catch (e) {}
      // 名前付きトーストは hello 受信側で表示。1.5秒待って hello が来なければ無名でフォールバック
      setTimeout(function () {
        if (peers[id] && !peers[id]._greeted) { peers[id]._greeted = 1; Game.UI.toast('プレイヤーが参加しました'); }
      }, 1500);
      refreshNetUI();
    }));
    room.onPeerLeave(safe('leave', function (id) {
      const wasHost = (id === hostId);
      const nm = peers[id] && peers[id].name;
      delete peers[id];
      if (wasHost && !isHost && Object.keys(peers).length === 0) { degradeSolo(); return; } // 二人きり→ソロ継続
      Game.UI.toast(wasHost ? 'ホストが切断されました — ホストを引き継ぎます' : ((nm || 'プレイヤー') + ' が退出しました'));
      refreshNetUI();
      if (wasHost && !isHost) electHost(); // ホスト離脱 → 自動移譲
    }));

    connected = true;
    // ホストは敵スナップショットを定期配信（rAF非依存で堅牢）
    if (isHost) startHostLoop();
    startWatchdog();
    Game.UI.toast(host ? ('ホスト開始 / ルーム: ' + code) : ('ルームに参加: ' + code));
    refreshNetUI();
    return true;
  }

  // ホストの敵スナップショット配信ループ（昇格時にも再利用）
  function startHostLoop() {
    if (mobInterval) return;
    mobInterval = setInterval(function () {
      try {
        if (!(connected && isHost && Game.state && Game.Mobs)) return;
        // 発射カットシーンのスキップ/終了検知（150msポーリング、状態はtransient）
        if (launchWatch === 1) {
          if (Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying()) launchWatch = 2;
          else if (Date.now() - launchWatchT > 6000) launchWatch = 0; // 再生されず終了
        } else if (launchWatch === 2 && !(Game.Cutscene && Game.Cutscene.isPlaying && Game.Cutscene.isPlaying())) {
          launchWatch = 0; pendingCutEnd = true; // スキップ/終了 → 全員を前進させる
        }
        if (sendMobsA) sendMobsA({
          m: Game.Mobs.buildSnapshot(),
          d: pendingDeaths.length ? pendingDeaths : undefined,
          launch: pendingLaunch ? 1 : undefined,
          disc: pendingDiscovery || undefined,
          ce: pendingCutEnd ? 1 : undefined,
          oh: originalHost ? 1 : undefined
        });
        pendingDeaths = []; pendingLaunch = false; pendingDiscovery = null; pendingCutEnd = false;
      } catch (e) { console.warn('[net] host loop:', e && e.message ? e.message : e); }
    }, 150);
  }

  // --- ホスト生存ウォッチドッグ（onPeerLeave が発火しない突然死/回線断もカバー） ---
  function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(watchdogTick, WATCH_EVERY);
  }
  function watchdogTick() {
    try {
      if (!connected || isHost) return;
      if (Date.now() - lastHostSeen < HOST_TIMEOUT) return; // 正常
      // タイムアウト。まず自分の回線かを判定
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (netState !== 'offline') { netState = 'offline'; Game.UI.toast('接続が不安定です — 回線の回復を待っています…'); refreshNetUI(); }
        return; // オフライン中は選出せず待機（勝手なホスト分裂を防ぐ）
      }
      if (netState === 'offline' || netState === 'rejoin') {
        // 自分の回線が戻った → 有界リジョイン（既存の参加経路を再利用）
        if (rejoinAttempts < REJOIN_MAX) {
          rejoinAttempts++;
          netState = 'rejoin';
          Game.UI.toast('再接続しています… (' + rejoinAttempts + '/' + REJOIN_MAX + ')');
          const code = lastCode;
          internalRejoin = true;
          try { leave(); start(code, false); } finally { internalRejoin = false; }
          netState = 'rejoin'; refreshNetUI();
          return;
        }
        degradeSolo(); return;
      }
      // 回線は生きているのにホスト無音 → ホスト消失。 stale エントリを外して移譲 or ソロ化
      if (hostId && peers[hostId]) delete peers[hostId];
      if (Object.keys(peers).length > 0) {
        Game.UI.toast('ホストの応答がありません — ホストを引き継ぎます');
        electHost();
        lastHostSeen = Date.now(); // 新ホストの初回配信を待つ猶予
        refreshNetUI();
      } else degradeSolo();
    } catch (e) { console.warn('[net] watchdog:', e && e.message ? e.message : e); }
  }

  // ソロ復帰: 送信停止・ローカル敵シミュレーション再開（mobs.js は isConnected()=false で自動的に通常更新へ）
  function degradeSolo() {
    leave();
    Game.UI.toast('ホストとの接続が切れました — ソロで継続します');
    refreshNetUI();
  }

  // 昇格ホストの降格（元ホスト復帰などの分裂解消）
  function demoteToClient(newHostId) {
    if (!isHost || originalHost) return;
    isHost = false; hostId = newHostId || hostId;
    if (mobInterval) { clearInterval(mobInterval); mobInterval = null; }
    lastHostSeen = Date.now();
    Game.UI.toast('ホストが復帰しました — 同期を戻します');
    refreshNetUI();
  }

  // ホスト離脱時の自動ホスト移譲。残存ピア全員が同じ集合から決定的に最小IDを選ぶ。
  function electHost() {
    if (!connected || isHost) return;
    // 候補 = 自分 + 現在繋がっている残存ピア（ホストは既に削除済み）
    const ids = [selfId];
    for (const id in peers) ids.push(id);
    ids.sort();
    const elected = ids[0];
    if (elected === selfId) promoteToHost();
    else { hostId = elected; Game.UI.toast('ホスト移譲中… 新ホストに同期します'); }
  }

  function promoteToHost() {
    if (isHost) return;
    isHost = true; hostId = selfId;
    startHostLoop();
    // 全員へ自分の世界差分を再配信し、ズレを補正（みんなは既にseedを共有済み）
    try { if (sendWorld) sendWorld(worldSnapshot()); } catch (e) {}
    Game.UI.toast('★ あなたが新しいホストになりました（自動移譲）— 進行は途切れません');
    refreshNetUI();
    if (Game.Save) Game.Save.autosave('force'); // 昇格直後に保全
  }

  function leave() {
    if (mobInterval) { clearInterval(mobInterval); mobInterval = null; }
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
    if (room) { try { room.leave(); } catch (e) {} }
    room = null; connected = false; isHost = false; originalHost = false; selfId = null; hostId = null;
    pendingDeaths = []; pendingLaunch = false; pendingDiscovery = null; pendingCutEnd = false;
    launchWatch = 0; expectLaunchEnd = 0; lastHostSeen = 0;
    if (!internalRejoin) { netState = 'ok'; rejoinAttempts = 0; }
    for (const k in peers) delete peers[k];
    Game.UI.refreshNet && Game.UI.refreshNet();
  }

  function worldSnapshot() {
    const dump = function (name) { const o = {}; Game.state.worlds[name].modifiedTiles.forEach(function (v, k) { o[k] = v; }); return o; };
    return { seed: Game.state.seed, light: dump('light'), shadow: dump('shadow'), tick: Game.state.tick };
  }
  function adoptWorld(d) {
    if (Game.adoptNetWorld) Game.adoptNetWorld(d);
  }

  // 送信（main から定期）。静止中は帯域節約のため間引き（1.5秒毎のハートビートのみ）
  let posTimer = 0;
  let lastSent = { x: null, y: null, dir: null, w: null, t: 0 };
  function tick() {
    if (!connected || !sendPos) return;
    posTimer++;
    if (posTimer < 6) return; posTimer = 0; // ~10Hz
    const p = Game.state.player;
    const x = Math.round(p.x), y = Math.round(p.y), w = Game.state.worldName;
    const now = Date.now();
    const moved = (x !== lastSent.x || y !== lastSent.y || p.dir !== lastSent.dir || w !== lastSent.w);
    if (!moved && now - lastSent.t < 1500) return; // 静止中スロットル
    lastSent.x = x; lastSent.y = y; lastSent.dir = p.dir; lastSent.w = w; lastSent.t = now;
    try { sendPos({ x: x, y: y, dir: p.dir, world: w }); } catch (e) {}
  }

  // ローカル編集をブロードキャスト
  function broadcastEdit(tx, ty, obj, world) {
    if (connected && sendEdit) try { sendEdit({ tx: tx, ty: ty, o: obj, w: world }); } catch (e) {}
  }
  function applyRemoteEdit(tx, ty, obj, world) {
    if (!Game.state || !Game.state.worlds[world]) return;
    const w = Game.state.worlds[world];
    const key = Game.Utils.tileKey(tx, ty);
    const dlt = w.modifiedTiles.get(key) || {}; dlt.o = obj; w.modifiedTiles.set(key, dlt);
    const ch = w.chunks.get(Game.Utils.chunkKey(Game.World.toChunkCoord(tx), Game.World.toChunkCoord(ty)));
    if (ch) { ch.object[Game.Utils.mod(ty, Game.CFG.CHUNK_SIZE) * Game.CFG.CHUNK_SIZE + Game.Utils.mod(tx, Game.CFG.CHUNK_SIZE)] = obj; ch.dirty = true; }
  }

  function chat(text) { if (connected && sendChat && text) { try { sendChat({ t: text.slice(0, 80) }); } catch (e) {} Game.UI.toast('あなた: ' + text); } }

  // 敵同期（ホスト権威）
  function sendMobsSnapshot(arr) { if (connected && isHost && sendMobsA) try { sendMobsA({ m: arr }); } catch (e) {} }
  function sendHit(id, dmg, x, y) { if (connected && !isHost && sendHitA) try { sendHitA({ id: id, dmg: dmg, x: x, y: y }); } catch (e) {} }
  function sendMobDeath(x, y, items) { if (connected && isHost && items && items.length) pendingDeaths.push({ x: x, y: y, items: items }); }
  function sendLaunchReady() { if (connected && !isHost && sendReadyA) try { sendReadyA({}); } catch (e) {} }
  function broadcastLaunch() {
    if (connected && isHost) { pendingLaunch = true; launchWatch = 1; launchWatchT = Date.now(); } // スキップ同期の監視開始
  }
  // ランドマーク発見: ホストは snapshot で全員へ、クライアントは ready 経由でホストへ
  function broadcastDiscovery(kind) {
    if (!connected) return;
    if (isHost) pendingDiscovery = kind;
    else if (sendReadyA) try { sendReadyA({ disc: kind }); } catch (e) {}
  }
  // 最寄りの仲間にアイテムを渡す（1対1）。成功で true
  function giveItem(slot) {
    if (!connected || !sendGiveA || !slot) return false;
    const p = Game.state.player; let best = null, bd = Infinity;
    for (const id in peers) { const pe = peers[id]; if (pe.tx == null || pe.world !== Game.state.worldName) continue; const d = Math.hypot((pe.tx) - p.x, (pe.ty) - p.y); if (d < bd) { bd = d; best = id; } }
    if (!best) { Game.UI.toast('近くに同じ世界の仲間がいません'); return false; }
    try { sendGiveA({ id: slot.id, count: slot.count, roll: slot.roll || null }, best); } catch (e) { return false; }
    Game.UI.toast((peers[best].name || '仲間') + ' に ' + (Game.ITEMS[slot.id] ? Game.ITEMS[slot.id].name : slot.id) + ' を渡した');
    return true;
  }

  // テスト用フック（本番動作には未使用）: ホスト無音状態を注入してウォッチドッグを即時評価
  function _simHostSilence() { lastHostSeen = Date.now() - HOST_TIMEOUT - 1; watchdogTick(); }

  return { available, start, leave, tick, broadcastEdit, getPeers, peerCount, isConnected, setName, chat, sendMobsSnapshot, sendHit, sendMobDeath, sendLaunchReady, broadcastLaunch, broadcastDiscovery, giveItem, statusText, _simHostSilence, get host() { return isHost; } };
})();
