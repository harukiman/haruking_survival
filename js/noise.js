// noise.js — value noise + fBm（seed連続・チャンク跨ぎ連続）
window.Game = window.Game || {};

Game.Noise = (function () {
  const U = Game.Utils;

  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = U.fade(xf), v = U.fade(yf);
    const a = U.hash3(xi, yi, seed);
    const b = U.hash3(xi + 1, yi, seed);
    const c = U.hash3(xi, yi + 1, seed);
    const d = U.hash3(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  }

  // fractal Brownian motion -> 0..1
  function fbm(x, y, seed, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * valueNoise(x * freq, y * freq, seed + i * 1013);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  }

  return { valueNoise, fbm };
})();
