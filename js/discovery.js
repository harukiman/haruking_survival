// discovery.js — 大きなランドマークの初発見で演出ムービー（MP同時再生）
window.Game = window.Game || {};

Game.Discovery = (function () {
  function kindForObj(o) {
    const O = Game.OBJ;
    if (o === O.SPAWNER || o === O.DUNGEON_WALL) return 'dungeon';
    if (o === O.RESONANCE_CORE || o === O.SEAL_WALL) return 'vault';
    if (o === O.STELA) return 'stela';
    if (o === O.WISH_ALTAR) return 'altar';
    if (o === O.TREASURE_CHEST) return Game.state.worldName === 'space' ? 'cosmic' : 'treasure';
    return null;
  }

  // プレイヤー周辺を走査し、未発見のランドマークがあれば演出
  function scan() {
    const st = Game.state;
    if (!st || st.paused) return;
    if (Game.Cutscene && Game.Cutscene.isPlaying()) return;
    const TS = Game.CFG.TILE_SIZE, p = st.player;
    const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    const R = 5;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const k = kindForObj(Game.World.objAt(ptx + dx, pty + dy));
        if (k) { if (tryTrigger(k, ptx + dx, pty + dy)) return; }
      }
    }
    // ボス接近
    const mobs = st.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.def.boss && Math.hypot(m.x - p.x, m.y - p.y) < 360) { tryTrigger('boss', Math.round(m.x / TS), Math.round(m.y / TS)); return; }
    }
  }

  const KIND_LABEL = { dungeon: 'ダンジョン', vault: '封印遺跡', stela: '石碑', treasure: '宝の在り処', cosmic: '星の宝', boss: '強敵', altar: '古の祭壇' };

  // 同種は「世界＋40タイル区画」ごとに地図記録は一度きり。
  // 発見ムービー(全画面演出)は「種別ごと初回のみ」。2回目以降は控えめなトーストだけで中断しない。
  function tryTrigger(kind, tx, ty) {
    if (!Game.state.discovered) Game.state.discovered = {};
    const key = Game.state.worldName + ':' + kind + ':' + Math.floor(tx / 40) + ',' + Math.floor(ty / 40);
    if (Game.state.discovered[key]) return false;
    // この種別を過去に発見済みか（演出を出すかの判定。記録キー追加より前に確認）
    const firstOfKind = !Object.keys(Game.state.discovered).some(function (k) { return k.split(':')[1] === kind; });
    Game.state.discovered[key] = 1;
    if (Game.Achievements && Object.keys(Game.state.discovered).length >= 5) Game.Achievements.unlock('explorer');
    if (firstOfKind) {
      fire(kind);
      if (Game.Net && Game.Net.isConnected() && Game.Net.broadcastDiscovery) Game.Net.broadcastDiscovery(kind);
    } else if (Game.UI && Game.UI.toast) {
      Game.UI.toast((KIND_LABEL[kind] || '何か') + 'を見つけた');
    }
    return true;
  }

  function fire(kind) {
    if (!Game.Cutscene || !Game.Cutscene.playDiscovery) return;
    Game.state.paused = true;
    Game.Cutscene.playDiscovery(kind, function () { Game.state.paused = false; });
  }

  // 他プレイヤーの発見を受けて同時再生（自分が再生中なら重複回避）
  function onRemote(kind) {
    if (Game.Cutscene && Game.Cutscene.isPlaying()) return;
    fire(kind);
  }

  return { scan, onRemote, fire };
})();
