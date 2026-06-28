// daynight.js — 昼夜サイクル（MVPは時刻進行のみ。照明/spawn連動は次波）
window.Game = window.Game || {};

Game.DayNight = (function () {
  function update() {
    const s = Game.state;
    s.timeOfDay = (s.tick % Game.DAY_LENGTH) / Game.DAY_LENGTH; // 0..1
  }

  function isNight() {
    const t = Game.state.timeOfDay;
    return t < 0.22 || t > 0.78;
  }

  function clockText() {
    // 0=深夜, 0.5=正午 を 24h 表記に
    const hours = (Game.state.timeOfDay * 24 + 6) % 24; // 0をAM6時起点に寄せる
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  return { update, isNight, clockText };
})();
