/* ═══════════════════════════════════════════════════════════════════════
 *  4626.fun — Immersive Audio Layer
 *  ─────────────────────────────────────────────────────────────────────
 *  • ~60s looped music bed (subtle, piano-led)
 *  • 15s cosmic ambience loop (string pad)
 *  • 3 interaction FX (hover / click / reveal)
 *  • (close-beat crescendo FX disabled — finale plays silent over the music bed)
 *  • Silent at load. Fades in on first user scroll.
 *  • Mute toggle persisted to localStorage.
 *  • Respects `prefers-reduced-motion`.
 *  • Runs independently of app.js — queries DOM for #ch-* and #ch-close
 *    beat targets (.close-line) and creates its own ScrollTrigger hooks.
 * ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const AUDIO_BASE = './audio/';
  const MUTE_KEY = '4626.audio.muted';

  const MUSIC = { key: 'bed', url: AUDIO_BASE + 'bed.mp3', loop: true, gain: 0.22 };
  const AMBIENCE = { key: 'ambience', url: AUDIO_BASE + 'fx/ambience.mp3', loop: true, gain: 0.12 };

  const FX = {
    // Crescendo beats (beat_L1…L4) intentionally omitted — finale plays
    // silent over the music bed.
    hover:     { url: AUDIO_BASE + 'fx/hover.mp3',     gain: 0.15 },
    click:     { url: AUDIO_BASE + 'fx/click.mp3',     gain: 0.25 },
    reveal:    { url: AUDIO_BASE + 'fx/reveal.mp3',    gain: 0.22 },
  };

  // ─── AudioMixer ────────────────────────────────────────────────────────
  class AudioMixer {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.busMusic = null;
      this.busAmbience = null;
      this.busFx = null;
      this.buffers = new Map();          // key -> AudioBuffer
      this.musicSource = null;
      this.ambienceSource = null;
      this.loadPromise = null;
      this.started = false;
      this.muted = this._readMuted();
    }

    _readMuted() {
      try {
        const v = localStorage.getItem(MUTE_KEY);
        if (v === null) return false;    // default unmuted
        return v === '1';
      } catch (_) { return false; }
    }

    _writeMuted(v) {
      try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (_) {}
    }

    _ensureContext() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.busMusic = this.ctx.createGain();     this.busMusic.gain.value = MUSIC.gain;
      this.busAmbience = this.ctx.createGain();  this.busAmbience.gain.value = AMBIENCE.gain;
      this.busFx = this.ctx.createGain();        this.busFx.gain.value = 1.0;

      this.busMusic.connect(this.master);
      this.busAmbience.connect(this.master);
      this.busFx.connect(this.master);
    }

    async _loadOne(key, url) {
      if (this.buffers.has(key)) return this.buffers.get(key);
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        this.buffers.set(key, buf);
        return buf;
      } catch (e) {
        console.warn('[audio] failed to load', key, e && e.message);
        return null;
      }
    }

    preload() {
      if (this.loadPromise) return this.loadPromise;
      this._ensureContext();
      if (!this.ctx) return Promise.resolve();
      const jobs = [
        this._loadOne(MUSIC.key, MUSIC.url),
        this._loadOne(AMBIENCE.key, AMBIENCE.url),
      ];
      for (const [k, cfg] of Object.entries(FX)) {
        jobs.push(this._loadOne(k, cfg.url));
      }
      this.loadPromise = Promise.all(jobs);
      return this.loadPromise;
    }

    // First scroll gesture — resume context, fade music in over 3s.
    async start() {
      if (this.started) return;
      this.started = true;
      this._ensureContext();
      if (!this.ctx) return;
      try { if (this.ctx.state === 'suspended') await this.ctx.resume(); } catch (_) {}
      await this.preload();
      this._startBed(MUSIC, this.busMusic, 3.0);
      this._startBed(AMBIENCE, this.busAmbience, 2.0);
    }

    _startBed(spec, bus, fadeSec) {
      const buf = this.buffers.get(spec.key);
      if (!buf) return null;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, this.ctx.currentTime + fadeSec);
      src.connect(g); g.connect(bus);
      src.start();
      if (spec.key === MUSIC.key) this.musicSource = { src, gain: g };
      else this.ambienceSource = { src, gain: g };
      return src;
    }

    playFx(name) {
      if (!this.ctx || !this.started) return;
      const buf = this.buffers.get(name);
      const cfg = FX[name];
      if (!buf || !cfg) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = cfg.gain;
      src.connect(g); g.connect(this.busFx);
      src.start();
    }

    setMuted(v) {
      this.muted = !!v;
      this._writeMuted(this.muted);
      if (!this.master) return;
      const now = this.ctx.currentTime;
      const target = this.muted ? 0 : 1;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(target, now + 0.25);
    }

    toggleMuted() { this.setMuted(!this.muted); return this.muted; }
  }

  // ─── Mute button (floating bottom-right) ───────────────────────────────
  // Always floats at bottom-right. Keeps the nav clean so "4626.fun" reads
  // without competing elements (important on narrow mobile viewports).
  function injectMuteButton(mixer) {
    const existing = document.getElementById('audio-toggle');
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);

    const btn = document.createElement('button');
    btn.id = 'audio-toggle';
    btn.type = 'button';
    btn.className = 'audio-toggle-float';
    btn.setAttribute('aria-label', mixer.muted ? 'Unmute audio' : 'Mute audio');
    btn.setAttribute('aria-pressed', mixer.muted ? 'true' : 'false');
    btn.innerHTML = svgIcon(mixer.muted);

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Guaranteed user-gesture path: resume the AudioContext synchronously
      // here so browsers that ignore scroll-driven resume still play sound.
      try {
        mixer._ensureContext();
        if (mixer.ctx && mixer.ctx.state === 'suspended') {
          await mixer.ctx.resume();
        }
      } catch (_) {}
      const muted = mixer.toggleMuted();
      btn.innerHTML = svgIcon(muted);
      btn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      if (!muted && !mixer.started) mixer.start();
      dismissScrollHint();
    });

    document.body.appendChild(btn);
  }

  // ─── Scroll-to-begin hint ──────────────────────────────────────────────
  // A tiny pill above the audio toggle that quietly tells first-time
  // visitors the experience starts on scroll. It fades in 1.2s after
  // load, dismisses on first scroll / first toggle click / 8s timeout.
  let _hintEl = null;
  let _hintDismissed = false;
  function injectScrollHint() {
    if (_hintEl) return;
    const el = document.createElement('div');
    el.className = 'audio-scroll-hint';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'Scroll to begin';
    document.body.appendChild(el);
    _hintEl = el;
    // Reveal after a beat so it doesn't fight the page-load.
    setTimeout(() => {
      if (!_hintDismissed) el.classList.add('is-visible');
    }, 1200);
    // Self-dismiss after 8 seconds even without interaction.
    setTimeout(dismissScrollHint, 9200);
  }
  function dismissScrollHint() {
    if (_hintDismissed || !_hintEl) return;
    _hintDismissed = true;
    _hintEl.classList.remove('is-visible');
    _hintEl.classList.add('is-dismissed');
    setTimeout(() => {
      if (_hintEl && _hintEl.parentElement) _hintEl.parentElement.removeChild(_hintEl);
      _hintEl = null;
    }, 800);
  }

  function svgIcon(muted) {
    // Inline SVG — speaker with optional slash
    if (muted) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
    }
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  }

  // ─── ScrollTrigger bindings ────────────────────────────────────────────
  function bindScrollTriggers(mixer) {
    if (typeof window.ScrollTrigger === 'undefined') {
      // Retry once after a moment — app.js registers ScrollTrigger via module.
      return setTimeout(() => bindScrollTriggers(mixer), 300);
    }
    const ST = window.ScrollTrigger;

    // Crescendo close-beat FX intentionally disabled. The finale lines
    // (One vault → Two tokens → (3,3) → 4626.fun) now read silent over
    // the continuing music bed for a quieter, more authored ending.
    // Music bed + ambience + click/hover/reveal interaction FX still play.
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  function boot() {
    // Respect reduced-motion: skip audio entirely.
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const mixer = new AudioMixer();
    window.__audio = mixer;  // expose for debugging / nav toggle

    injectMuteButton(mixer);

    injectScrollHint();

    // Start on first scroll (and never sooner). We also attach a one-shot
    // pointerdown / keydown / click handler so the AudioContext can be
    // resumed inside a guaranteed user-gesture frame for browsers that
    // refuse to honour scroll-driven resume.
    let firstGestureBound = false;
    const onFirstGesture = async () => {
      if (firstGestureBound) return;
      firstGestureBound = true;
      window.removeEventListener('scroll', onFirstGesture);
      window.removeEventListener('touchmove', onFirstGesture);
      window.removeEventListener('wheel', onFirstGesture);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      try {
        mixer._ensureContext();
        if (mixer.ctx && mixer.ctx.state === 'suspended') {
          await mixer.ctx.resume();
        }
      } catch (_) {}
      if (!mixer.muted) mixer.start();
      dismissScrollHint();
    };
    window.addEventListener('scroll', onFirstGesture, { passive: true });
    window.addEventListener('touchmove', onFirstGesture, { passive: true });
    window.addEventListener('wheel', onFirstGesture, { passive: true });
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('keydown', onFirstGesture, { passive: true });

    // Interaction FX — light-touch, doesn't depend on mixer being started.
    // (They simply won't play if the user hasn't scrolled yet, which is fine.)
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('a, button, .nav-btn, [role="button"]')) {
        mixer.playFx('click');
      }
    }, { capture: true });

    // ScrollTrigger hooks — bind once the library is on the page.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      bindScrollTriggers(mixer);
    } else {
      document.addEventListener('DOMContentLoaded', () => bindScrollTriggers(mixer));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
