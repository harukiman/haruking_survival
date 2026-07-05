// daynight.js — 昼夜サイクル（MVPは時刻進行のみ。照明/spawn連動は次波）
window.Game = window.Game || {};

Game.DayNight = (function () {
  function update() {
    const s = Game.state;
    s.timeOfDay = (s.tick % Game.DAY_LENGTH) / Game.DAY_LENGTH; // 0..1
    // 血の月: 数日ごとの夜
    const day = Math.floor(s.tick / Game.DAY_LENGTH);
    // ★核の予告: 初めての夜、影の世界を一瞬"見せる"(語るだけでなく体験させる北極星)
    if (!s.storySeen) s.storySeen = {};
    if (isNight() && day === 0 && s.worldName === 'light' && !s.hasShifted && !s.storySeen.shadowVision) {
      s.storySeen.shadowVision = true;
      if (Game.Render.shadowVision) Game.Render.shadowVision();
      if (Game.UI && Game.UI.toast) Game.UI.toast('🌓 夜——鏡の向こうに、もう一つの世界の気配。《影鏡》を作れば渡れる');
    }
    const isBloodDay = ((day + 1) % Game.TUNE.BLOOD_MOON_EVERY) === 0;
    const nowBlood = isBloodDay && isNight();
    if (nowBlood && !s.bloodMoon) {
      Game.UI.toast('🌑 血の月だ… 今宵は魔物が荒れ狂う。光を絶やすな');
      if (Game.Render.flash) Game.Render.flash('rgba(160,20,20,0.4)'); // 血色のフラッシュ
      if (Game.Render.shake) Game.Render.shake(8);
      Game.Audio.play('thunder'); Game.Audio.play('event_horde');
    }
    if (!nowBlood && s.bloodMoon && Game.Story && !Game.Story.seen('bloodmoon')) Game.Story.unlock('bloodmoon', true); // 血の月を越えた
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
        else s.weather.type = Math.random() < 0.35 ? 'storm' : 'rain';
      } else if (r < 0.36) {
        s.weather.type = 'fog'; // 霧（どの地形でも・控えめ）
      } else s.weather.type = 'clear';
      s.weather.timer = 1800 + Math.floor(Math.random() * 3600);
      if (s.weather.type !== prev) {
        if (s.weather.type === 'sandstorm') Game.UI.toast('🏜 砂嵐が来た… 視界が悪く、足が重い');
        else if (s.weather.type === 'blizzard') Game.UI.toast('❄ 吹雪だ… 凍えに気をつけろ。火か毛皮を');
        else if (s.weather.type === 'fog') Game.UI.toast('🌫 霧が立ち込めてきた… 視界に気をつけろ');
        else if (s.weather.type === 'storm') Game.UI.toast('⛈ 雷雨だ… 稲光と雷鳴、雨脚が強い');
      }
    }
    // 雷雨: 稀に稲光(画面フラッシュ＋雷鳴＋空からの稲妻)。演出のみ(ダメージ無し)
    if (s.weather.type === 'storm' && !s.paused && s.worldName !== 'space' && Math.random() < 0.012) {
      if (Game.Render.flash) Game.Render.flash('rgba(200,220,255,0.5)');
      if (Game.Audio) Game.Audio.play('thunder');
      if (Game.Render.spawnLightning) {
        const TS = Game.CFG.TILE_SIZE;
        const lx = s.player.x + (Math.random() - 0.5) * 320;
        const ly = s.player.y + (Math.random() - 0.5) * 220;
        Game.Render.spawnLightning(lx, ly - 340, lx, ly);
        // 落雷の世界反応: 着弾点の近くの敵に大ダメージ+着弾地点が発火(雨で早鎮火)。
        // 嵐は脅威であり武器にもなる — 敵の群れへ雷が落ちる幸運も
        {
          const TS2 = Game.CFG.TILE_SIZE;
          const mobs2 = s.mobs || [];
          for (let mi = 0; mi < mobs2.length; mi++) {
            const mm = mobs2[mi]; if (!mm.def || mm.def.friendly) continue;
            if (Math.hypot(mm.x - lx, mm.y - ly) < 1.6 * TS2) {
              if (Game.Net.isConnected() && !Game.Net.host) Game.Net.sendHit(mm.id, 30, lx, ly);
              else Game.Mobs.damageMob(mm, 30, lx, ly, false);
            }
          }
          if (Game.World.ignite && Math.random() < 0.5) Game.World.ignite(lx, ly, 1, 0.4); // 稀に着弾点が燃える
          if (Game.Render.spawnParticles) Game.Render.spawnParticles(lx, ly, '#fff07a', 10);
        }
        // 屋外(住宅の外)で無防備なら落雷が直撃しうる。屋内(セーフエリア)なら安全
        if (!sheltered() && !peaceful() && Math.random() < 0.22) {
          Game.Survival.damage(4, 'storm');
          if (Game.Render.flash) Game.Render.flash('rgba(255,255,255,0.7)');
          expoToast('⚡ 落雷を受けた！ 嵐の間は屋根の下へ避難を', 'storm');
        }
      }
    }
    weatherExposure(s);
  }

  // ---- 天候ダメージと住宅セーフエリア ----
  // 住宅(床＋四方を壁で囲う)に入れば天候の脅威を完全に無効化。屋外では吹雪=凍え/砂嵐=消耗で
  // じわりと削られる(のんびりは免除)。焚火/ランタンの暖 or 暖かい防具でも凍えは防げる。
  let expoTick = 0, expoMsgAt = -9999, wasShel = false;
  function peaceful() { const d = Game.DIFFICULTIES[Game.state.difficulty]; return !d || d.dmgMult === 0; }
  function sheltered() { return Game.World.isSheltered && Game.World.isSheltered(); }
  function nearWarmth() { return Game.Survival.nearLight && Game.Survival.nearLight(); } // 焚火/ランタン等の光=暖
  function hasWarmGear() {
    const p = Game.state.player; if (!p || !p.armor) return false;
    for (const k in p.armor) { const a = p.armor[k]; if (!a) continue; const def = Game.ITEMS[a.id || a]; if (def && def.warm) return true; }
    return false;
  }
  function expoToast(msg, snd) {
    if (Game.state.tick - expoMsgAt < 360) return; // 連呼しない
    expoMsgAt = Game.state.tick; Game.UI.toast(msg); if (snd && Game.Audio) Game.Audio.play('hurt');
  }
  function weatherExposure(s) {
    if (s.paused || !s.player || s.player.health <= 0) return;
    if (s.worldName === 'space') return;
    const shel = sheltered();
    // セーフエリア出入りのフィードバック
    if (shel && !wasShel) Game.UI.toast('🏠 住まいの中は安全だ。天候の脅威が届かない');
    wasShel = shel;
    if (shel || peaceful()) return;         // 屋内 or のんびり=天候無効
    const w = s.weather && s.weather.type; if (!w || w === 'clear' || w === 'fog' || w === 'rain') return;
    expoTick++;
    if (w === 'blizzard') {
      if (nearWarmth() || hasWarmGear()) return; // 暖があれば凍えない
      if (expoTick % 150 === 0) { Game.Survival.damage(1, 'cold'); expoToast('❄ 凍えている… 火のそばへ、毛皮を、あるいは屋根の下へ', 'cold'); }
    } else if (w === 'sandstorm') {
      if (expoTick % 200 === 0) { Game.Survival.damage(1, 'sand'); expoToast('🏜 砂塵に削られている… 屋内に逃れよう', 'sand'); }
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
    const icon = Game.state.bloodMoon ? '🌑 ' : isNight() ? '🌙 ' : '☀ ';
    return icon + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  return { update, isNight, clockText };
})();
