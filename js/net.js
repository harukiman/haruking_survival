// net.js — Trystero P2P 協力プレイ（サーバー不要・GitHub Pagesのまま数人接続）
window.Game = window.Game || {};

Game.Net = (function () {
  let room = null;
  let sendPos = null, sendEdit = null, sendHello = null, sendWorld = null, sendChat = null;
  let sendMobsA = null, sendHitA = null, sendReadyA = null, sendGiveA = null;
  let pendingDeaths = [], pendingLaunch = false, pendingDiscovery = null;
  let isHost = false, connected = false, mobInterval = null;
  let myName = '旅人' + Math.floor(Math.random() * 9000 + 1000);
  let selfId = null, hostId = null; // ホスト移譲(自動昇格)用
  const peers = {}; // id -> {x,y,dir,world,name}

  function available() { return !!window.__trystero; }
  function getPeers() { return peers; }
  function peerCount() { return connected ? Object.keys(peers).length : 0; }
  function isConnected() { return connected; }
  function setName(n) { if (n) { myName = n; if (connected && sendHello) sendHello({ name: myName }); } }

  function start(code, host) {
    if (!available()) { Game.UI.toast('マルチプレイ準備中… ネット接続を確認してください'); return false; }
    if (connected) leave();
    isHost = host;
    const T = window.__trystero;
    selfId = (T && T.selfId) || null;
    hostId = host ? selfId : null; // ホストは自分、参加者はworld受信時に確定
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
    a10[1](function (d, id) { // アイテム受け取り（1対1の受け渡し）
      if (!Game.state) return;
      if (d.roll) Game.Inventory.addInstance({ id: d.id, roll: d.roll });
      else Game.Inventory.add(d.id, d.count || 1);
      Game.UI.refreshAll && Game.UI.refreshAll();
      Game.UI.toast((peers[id] && peers[id].name || '仲間') + ' から ' + (Game.ITEMS[d.id] ? Game.ITEMS[d.id].name : d.id) + ' を受け取った');
    });
    a9[1](function (d, id) { // client→host: 発射準備 / 発見通知
      if (!isHost) return;
      if (d && d.disc) { if (Game.Discovery) Game.Discovery.onRemote(d.disc); pendingDiscovery = d.disc; } // ホスト再生＋他クライアントへ中継
      else Game.Rocket.peerReady(id);
    });

    a1[1](function (d, id) { const p = peers[id] || (peers[id] = {}); if (p.x == null) { p.x = d.x; p.y = d.y; } p.tx = d.x; p.ty = d.y; p.dir = d.dir; p.world = d.world; });
    a3[1](function (d, id) { const p = peers[id] || (peers[id] = {}); p.name = d.name; });
    a4[1](function (d, id) { if (id) hostId = id; if (!isHost) adoptWorld(d); }); // 送信元=現ホストを記録
    a2[1](function (d) { applyRemoteEdit(d.tx, d.ty, d.o, d.w); });
    a5[1](function (d, id) { Game.UI.toast((peers[id] && peers[id].name || '旅人') + ': ' + d.t); });
    a6[1](function (d) { // client: 敵スナップショット＋死亡ドロップ
      if (isHost) return;
      Game.Mobs.applyMobSnapshot(d.m);
      if (d.d) for (let i = 0; i < d.d.length; i++) Game.Mobs.spawnNetDrops(d.d[i].x, d.d[i].y, d.d[i].items);
      if (d.launch) Game.Rocket.onRemoteLaunch(); // ホストの発射に同期
      if (d.disc && Game.Discovery) Game.Discovery.onRemote(d.disc); // ランドマーク発見を同時再生
    });
    a7[1](function (d) { if (isHost) Game.Mobs.applyRemoteHit(d.id, d.dmg, d.x, d.y); }); // host: 被ダメ要求

    room.onPeerJoin(function (id) {
      peers[id] = peers[id] || {}; // 参加直後から在籍を把握(ホスト移譲の選出を確実に)
      sendHello({ name: myName }, id);
      if (isHost) sendWorld(worldSnapshot(), id);
      Game.UI.toast('プレイヤーが参加しました');
      Game.UI.refreshNet && Game.UI.refreshNet();
    });
    room.onPeerLeave(function (id) {
      const wasHost = (id === hostId);
      delete peers[id];
      Game.UI.toast(wasHost ? 'ホストが切断されました — ホストを引き継ぎます' : 'プレイヤーが退出');
      Game.UI.refreshNet && Game.UI.refreshNet();
      if (wasHost && !isHost) electHost(); // ホスト離脱 → 自動移譲
    });

    connected = true;
    // ホストは敵スナップショットを定期配信（rAF非依存で堅牢）
    if (isHost) startHostLoop();
    Game.UI.toast(host ? ('ホスト開始 / ルーム: ' + code) : ('ルームに参加: ' + code));
    Game.UI.refreshNet && Game.UI.refreshNet();
    return true;
  }

  // ホストの敵スナップショット配信ループ（昇格時にも再利用）
  function startHostLoop() {
    if (mobInterval) return;
    mobInterval = setInterval(function () {
      if (connected && isHost && Game.state && Game.Mobs) {
        if (sendMobsA) sendMobsA({ m: Game.Mobs.buildSnapshot(), d: pendingDeaths.length ? pendingDeaths : undefined, launch: pendingLaunch ? 1 : undefined, disc: pendingDiscovery || undefined });
        pendingDeaths = []; pendingLaunch = false; pendingDiscovery = null;
      }
    }, 150);
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
    Game.UI.refreshNet && Game.UI.refreshNet();
    if (Game.Save) Game.Save.autosave('force'); // 昇格直後に保全
  }

  function leave() {
    if (mobInterval) { clearInterval(mobInterval); mobInterval = null; }
    if (room) { try { room.leave(); } catch (e) {} }
    room = null; connected = false; isHost = false; selfId = null; hostId = null; pendingDeaths = [];
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

  // 送信（main から定期）
  let posTimer = 0;
  function tick() {
    if (!connected || !sendPos) return;
    posTimer++;
    if (posTimer < 6) return; posTimer = 0; // ~10Hz
    const p = Game.state.player;
    sendPos({ x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, world: Game.state.worldName });
  }

  // ローカル編集をブロードキャスト
  function broadcastEdit(tx, ty, obj, world) {
    if (connected && sendEdit) sendEdit({ tx: tx, ty: ty, o: obj, w: world });
  }
  function applyRemoteEdit(tx, ty, obj, world) {
    if (!Game.state || !Game.state.worlds[world]) return;
    const w = Game.state.worlds[world];
    const key = Game.Utils.tileKey(tx, ty);
    const dlt = w.modifiedTiles.get(key) || {}; dlt.o = obj; w.modifiedTiles.set(key, dlt);
    const ch = w.chunks.get(Game.Utils.chunkKey(Game.World.toChunkCoord(tx), Game.World.toChunkCoord(ty)));
    if (ch) { ch.object[Game.Utils.mod(ty, Game.CFG.CHUNK_SIZE) * Game.CFG.CHUNK_SIZE + Game.Utils.mod(tx, Game.CFG.CHUNK_SIZE)] = obj; ch.dirty = true; }
  }

  function chat(text) { if (connected && sendChat && text) { sendChat({ t: text.slice(0, 80) }); Game.UI.toast('あなた: ' + text); } }

  // 敵同期（ホスト権威）
  function sendMobsSnapshot(arr) { if (connected && isHost && sendMobsA) sendMobsA({ m: arr }); }
  function sendHit(id, dmg, x, y) { if (connected && !isHost && sendHitA) sendHitA({ id: id, dmg: dmg, x: x, y: y }); }
  function sendMobDeath(x, y, items) { if (connected && isHost && items && items.length) pendingDeaths.push({ x: x, y: y, items: items }); }
  function sendLaunchReady() { if (connected && !isHost && sendReadyA) sendReadyA({}); }
  function broadcastLaunch() { if (connected && isHost) pendingLaunch = true; }
  // ランドマーク発見: ホストは snapshot で全員へ、クライアントは ready 経由でホストへ
  function broadcastDiscovery(kind) {
    if (!connected) return;
    if (isHost) pendingDiscovery = kind;
    else if (sendReadyA) sendReadyA({ disc: kind });
  }
  // 最寄りの仲間にアイテムを渡す（1対1）。成功で true
  function giveItem(slot) {
    if (!connected || !sendGiveA || !slot) return false;
    const p = Game.state.player; let best = null, bd = Infinity;
    for (const id in peers) { const pe = peers[id]; if (pe.tx == null || pe.world !== Game.state.worldName) continue; const d = Math.hypot((pe.tx) - p.x, (pe.ty) - p.y); if (d < bd) { bd = d; best = id; } }
    if (!best) { Game.UI.toast('近くに同じ世界の仲間がいません'); return false; }
    sendGiveA({ id: slot.id, count: slot.count, roll: slot.roll || null }, best);
    Game.UI.toast((peers[best].name || '仲間') + ' に ' + (Game.ITEMS[slot.id] ? Game.ITEMS[slot.id].name : slot.id) + ' を渡した');
    return true;
  }

  return { available, start, leave, tick, broadcastEdit, getPeers, peerCount, isConnected, setName, chat, sendMobsSnapshot, sendHit, sendMobDeath, sendLaunchReady, broadcastLaunch, broadcastDiscovery, giveItem, get host() { return isHost; } };
})();
