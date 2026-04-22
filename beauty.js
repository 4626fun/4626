/* ══════════════════════════════════════════════════════════════════════
   beauty.js — 4626.fun · Beauty Pass (runtime companion)
   Tones ambient WebGL intensity without rebuilding shaders.
   Adds gentle chapter-aware atmosphere.
   ══════════════════════════════════════════════════════════════════════ */
(function beautyPass() {
  'use strict';

  // Wait until the scene is alive
  const start = performance.now();
  const tick = () => {
    const sf = window.__starfield;
    if (!sf || !sf.material || !sf.material.uniforms) {
      if (performance.now() - start < 8000) return requestAnimationFrame(tick);
      return; // give up gracefully
    }

    // 1. Global starfield brightness — dial it down. The spec reserves
    //    uBrightness as chapter-driven, so we multiply, not replace.
    const u = sf.material.uniforms;
    const origSet = u.uBrightness;
    if (origSet) {
      // Proxy the uniform so whatever the chapter system writes,
      // we scale it by our beauty coefficient.
      let raw = origSet.value;
      Object.defineProperty(u.uBrightness, 'value', {
        configurable: true,
        get() { return raw * BEAUTY.starMul; },
        set(v) { raw = v; }
      });
    }

    // 2. Ambient orbs — already hidden via CSS; also pause their animations.
    document.querySelectorAll('.ambient-orb').forEach(el => {
      el.style.animation = 'none';
    });

    // 3. Gentle chapter atmosphere: when in Accrue or Close, calm the
    //    field further; in Hero and Token let it breathe. This gives
    //    the "rhythm of tension and release" the spec asks for.
    const scenes = Array.from(document.querySelectorAll('.scroll-scene'));
    let raf = 0;
    const updateAtmosphere = () => {
      raf = 0;
      const vh = window.innerHeight;
      const mid = window.scrollY + vh / 2;
      let active = 'hero';
      for (const s of scenes) {
        const r = s.getBoundingClientRect();
        const top = r.top + window.scrollY;
        if (mid >= top && mid < top + r.height) {
          active = s.id.replace('ch-', '');
          break;
        }
      }
      // Per-chapter star intensity multipliers
      const map = {
        hero:            0.58,
        token:           0.52,
        accrue:          0.42,
        cca:             0.50,
        'dual-overview': 0.46,
        vaults:          0.38,
        close:           0.28,
      };
      const target = map[active] != null ? map[active] : 0.5;
      // Ease toward target — do not snap
      BEAUTY.starMul += (target - BEAUTY.starMul) * 0.08;
    };
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(updateAtmosphere);
    }, { passive: true });

    // Keep easing regardless of scroll so it settles on pauses
    (function settle() {
      updateAtmosphere();
      requestAnimationFrame(settle);
    })();
  };

  const BEAUTY = { starMul: 0.55 };
  window.__beauty = BEAUTY;
  requestAnimationFrame(tick);
})();
