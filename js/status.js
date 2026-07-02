// status.js — 状態異常（出血/毒/感染/凍え/満腹）グロテスクなサバイバル
window.Game = window.Game || {};

Game.Status = (function () {
  const TYPES = {
    bleed:     { name: '出血', icon: '🩸', dps: 1, color: '#c0303a' },
    poison:    { name: '毒', icon: '🤢', dps: 1, color: '#7ac03a' },
    infection: { name: '感染', icon: '🦠', dps: 1, color: '#b06ad0' },
    cold:      { name: '凍え', icon: '❄', dps: 1, color: '#7ac0e0' },
    burn:      { name: '炎上', icon: '🔥', dps: 2, color: '#ff7a3a' },
    wellfed:   { name: '満腹', icon: '🍗', buff: true, color: '#e0b04a' },
    strength:  { name: '力の薬', icon: '💪', buff: true, color: '#ff8a4a' },
    swiftness: { name: '俊足の薬', icon: '💨', buff: true, color: '#7fe0a0' },
    ironskin:  { name: '守りの薬', icon: '🛡', buff: true, color: '#9fd8ff' },
    regen_buff:{ name: '再生の薬', icon: '💗', buff: true, color: '#ff7aa0' },
  };
  // バフの効果量（過剰にならない中庸値）
  const BUFF = { strength: { atk: 4 }, swiftness: { spd: 0.15 }, ironskin: { armor: 4 }, regen_buff: { regen: 1 } };
  function buffSum() {
    const s = st(); const o = { atk: 0, spd: 0, armor: 0, regen: 0 };
    for (const k in BUFF) { if (s[k] > 0) { for (const kk in BUFF[k]) o[kk] += BUFF[k][kk]; } }
    return o;
  }

  function st() { const p = Game.state.player; if (!p.status) p.status = {}; return p.status; }
  function apply(type, ticks) { const s = st(); const fresh = !(s[type] > 0); s[type] = Math.max(s[type] || 0, ticks); if (fresh) flash(type); }
  function add(type, ticks) { const s = st(); const fresh = !(s[type] > 0); s[type] = (s[type] || 0) + ticks; if (fresh) flash(type); }
  function has(type) { return (st()[type] || 0) > 0; }
  function cure(type) { st()[type] = 0; }
  function clearAll() { Game.state.player.status = {}; }
  // デバフが「新規に」付いた瞬間のみ薄い色フラッシュ＋通知(罹患中の再付与では鳴らさない)
  function flash(type) {
    const t = TYPES[type]; if (!t || t.buff) return;
    if (Game.Render && Game.Render.flash && typeof t.color === 'string' && t.color[0] === '#') {
      const h = t.color;
      Game.Render.flash('rgba(' + parseInt(h.substr(1, 2), 16) + ',' + parseInt(h.substr(3, 2), 16) + ',' + parseInt(h.substr(5, 2), 16) + ',0.16)');
    }
    if (Game.UI && Game.UI.toast) Game.UI.toast(t.icon + ' ' + t.name + '状態になった');
  }

  function isCold() {
    const p = Game.state.player;
    for (const k in p.armor) { const a = p.armor[k]; const def = a && Game.ITEMS[a.id || a]; if (def && def.warm) return false; }
    if (Game.Survival.nearLight && Game.Survival.nearLight()) return false; // 火のそばは暖かい
    // 吹雪は地形・時間を問わず凍える（防寒/火で上の早期returnにより保護される）
    if (Game.state.weather && Game.state.weather.type === 'blizzard') return true;
    const TS = Game.CFG.TILE_SIZE;
    const g = Game.World.groundAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
    return g === Game.TILE.SNOW && (Game.DayNight.isNight() || Game.state.worldName === 'shadow');
  }

  function update() {
    const p = Game.state.player; const s = st();
    if (isCold()) apply('cold', 50);
    let dmg = 0;
    const persec = Game.state.tick % 30 === 0;
    for (const k in TYPES) {
      if (!s[k]) continue;
      s[k]--;
      if (!TYPES[k].buff && s[k] > 0 && persec) dmg += TYPES[k].dps;
    }
    // 感染は放置で悪化（出血を誘発）
    if (s.infection > 600 && persec && Math.random() < 0.2) add('bleed', 60);
    if (dmg > 0 && p.health > 0) Game.Survival.damage(dmg, 'status');
    if (Game.state.tick % 15 === 0 && Game.UI.refreshStatus) Game.UI.refreshStatus();
  }

  function activeList() {
    const s = st(); const out = [];
    for (const k in TYPES) if (s[k] > 0) out.push({ key: k, name: TYPES[k].name, icon: TYPES[k].icon, color: TYPES[k].color, buff: !!TYPES[k].buff, t: s[k] });
    return out;
  }

  return { TYPES, apply, add, has, cure, clearAll, update, activeList, buffSum };
})();
