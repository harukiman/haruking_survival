// settings.js — 永続設定（ゲームセーブと独立。端末ごとに保持）
window.Game = window.Game || {};

Game.Settings = (function () {
  const KEY = 'haruking_settings_v1';
  const DEF = {
    bgmVol: 60, sfxVol: 90, brightness: 100,
    btnSize: 100, btnOpacity: 92, joySens: 100,
    leftHanded: false, dmgNumbers: true, showFps: false, screenShake: true, lowHpWarn: true, ambient: true, homeCompass: true,
  };
  let s = load();
  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEF); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function get(k) { return s[k]; }
  function set(k, v) { s[k] = v; save(); apply(); }
  function all() { return s; }

  function apply() {
    if (Game.Audio && Game.Audio.setVolumes) Game.Audio.setVolumes(s.bgmVol / 100, s.sfxVol / 100);
    const root = document.body;
    root.style.setProperty('--btn-scale', (s.btnSize / 100).toFixed(2));
    root.style.setProperty('--btn-opacity', (s.btnOpacity / 100).toFixed(2));
    root.classList.toggle('left-handed', !!s.leftHanded);
    let ov = document.getElementById('brightness-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'brightness-ov'; const app = document.getElementById('app'); if (app) app.appendChild(ov); }
    if (ov) ov.style.opacity = Math.max(0, (100 - s.brightness) / 100 * 0.72);
  }
  return { get, set, all, apply };
})();
