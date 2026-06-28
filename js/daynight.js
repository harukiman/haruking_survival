// daynight.js — 昼夜サイクル（MVPは時刻進行のみ。照明/spawn連動は次波）
window.Game = window.Game || {};

Game.DayNight = (function () {
  function update() {
    const s = Game.state;
    s.timeOfDay = (s.tick % Game.DAY_LENGTH) / Game.DAY_LENGTH; // 0..1
    // 天候: 一定間隔でランダム遷移
    if (!s.weather) s.weather = { type: 'clear', timer: 0 };
    s.weather.timer--;
    if (s.weather.timer <= 0) {
      const r = Math.random();
      // プレイヤー付近の地面で雪/雨を判定
      const TS = Game.CFG.TILE_SIZE;
      const pt = { tx: Math.floor(s.player.x / TS), ty: Math.floor(s.player.y / TS) };
      const cold = Game.World.groundAt(pt.tx, pt.ty) === Game.TILE.SNOW;
      if (r < 0.25) s.weather.type = cold ? 'snow' : 'rain';
      else s.weather.type = 'clear';
      s.weather.timer = 1800 + Math.floor(Math.random() * 3600);
    }
  }

  function isNight() {
    const t = Game.state.timeOfDay;
    return t < 0.22 || t > 0.78;
  }

  function clockText() {
    // 0=深夜00:00, 0.5=正午12:00（暗さモデルと一致）
    const hours = (Game.state.timeOfDay * 24) % 24;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const icon = isNight() ? '🌙 ' : '☀ ';
    return icon + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  return { update, isNight, clockText };
})();
