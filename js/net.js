// net.js — Trystero P2P 協力プレイ（サーバー不要・GitHub Pagesのまま数人接続）
window.Game = window.Game || {};

Game.Net = (function () {
  let room = null;
  let sendPos = null, sendEdit = null, sendHello = null, sendWorld = null, sendChat = null;
  let sendMobsA = null, sendHitA = null, sendReadyA = null;
  let pendingDeaths = [], pendingLaunch = false;
  let isHost = false, connected = false, mobInterval = null;
  let myName = '旅人' + Math.floor(Math.random() * 9000 + 1000);
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
    a9[1](function (d, id) { if (isHost) Game.Rocket.peerReady(id); }); // client→host: 発射準備

    a1[1](function (d, id) { const p = peers[id] || (peers[id] = {}); if (p.x == null) { p.x = d.x; p.y = d.y; } p.tx = d.x; p.ty = d.y; p.dir = d.dir; p.world = d.world; });
    a3[1](function (d, id) { const p = peers[id] || (peers[id] = {}); p.name = d.name; });
    a4[1](function (d) { if (!isHost) adoptWorld(d); });
    a2[1](function (d) { applyRemoteEdit(d.tx, d.ty, d.o, d.w); });
    a5[1](function (d, id) { Game.UI.toast((peers[id] && peers[id].name || '旅人') + ': ' + d.t); });
    a6[1](function (d) { // client: 敵スナップショット＋死亡ドロップ
      if (isHost) return;
      Game.Mobs.applyMobSnapshot(d.m);
      if (d.d) for (let i = 0; i < d.d.length; i++) Game.Mobs.spawnNetDrops(d.d[i].x, d.d[i].y, d.d[i].items);
      if (d.launch) Game.Rocket.onRemoteLaunch(); // ホストの発射に同期
    });
    a7[1](function (d) { if (isHost) Game.Mobs.applyRemoteHit(d.id, d.dmg, d.x, d.y); }); // host: 被ダメ要求

    room.onPeerJoin(function (id) {
      sendHello({ name: myName }, id);
      if (isHost) sendWorld(worldSnapshot(), id);
      Game.UI.toast('プレイヤーが参加しました');
      Game.UI.refreshNet && Game.UI.refreshNet();
    });
    room.onPeerLeave(function (id) { delete peers[id]; Game.UI.toast('プレイヤーが退出'); Game.UI.refreshNet && Game.UI.refreshNet(); });

    connected = true;
    // ホストは敵スナップショットを定期配信（rAF非依存で堅牢）
    if (isHost) {
      mobInterval = setInterval(function () {
        if (connected && isHost && Game.state && Game.Mobs) {
          if (sendMobsA) sendMobsA({ m: Game.Mobs.buildSnapshot(), d: pendingDeaths.length ? pendingDeaths : undefined, launch: pendingLaunch ? 1 : undefined });
          pendingDeaths = []; pendingLaunch = false;
        }
      }, 150);
    }
    Game.UI.toast(host ? ('ホスト開始 / ルーム: ' + code) : ('ルームに参加: ' + code));
    Game.UI.refreshNet && Game.UI.refreshNet();
    return true;
  }

  function leave() {
    if (mobInterval) { clearInterval(mobInterval); mobInterval = null; }
    if (room) { try { room.leave(); } catch (e) {} }
    room = null; connected = false; pendingDeaths = [];
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

  return { available, start, leave, tick, broadcastEdit, getPeers, peerCount, isConnected, setName, chat, sendMobsSnapshot, sendHit, sendMobDeath, sendLaunchReady, broadcastLaunch, get host() { return isHost; } };
})();
