// rocket.js — ロケット打上げ（宇宙へ）。マルチは全員同意で発射
window.Game = window.Game || {};

Game.Rocket = (function () {
  let ready = {}; // ホスト集計: 'self'/peerId -> 1

  // ロケットに対話したとき
  function board() {
    if (Game.state.worldName === 'space') { launchTo('light'); return; } // 帰還は即時
    // ソロ or 単独ホスト → 即発射
    if (!Game.Net.isConnected() || Game.Net.peerCount() === 0) { launchTo('space'); return; }
    // マルチ: 全員同意
    if (Game.Net.host) { ready['self'] = 1; announce(); checkAll(); }
    else { Game.Net.sendLaunchReady(); Game.UI.toast('発射準備OK！ 全員が乗ると出発します'); }
  }

  function peerReady(id) { if (!Game.Net.host) return; ready[id] = 1; announce(); checkAll(); }
  function total() { return Game.Net.peerCount() + 1; }
  function count() { return Object.keys(ready).length; }
  function announce() { Game.UI.toast('発射準備 ' + count() + ' / ' + total()); }
  function checkAll() {
    if (Game.Net.host && count() >= total()) { ready = {}; Game.Net.broadcastLaunch(); launchTo('space'); }
  }
  function onRemoteLaunch() { launchTo('space'); } // クライアント受信

  function launchTo(name) {
    if (Game.Cutscene && Game.Cutscene.playLaunch) {
      Game.state.paused = true;
      Game.Cutscene.playLaunch(name === 'space', function () {
        Game.World.travelTo(name);
        Game.state.paused = false;
        Game.UI.toast(name === 'space' ? '宇宙に到達した…！' : '地上に帰還した');
      });
    } else { Game.World.travelTo(name); }
  }

  return { board, peerReady, onRemoteLaunch };
})();
