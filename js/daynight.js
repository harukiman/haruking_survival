// daynight.js — 昼夜サイクル（MVPは時刻進行のみ。照明/spawn連動は次波）
window.Game = window.Game || {};

Game.DayNight = (function () {
  function update() {
    const s = Game.state;
    s.timeOfDay = (s.tick % Game.DAY_LENGTH) / Game.DAY_LENGTH; // 0..1
    // 血の月: 数日ごとの夜
    const day = Math.floor(s.tick / Game.DAY_LENGTH);
    const isBloodDay = ((day + 1) % Game.TUNE.BLOOD_MOON_EVERY) === 0;
    const nowBlood = isBloodDay && isNight();
    if (nowBlood && !s.bloodMoon) { Game.UI.toast('🌑 血の月だ… 今宵は魔物が荒れ狂う。光を絶やすな'); Game.Audio.play('shift'); }
    s.bloodMoon = nowBlood;
    // 天候: 一定間隔でランダム遷移
    if (!s.weather) s.weather = { type: 'clear', timer: 0 };
    s.weather.timer--;
    if (s.weather.timer <= 0) {
      const r = Math.random();
      // プレイヤー付近の地面で天候を判定（地域ハザード: 砂嵐/吹雪）
      const TS = Game.CFG.TILE_SIZE;
      const pt = { tx: Math.floor(s.player.x / TS), ty: Math.floor(s.player.y / TS) };
      const g = Game.World.groundAt(pt.tx, pt.ty);
      const prev = s.weather.type;
      if (r < 0.28) {
        if (g === Game.TILE.SNOW) s.weather.type = Math.random() < 0.5 ? 'blizzard' : 'snow';
        else if (g === Game.TILE.SAND) s.weather.type = Math.random() < 0.6 ? 'sandstorm' : 'clear';
        else s.weather.type = 'rain';
      } else s.weather.type = 'clear';
      s.weather.timer = 1800 + Math.floor(Math.random() * 3600);
      if (s.weather.type !== prev) {
        if (s.weather.type === 'sandstorm') Game.UI.toast('🏜 砂嵐が来た… 視界が悪く、足が重い');
        else if (s.weather.type === 'blizzard') Game.UI.toast('❄ 吹雪だ… 凍えに気をつけろ。火か毛皮を');
      }
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
