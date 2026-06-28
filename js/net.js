// net.js — Trystero P2P 協力プレイ（サーバー不要・GitHub Pagesのまま数人接続）
window.Game = window.Game || {};

Game.Net = (function () {
  let room = null;
  let sendPos = null, sendEdit = null, sendHello = null, sendWorld = null, sendChat = null;
  let isHost = false, connected = false;
  let myName = '旅人' + Math.floor(Math.random() * 9000 + 1000);
  const peers = {}; // id -> {x,y,dir,world,name}

  function available() { return !!window.__trystero; }
  function getPeers() { return peers; }
  function peerCount() { return connected ? Object.keys(peers).length : 0; }
  function isConnected() { return connected; }
  function setName(n) { if (n) myName = n; }

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

    a1[1](function (d, id) { const p = peers[id] || (peers[id] = {}); p.x = d.x; p.y = d.y; p.dir = d.dir; p.world = d.world; });
    a3[1](function (d, id) { const p = peers[id] || (peers[id] = {}); p.name = d.name; });
    a4[1](function (d) { if (!isHost) adoptWorld(d); });
    a2[1](function (d) { applyRemoteEdit(d.tx, d.ty, d.o, d.w); });
    a5[1](function (d, id) { Game.UI.toast((peers[id] && peers[id].name || '旅人') + ': ' + d.t); });

    room.onPeerJoin(function (id) {
      sendHello({ name: myName }, id);
      if (isHost) sendWorld(worldSnapshot(), id);
      Game.UI.toast('プレイヤーが参加しました');
      Game.UI.refreshNet && Game.UI.refreshNet();
    });
    room.onPeerLeave(function (id) { delete peers[id]; Game.UI.toast('プレイヤーが退出'); Game.UI.refreshNet && Game.UI.refreshNet(); });

    connected = true;
    Game.UI.toast(host ? ('ホスト開始 / ルーム: ' + code) : ('ルームに参加: ' + code));
    Game.UI.refreshNet && Game.UI.refreshNet();
    return true;
  }

  function leave() {
    if (room) { try { room.leave(); } catch (e) {} }
    room = null; connected = false;
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

  return { available, start, leave, tick, broadcastEdit, getPeers, peerCount, isConnected, setName, chat, get host() { return isHost; } };
})();
