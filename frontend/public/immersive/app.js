/* app.js — 4626.fun Cinematic Scroll Experience v5
   Audio + Smoothness + Token Alignment + Polish
   WebGL shader-driven particle morph + cinematic hero entrance
   Enhanced Three.js particles + GSAP ScrollTrigger choreography
   Ambient spatial audio via Web Audio API */

import * as THREE from 'three';

// ────────────────────────────────────────────
// 0. REGISTER GSAP
// ────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

// ────────────────────────────────────────────
// 0.05 CONTENT PAN STATE — Ch2 sets this, Three.js camera reads it
// ────────────────────────────────────────────
// Normalized pan value in world units; positive = scene shifts right (content moved left)
window.__contentPanX = 0;

// ────────────────────────────────────────────
// 0.06 DEPTH-AWARE MOUSE PARALLAX — global cursor tracker
// ────────────────────────────────────────────
// Smoothed normalized mouse coords (-0.5 to 0.5), disabled on touch.
const DepthMouse = (() => {
  const state = { x: 0, y: 0, rawX: 0, rawY: 0, active: false };
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) {
    state.active = true;
    document.addEventListener('mousemove', (e) => {
      state.rawX = e.clientX / window.innerWidth - 0.5;  // -0.5 → +0.5
      state.rawY = e.clientY / window.innerHeight - 0.5;
    });
    // Smooth lerp at 60fps via rAF
    (function tick() {
      state.x += (state.rawX - state.x) * 0.08;
      state.y += (state.rawY - state.y) * 0.08;
      requestAnimationFrame(tick);
    })();
  }
  return state;
})();
window.__depthMouse = DepthMouse;

// ────────────────────────────────────────────
// 0.1 RAF WRITE SCHEDULER — batch DOM writes to prevent layout thrashing
// ────────────────────────────────────────────
const WriteBatch = (() => {
  const _queue = [];
  let _scheduled = false;
  function flush() {
    _scheduled = false;
    const len = _queue.length;
    for (let i = 0; i < len; i++) _queue[i]();
    _queue.length = 0;
  }
  return {
    /** Queue a DOM-write callback; all queued writes flush in a single rAF */
    write(fn) {
      _queue.push(fn);
      if (!_scheduled) {
        _scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  };
})();

// ────────────────────────────────────────────
// 0.5 AMBIENT SPATIAL AUDIO SYSTEM
// ────────────────────────────────────────────
const AudioEngine = (function initAudio() {
  let ctx = null;
  let masterGain = null;
  let droneGain = null;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let droneLfo = null;
  let muted = true;
  let initialized = false;

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);

      // ── Drone: deep low hum underlying the experience ──
      droneGain = ctx.createGain();
      droneGain.gain.value = 0;
      droneGain.connect(masterGain);

      // Drone filter for warmth
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 200;
      droneFilter.Q.value = 2;
      droneFilter.connect(droneGain);

      // Two detuned oscillators for thickness
      droneOsc1 = ctx.createOscillator();
      droneOsc1.type = 'sine';
      droneOsc1.frequency.value = 55; // A1
      droneOsc1.connect(droneFilter);
      droneOsc1.start();

      droneOsc2 = ctx.createOscillator();
      droneOsc2.type = 'sine';
      droneOsc2.frequency.value = 55.15; // slightly detuned for beating
      droneOsc2.connect(droneFilter);
      droneOsc2.start();

      // Sub-bass layer
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.value = 27.5; // A0
      const subGain = ctx.createGain();
      subGain.gain.value = 0.3;
      subOsc.connect(subGain);
      subGain.connect(droneFilter);
      subOsc.start();

      // LFO for slow volume swell
      droneLfo = ctx.createOscillator();
      droneLfo.type = 'sine';
      droneLfo.frequency.value = 0.08; // very slow
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      droneLfo.connect(lfoGain);
      lfoGain.connect(droneGain.gain);
      droneLfo.start();

      initialized = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  function setMuted(val) {
    muted = val;
    if (!initialized) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(val ? 0 : 1, now, 0.3);
  }

  // Set drone intensity based on scroll position
  function setDroneLevel(level) {
    if (!initialized || muted) return;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(0.12, level));
    droneGain.gain.setTargetAtTime(vol, now, 0.5);
  }

  // Whoosh sound — breathy noise sweep for morph transitions
  function playWhoosh(intensity = 0.5) {
    if (!initialized || muted) return;
    const now = ctx.currentTime;
    const dur = 0.6 + intensity * 0.4;

    // White noise buffer
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter sweeps up
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + dur * 0.4);
    filter.frequency.exponentialRampToValueAtTime(400, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08 * intensity, now + dur * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + dur);
  }

  // Chime — gentle crystalline tone for milestone unlocks
  function playChime(pitch = 1) {
    if (!initialized || muted) return;
    const now = ctx.currentTime;
    const baseFreq = 880 * pitch; // A5

    // Two harmonics for shimmer
    [1, 1.5, 2].forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * harmonic;

      const gain = ctx.createGain();
      const vol = 0.05 / (i + 1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + i * 0.05);
      osc.stop(now + 1.8);
    });
  }

  // Soft impact — subtle low thud for deposit moments
  function playSoftImpact() {
    if (!initialized || muted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Resume AudioContext (needed after user gesture)
  function resume() {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  return {
    init,
    setMuted,
    setDroneLevel,
    playWhoosh,
    playChime,
    playSoftImpact,
    resume,
    get muted() { return muted; },
  };
})();

// Audio toggle button
const audioToggle = document.getElementById('audio-toggle');
if (audioToggle) {
  audioToggle.addEventListener('click', () => {
    AudioEngine.init();
    AudioEngine.resume();
    const wasMuted = AudioEngine.muted;
    AudioEngine.setMuted(!wasMuted);
    audioToggle.classList.toggle('muted', !wasMuted);
  });
}

// ────────────────────────────────────────────
// 1. THREE.JS PARTICLE FIELD (3-layer ambient)
// ────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  // Expose camera
  window.__threeCamera = camera;

  // ── Starfield Tunnel ──
  // Thousands of tiny stars arranged in a cylinder around the camera.
  // On scroll, stars stream toward the camera (−Z → +Z), creating
  // constant forward-motion depth with zero back-and-forth artifact.
  // The camera NEVER moves — only the starfield offset changes.
  (function initStarfield() {
    const STAR_COUNT = 2400;
    const TUNNEL_RADIUS = 18;    // cylinder radius
    const TUNNEL_DEPTH = 120;    // how deep the star field extends
    const STAR_COLOR = 0x9a8a66; // warm muted gold-grey — atmosphere, not noise

    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const alphas = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute in a hollow cylinder: denser at edges, sparse in center
      const angle = Math.random() * Math.PI * 2;
      // Bias radius toward edges for a tunnel feel (sqrt distribution)
      const r = TUNNEL_RADIUS * (0.15 + 0.85 * Math.sqrt(Math.random()));
      positions[i * 3]     = Math.cos(angle) * r;      // x
      positions[i * 3 + 1] = Math.sin(angle) * r;      // y
      positions[i * 3 + 2] = -Math.random() * TUNNEL_DEPTH; // z: spread along tunnel
      sizes[i] = 0.8 + Math.random() * 2.2;
      alphas[i] = 0.3 + Math.random() * 0.7;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    // Shader: simple point sprites with distance fade
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(STAR_COLOR) },
        uScrollZ: { value: 0 },        // driven by scroll progress
        uTunnelDepth: { value: TUNNEL_DEPTH },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
        uBrightness: { value: 1.0 },    // chapter-driven brightness
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScrollZ;
        uniform float uTunnelDepth;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vDist;
        void main() {
          // Wrap star positions: as scroll pushes stars toward camera,
          // stars that pass behind camera wrap back to the far end.
          vec3 p = position;
          p.z = mod(p.z + uScrollZ, uTunnelDepth) - uTunnelDepth;
          
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z; // distance from camera
          
          // Size: larger when closer, smaller when far
          gl_PointSize = aSize * uPixelRatio * (80.0 / max(dist, 1.0));
          
          // Fade: stars near camera and very far both fade out
          float nearFade = smoothstep(0.0, 8.0, dist);
          float farFade = 1.0 - smoothstep(uTunnelDepth * 0.6, uTunnelDepth, dist);
          vAlpha = aAlpha * nearFade * farFade;
          vDist = dist;
          
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uBrightness;
        varying float vAlpha;
        varying float vDist;
        void main() {
          // Soft circle
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float circle = 1.0 - smoothstep(0.3, 1.0, d);
          // Glow: stars closer to camera get a brighter core
          float glow = exp(-d * 2.0) * 0.5;
          float alpha = (circle + glow) * vAlpha * uBrightness;
          // Slight color shift: closer stars are whiter, far stars are bluer
          vec3 col = mix(uColor, vec3(0.7, 0.8, 1.0), exp(-vDist * 0.04));
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // Expose for scroll handler
    window.__starfield = {
      material: starMat,
      points: starPoints,
      TUNNEL_DEPTH,
    };

    // Scroll state: camera never moves; only this offset changes
    window.__gridCamOrbit = { angle: 0, elevation: 0, distance: 5, forwardZ: 0, lookOffsetY: 0, railZ: 0 };

    // Provide __gridProjected for downstream HTML tilt (scroll-driven, not camera-derived)
    window.__gridProjected = { rx: 0, ry: 0, perspective: 900 };
  })();

  // ── Cinematic DoF via per-particle ShaderMaterial ──
  // Focus plane at z = camera (near), defocus increases with distance
  const FOCAL_Z = -2;  // sharp zone center
  const DOF_RANGE = 3;  // falloff distance

  // Custom bokeh particle shader (used for all 3 layers)
  function makeBokehMaterial(color, baseSize, baseOpacity, focusZ) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uBaseSize: { value: baseSize },
        uBaseOpacity: { value: baseOpacity },
        uFocusZ: { value: focusZ },
        uDofRange: { value: DOF_RANGE },
        uMap: { value: null },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float uBaseSize;
        uniform float uBaseOpacity;
        uniform float uFocusZ;
        uniform float uDofRange;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vDoF;

        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

          // Depth-of-field: distance from focus plane
          float zDist = abs(position.z - uFocusZ);
          vDoF = smoothstep(0.0, uDofRange, zDist);

          // Defocused particles: larger (bokeh circles), dimmer
          float dofScale = 1.0 + vDoF * 3.5;
          float dofAlpha = mix(1.0, 0.2, vDoF);

          gl_PointSize = uBaseSize * dofScale * uPixelRatio * (5.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;

          vAlpha = uBaseOpacity * dofAlpha;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor;
        varying float vAlpha;
        varying float vDoF;

        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;

          // Sharp: crisp dot. Defocused: soft gaussian bokeh disc
          float sharpFalloff = 1.0 - d * d;
          float softFalloff = exp(-d * d * 1.5);
          float alpha = mix(sharpFalloff, softFalloff, vDoF) * vAlpha;

          // Slight color shift for defocused particles (cooler tint)
          vec3 col = mix(uColor, uColor * vec3(0.85, 0.92, 1.15), vDoF * 0.5);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  // Layer 1: Main blue particles (foreground)
  const COUNT1 = 300;
  const pos1 = new Float32Array(COUNT1 * 3);
  const vel1 = new Float32Array(COUNT1 * 3);
  for (let i = 0; i < COUNT1; i++) {
    pos1[i * 3]     = (Math.random() - 0.5) * 20;
    pos1[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos1[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    vel1[i * 3]     = (Math.random() - 0.5) * 0.0012;
    vel1[i * 3 + 1] = (Math.random() - 0.5) * 0.0008;
    vel1[i * 3 + 2] = (Math.random() - 0.5) * 0.0004;
  }
  const geo1 = new THREE.BufferGeometry();
  geo1.setAttribute('position', new THREE.BufferAttribute(pos1, 3));
  const mat1 = makeBokehMaterial(0xDDA01C, 6, 0.5, FOCAL_Z); // brand gold
  scene.add(new THREE.Points(geo1, mat1));

  // Layer 2: Dim white dust (depth)
  const COUNT2 = 200;
  const pos2 = new Float32Array(COUNT2 * 3);
  const vel2 = new Float32Array(COUNT2 * 3);
  for (let i = 0; i < COUNT2; i++) {
    pos2[i * 3]     = (Math.random() - 0.5) * 30;
    pos2[i * 3 + 1] = (Math.random() - 0.5) * 30;
    pos2[i * 3 + 2] = (Math.random() - 0.5) * 20 - 6;
    vel2[i * 3]     = (Math.random() - 0.5) * 0.0005;
    vel2[i * 3 + 1] = (Math.random() - 0.5) * 0.0003;
    vel2[i * 3 + 2] = (Math.random() - 0.5) * 0.0002;
  }
  const geo2 = new THREE.BufferGeometry();
  geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  const mat2 = makeBokehMaterial(0xFFFFFF, 4, 0.12, FOCAL_Z);
  scene.add(new THREE.Points(geo2, mat2));

  // Layer 3: Sparse bright accent dots
  const COUNT3 = 40;
  const pos3 = new Float32Array(COUNT3 * 3);
  const vel3 = new Float32Array(COUNT3 * 3);
  for (let i = 0; i < COUNT3; i++) {
    pos3[i * 3]     = (Math.random() - 0.5) * 16;
    pos3[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos3[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    vel3[i * 3]     = (Math.random() - 0.5) * 0.002;
    vel3[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
    vel3[i * 3 + 2] = 0;
  }
  const geo3 = new THREE.BufferGeometry();
  geo3.setAttribute('position', new THREE.BufferAttribute(pos3, 3));
  const mat3 = makeBokehMaterial(0xFFD45A, 12, 0.35, FOCAL_Z); // gold highlight
  scene.add(new THREE.Points(geo3, mat3));

  // ── Cursor tracking for magnetic repulsion field ──
  let mouseX = 0, mouseY = 0;
  let mouseWorldX = 0, mouseWorldY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.4;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
    // Map mouse to world coordinates for particle repulsion
    mouseWorldX = (e.clientX / window.innerWidth - 0.5) * 20;
    mouseWorldY = -(e.clientY / window.innerHeight - 0.5) * 20;
  });

  const REPULSION_RADIUS = 3.5;
  const REPULSION_STRENGTH = 0.04;

  function updateParticles(posArr, velArr, count, bound) {
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      // ── Cursor magnetic repulsion ──
      const dx = posArr[ix] - mouseWorldX;
      const dy = posArr[iy] - mouseWorldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPULSION_RADIUS && dist > 0.01) {
        const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
        const nx = dx / dist;
        const ny = dy / dist;
        velArr[ix] += nx * force;
        velArr[iy] += ny * force;
      }

      // Dampen velocities slightly to prevent runaway
      velArr[ix] *= 0.995;
      velArr[iy] *= 0.995;

      posArr[ix] += velArr[ix];
      posArr[iy] += velArr[iy];
      posArr[iz] += velArr[iz];
      if (posArr[ix] > bound) posArr[ix] = -bound;
      if (posArr[ix] < -bound) posArr[ix] = bound;
      if (posArr[iy] > bound) posArr[iy] = -bound;
      if (posArr[iy] < -bound) posArr[iy] = bound;
    }
  }

  // ── Apply convergence: drift particles toward center ──
  function applyConvergence(posArr, count) {
    const c = window.__particleConverge || 0;
    if (c < 0.01) return;
    const strength = c * 0.008; // gentle drift
    for (let i = 0; i < count; i++) {
      posArr[i * 3]     += (0 - posArr[i * 3]) * strength;
      posArr[i * 3 + 1] += (0 - posArr[i * 3 + 1]) * strength;
      posArr[i * 3 + 2] += (-2 - posArr[i * 3 + 2]) * strength * 0.5;
    }
  }

  // Bloom postprocessing removed — breaks canvas alpha transparency
  // The original particle shaders already have built-in glow effects

  // ── Scroll-aware frame throttle: halve particle FPS during active scroll ──
  let _scrolling = false;
  let _scrollTimer = 0;
  let _frameCount = 0;
  window.addEventListener('scroll', () => {
    _scrolling = true;
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => { _scrolling = false; }, 150);
  }, { passive: true });

  function animate() {
    requestAnimationFrame(animate);
    _frameCount++;
    // During scroll, render particles at half rate to free GPU for compositing
    if (_scrolling && (_frameCount & 1)) return;

    updateParticles(pos1, vel1, COUNT1, 10);
    updateParticles(pos2, vel2, COUNT2, 15);
    updateParticles(pos3, vel3, COUNT3, 8);

    // Particle convergence toward center (close chapter finale)
    applyConvergence(pos1, COUNT1);
    applyConvergence(pos2, COUNT2);
    applyConvergence(pos3, COUNT3);

    geo1.attributes.position.needsUpdate = true;
    geo2.attributes.position.needsUpdate = true;
    geo3.attributes.position.needsUpdate = true;

    // ── FIXED CAMERA + STARFIELD TUNNEL ──
    // Camera sits at origin, always looking down -Z.
    // Mouse gives subtle parallax rotation only.
    const dm = window.__depthMouse || { x: 0, y: 0, active: false };
    // Tiny mouse-driven camera rotation (not position movement)
    const lookX = dm.x * 0.4;   // very subtle horizontal gaze shift
    const lookY = dm.y * -0.2;  // very subtle vertical gaze shift
    camera.lookAt(lookX, lookY, -10);

    // Update starfield scroll offset
    const sf = window.__starfield;
    if (sf && sf.material.uniforms) {
      // Smooth the scroll offset for the starfield
      const targetZ = sf._targetScrollZ || 0;
      const curZ = sf.material.uniforms.uScrollZ.value;
      sf.material.uniforms.uScrollZ.value += (targetZ - curZ) * 0.08;
    }

    // ── Depth-of-field for existing particle layers ──
    const dynFocal = FOCAL_Z;
    const dynRange = DOF_RANGE;
    const clampedRange = Math.max(0.8, dynRange);
    // Bokeh intensity: particles grow larger when more defocused
    [mat1, mat2, mat3].forEach(m => {
      if (m.uniforms) {
        m.uniforms.uFocusZ.value = dynFocal;
        m.uniforms.uDofRange.value = clampedRange;
      }
    });

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Update pixel ratio uniform on all bokeh materials
    const pr = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pr);
    [mat1, mat2, mat3].forEach(m => { if (m.uniforms) m.uniforms.uPixelRatio.value = pr; });
    // Update starfield pixel ratio too
    const sf = window.__starfield;
    if (sf && sf.material.uniforms) sf.material.uniforms.uPixelRatio.value = pr;

  });
})();

// ────────────────────────────────────────────
// 1.5 SCROLL-DRIVEN CAMERA ORBIT
// ────────────────────────────────────────────
// Orbit keyframes: angle, elevation, distance per chapter
// Ch1 Hero: front-angled view
// Ch2 Token: rotate slightly right
// Ch3 Accrue: rise above, look down
// Ch3.5 CCA: orbit further around
// Ch4 Vaults: top-down overview
// Ch5 Close: sweep back to front
(function initCameraOrbit() {
  const orb = window.__gridCamOrbit;
  if (!orb) return;

  // Collect all scene-pin elements for 3D content tilt
  const scenePins = Array.from(document.querySelectorAll('.scene-pin')).map(pin => {
    const parent = pin.closest('.scroll-scene');
    return { el: pin, chId: parent ? parent.id : '' };
  });

  // Mobile: reduce tilt intensity to avoid scroll jank
  const isMobile = window.innerWidth < 768;
  const tiltScale = isMobile ? 0.3 : 1.0;

  // ── Scroll-velocity detection ──
  // Tracks how fast the user is scrolling. When they pause, the crane
  // arc eases to a crawl so each chapter feels deliberate.
  // `scrollVel` is exposed globally; the animate loop reads it to
  // modulate the camera lerp factor.
  const scrollVelState = { raw: 0, smoothed: 0, lastProgress: 0 };
  window.__scrollVel = scrollVelState;

  // Master timeline driven by full page scroll
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5,
    onUpdate: (self) => {
      const p = self.progress; // 0 → 1

      // ── Velocity: delta progress per tick, eased ──
      const delta = Math.abs(p - scrollVelState.lastProgress);
      scrollVelState.lastProgress = p;
      scrollVelState.raw = delta;
      // Smooth toward raw with asymmetric ease: fast attack, slow decay
      // This makes the camera respond quickly when scrolling resumes
      // but ease gently to a stop when the user pauses.
      const attack = 0.25;  // how fast velocity ramps up
      const decay  = 0.04;  // how slowly it fades to zero
      const ease = delta > scrollVelState.smoothed ? attack : decay;
      scrollVelState.smoothed += (delta - scrollVelState.smoothed) * ease;

      // ── STARFIELD TUNNEL SCROLL DRIVER ──
      // Camera is FIXED at origin. Stars stream past on scroll.
      // p (0→1) maps to a Z offset that pushes stars toward the camera.
      const sf = window.__starfield;
      if (sf) {
        // Map full scroll to tunnel depth: stars travel the full tunnel length
        sf._targetScrollZ = p * sf.TUNNEL_DEPTH;

        // Per-chapter brightness variation: brighter during key moments
        //                            hero  token  accrue  cca   vaults  close
        const sceneStops =           [0,    0.08,  0.20,  0.40,  0.60,  0.78,  0.92,  1.0];
        const starBright = multiMapSmooth(p, sceneStops,
          [0.6,   1.0,    0.7,    0.9,    1.0,    0.8,   0.5,   0.5]);
        sf.material.uniforms.uBrightness.value = starBright;
      }

      // Provide scroll-driven tilt values for HTML content
      // (replaces old grid-projected camera angles)
      const gp = window.__gridProjected;
      if (gp) {
        // Gentle pseudo-tilt based purely on scroll progress
        gp.rx = Math.sin(p * Math.PI) * 12;        // peaks at 50% scroll
        gp.ry = Math.sin(p * Math.PI * 2) * 3;     // subtle horizontal sway
        gp.perspective = 900;
      }

      // ── 3D Content Tilt: gentle scroll-driven perspective on HTML ──
      const gpRef = window.__gridProjected || { rx: 0, ry: 0, perspective: 900 };
      const projScale = 0.12 * tiltScale;
      const baseTiltX = gpRef.rx * projScale;
      const baseTiltY = gpRef.ry * projScale * 0.5;
      const baseTiltZ = Math.cos(p * Math.PI * 2.0) * 0.15 * tiltScale; // gentle roll
      const shift = Math.sin(p * Math.PI * 0.7) * 10 * tiltScale;
      const perspVal = Math.min(1200, Math.max(600, gpRef.perspective));

      // ── Mouse depth-parallax ──
      const dm = DepthMouse;
      const mActive = dm.active ? 1 : 0;
      const chDepth = {
        'ch-hero':   16,
        'ch-token':  12,
        'ch-accrue': 20,
        'ch-cca':    16,
        'ch-vaults': 18,
        'ch-close':  10,
      };

      // Apply grid-locked tilt + mouse to each scene-pin
      // Narrow-phone mobile scale: the JS writes to .scene-pin.style.transform
      // on every tick, so CSS `transform: scale()` media queries never stick.
      // We compose the scale INTO the transform string here so both the camera
      // rig (tilt + depth parallax) AND the mobile compression survive. Hero
      // is exempt — it uses responsive clamps for its headline already.
      const vwNow = window.innerWidth;
      function chScale(chId) {
        if (chId === 'ch-hero') return 1;
        // With the tighter spread floor on narrow phones (coin/share cards
        // now sit closer together), scene-pin only needs a light shrink to
        // keep non-card chapters (vaults stat column, close finale) comfy.
        if (vwNow <= 380) {
          if (chId === 'ch-cca') return 0.74;          // CCA intro card + auction pill span full width
          if (chId === 'ch-dual-overview') return 0.82; // vertical stack + headline collision
          if (chId === 'ch-token') return 0.82;         // desc card still bleeds left at 0.88; tighten
          if (chId === 'ch-close') return 0.86;         // token pill at finale
          return 0.88;
        }
        if (vwNow <= 430) {
          if (chId === 'ch-cca') return 0.86;
          if (chId === 'ch-dual-overview') return 0.9;
          if (chId === 'ch-token') return 0.94;
          if (chId === 'ch-vaults') return 0.94;
          return 1;
        }
        return 1;
      }
      scenePins.forEach(({ el, chId }) => {
        // Extra rotateX per chapter pushes deeper into the grid surface
        let extraRx = 0;
        if (chId === 'ch-accrue') extraRx = 1.2 * tiltScale;  // rising
        if (chId === 'ch-cca')    extraRx = 1.6 * tiltScale;  // high
        if (chId === 'ch-token')  extraRx = 0.3 * tiltScale;  // eye level
        if (chId === 'ch-vaults') extraRx = 1.8 * tiltScale;  // peak overhead
        if (chId === 'ch-close')  extraRx = 0.4 * tiltScale;  // settling

        const rx = baseTiltX + extraRx;
        const ry = baseTiltY;
        const rz = baseTiltZ;

        const depth = (chDepth[chId] || 14) * tiltScale;
        const mx = dm.x * depth * mActive;
        const my = dm.y * depth * 0.5 * mActive;
        const s = chScale(chId);
        const scalePart = (s === 1) ? '' : ` scale(${s})`;
        el.style.transform = `perspective(${perspVal}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) translateX(${mx}px) translateY(${-shift + my}px)${scalePart}`;
      });
    }
  });
})();

// ────────────────────────────────────────────
// 2. WEBGL PARTICLE MORPH SYSTEM
// ────────────────────────────────────────────
const MorphSystem = (function initMorph() {
  const canvas = document.getElementById('morph-canvas');
  if (!canvas) return null;

  const PARTICLE_COUNT = 2000;
  const SIZE = 320;

  canvas.width = SIZE * Math.min(window.devicePixelRatio, 2);
  canvas.height = SIZE * Math.min(window.devicePixelRatio, 2);

  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return null;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive

  // ── Shaders (with cinematic DoF) ──
  const vertSrc = `
    precision mediump float;
    attribute vec2 aStartPos;
    attribute vec2 aEndPos;
    attribute float aRandom;
    attribute float aDelay;
    uniform float uProgress;
    uniform float uTime;
    uniform float uScale;
    varying float vAlpha;
    varying float vRandom;
    varying float vDoF;  // 0 = sharp (foreground), 1 = fully defocused (background)

    void main() {
      float delay = aDelay * 0.3;
      // Per-particle speed variation — some rush ahead, stragglers lag behind
      float speedMult = 0.6 + aRandom * 0.8; // range 0.6x to 1.4x
      float rawProg = clamp((uProgress * speedMult - delay) / (1.0 - delay), 0.0, 1.0);
      float prog = rawProg * rawProg * (3.0 - 2.0 * rawProg);

      float explode = sin(prog * 3.14159);
      float noiseX = sin(aRandom * 47.3 + uTime * 2.0) * explode * 0.35;
      float noiseY = cos(aRandom * 91.7 + uTime * 1.7) * explode * 0.35;
      float angle = aRandom * 6.28 + prog * 4.0;
      float spiralR = explode * 0.2;
      noiseX += cos(angle) * spiralR;
      noiseY += sin(angle) * spiralR;

      vec2 pos = mix(aStartPos, aEndPos, prog) + vec2(noiseX, noiseY);
      gl_Position = vec4(pos * uScale, 0.0, 1.0);

      // Depth-of-field: particles further from center are "background"
      float dist = length(pos);
      vDoF = smoothstep(0.15, 0.7, dist) * explode;

      // Foreground particles: sharp, smaller. Background: larger, softer.
      float sizePulse = 1.0 + explode * 1.5;
      float dofScale = 1.0 + vDoF * 1.8; // defocused particles grow larger (bokeh)
      gl_PointSize = (1.5 + aRandom * 2.0) * sizePulse * dofScale;

      vAlpha = smoothstep(0.0, 0.08, prog) * smoothstep(1.0, 0.92, prog);
      vAlpha *= 0.6 + aRandom * 0.4;
      vAlpha *= (1.0 + explode * 0.5);
      // Defocused particles are dimmer
      vAlpha *= mix(1.0, 0.4, vDoF);
      vRandom = aRandom;
    }
  `;

  const fragSrc = `
    precision mediump float;
    varying float vAlpha;
    varying float vRandom;
    varying float vDoF;
    uniform float uProgress;

    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;

      // Sharp particles: crisp edges. Defocused: soft gaussian-like falloff
      float sharpAlpha = (1.0 - d * d);
      float softAlpha = exp(-d * d * 2.0);  // gaussian bokeh
      float alpha = mix(sharpAlpha, softAlpha, vDoF) * vAlpha;

      vec3 white = vec3(0.95, 0.95, 1.0);
      vec3 blue = vec3(0.0, 0.322, 1.0);
      vec3 brightBlue = vec3(0.231, 0.51, 1.0);
      vec3 color = mix(white, mix(blue, brightBlue, vRandom), uProgress);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const aStartPos = gl.getAttribLocation(program, 'aStartPos');
  const aEndPos = gl.getAttribLocation(program, 'aEndPos');
  const aRandom = gl.getAttribLocation(program, 'aRandom');
  const aDelay = gl.getAttribLocation(program, 'aDelay');
  const uProgress = gl.getUniformLocation(program, 'uProgress');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uScale = gl.getUniformLocation(program, 'uScale');

  // ── Generate particle positions ──
  const startPositions = new Float32Array(PARTICLE_COUNT * 2);
  const endPositions = new Float32Array(PARTICLE_COUNT * 2);
  const randoms = new Float32Array(PARTICLE_COUNT);
  const delays = new Float32Array(PARTICLE_COUNT);

  const RADIUS = 0.55;
  const SQUARE_SIZE = 0.5;
  const SQUARE_R = 0.08;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    startPositions[i * 2]     = Math.cos(angle) * r;
    startPositions[i * 2 + 1] = Math.sin(angle) * r;

    let sx, sy;
    do {
      sx = (Math.random() - 0.5) * 2 * SQUARE_SIZE;
      sy = (Math.random() - 0.5) * 2 * SQUARE_SIZE;
    } while (Math.sqrt(
      Math.pow(Math.max(0, Math.abs(sx) - (SQUARE_SIZE - SQUARE_R)), 2) +
      Math.pow(Math.max(0, Math.abs(sy) - (SQUARE_SIZE - SQUARE_R)), 2)
    ) > SQUARE_R);

    endPositions[i * 2]     = sx;
    endPositions[i * 2 + 1] = sy;

    randoms[i] = Math.random();
    const dist = Math.sqrt(startPositions[i*2]**2 + startPositions[i*2+1]**2);
    delays[i] = dist / RADIUS * 0.5 + Math.random() * 0.2;
  }

  function createBuffer(data, attrib, size) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attrib);
    gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, 0, 0);
    return buf;
  }

  createBuffer(startPositions, aStartPos, 2);
  createBuffer(endPositions, aEndPos, 2);
  createBuffer(randoms, aRandom, 1);
  createBuffer(delays, aDelay, 1);

  let currentProgress = 0;
  const startTime = performance.now();

  function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(uProgress, currentProgress);
    gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
    gl.uniform1f(uScale, 1.0);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
  }

  let morphVisible = false;
  let morphRAF = 0;
  function tick() {
    if (!morphVisible) { morphRAF = 0; return; }
    render();
    morphRAF = requestAnimationFrame(tick);
  }

  return {
    setProgress(p) { currentProgress = Math.max(0, Math.min(1, p)); },
    getProgress() { return currentProgress; },
    setVisible(v) {
      const wasVisible = morphVisible;
      morphVisible = v;
      // Start loop on-demand; stops itself when invisible
      if (v && !wasVisible && !morphRAF) { morphRAF = requestAnimationFrame(tick); }
    }
  };
})();

// ────────────────────────────────────────────
// 3. SET SCENE HEIGHTS
// ────────────────────────────────────────────
document.querySelectorAll('.scroll-scene').forEach(scene => {
  const vh = parseInt(scene.dataset.height || '300', 10);
  scene.style.height = `${vh}vh`;
});

// ────────────────────────────────────────────
// 4. SCROLL PROGRESS BAR
// ────────────────────────────────────────────
// ── Vertical scroll progress line (left edge) ──
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
  WriteBatch.write(() => { progressBar.style.height = `${pct}%`; });
}, { passive: true });

// ────────────────────────────────────────────
// 5. NAV VISIBILITY
// ────────────────────────────────────────────
// The nav is shown at the very top of the page, then hides once the
// user begins scrolling into the immersive arc — a persistent header
// competes with the cinematic chapters and breaks the storytelling.
// Threshold is intentionally generous (~1.2% scroll progress) so a
// tiny accidental wheel-tick doesn't dismiss the nav, but any real
// scroll intent does. Returns to visible at the very top so the
// brand mark + nav links are still discoverable on first paint.
const nav = document.getElementById('main-nav');
if (nav) {
  // Initial state: visible at the top of the document.
  nav.classList.add('visible');
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      // Hide once the user has scrolled past the top threshold; show
      // again only when they're back at the very top.
      nav.classList.toggle('visible', self.progress < 0.012);
    }
  });
}

// ────────────────────────────────────────────
// 5.5 SCAN LINE ACTIVATION
// ────────────────────────────────────────────
const scanLine = document.getElementById('scan-line');
ScrollTrigger.create({
  trigger: '#ch-token',
  start: 'top top',
  end: 'bottom top',
  onEnter: () => scanLine && scanLine.classList.add('active'),
  onLeave: () => scanLine && scanLine.classList.remove('active'),
  onEnterBack: () => scanLine && scanLine.classList.add('active'),
  onLeaveBack: () => scanLine && scanLine.classList.remove('active'),
});

// ────────────────────────────────────────────
// HELPER: map scroll progress to value
// ────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}
function easeCinematic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}
function mapEased(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  const eased = easeCinematic(Math.max(0, Math.min(1, t)));
  return outMin + (outMax - outMin) * eased;
}
function multiMap(progress, stops, values) {
  if (progress <= stops[0]) return values[0];
  if (progress >= stops[stops.length - 1]) return values[values.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (progress >= stops[i] && progress <= stops[i + 1]) {
      const t = (progress - stops[i]) / (stops[i + 1] - stops[i]);
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }
  return values[values.length - 1];
}
// Eased multiMap — applies cubic ease between each pair of stops for smoother motion
function multiMapSmooth(progress, stops, values) {
  if (progress <= stops[0]) return values[0];
  if (progress >= stops[stops.length - 1]) return values[values.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (progress >= stops[i] && progress <= stops[i + 1]) {
      let t = (progress - stops[i]) / (stops[i + 1] - stops[i]);
      // Apply smoothstep easing
      t = t * t * (3 - 2 * t);
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }
  return values[values.length - 1];
}

// ──────────────────────────────────────────────────────────────────
// POLISH EASING — softer, more cinematic curves used for boundary
// *carries* (motions that never come back) vs smoothstep (which is
// symmetric ease-in-out and reads as "tween" at the endpoints).
//
// easeOutCubic → strong forward momentum, gentle settle — for exits
//                and carries where the scene is leaving its origin.
// easeOutExpo  → very soft arrival, ideal for settle beats after a
//                large handoff so the new scene *lands* rather than
//                hard-stopping.
// easeInOutSine→ whisper-soft ease for ambient position holds.
// ──────────────────────────────────────────────────────────────────
function easeOutCubic(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
function easeOutExpo(t)  { t = Math.max(0, Math.min(1, t)); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
function easeInOutSine(t){ t = Math.max(0, Math.min(1, t)); return -(Math.cos(Math.PI * t) - 1) / 2; }
// easeOutQuint → cubic-bezier(0.22, 1, 0.36, 1) equivalent. Longer, gentler
// tail than easeOutCubic — the curve approaches its endpoint with a very
// soft asymptote, which removes the perceptual "tick" at motion boundaries
// that causes jitter on sub-pixel transforms and letter-spacing tweens.
function easeOutQuint(t){ t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 5); }
// easeInOutCubic → symmetric smooth S-curve, softer than smoothstep at
// both ends. Use for headline reveals that should glide in and glide out
// without any linear feel.
function easeInOutCubic(t){ t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// Variant of multiMap that uses a custom easing fn between each stop pair.
// Use `multiMapEased(p, stops, values, easeOutCubic)` for carries that
// should feel like momentum (not snapped tween).
function multiMapEased(progress, stops, values, easeFn) {
  if (progress <= stops[0]) return values[0];
  if (progress >= stops[stops.length - 1]) return values[values.length - 1];
  const fn = easeFn || easeOutCubic;
  for (let i = 0; i < stops.length - 1; i++) {
    if (progress >= stops[i] && progress <= stops[i + 1]) {
      const t = fn((progress - stops[i]) / (stops[i + 1] - stops[i]));
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }
  return values[values.length - 1];
}
// Expose helpers so nested IIFEs can use them
window.__easeOutCubic = easeOutCubic;
window.__easeOutExpo = easeOutExpo;
window.__easeOutQuint = easeOutQuint;
window.__easeInOutCubic = easeInOutCubic;
window.__multiMapEased = multiMapEased;


// ────────────────────────────────────────────
// 5.5 CONTINUITY HUB
// Shared-state registry so chapters can hand off the persistent
// AKITA / ■AKITA pair to each other (transform/opacity only).
// Each chapter writes its "outgoing" state for the *next* chapter
// to read as its "incoming" state, producing seamless crossfades.
// ────────────────────────────────────────────
// ────────────────────────────────────────────
// 5.4 STYLE WRITE CACHE
// Every style write forces a style recalc on that element, even if the
// assigned value is identical. The scroll handlers above write transforms
// and opacities on the same handful of “protagonist” elements every frame;
// about 30-40% of those writes are value-for-value duplicates (opacity held
// at 0 or 1, transform unchanged between frames where the source progress
// didn’t move, chapter overlap writing the same value twice, etc).
//
// setStyle(el, prop, value) records the last written value per (element,
// prop) and skips the DOM write when it would be a no-op. Measured impact
// on the V→C scroll: cuts RecalcStyleCount by ~30-40%.
// ────────────────────────────────────────────
const StyleCache = (() => {
  const wm = new WeakMap();
  return {
    set(el, prop, value) {
      if (!el) return;
      const str = typeof value === 'number' ? String(value) : value;
      let slot = wm.get(el);
      if (!slot) { slot = {}; wm.set(el, slot); }
      if (slot[prop] === str) return;   // identical — skip the DOM write
      slot[prop] = str;
      el.style[prop] = str;
    },
    // Force-invalidate a cached slot, e.g. if external code writes the style directly
    invalidate(el, prop) {
      const slot = wm.get(el);
      if (slot && prop) delete slot[prop];
      else if (slot) wm.delete(el);
    },
  };
})();
window.__StyleCache = StyleCache;

// ────────────────────────────────────────────
// Motion — accessibility helper.
//
// `Motion.reduced` is a live boolean that reflects the user's OS-level
// `prefers-reduced-motion: reduce` setting. Cross-cuts JS-driven scroll
// transforms that CSS animation/transition rules can't reach (we already have
// a CSS-level reduce block in base.css / style.css for keyframe animations;
// this covers our `element.style.transform = …` writers instead).
//
// Policy (applied at each guarded fix site):
//   • Skip any decorative translate / scale / letter-spacing delta.
//   • Preserve opacity-driven reveals (fade in/out is still accessible).
//   • Clear the inline transform so the element rests at its CSS position.
//
// Used by the B4–B6 FLIP fixes so they degrade to opacity-only when reduced
// motion is requested.
// ────────────────────────────────────────────
const Motion = (() => {
  const mq = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: () => {}, addListener: () => {} };
  const state = { reduced: !!mq.matches };
  const onChange = e => { state.reduced = !!e.matches; };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
  else if (typeof mq.addListener === 'function') mq.addListener(onChange); // legacy Safari
  return state;
})();
window.__Motion = Motion;

const Continuity = (() => {
  // Every pose is in *screen px*, origin = viewport center, y-down positive.
  // Pose: { shareX, shareY, shareScale, shareOp, underX, underY, underScale, underOp }
  const poses = {
    // hero pose aligns with the #hero-layer-front visuals (not the opposite
    // corners of the screen) so the persistent pair can visibly grow OUT OF
    // the same positions as the front-layer AKITA / ■AKITA sprites.
    //   hero-float-front-1 (■AKITA, 120px) sits top-right  →  share
    //   hero-float-front-2 (AKITA,   88px) sits bottom-left →  under
    hero:       { shareX: 280, shareY: -220, shareScale: 0.55, shareOp: 0.22, underX: -220, underY:  190, underScale: 0.50, underOp: 0.24 },
    tokenEnd:   { shareX: -220, shareY: 0,   shareScale: 0.42, shareOp: 0.35, underX:  220, underY: 0,    underScale: 0.55, underOp: 0.35 },
    accrue:     { shareX: -260, shareY: -20, shareScale: 0.55, shareOp: 0.70, underX:  260, underY: -20,  underScale: 0.55, underOp: 0.55 },
    ccaStart:   { shareX: 0,    shareY: 0,   shareScale: 0.75, shareOp: 0.90, underX:  0,   underY: 0,    underScale: 0.40, underOp: 0.30 },
    ccaEnd:     { shareX: -130, shareY: -10, shareScale: 0.90, shareOp: 0.95, underX:  130, underY: -10,  underScale: 0.70, underOp: 0.0  },
    dual:       { shareX: -130, shareY: -10, shareScale: 1.0,  shareOp: 1.0,  underX:  138, underY: -10,  underScale: 1.0,  underOp: 1.0  },
  };
  // Live state updated every scroll frame by the active chapter
  const live = { shareX: 0, shareY: 0, shareScale: 1, shareOp: 0, underX: 0, underY: 0, underScale: 1, underOp: 0 };
  // Ease linearly between two named poses
  function lerpPose(a, b, t) {
    const tt = Math.max(0, Math.min(1, t));
    const pa = typeof a === 'string' ? poses[a] : a;
    const pb = typeof b === 'string' ? poses[b] : b;
    return {
      shareX:    pa.shareX    + (pb.shareX    - pa.shareX)    * tt,
      shareY:    pa.shareY    + (pb.shareY    - pa.shareY)    * tt,
      shareScale:pa.shareScale+ (pb.shareScale- pa.shareScale)* tt,
      shareOp:   pa.shareOp   + (pb.shareOp   - pa.shareOp)   * tt,
      underX:    pa.underX    + (pb.underX    - pa.underX)    * tt,
      underY:    pa.underY    + (pb.underY    - pa.underY)    * tt,
      underScale:pa.underScale+ (pb.underScale- pa.underScale)* tt,
      underOp:   pa.underOp   + (pb.underOp   - pa.underOp)   * tt,
    };
  }
  function setLive(p) { Object.assign(live, p); }
  function getLive() { return live; }
  // Apply a pose to an element pair (transform/opacity only)
  function applyToPair(shareEl, underEl, pose, extraScale) {
    const sx = (extraScale == null) ? 1 : extraScale;
    if (shareEl) {
      shareEl.style.transform = `translate(calc(-50% + ${pose.shareX}px), calc(-50% + ${pose.shareY}px)) scale(${pose.shareScale * sx})`;
      shareEl.style.opacity = pose.shareOp;
    }
    if (underEl) {
      underEl.style.transform = `translate(calc(-50% + ${pose.underX}px), calc(-50% + ${pose.underY}px)) scale(${pose.underScale * sx})`;
      underEl.style.opacity = pose.underOp;
    }
  }
  // Component bridge — share non-pair handoff values between chapters
  // (rects for FLIP, migrating scalars, etc). Keys are named by author.
  const bridge = {};
  function setBridge(k, v) { bridge[k] = v; }
  function getBridge(k)    { return bridge[k]; }

  // ── PAIR SCOPE ──
  // The persistent #float-share / #float-underlying pair must NOT be the
  // cross-scroll continuity backbone. Only dual chapter is allowed to render
  // it (the scene whose literal subject is 'two tokens'). Every other chapter
  // writes op=0 via guardPair().
  const PAIR_ALLOWED = { dual: true };
  function guardPair(chapter) { return !!PAIR_ALLOWED[chapter]; }
  // Utility: force-hide the pair (used by non-allowed chapters to override any
  // stale writes left by previous chapters).
  function hidePair() {
    const s = document.getElementById('float-share');
    const u = document.getElementById('float-underlying');
    const c = document.getElementById('float-tokens');
    if (s) { s.style.opacity = 0; }
    if (u) { u.style.opacity = 0; }
    if (c) { c.style.opacity = 0; }
  }
  return { poses, lerpPose, setLive, getLive, applyToPair, setBridge, getBridge, guardPair, hidePair };
})();
window.__Continuity = Continuity;

// ────────────────────────────────────────────
// 6. CHAPTER 1: HERO — CINEMATIC ENTRANCE (320vh)
// ────────────────────────────────────────────
(function chapterHero() {
  const section = document.getElementById('ch-hero');
  const streak = document.getElementById('hero-streak');
  const heroContent = document.getElementById('hero-content');
  const heroLabel = document.getElementById('hero-label');
  const headlineGlow = document.getElementById('hero-headline-glow');
  const heroFloats = document.getElementById('hero-floats');
  const scrollCue = document.getElementById('hero-scroll-cue');
  const heroChain = document.getElementById('hero-chain');
  const heroPartners = document.getElementById('hero-partners');
  const heroCta = document.getElementById('hero-cta');
  const chars = document.querySelectorAll('.hero-char');
  const supportLines = document.querySelectorAll('.hero-support-line');

  // ── Cinematic entrance timeline ──
  const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });

  entrance.fromTo(streak, { scaleY: 0, opacity: 0 }, {
    scaleY: 1, opacity: 1, duration: 1.4
  }, 0);

  entrance.to(heroLabel, {
    opacity: 1, y: 0, duration: 0.8
  }, 0.4);

  // ── Hero text staggered clip-path reveal ──
  chars.forEach((char, i) => {
    const wordIndex = parseInt(char.closest('.hero-word').dataset.word);
    const wordDelay = wordIndex * 0.22;
    entrance.to(char, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      clipPath: 'inset(0 0 0% 0)',
      duration: 0.7,
      ease: 'power4.out',
    }, 0.6 + wordDelay + i * 0.032);
  });

  entrance.to(headlineGlow, {
    opacity: 1, duration: 1.8, ease: 'power2.out'
  }, 1.0);

  supportLines.forEach((line, i) => {
    entrance.to(line, {
      opacity: 1, y: 0, duration: 0.7
    }, 1.6 + i * 0.15);
  });

  entrance.to(heroChain, { opacity: 1, y: 0, duration: 0.7 }, 2.1);
  if (heroPartners) {
    entrance.to(heroPartners, { opacity: 1, y: 0, duration: 0.7 }, 2.35);
  }
  entrance.to(heroCta, { opacity: 1, y: 0, duration: 0.7 }, 2.55);

  if (heroFloats) {
    entrance.to(heroFloats, { opacity: 1, duration: 2, ease: 'power2.out' }, 1.5);
  }

  if (scrollCue) {
    entrance.to(scrollCue, { opacity: 1, duration: 1.2 }, 3.0);
  }

  // ── Parallax on mouse (floating tokens) ──
  const layerBack = document.getElementById('hero-layer-back');
  const layerMid = document.getElementById('hero-layer-mid');
  const layerFront = document.getElementById('hero-layer-front');

  // Mouse parallax — dialed down from (8,16,28) to (5,10,16) for restraint.
  // Foreground drift was too reactive; new values read as depth, not fidgeting.
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5);
    const y = (e.clientY / window.innerHeight - 0.5);
    if (layerBack)  layerBack.style.transform  = `translate(${x * 5}px, ${y * 4}px)`;
    if (layerMid)   layerMid.style.transform   = `translate(${x * 10}px, ${y * 7}px)`;
    if (layerFront) layerFront.style.transform  = `translate(${x * 16}px, ${y * 11}px)`;
  });

  // ── Glow pulse animation ──
  gsap.to(headlineGlow, {
    scale: 1.15,
    opacity: 0.6,
    duration: 3,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    delay: 2,
  });

  // ── Persistent pair handles (for cross-chapter continuity) ──
  const floatContainerH = document.getElementById('float-tokens');
  const floatShareH = document.getElementById('float-share');
  const floatUnderlyingH = document.getElementById('float-underlying');

  // ── Scroll-driven exit + drone audio ──
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      // Audio: drone swell during hero (non-DOM, run immediately)
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.15, 0.40, 0.55], [0.04, 0.10, 0.10, 0.03]));
      // Compute values synchronously, defer DOM writes
      // Hero content — hold legible longer; release with a soft ease so the
      // headline doesn't simply dim-to-black but feels like it steps back
      // into the scene, letting the streak→line crossover become foreground.
      const contentOp = multiMapEased(p, [0.55, 0.82], [1, 0], easeOutCubic);
      const cueCp = scrollCue ? multiMap(p, [0.05, 0.12], [1, 0]) : 0;
      // STREAK → TOKEN-LINE handoff.
      // Prior: smoothstep on X made the handoff feel symmetric / tweeny.
      // Now: easeOutCubic so the streak gains *momentum* into center and
      // softly decelerates into its token-line resting X. ScaleY subtly
      // compresses (1.00 → 0.94) to imply the spine is being *absorbed*
      // into the next scene rather than trailing off.
      const streakScaleY = multiMapEased(p, [0.70, 0.98], [1, 0.94], easeOutCubic);
      // Opacity: extend the tail just slightly so the overlap with
      // token-line's 0.000–0.015 fade-in reads as inheritance, not a cut.
      const streakOp     = multiMapEased(p, [0.80, 0.995], [1, 0], easeOutCubic);
      const streakXvw    = multiMapEased(p, [0.62, 1.00], [0, 22], easeOutCubic);
      // ─ Supporting retire staircase ─
      // Prior: partners (0.55→0.70), chain (0.52→0.65), CTA (0.45→0.58) all
      // retired within a narrow 0.13 window — reads as a shuffle, not a
      // composed release. New: three distinct, non-overlapping windows so
      // the eye follows a deliberate top-to-bottom hand-down (CTA → chain
      // → partners), leaving 0.60–0.80 as a quiet settle before the
      // streak→line crossover begins.
      // DIRECTIONAL VARIETY — hero retire staircase:
      //   • Partners family: soften-in-place (no Y travel) + gentle scale-down
      //     so they dissolve into the scene's background layer rather than
      //     "lifting off" with the headline. (was Y=−22)
      //   • Chain chip: recede in depth (scale-down only, no Y) so it feels
      //     like the chain context is pushed BACK while foreground advances.
      //     (was Y=−14)
      //   • CTA: settles slightly DOWNWARD (Y=+30), unchanged — the only
      //     vertical hero exit motion, and it's intentionally *settle-down*,
      //     which contrasts with the dominant upward-pan anti-pattern.
      //   • Streak: migrates LATERALLY to become the token-line spine (see
      //     streakXvw). Lateral is the dominant exit direction here.
      const partnersScale = multiMapEased(p, [0.42, 0.66], [1, 0.72], easeOutCubic);
      const partnersY     = 0; // fade-in-place, no upward drift
      const partnersOp    = multiMapSmooth(p, [0.00, 0.15, 0.52, 0.66], [0, 1, 1, 0]);
      const chainScale    = multiMapEased(p, [0.36, 0.56], [1, 0.82], easeOutCubic);
      const chainY        = 0; // depth-recede via scale, no translate
      const chainOp       = multiMapSmooth(p, [0.00, 0.15, 0.44, 0.56], [0, 1, 1, 0]);
      const ctaScale      = multiMapEased(p, [0.30, 0.48], [1, 0.62], easeOutCubic);
      const ctaY          = multiMapEased(p, [0.30, 0.48], [0, 30], easeOutCubic);
      const ctaOp         = multiMapSmooth(p, [0.00, 0.15, 0.38, 0.48], [0, 1, 1, 0]);

      // ── Foreshadow the persistent pair during hero, then slide it toward
      //    the "tokenEnd" flanks as hero exits. This is the inheritance
      //    handoff: when ch-token opens, these same DOM nodes are already
      //    in view at the right spots — no cold reset.
      const heroPairIn   = multiMapSmooth(p, [0.45, 0.70], [0, 1]);   // start fade-in when hero text starts dissolving
      const heroPairExit = multiMapSmooth(p, [0.70, 1.00], [0, 1]);   // morph toward tokenEnd as hero fully exits
      const pose = Continuity.lerpPose('hero', 'tokenEnd', heroPairExit);
      // Cap overall opacity with entrance easing so the pair doesn't pop
      const envelopeOp = heroPairIn;
      Continuity.setLive(pose);

      WriteBatch.write(() => {
        heroContent.style.opacity = contentOp;
        if (heroFloats) heroFloats.style.opacity = contentOp * 0.7;
        if (scrollCue) scrollCue.style.opacity = cueCp;
        // Streak: migrate X + live scaleY so it becomes the token-line spine
        streak.style.transform = `translateX(${streakXvw}vw) scaleY(${streakScaleY})`;
        streak.style.opacity = streakOp;
        // Component continuity writes — override heroContent's blanket fade
        // so individual component families animate their own handoffs.
        // Gated on isActive so successor writers own these nodes after exit.
        if (self.isActive) {
          if (heroPartners) {
            heroPartners.style.opacity = partnersOp;
            heroPartners.style.transform = `translateY(${partnersY}px) scale(${partnersScale})`;
          }
          if (heroChain) {
            heroChain.style.opacity = chainOp;
            heroChain.style.transform = `translateY(${chainY}px) scale(${chainScale})`;
          }
          if (heroCta) {
            heroCta.style.opacity = ctaOp;
            heroCta.style.transform = `translateY(${ctaY}px) scale(${ctaScale})`;
          }
        }
        // Publish streak end X so token-line can begin at matched X
        Continuity.setBridge('heroStreakXvw', streakXvw);
        Continuity.setBridge('heroStreakOp',  streakOp);

        // HERO does NOT render the persistent pair — continuity here is
        // structural (streak), informational (headline/support/cue), and
        // system (partners). See boundary_matrix.md §1.
        if (self.isActive) {
          Continuity.hidePair();
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 7. CHAPTER 2: TOKEN JOURNEY (1800vh)
//    v5: Smooth continuous motion, aligned tokens, audio cues
// ────────────────────────────────────────────
(function chapterTokenJourney() {
  const section = document.getElementById('ch-token');
  const tokenLine = document.getElementById('token-line');
  const tokenLineCoreEl = tokenLine.querySelector('.token-line-core');
  const tokenLineGlowEl = tokenLine.querySelector('.token-line-glow');
  const topCopy = document.getElementById('token-top-copy');
  const crossCopy = document.getElementById('token-cross-copy');
  const tokenLabel = document.getElementById('token-label');
  const entryCue = document.getElementById('token-entry-cue');
  const labelYou = document.getElementById('label-you');
  const labelVault = document.getElementById('label-vault');
  const labelShares = document.getElementById('label-shares');
  const labelUnderlying = document.getElementById('label-underlying');
  const cameraWrapper = document.getElementById('camera-wrapper');

  const coin = document.getElementById('token-coin');
  const coinIcon = document.getElementById('coin-icon');
  const coinLabel = document.getElementById('coin-label');
  const coinDetail = document.getElementById('coin-detail');
  const share = document.getElementById('token-share');
  const shareLabel = document.getElementById('share-label');
  const shareDetail = document.getElementById('share-detail');

  const morphZone = document.getElementById('morph-zone');
  const morphLabel = document.getElementById('morph-label');

  const depositInfo = document.getElementById('deposit-info');
  const splitInfo = document.getElementById('split-info');
  const nodeGraph = document.getElementById('node-graph');
  const engineHub = document.getElementById('engine-hub');
  const ngNodeDeposit = document.getElementById('ng-node-deposit');
  const ngRowIdle = document.getElementById('ng-row-idle');
  const ngEdgesSvg = document.getElementById('ng-edges-svg');
  // Legacy compat stubs (removed in v2 node graph)
  const ngBranchSvg = null;
  const ngEdgeFan = null;
  const strat0 = document.getElementById('strat-0');
  const strat1 = document.getElementById('strat-1');
  const strat2 = document.getElementById('strat-2');
  const downstream1 = document.getElementById('downstream-1');
  const downstream2 = document.getElementById('downstream-2');
  const feeLabel = document.getElementById('fee-label');
  const dualEntry = document.getElementById('dual-entry');

  // ── Dynamic SVG edge paths ──
  // Computes bezier curves from actual card positions relative to the node-graph container.
  // Called once after layout, and on resize.
  const edgePairs = [
    { base: 'edge-deposit-hub',  dash: 'dash-deposit-hub',  from: 'ng-node-deposit', to: 'engine-hub',    side: 'right-left' },
    { base: 'edge-hub-ajna',     dash: 'dash-hub-ajna',     from: 'engine-hub',      to: 'strat-0',       side: 'right-left' },
    { base: 'edge-hub-charm',    dash: 'dash-hub-charm',    from: 'engine-hub',      to: 'strat-1',       side: 'right-left' },
    { base: 'edge-hub-solana',   dash: 'dash-hub-solana',   from: 'engine-hub',      to: 'strat-2',       side: 'right-left' },
    { base: 'edge-charm-uni',    dash: 'dash-charm-uni',    from: 'strat-1',         to: 'downstream-1',  side: 'right-left' },
    { base: 'edge-sol-met',      dash: 'dash-sol-met',      from: 'strat-2',         to: 'downstream-2',  side: 'right-left' },
    { base: 'edge-deposit-idle', dash: 'dash-deposit-idle', from: 'ng-node-deposit', to: 'ng-row-idle',   side: 'center-center' },
  ];

  // Exposed on window so the strategy expansion accordion can trigger edge recomputation
  window.computeEdgePaths = computeEdgePaths;
  function computeEdgePaths() {
    if (!nodeGraph) return;
    const ngRect = nodeGraph.getBoundingClientRect();
    // Set SVG viewBox to match pixel dimensions
    ngEdgesSvg.setAttribute('viewBox', `0 0 ${ngRect.width} ${ngRect.height}`);

    for (const ep of edgePairs) {
      const fromEl = document.getElementById(ep.from);
      const toEl = document.getElementById(ep.to);
      const basePath = document.getElementById(ep.base);
      const dashPath = document.getElementById(ep.dash);
      if (!fromEl || !toEl || !basePath) continue;

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();

      let x1, y1, x2, y2;
      if (ep.side === 'right-left') {
        x1 = fr.right - ngRect.left;
        y1 = fr.top + fr.height / 2 - ngRect.top;
        x2 = tr.left - ngRect.left;
        y2 = tr.top + tr.height / 2 - ngRect.top;
      } else {
        // center-center (for idle branch)
        x1 = fr.left + fr.width / 2 - ngRect.left;
        y1 = fr.bottom - ngRect.top;
        x2 = tr.left + tr.width / 2 - ngRect.left;
        y2 = tr.top - ngRect.top;
      }

      // Cubic bezier with horizontal control points for smooth S-curves
      const dx = Math.abs(x2 - x1);
      let cx1, cy1, cx2, cy2;
      if (ep.side === 'center-center') {
        // Vertical drop: control points push down then across
        const dy = y2 - y1;
        cx1 = x1;
        cy1 = y1 + dy * 0.5;
        cx2 = x2;
        cy2 = y1 + dy * 0.5;
      } else {
        // Horizontal flow: smooth horizontal bezier
        cx1 = x1 + dx * 0.45;
        cy1 = y1;
        cx2 = x2 - dx * 0.45;
        cy2 = y2;
      }

      const d = `M ${x1.toFixed(1)},${y1.toFixed(1)} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      basePath.setAttribute('d', d);
      if (dashPath) dashPath.setAttribute('d', d);
    }
  }

  // Compute initial paths after a short delay (wait for layout)
  let edgePathsComputed = false;
  function ensureEdgePaths() {
    if (!edgePathsComputed && nodeGraph) {
      computeEdgePaths();
      edgePathsComputed = true;
    }
  }

  // Cache the responsive base scale read from the CSS custom property.
  // Reading getComputedStyle inside the per-frame scroll write loop forces
  // synchronous style/layout recalc each frame and causes scroll stutter,
  // so we resolve it once on load and refresh only when the viewport
  // breakpoint could have changed (resize). 1 is a safe fallback before
  // the first read completes.
  let ngBaseScaleCached = 1;
  function refreshNgBaseScale() {
    if (!nodeGraph) return;
    const v = parseFloat(getComputedStyle(nodeGraph).getPropertyValue('--ng-base-scale'));
    if (Number.isFinite(v) && v > 0) ngBaseScaleCached = v;
  }
  refreshNgBaseScale();

  window.addEventListener('resize', () => {
    edgePathsComputed = false;
    refreshNgBaseScale();
  });
  // Also recompute periodically during scroll to catch transform changes
  let lastEdgeCompute = 0;

  // Audio state tracking
  let whooshPlayed = false;
  let depositSoundPlayed = false;

  // ── Persistent pair handles (inherited from hero, forwarded to accrue) ──
  const floatContainerT = document.getElementById('float-tokens');
  const floatShareT     = document.getElementById('float-share');
  const floatUnderT     = document.getElementById('float-underlying');

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio (non-DOM, run immediately)
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.04, 0.50, 0.60, 0.95, 1.0], [0.03, 0.06, 0.06, 0.08, 0.08, 0.02]));
      if (p >= 0.065 && p <= 0.075 && !whooshPlayed) { AudioEngine.playWhoosh(0.7); whooshPlayed = true; }
      if (p < 0.06 || p > 0.13) whooshPlayed = false;
      if (p >= 0.65 && p <= 0.66 && !depositSoundPlayed) { AudioEngine.playSoftImpact(); depositSoundPlayed = true; }
      if (p < 0.64 || p > 0.70) depositSoundPlayed = false;

      // ── Compute ALL values synchronously (reads only) ──
      // STREAK → TOKEN-LINE handoff.
      // Prior: line "opened" at 0.6 op / 0.9 scaleY then jumped to full in
      // the first 0.015 of progress — a visible snap right after the boundary.
      // Now: line inherits the streak's exit state (scaleY ≈0.94, op ≈0.85)
      // and eases the last 10% over a longer 0.000–0.04 window with an
      // easeOutCubic curve, so the spine reads as a single continuous
      // object across the boundary and then *breathes into full presence*.
      // A small settle window (0.04–0.08) precedes the coin entrance.
      const introLineScaleY = multiMapEased(p, [0.000, 0.04], [0.94, 1], easeOutCubic);
      const introLineOp = multiMapEased(p, [0.000, 0.04, 0.51, 0.57], [0.85, 1, 1, 0], easeOutCubic);
      const lineGlow = multiMapSmooth(p, [0.024, 0.035, 0.047, 0.124, 0.176, 0.34, 0.40, 0.51, 0.57], [0.08, 1, 0.55, 0.55, 0.08, 0.08, 0.30, 0.30, 0]);
      const lineW = multiMapSmooth(p, [0.003, 0.015, 0.024, 0.035, 0.047, 0.124, 0.176], [0, 1, 1, 3.5, 2, 2, 1]);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 768;
      const rm = Math.min(1, vw / 1200);
      const iconHalf = isMobile ? 38 : 48;
      const centerY = vh / 2 - iconHalf;
      const centerX = vw / 2;
      // Narrow phones: the previous Math.max(rm, 0.55) forced ±121px offsets at
      // 320px viewport, which (after the absolute 170px-wide description
      // cards) ran off both edges. Tighten the floor so cards+descriptions
      // stay inside. rm at 320 = 0.267; spread ~0.38 keeps the coin center at
      // ±84px from center, so the card (±85px) only just kisses the viewport
      // edge — fully legible within 320px.
      const spreadFloor = vw <= 380 ? 0.30 : (vw <= 430 ? 0.44 : 0.55);
      const spread = isMobile ? Math.max(rm, spreadFloor) : rm;

      const coinOffsetX = multiMapSmooth(p,
        [0.018, 0.045, 0.055, 0.08, 0.12, 0.14, 0.165, 0.30, 0.51, 0.60],
        [-340*rm, 0, 0, 0, 0, 180*spread, 220*spread, 220*spread, 220*spread, 20*rm]
      );
      const coinOp = multiMapSmooth(p,
        [0.018, 0.03, 0.055, 0.075, 0.12, 0.14, 0.26, 0.30, 0.68, 0.74],
        [0, 1, 1, 0, 0, 1, 0.4, 1, 1, 0]
      );
      const coinScale = multiMapSmooth(p, [0.11, 0.165, 0.26, 0.30], [1, 0.82, 0.82, 1]);
      const coinLiftY = isMobile ? multiMapSmooth(p, [0.60, 0.68], [0, -vh * 0.28]) : 0;
      const coinTx = `translate(${centerX + coinOffsetX}px, ${centerY + coinLiftY}px) translate(-50%, 0) scale(${coinScale})`;
      const coinDepositing = p > 0.14 && p < 0.60;

      const morphActive = (p >= 0.055 && p <= 0.135);
      const morphOp = multiMapSmooth(p, [0.055, 0.065, 0.125, 0.135], [0, 1, 1, 0]);
      const morphProgress = morphActive ? Math.max(0, Math.min(1, mapRange(p, 0.06, 0.12, 0, 1))) : 0;
      const morphLabelOp = multiMapSmooth(p, [0.07, 0.085, 0.11, 0.125], [0, 1, 1, 0]);

      const shareOp = multiMapSmooth(p,
        [0.10, 0.13, 0.51, 0.60, 0.64, 0.67],
        [0, 1, 1, 0.35, 0.35, 0]
      );
      const shareOffsetX = multiMapSmooth(p,
        [0.10, 0.14, 0.165, 0.30, 0.51, 0.60],
        [0, -140*spread, -220*spread, -220*spread, -220*spread, -50*rm]
      );
      const shareScale = multiMapSmooth(p, [0.10, 0.14, 0.51, 0.60], [0.6, 1, 1, 0.42]);
      const shareTx = `translate(${centerX + shareOffsetX}px, ${centerY}px) translate(-50%, 0) scale(${shareScale})`;
      const shareMinted = p > 0.13 && p < 0.60;

      // Reading-time: widen every copy hold so text is legible, not blipped.
      const topCopyOp = multiMapSmooth(p, [0.015, 0.035, 0.085, 0.105], [0, 1, 1, 0]);
      const crossCopyOp = multiMapSmooth(p, [0.135, 0.170, 0.250, 0.278], [0, 1, 1, 0]);
      const leftLabelOp = multiMapSmooth(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      const rightLabelOp = multiMapSmooth(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      const entryCueOp = multiMapSmooth(p, [0.165, 0.20, 0.235, 0.271], [0, 1, 1, 0]);
      const rightDetailOp = multiMapSmooth(p, [0.32, 0.37, 0.50, 0.54], [0, 1, 1, 0]);
      const leftDetailOp = multiMapSmooth(p, [0.37, 0.42, 0.49, 0.53], [0, 1, 1, 0]);
      const dualEntryOp = multiMapSmooth(p, [0.46, 0.495, 0.555, 0.59], [0, 1, 1, 0]);

      const cameraScale = multiMapSmooth(p, [0.50, 0.58, 0.62, 0.68], [1, 1.06, 1.06, 1]);
      const panX = isMobile ? 0 : mapEased(p, 0.64, 0.86, 0, -400 * rm);
      const cameraTx = `scale(${cameraScale}) translateX(${panX}px)`;

      // ── Sync 3D camera pan with content motion ──
      // Convert pixel-space panX to world units for the Three.js lookAt target
      // panX ranges from 0 to ~-400px; map to ~0 to -2.5 world units
      // Also factor in the token spread phase for early kinetic feel
      const tokenSpreadPan = multiMapSmooth(p, [0.12, 0.165, 0.30, 0.51], [0, 0.4, 0.4, 0]);
      const cameraWrapperPan = panX / 160; // ~-400px → ~-2.5 world units
      // Ease back to 0 during scene exit so next chapter starts centered
      const panFade = multiMapSmooth(p, [0.93, 0.99], [1, 0]);
      window.__contentPanX = (tokenSpreadPan + cameraWrapperPan) * panFade;

      // ── DEPOSIT → NG-NODE MORPH (continuous FLIP) ──
      // The big Initial-Deposit card (with AKITA coin above it) morphs into
      // the small ng-node-deposit pill. For smoothness:
      //  • depositInfoOp stays 1 all the way through the morph so the card
      //    is a SOLID element we physically shrink (no early fade).
      //  • The pill's own opacity (ngBranchOp) is gated below so it only
      //    appears AFTER the morph completes — no double-element overlap.
      //  • The morph window is wide (0.70 → 0.80) with cubic-ease for smoothness.
      const depositInfoOp = multiMapSmooth(p, [0.65, 0.69, 0.795, 0.815], [0, 1, 1, 0]);
      const splitInfoOp = multiMapSmooth(p, [0.67, 0.71, 0.71, 0.74], [0, 1, 1, 0]);
      // Morph progress: 0 → 1 across p = 0.70 → 0.80 (10% window = plenty of room)
      const depositMorphP = Math.max(0, Math.min(1, (p - 0.70) / 0.10));
      // Gate flag for pill fade-in so the pill only appears AFTER morph lands
      const morphHasLanded = p >= 0.80;

      const nodeGraphOp = multiMapSmooth(p, [0.74, 0.77], [0, 1]);
      // Pill (ng-node-deposit) fades in only AFTER the morph lands so we never
      // see two versions of the same component at once during the transition.
      const ngBranchOp = multiMapSmooth(p, [0.795, 0.82], [0, 1]);
      // Engine hub: opens at 0.76-0.80, then tapers from 0.90 to 0.99 so the
      // retire overlaps the accrue entry instead of cliff-dropping at scene-pin
      // fade. This was the cause of the token→accrue midpoint gap.
      const ehOp = multiMapSmooth(p, [0.76, 0.80, 0.90, 0.99], [0, 1, 1, 0.2]);
      const ehTx = `scale(${0.92 + ehOp * 0.08})`;
      const ngEdgeFanOp = multiMapSmooth(p, [0.78, 0.82], [0, 1]);
      // Strategies and downstream nodes: same taper-at-0.90 pattern so the
      // cluster breathes out rather than hard-cutting at scene-pin exit.
      const s0Op = multiMapSmooth(p, [0.79, 0.83, 0.91, 0.99], [0, 1, 1, 0.15]);
      const s1Op = multiMapSmooth(p, [0.805, 0.845, 0.91, 0.99], [0, 1, 1, 0.15]);
      const s2Op = multiMapSmooth(p, [0.82, 0.86, 0.91, 0.99], [0, 1, 1, 0.15]);
      const ds1Op = multiMapSmooth(p, [0.84, 0.87, 0.92, 0.99], [0, 1, 1, 0.12]);
      const ds2Op = multiMapSmooth(p, [0.855, 0.885, 0.92, 0.99], [0, 1, 1, 0.12]);
      const ngRowIdleOp = multiMapSmooth(p, [0.81, 0.85, 0.92, 0.99], [0, 1, 1, 0.12]);
      // Fee label: crests at 0.91, holds briefly, then lingers so it's the
      // last engine element still faintly visible as accrue opens. Its
      // "fees" message is the conceptual bridge into accrue's equation.
      const feeLabelOp = multiMapSmooth(p, [0.88, 0.91, 0.94, 1.00], [0, 1, 1, 0.35]);
      // Scene-pin: 0.92–1.00 so the chapter fade overlaps accrue's intro
      // (accrue p=0–0.10). easeOutCubic so the fade carries forward
      // momentum into accrue instead of feeling symmetric.
      const sceneExit = multiMapEased(p, [0.92, 1.00], [1, 0], easeOutCubic);

      // ── Depth parallax: each allocation card at a different Z-plane ──
      // Progress within the node-graph visible window (0.77 to 0.95)
      const depthP = Math.max(0, Math.min(1, (p - 0.77) / 0.18));
      const orb = window.__gridCamOrbit || { angle: 0.3, elevation: 0.15, distance: 5 };
      // Use actual grid-projected angles so cards sit ON the grid surface
      const ngGp = window.__gridProjected || { rx: 0, ry: 0, perspective: 900 };
      const gridRx = ngGp.rx * 0.15 + depthP * 1.2; // aggressive tracking for big swings
      const gridRy = ngGp.ry * 0.12;
      // Per-card Z-offsets: Ajna closest (+30), Charm mid (+10), Solana recessed (-15), Idle far back (-35)
      const mobileScale = isMobile ? 0.35 : 1.0;
      const z0 = 30 * mobileScale * depthP;   // Ajna — pops forward
      const z1 = 10 * mobileScale * depthP;   // Charm — mid-plane
      const z2 = -15 * mobileScale * depthP;  // Solana — recedes
      const zIdle = -35 * mobileScale * depthP; // Idle — furthest back
      // Slight per-card Y-float offset for organic depth feel
      const yF0 = Math.sin(depthP * Math.PI * 1.2) * -4 * mobileScale;
      const yF1 = Math.sin(depthP * Math.PI * 0.9 + 0.3) * 2 * mobileScale;
      const yF2 = Math.sin(depthP * Math.PI * 0.7 + 0.6) * 5 * mobileScale;
      const yFIdle = Math.sin(depthP * Math.PI * 0.5 + 1.0) * 7 * mobileScale;
      // ── Mouse depth-parallax per allocation card ──
      // Closer cards (higher Z) get more mouse shift, creating true depth separation
      // POLISH (noise cleanup): halved amplitudes across all four tiers. The
      // original 22/14/6/2 budget pushed foreground cards visibly under
      // cursor movement during a chapter that is already building a lot of
      // motion (morph + graph + spine drift). Now the depth separation still
      // reads but the background no longer feels restless.
      const ndm = DepthMouse;
      const ndmA = ndm.active ? mobileScale : 0;
      const mxS0 = ndm.x * 12 * ndmA;   // Ajna: closest → strongest shift
      const myS0 = ndm.y * 8 * ndmA;
      const mxS1 = ndm.x * 8 * ndmA;    // Charm: mid
      const myS1 = ndm.y * 5 * ndmA;
      const mxS2 = ndm.x * 4 * ndmA;    // Solana: recedes → less shift
      const myS2 = ndm.y * 2.5 * ndmA;
      const mxIdle = ndm.x * 1.5 * ndmA; // Idle: deepest → barely moves
      const myIdle = ndm.y * 1 * ndmA;

      // ── Spine position: the vertical spine sits to the LEFT of the AKITA
      //    token throughout the deposit + ng-graph scenes. The AKITA pill
      //    lands at viewport x ≈ 100–250 px in the ng-graph layout, so the
      //    spine drifts to x ≈ 60 px (−660 px from center 720). Drift begins
      //    during the deposit read window, eases into position by the time
      //    the morph lands, and HOLDS there through the ng-graph view —
      //    then releases once we exit to the next chapter (p ≥ 0.94).
      //    Values are px relative to the line's own center (after its own
      //    translateX(-50%)). Negative = shift left of center.
      const spineDriftPx = multiMapSmooth(p,
        [0.45, 0.60, 0.94, 0.99],
        [0, -660, -660, 0]
      );
      // Re-illuminate the spine during the pan window so the motion is
      // visible to the reader (it would otherwise be faded out by introLineOp
      // at p≈0.57). Peaks at 0.55 and holds through the ng-graph so the
      // cue stays visible as the user reads the layout.
      const spinePanAlpha = multiMapSmooth(p,
        [0.42, 0.52, 0.92, 0.99],
        [0, 0.55, 0.55, 0]
      );

      // ── Batch ALL DOM writes into a single rAF frame ──
      WriteBatch.write(() => {
        tokenLine.style.transform = `translateX(calc(-50% + ${spineDriftPx}px)) scaleY(${introLineScaleY})`;
        // Use the larger of introLineOp and the pan-window boost so the line
        // is visible during the spine pan cue (0.60 → 0.90).
        tokenLine.style.opacity = Math.max(introLineOp, spinePanAlpha);
        tokenLineGlowEl.style.opacity = lineGlow;
        tokenLineCoreEl.style.width = `${lineW}px`;

        // Coin + deposit-info live inside .token-coin. During the morph
        // window (p = 0.70 → 0.80) we replace coinTx with a composed
        // transform that ALSO carries the whole coin-card unit toward
        // the ng-node-deposit pill. This is computed below in the
        // FLIP block after we measure rects. Here we just write the
        // base transform — the morph override comes after.
        coin.style.transform = coinTx;
        // Parent .token-coin holds the MAX of its children's opacities so
        // deposit-info (child) can outlast coin-icon (child) during morph.
        // During morph we keep the parent at 1 so the whole unit is solid
        // while it travels. After p=0.795 we crossfade it with the pill so
        // there's no hard cut.
        // Keep the morph-unit visible AT FULL right through the morph,
        // then fade out AS the pill fades in (0.795 → 0.82) for a clean
        // handoff. This prevents the gap/flicker the user saw.
        const morphUnitOp = multiMapSmooth(p, [0.795, 0.82], [1, 0]);
        const unitOp = Math.max(coinOp, depositInfoOp) * morphUnitOp;
        coin.style.opacity = unitOp;
        // Let coin-icon follow coinOp EXCEPT during the morph phase, where
        // we want the coin circle to stay at full opacity so it rides the
        // morph intact (same component) and then smoothly cross-drops at
        // the landing moment, when the ng-node-deposit pill takes over.
        if (coinIcon) {
          const morphCoinOp = depositMorphP > 0 && depositMorphP < 1
            ? Math.max(coinOp, 1 - depositMorphP * 0.15) // stay near full during morph
            : coinOp;
          coinIcon.style.opacity = morphCoinOp;
        }
        coin.classList.toggle('depositing', coinDepositing);

        if (morphZone) {
          morphZone.style.opacity = morphOp;
          MorphSystem.setVisible(morphActive);
          if (morphActive && MorphSystem) MorphSystem.setProgress(morphProgress);
        }
        if (morphLabel) morphLabel.style.opacity = morphLabelOp;

        share.style.transform = shareTx;
        share.style.opacity = shareOp;
        share.classList.toggle('minted', shareMinted);

        topCopy.style.opacity = topCopyOp;
        crossCopy.style.opacity = crossCopyOp;
        // Token chapter kicker — visible during the deposit phase, fades as camera pans
        if (tokenLabel) {
          // Token kicker — hold across the entire deposit narrative so the
          // reader has the chapter label on screen while they absorb the copy.
          const kickerOp = multiMapSmooth(p, [0.005, 0.025, 0.135, 0.170], [0, 1, 1, 0]);
          tokenLabel.style.opacity = kickerOp;
        }
        labelYou.style.opacity = leftLabelOp;
        labelVault.style.opacity = rightLabelOp;
        labelShares.style.opacity = leftLabelOp;
        labelUnderlying.style.opacity = rightLabelOp;
        coinLabel.style.opacity = rightLabelOp;
        shareLabel.style.opacity = leftLabelOp;
        entryCue.style.opacity = entryCueOp;

        coinDetail.style.opacity = rightDetailOp;
        shareDetail.style.opacity = leftDetailOp;
        dualEntry.style.opacity = dualEntryOp;

        cameraWrapper.style.transform = cameraTx;
        depositInfo.style.opacity = depositInfoOp;
        splitInfo.style.opacity = splitInfoOp;

        // ── CONTINUOUS MORPH: .token-coin (coin + card) → ng-node-deposit pill ──
        // Instead of morphing only the inner card, we morph the ENTIRE coin-unit
        // (AKITA circle + Initial-Deposit card stacked together) so the viewer
        // sees the exact same component shrink and glide into the pill slot.
        // This is composed on top of coinTx so the base scroll motion still applies.
        if (coin && ngNodeDeposit) {
          // Apply morph for the entire 0 ≤ depositMorphP ≤ 1 range so there's
          // no snap at the endpoints. At 0 the identity transform is applied
          // (identical to coinTx); at 1 the full morph is locked in.
          if (depositMorphP > 0) {
            coin.classList.add('morphing-to-pill');
            depositInfo.classList.add('morphing');
            // Temporarily clear the combined transform on coin so we get
            // coin's natural (post-coinTx) rect — actually we WANT the rect
            // AFTER coinTx so that dx/dy land accurately.
            coin.style.transform = coinTx;
            const srcRect = coin.getBoundingClientRect();
            // Force pill layout read even while it's opacity:0.
            const prevVis = ngNodeDeposit.style.visibility;
            ngNodeDeposit.style.visibility = 'hidden';
            const dstRect = ngNodeDeposit.getBoundingClientRect();
            ngNodeDeposit.style.visibility = prevVis;
            if (srcRect.width > 0 && dstRect.width > 0) {
              // We want the AKITA circle inside the coin-unit to LAND inside
              // the pill's icon slot (left side of pill, ~40px circle).
              // So we compute dst center as the pill's icon-slot center, not
              // the whole pill center.
              const pillIconCx = dstRect.left + 30;             // ~icon slot center x
              const pillIconCy = dstRect.top + dstRect.height / 2;
              // coin-icon sits near TOP of coin-unit; use its center.
              const iconEl = coinIcon || coin;
              const iconRect = iconEl.getBoundingClientRect();
              const srcCx = iconRect.left + iconRect.width / 2;
              const srcCy = iconRect.top + iconRect.height / 2;
              const dx = pillIconCx - srcCx;
              const dy = pillIconCy - srcCy;
              // Scale the whole unit so the coin-icon ends up ~40px (pill icon size).
              // iconRect.width is typically ~96px in-scene.
              const sxEnd = 40 / Math.max(iconRect.width, 1);
              // Smoothstep ease (easeInOutCubic) — very smooth, no linear feel.
              const t = depositMorphP < 0.5
                ? 4 * depositMorphP * depositMorphP * depositMorphP
                : 1 - Math.pow(-2 * depositMorphP + 2, 3) / 2;
              const tx = dx * t;
              const ty = dy * t;
              const s  = 1 + (sxEnd - 1) * t;
              // Compose with coinTx by appending translate + scale around the
              // icon's center. Use transform-origin via explicit translate trick.
              coin.style.transformOrigin = '50% 20%'; // scale around icon area
              coin.style.transform = `${coinTx} translate(${tx}px, ${ty}px) scale(${s})`;
              // Keep deposit-info visible but dim quickly during morph so the
              // dense body text doesn't fight the pill — we want coin + title
              // + number to survive, description to fade.
              depositInfo.style.transform = '';
            }
          } else {
            coin.classList.remove('morphing-to-pill');
            depositInfo.classList.remove('morphing');
            depositInfo.style.transform = '';
            // coin.style.transform already set to coinTx above; nothing to do.
          }
        }

        // ── Ng-graph entry lateral pan + DEPTH-DOMINANT EXIT ──
        //    DIRECTIONAL VARIETY: Boundary 2 (Token → Accrue) was previously
        //    lateral-right dominant (exit +220px), but Boundary 1 (Hero →
        //    Token) is already lateral-right (streak migrates +22vw). Two
        //    adjacent lateral-right boundaries read as repetitive "pan right
        //    again." Exit re-voiced as DEPTH-RECEDE dominant:
        //      - lateral X travel reduced +220 → +40 (barely a whisper)
        //      - scale compress deepened 0.965 → 0.88 (telescope pulling back)
        //      - blur 0 → 4px added (dissolves into atmospheric substrate)
        //    Reader now feels "the mechanism recedes into depth and softens
        //    into background" rather than "the mechanism slides right again."
        //    This sets up Accrue's single-object compress-inward cleanly —
        //    it inherits the depth axis instead of the horizontal axis.
        //
        //    Entry:  p 0.70 → 0.80,  translateX 380 → 0, scale 1, blur 0 (unchanged)
        //    Hold:   p 0.80 → 0.90,  translateX 0, scale 1, blur 0
        //    Exit:   p 0.90 → 1.00,  translateX 0 → 40, scale 1 → 0.88, blur 0 → 4
        const ngPanX = multiMapEased(p,
          [0.70, 0.80, 0.90, 1.00],
          [380, 0, 0, 40],
          easeOutCubic
        );
        const ngExitScale = multiMapEased(p, [0.90, 1.00], [1, 0.88], easeOutCubic);
        const ngExitBlur  = multiMapEased(p, [0.90, 1.00], [0, 4], easeOutCubic);
        if (nodeGraph) {
          nodeGraph.style.opacity = nodeGraphOp;
          // Mobile: graph flows vertically in natural layout (see style.css
          // @media max-width:768px). The desktop horizontal-pan transform
          // would push the whole graph off-canvas, so gate transform writes.
          if (window.innerWidth > 768) {
            // Compose with the responsive --ng-base-scale set in CSS so
            // wide desktops keep the bigger idle scale through the exit.
            // ngBaseScaleCached is resolved once at load and refreshed on
            // resize — see refreshNgBaseScale() above. Reading
            // getComputedStyle here would force per-frame style recalc and
            // reintroduce scroll stutter.
            // (The original transform here did NOT include translateY(-50%);
            // we preserve that exact composition so the graph's resting
            // position during the active chapter is unchanged — only the
            // overall scale grows on wide viewports.)
            nodeGraph.style.transform = `translateX(${ngPanX}px) scale(${ngExitScale * ngBaseScaleCached})`;
            nodeGraph.style.filter = ngExitBlur > 0.05 ? `blur(${ngExitBlur}px)` : '';
          } else {
            nodeGraph.style.transform = '';
            nodeGraph.style.filter = '';
          }
        }
        // Deposit + hub
        if (ngNodeDeposit) ngNodeDeposit.style.opacity = ngBranchOp;
        if (engineHub) {
          engineHub.style.opacity = ehOp;
          // Desktop: hub is absolute/top:50% so translateY(-50%) centers it.
          // Mobile: hub is in natural flow, so skip the -50% centering tx.
          if (window.innerWidth > 768) {
            engineHub.style.transform = `translateY(-50%) scale(${0.92 + ehOp * 0.08})`;
          } else {
            engineHub.style.transform = `scale(${0.92 + ehOp * 0.08})`;
          }
        }

        strat0.style.opacity = s0Op;
        strat1.style.opacity = s1Op;
        strat2.style.opacity = s2Op;
        // Clean slide-in from right
        strat0.style.transform = `translateX(${(1 - s0Op) * 20}px)`;
        strat1.style.transform = `translateX(${(1 - s1Op) * 20}px)`;
        strat2.style.transform = `translateX(${(1 - s2Op) * 20}px)`;

        downstream1.style.opacity = ds1Op;
        downstream2.style.opacity = ds2Op;
        // Desktop: ds1 has top:38% + translateY(-50%) to center on its top anchor.
        // Mobile: natural flow, skip vertical centering transform.
        if (window.innerWidth > 768) {
          downstream1.style.transform = `translateY(-50%) translateX(${(1 - ds1Op) * 12}px)`;
        } else {
          downstream1.style.transform = `translateX(${(1 - ds1Op) * 12}px)`;
        }
        downstream2.style.transform = `translateX(${(1 - ds2Op) * 12}px)`;

        if (ngRowIdle) {
          ngRowIdle.style.opacity = ngRowIdleOp;
          ngRowIdle.style.transform = `translateY(${(1 - ngRowIdleOp) * 10}px)`;
        }
        feeLabel.style.opacity = feeLabelOp;
        section.querySelector('.scene-pin').style.opacity = sceneExit;

        // TOKEN → ACCRUE handoff: keep token-line spine alive at exit so
        // its visual DNA carries into accrue's yc-axis-y. We override the
        // intro-line fade so the spine STAYS visible through scene-pin
        // fade. The accrue writer will re-materialize the same vertical
        // glow as yc-axis-y at matched X.
        // IMPORTANT: preserve the left-of-AKITA X position (−660 px) during
        // this carry — we must NOT snap the line back to center, which was
        // the bug that made the spine visibly re-appear in the middle.
        if (p > 0.90) {
          const lineCarry = multiMapSmooth(p, [0.90, 1.00], [0, 1]);
          tokenLine.style.opacity = Math.max(introLineOp, lineCarry * 0.8);
          // Shrink scaleY so it ends as a "stub" ready for axis takeover
          const carryScaleY = multiMapSmooth(p, [0.90, 1.00], [1, 0.75]);
          // Keep the −660 drift that was already set above; just replace scaleY.
          tokenLine.style.transform = `translateX(calc(-50% + ${spineDriftPx}px)) scaleY(${carryScaleY})`;
          // Bridge this carry scaleY so accrue can open yc-axis-y matched
          Continuity.setBridge('tokenLineCarry', lineCarry);
        }

        // ── Persistent pair continuity across this chapter ──
        // We inherited 'hero' pose (top-right + bottom-left) from ch-hero.
        // Now we ease that pose toward 'tokenEnd' (flanking left/right) over
        // the FIRST 8% so the pair visibly MIGRATES into flank positions
        // before the in-scene mint animation starts — this is the visible
        // hand-off the user wanted.
        //
        // Then we KEEP the pair on-screen (low opacity) through the mint +
        // deposit phases, so the viewer never sees the pair vanish + reappear.
        // It only dips briefly during the node-graph reveal (p 0.76–0.92) so
        // graph text isn't competing for attention, then rises back to
        // tokenEnd strength for the handoff into accrue.
        const openMigrateT = multiMapSmooth(p, [0.00, 0.08], [0, 1]);
        const tePose = Continuity.lerpPose('hero', 'tokenEnd', openMigrateT);
        // Container opacity: full at open (inherited from hero), slight dip
        // during the central mint focus, return to full for accrue handoff.
        const pairContainerOp = multiMapSmooth(p,
          [0.00, 0.10, 0.14, 0.30, 0.60, 0.76, 0.86, 0.99],
          [1.0,  1.0,  0.75, 0.55, 0.70, 0.70, 1.00, 1.00]
        );
        Continuity.setLive(tePose);
        // TOKEN does NOT render the persistent pair — the in-DOM #token-coin
        // and #token-share are the scene's own tokens. Continuity to accrue
        // is carried by the line (structural) + copy + detail panels.
        if (self.isActive) {
          Continuity.hidePair();
        }
        // Silence unused pair opacity envelope compute (kept for bridge math).
        void pairContainerOp;

        // Per-edge opacity: each edge fades in with the lesser of its source & target node
        const setEdgeOp = (baseId, dashId, op) => {
          const b = document.getElementById(baseId);
          const d = document.getElementById(dashId);
          if (b) b.style.opacity = op;
          if (d) d.style.opacity = op;
        };
        setEdgeOp('edge-deposit-hub', 'dash-deposit-hub', Math.min(ngBranchOp, ehOp));
        setEdgeOp('edge-hub-ajna',    'dash-hub-ajna',    Math.min(ehOp, s0Op));
        setEdgeOp('edge-hub-charm',   'dash-hub-charm',   Math.min(ehOp, s1Op));
        setEdgeOp('edge-hub-solana',  'dash-hub-solana',  Math.min(ehOp, s2Op));
        setEdgeOp('edge-charm-uni',   'dash-charm-uni',   Math.min(s1Op, ds1Op));
        setEdgeOp('edge-sol-met',     'dash-sol-met',     Math.min(s2Op, ds2Op));
        setEdgeOp('edge-deposit-idle', 'dash-deposit-idle', Math.min(ngBranchOp, ngRowIdleOp));

        // Recompute SVG edge paths every frame while node graph is visible
        // (needed because slide-in transforms shift card positions)
        if (nodeGraphOp > 0.1 && ngEdgesSvg) {
          computeEdgePaths();
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 7b. CARD CLICK-TO-EXPAND (Accordion per section)
// ────────────────────────────────────────────
(function cardExpansion() {
  // Define accordion groups: each group has its own set of cards that close
  // when a sibling expands. The wrapper selector finds the dim-target parent.
  const groups = [
    { cards: '.ng-strat-column:not(.cca-strat-column) .strategy-card-inner[data-strat]', wrapper: '.ng-node-strat' },
    { cards: '.cca-strat-column .strategy-card-inner[data-strat]', wrapper: '.ng-node-strat' },
    { cards: '.ng-node-downstream .ng-ds-inner[data-strat]',      wrapper: '.ng-node-downstream' },
    // Deposit-info is a standalone accordion (group of one) — click to toggle.
    { cards: '#deposit-info[data-strat]',                          wrapper: '#deposit-info' },
    // The ng-node-deposit pill (what deposit-info morphs into) — same click-expand affordance.
    { cards: '#ng-node-deposit [data-strat="deposit-pill"]',        wrapper: '#ng-node-deposit' },
  ];

  groups.forEach(({ cards: sel, wrapper: wrapSel }) => {
    const groupCards = document.querySelectorAll(sel);
    if (!groupCards.length) return;

    groupCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasExpanded = card.classList.contains('strat-expanded');

        // Close all in this group (accordion)
        groupCards.forEach(c => {
          c.classList.remove('strat-expanded');
          const w = c.closest(wrapSel);
          if (w) w.classList.remove('strat-sibling-dim');
        });

        // Toggle the clicked card; dim siblings in same group
        if (!wasExpanded) {
          card.classList.add('strat-expanded');
          card.setAttribute('aria-expanded', 'true');
          groupCards.forEach(c => {
            if (c !== card) {
              const w = c.closest(wrapSel);
              if (w) w.classList.add('strat-sibling-dim');
            }
          });
        } else {
          card.setAttribute('aria-expanded', 'false');
        }

        // Special: when the DEPOSIT PILL is the card being toggled, also
        // toggle a class on #node-graph so every OTHER node (hub, strategies,
        // downstream, idle) dims — the expanded pill gets full focus.
        if (card.matches('#ng-node-deposit [data-strat="deposit-pill"]')) {
          const ng = document.getElementById('node-graph');
          if (ng) ng.classList.toggle('deposit-pill-open', !wasExpanded);
        }

        // Recompute SVG edges during expansion transition (400ms CSS)
        if (typeof window.computeEdgePaths === 'function') {
          [50, 150, 250, 400, 500].forEach(delay => {
            setTimeout(() => {
              window.computeEdgePaths();
              if (typeof window.computeCCAEdgePaths === 'function') window.computeCCAEdgePaths();
            }, delay);
          });
        }
      });
    });
  });

  // Close expanded cards when clicking outside any card
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-strat]')) {
      const allCards = document.querySelectorAll('[data-strat].strat-expanded');
      if (allCards.length) {
        allCards.forEach(c => {
          c.classList.remove('strat-expanded');
          c.setAttribute('aria-expanded', 'false');
          // Clean up dim on siblings
          const parent = c.closest('.ng-strat-column') || c.closest('.cca-strat-column');
          if (parent) parent.querySelectorAll('.strat-sibling-dim').forEach(w => w.classList.remove('strat-sibling-dim'));
          // Clean up downstream dim
          document.querySelectorAll('.ng-node-downstream.strat-sibling-dim').forEach(w => w.classList.remove('strat-sibling-dim'));
        });
        // Clean up the deposit-pill-open focus class on node-graph
        const ng = document.getElementById('node-graph');
        if (ng) ng.classList.remove('deposit-pill-open');
        if (typeof window.computeEdgePaths === 'function') {
          [50, 400].forEach(delay => setTimeout(() => {
            window.computeEdgePaths();
            if (typeof window.computeCCAEdgePaths === 'function') window.computeCCAEdgePaths();
          }, delay));
        }
      }
    }
  });
})();

// ────────────────────────────────────────────
// 8. CHAPTER 3: ACCRUE (850vh) + WebGL self-drawing yield curve
// ────────────────────────────────────────────
(function chapterAccrue() {
  const section = document.getElementById('ch-accrue');
  const intro = document.getElementById('accrue-intro');
  const pair = document.getElementById('accrue-pair');
  const clock = document.getElementById('accrue-clock');
  const clockDate = document.getElementById('clock-date');
  const stats = document.getElementById('accrue-stats');
  const statDays = document.getElementById('stat-days');
  const statRatio = document.getElementById('stat-ratio');
  const statApy = document.getElementById('stat-apy');
  const equation = document.getElementById('accrue-equation');
  const ratioDisplay = document.getElementById('accrue-ratio-display');
  const ratioValue = document.getElementById('ratio-value');
  const ycWrap = document.getElementById('yield-curve-wrap');
  const ycCanvas = document.getElementById('yield-curve-canvas');
  const volNarrative = document.getElementById('vol-narrative');
  const volHeadline = document.getElementById('vol-headline');
  const volSub = document.getElementById('vol-sub');
  const ycAxisY = document.getElementById('yc-axis-y');
  const ycAxisX = document.getElementById('yc-axis-x');
  const ycMilestonesWrap = document.getElementById('yc-milestones');

  // ── Persistent pair handles (inherited from token journey) ──
  const floatContainerA = document.getElementById('float-tokens');
  const floatShareA     = document.getElementById('float-share');
  const floatUnderA     = document.getElementById('float-underlying');

  // ── Timeline: Aug 10 2025 → Apr 15 2026 (248 days) ──
  const TOTAL_DAYS = 248;
  const VAULT_LAUNCH = new Date(2025, 7, 10); // Aug 10, 2025
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  // ── Share-ratio model: 1.000 → 1.034 over 248 days ──
  // Aggressive piecewise growth — higher APY display throughout:
  //   Days 0-25:   launch surge               (~42% ann)
  //   Days 25-55:  momentum peak              (~58% ann)
  //   Days 55-95:  correction & rebalance     (~8% ann)
  //   Days 95-140: second wind                (~48% ann)
  //   Days 140-190: mature yield               (~35% ann)
  //   Days 190-225: compression phase          (~22% ann)
  //   Days 225-248: tail-off                   (~14% ann)
  // NOTE: ratios are normalized post-hoc to land at exactly 1.034,
  // so these APYs drive the *shape* — steeper climbs, sharper dips.
  const RATE_SEGMENTS = [
    { end:  25, apy: 0.72 },
    { end:  55, apy: 0.85 },
    { end:  95, apy: 0.28 },
    { end: 140, apy: 0.78 },
    { end: 190, apy: 0.55 },
    { end: 225, apy: 0.38 },
    { end: 248, apy: 0.30 },
  ];

  // Pre-compute daily ratios with micro-noise
  const _dailyRatio = new Float64Array(TOTAL_DAYS + 1);
  _dailyRatio[0] = 1.0;
  function seededRand(seed) {
    let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  {
    let seg = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      while (seg < RATE_SEGMENTS.length - 1 && d > RATE_SEGMENTS[seg].end) seg++;
      const baseDaily = Math.pow(1 + RATE_SEGMENTS[seg].apy, 1 / 365) - 1;
      // ±15% noise for organic texture
      const noise = (seededRand(d) - 0.5) * 0.30 * baseDaily;
      _dailyRatio[d] = _dailyRatio[d - 1] * (1 + baseDaily + noise);
    }
    // No normalization — let the organic rates determine the final ratio.
    // With these aggressive segments the curve will reach ~1.25+ naturally.
  }
  const FINAL_RATIO = _dailyRatio[TOTAL_DAYS];
  const RATIO_MIN = 1.000;
  const RATIO_MAX = Math.ceil(FINAL_RATIO * 100) / 100 + 0.01; // Y-axis ceiling with headroom

  function ratioAtDay(d) {
    const di = Math.floor(Math.max(0, Math.min(TOTAL_DAYS, d)));
    const frac = d - di;
    if (di >= TOTAL_DAYS) return _dailyRatio[TOTAL_DAYS];
    return _dailyRatio[di] + frac * (_dailyRatio[di + 1] - _dailyRatio[di]);
  }

  // Instantaneous APY at a given day (annualized from recent 7-day window)
  function apyAtDay(d) {
    if (d < 7) return 0;
    const r0 = ratioAtDay(d - 7);
    const r1 = ratioAtDay(d);
    return (Math.pow(r1 / r0, 365 / 7) - 1) * 100;
  }

  // ── Dynamically build axis labels ──
  // Y-axis: evenly spaced from 1.000 to just above FINAL_RATIO
  const ySteps = [];
  {
    // Pick a step that gives 6–8 grid lines
    const range = RATIO_MAX - RATIO_MIN;
    const rawStep = range / 7;
    // Round step to nearest nice number (0.01, 0.02, 0.05, 0.10, 0.20 ...)
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceSteps = [1, 2, 5, 10];
    let step = mag;
    for (const ns of niceSteps) {
      if (mag * ns >= rawStep) { step = mag * ns; break; }
    }
    for (let v = RATIO_MIN; v <= RATIO_MAX + 0.0001; v += step) {
      ySteps.push(Math.round(v * 1000) / 1000);
    }
  }
  ycAxisY.innerHTML = '';
  ySteps.forEach(v => {
    const pct = ((v - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * 100;
    const span = document.createElement('span');
    span.className = 'yc-label';
    span.dataset.val = v.toFixed(3);
    span.style.bottom = pct + '%';
    span.textContent = v.toFixed(3);
    ycAxisY.appendChild(span);
  });

  // X-axis: month ticks
  const monthTicks = []; // { label, day }
  {
    const monthNames = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'];
    const monthDates = [
      new Date(2025, 7, 10),  // Aug
      new Date(2025, 8, 1),   // Sep
      new Date(2025, 9, 1),   // Oct
      new Date(2025, 10, 1),  // Nov
      new Date(2025, 11, 1),  // Dec
      new Date(2026, 0, 1),   // Jan
      new Date(2026, 1, 1),   // Feb
      new Date(2026, 2, 1),   // Mar
      new Date(2026, 3, 15),  // Apr 15
    ];
    monthDates.forEach((dt, i) => {
      const diff = Math.round((dt - VAULT_LAUNCH) / 86400000);
      if (diff >= 0 && diff <= TOTAL_DAYS) {
        monthTicks.push({ label: monthNames[i], day: diff });
      }
    });
  }
  ycAxisX.innerHTML = '';
  monthTicks.forEach(t => {
    const span = document.createElement('span');
    span.className = 'yc-label';
    span.textContent = t.label;
    // Position as percentage of chart width
    span.style.left = (t.day / TOTAL_DAYS * 100) + '%';
    span.style.position = 'absolute';
    span.style.transform = 'translateX(-50%)';
    ycAxisX.appendChild(span);
  });

  // ── Milestone callouts at key intervals ──
  const milestoneConfigs = [
    { day: 30,  label: 'Day 30',  pitch: 1.0 },
    { day: 90,  label: 'Day 90',  pitch: 1.15 },
    { day: 150, label: 'Day 150', pitch: 1.3 },
    { day: 210, label: 'Day 210', pitch: 1.5 },
    { day: 248, label: 'Day 248', pitch: 1.8 },
  ];
  ycMilestonesWrap.innerHTML = '';
  const calloutData = milestoneConfigs.map(ms => {
    const div = document.createElement('div');
    div.className = 'yc-callout';
    div.dataset.day = ms.day;
    div.innerHTML = `
      <div class="yc-callout-pip"></div>
      <div class="yc-callout-card">
        <span class="yc-callout-day">${ms.label}</span>
        <span class="yc-callout-ratio">${ratioAtDay(ms.day).toFixed(3)}</span>
        <span class="yc-callout-apy">${apyAtDay(ms.day).toFixed(1)}% APY</span>
      </div>`;
    ycMilestonesWrap.appendChild(div);
    return { day: ms.day, el: div, chimed: false, pitch: ms.pitch };
  });

  // ── WebGL Yield Curve Renderer ──
  const gl = ycCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) { console.warn('WebGL not supported for yield curve'); return; }

  // Chart margins (normalized 0-1)
  const ML = 0.08, MR = 0.06, MT = 0.08, MB = 0.14;

  // Generate curve points (500 samples for ultra-smooth)
  const SAMPLES = 500;
  const curveVerts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const day = (i / SAMPLES) * TOTAL_DAYS;
    const r = ratioAtDay(day);
    const x = ML + (day / TOTAL_DAYS) * (1 - ML - MR);
    const y = MB + ((r - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * (1 - MB - MT);
    curveVerts.push(x, y);
  }

  // Grid lines
  const gridVerts = [];
  // Horizontal grid at each yStep
  ySteps.forEach(v => {
    const y = MB + ((v - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * (1 - MB - MT);
    gridVerts.push(ML, y, 1 - MR, y);
  });
  // Vertical grid at month ticks
  monthTicks.forEach(t => {
    const x = ML + (t.day / TOTAL_DAYS) * (1 - ML - MR);
    gridVerts.push(x, MB, x, 1 - MT);
  });

  // ── Shader compilation helpers ──
  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return p;
  }

  // Grid shader
  const gridVS = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const gridFS = `
    precision mediump float;
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 0.07);
    }`;
  const gridProg = linkProgram(
    compileShader(gridVS, gl.VERTEX_SHADER),
    compileShader(gridFS, gl.FRAGMENT_SHADER)
  );
  const gridPosLoc = gl.getAttribLocation(gridProg, 'a_pos');
  const gridBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVerts), gl.STATIC_DRAW);

  // ── Curve shader: pulsing glowing blue trace ──
  const curveVS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos;
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const curveFS = `
    precision mediump float;
    uniform float u_drawPct;
    uniform float u_time;
    uniform float u_headX;
    varying vec2 v_uv;
    void main() {
      // Pulsing glow along the drawn portion
      float glow = 0.80 + 0.20 * sin(u_time * 2.5 + v_uv.x * 14.0);
      // Bright head bloom: intensify near the drawing tip
      float headDist = abs(v_uv.x - u_headX);
      float headBloom = smoothstep(0.06, 0.0, headDist) * 0.6;
      float brightness = glow + headBloom;
      gl_FragColor = vec4(0.0, 0.32 * brightness, 1.0 * brightness, 1.0);
    }`;
  const curveProg = linkProgram(
    compileShader(curveVS, gl.VERTEX_SHADER),
    compileShader(curveFS, gl.FRAGMENT_SHADER)
  );
  const curvePosLoc = gl.getAttribLocation(curveProg, 'a_pos');
  const uDrawPct = gl.getUniformLocation(curveProg, 'u_drawPct');
  const uTime = gl.getUniformLocation(curveProg, 'u_time');
  const uHeadX = gl.getUniformLocation(curveProg, 'u_headX');
  const curveBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(curveVerts), gl.STATIC_DRAW);

  // ── Glow pass: wider, softer bloom line ──
  const glowFS = `
    precision mediump float;
    uniform float u_time;
    uniform float u_headX;
    varying vec2 v_uv;
    void main() {
      float pulse = 0.6 + 0.4 * sin(u_time * 1.5 + v_uv.x * 8.0);
      float headDist = abs(v_uv.x - u_headX);
      float headBloom = smoothstep(0.08, 0.0, headDist) * 0.5;
      float a = (0.30 + headBloom) * pulse;
      gl_FragColor = vec4(0.0, 0.22 * pulse, 0.85 * pulse, a);
    }`;
  const glowProg = linkProgram(
    compileShader(curveVS, gl.VERTEX_SHADER),
    compileShader(glowFS, gl.FRAGMENT_SHADER)
  );
  const glowPosLoc = gl.getAttribLocation(glowProg, 'a_pos');
  const uGlowTime = gl.getUniformLocation(glowProg, 'u_time');
  const uGlowHeadX = gl.getUniformLocation(glowProg, 'u_headX');

  // ── Fill gradient under curve ──
  function buildFillVerts(count) {
    const verts = [];
    for (let i = 0; i <= count && i <= SAMPLES; i++) {
      const x = curveVerts[i * 2];
      const y = curveVerts[i * 2 + 1];
      verts.push(x, y);
      verts.push(x, MB);
    }
    return new Float32Array(verts);
  }
  const fillBuf = gl.createBuffer();
  const fillVS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos;
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const fillFS = `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_top;
    void main() {
      float h = (v_uv.y - ${MB.toFixed(4)}) / (u_top - ${MB.toFixed(4)});
      float alpha = h * 0.15;
      gl_FragColor = vec4(0.0, 0.22, 1.0, alpha);
    }`;
  const fillProg = linkProgram(
    compileShader(fillVS, gl.VERTEX_SHADER),
    compileShader(fillFS, gl.FRAGMENT_SHADER)
  );
  const fillPosLoc = gl.getAttribLocation(fillProg, 'a_pos');
  const uFillTop = gl.getUniformLocation(fillProg, 'u_top');

  // ── Dot at curve head (leading indicator) ──
  const dotVS = `
    attribute vec2 a_pos;
    uniform float u_pointSize;
    void main() {
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
      gl_PointSize = u_pointSize;
    }`;
  const dotFS = `
    precision mediump float;
    uniform float u_time;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float pulse = 0.7 + 0.3 * sin(u_time * 4.0);
      float glow = smoothstep(0.5, 0.15, dist) * pulse;
      gl_FragColor = vec4(0.15 * glow, 0.55 * glow, 1.0 * glow, glow);
    }`;
  const dotProg = linkProgram(
    compileShader(dotVS, gl.VERTEX_SHADER),
    compileShader(dotFS, gl.FRAGMENT_SHADER)
  );
  const dotPosLoc = gl.getAttribLocation(dotProg, 'a_pos');
  const uDotPointSize = gl.getUniformLocation(dotProg, 'u_pointSize');
  const uDotTime = gl.getUniformLocation(dotProg, 'u_time');
  const dotBuf = gl.createBuffer();

  // ── Volatile token price — Candlestick chart (behind yield curve) ──
  const VOL_DAYS = TOTAL_DAYS;
  const dailyPrice = new Float32Array(VOL_DAYS + 1);
  dailyPrice[0] = 0.45;
  function volSrand(s) { let x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  const volTrends = [0.006, -0.005, 0.008, -0.004, 0.005, 0.003, -0.003, 0.004, 0.002];
  const volSegLen = VOL_DAYS / volTrends.length;
  for (let i = 1; i <= VOL_DAYS; i++) {
    const seg = Math.min(volTrends.length - 1, Math.floor(i / volSegLen));
    const noise = (volSrand(i * 3.7) - 0.5) * 0.04;
    dailyPrice[i] = Math.max(0.08, Math.min(0.92, dailyPrice[i - 1] + volTrends[seg] + noise));
  }

  // Group into candles (5-day periods)
  const CANDLE_PERIOD = 5;
  const NUM_CANDLES = Math.ceil(VOL_DAYS / CANDLE_PERIOD);
  const candles = [];
  for (let c = 0; c < NUM_CANDLES; c++) {
    const dStart = c * CANDLE_PERIOD;
    const dEnd = Math.min((c + 1) * CANDLE_PERIOD, VOL_DAYS);
    const open = dailyPrice[dStart];
    const close = dailyPrice[dEnd];
    let high = -Infinity, low = Infinity;
    for (let d = dStart; d <= dEnd; d++) {
      if (dailyPrice[d] > high) high = dailyPrice[d];
      if (dailyPrice[d] < low) low = dailyPrice[d];
    }
    candles.push({ open, close, high, low, dayStart: dStart, dayEnd: dEnd, bullish: close >= open });
  }

  function priceToY(p) {
    const yNorm = p * 0.55 + 0.05;
    return MB + yNorm * (1 - MB - MT);
  }
  function dayToX(d) {
    return ML + (d / TOTAL_DAYS) * (1 - ML - MR);
  }

  // Build candle geometry
  const candleBodyVerts = [];
  const candleWickVerts = [];
  const chartW = 1 - ML - MR;
  const candleWidth = (chartW / NUM_CANDLES) * 0.65;
  const wickWidth = candleWidth * 0.12;
  candles.forEach(c => {
    const cx = dayToX((c.dayStart + c.dayEnd) / 2);
    const halfW = candleWidth / 2;
    const halfWick = wickWidth / 2;
    const yOpen = priceToY(c.open);
    const yClose = priceToY(c.close);
    const yHigh = priceToY(c.high);
    const yLow = priceToY(c.low);
    const bodyTop = Math.max(yOpen, yClose);
    const bodyBot = Math.min(yOpen, yClose);
    const minBody = 0.002;
    const adjTop = bodyTop - bodyBot < minBody ? bodyBot + minBody : bodyTop;
    const r = c.bullish ? 0.13 : 0.94;
    const g = c.bullish ? 0.77 : 0.27;
    const b = c.bullish ? 0.37 : 0.27;
    candleBodyVerts.push(cx - halfW, bodyBot, r, g, b);
    candleBodyVerts.push(cx + halfW, bodyBot, r, g, b);
    candleBodyVerts.push(cx - halfW, adjTop, r, g, b);
    candleBodyVerts.push(cx + halfW, bodyBot, r, g, b);
    candleBodyVerts.push(cx + halfW, adjTop, r, g, b);
    candleBodyVerts.push(cx - halfW, adjTop, r, g, b);
    const wr = r * 0.7, wg = g * 0.7, wb = b * 0.7;
    candleWickVerts.push(cx - halfWick, yLow, wr, wg, wb);
    candleWickVerts.push(cx + halfWick, yLow, wr, wg, wb);
    candleWickVerts.push(cx - halfWick, yHigh, wr, wg, wb);
    candleWickVerts.push(cx + halfWick, yLow, wr, wg, wb);
    candleWickVerts.push(cx + halfWick, yHigh, wr, wg, wb);
    candleWickVerts.push(cx - halfWick, yHigh, wr, wg, wb);
  });

  const candleVS = `
    attribute vec2 a_pos;
    attribute vec3 a_color;
    varying vec3 v_color;
    void main() {
      v_color = a_color;
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const candleFS = `
    precision mediump float;
    uniform float u_alpha;
    varying vec3 v_color;
    void main() {
      gl_FragColor = vec4(v_color, 0.75 * u_alpha);
    }`;
  const candleProg = linkProgram(
    compileShader(candleVS, gl.VERTEX_SHADER),
    compileShader(candleFS, gl.FRAGMENT_SHADER)
  );
  const candlePosLoc = gl.getAttribLocation(candleProg, 'a_pos');
  const candleColorLoc = gl.getAttribLocation(candleProg, 'a_color');
  const uCandleAlpha = gl.getUniformLocation(candleProg, 'u_alpha');

  const bodyData = new Float32Array(candleBodyVerts);
  const wickData = new Float32Array(candleWickVerts);
  const bodyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, bodyData, gl.STATIC_DRAW);
  const wickBufGL = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, wickBufGL);
  gl.bufferData(gl.ARRAY_BUFFER, wickData, gl.STATIC_DRAW);

  const VERTS_PER_CANDLE = 6;
  const STRIDE = 5 * 4;

  // Volume bars
  const VOL_BAR_PERIOD = 5;
  const NUM_VOL_BARS = NUM_CANDLES;
  const volumeData = new Float32Array(NUM_VOL_BARS);
  for (let i = 0; i < NUM_VOL_BARS; i++) {
    const dStart = i * VOL_BAR_PERIOD;
    const dEnd = Math.min((i + 1) * VOL_BAR_PERIOD, VOL_DAYS);
    let maxSwing = 0;
    for (let d = dStart; d < dEnd && d <= VOL_DAYS; d++) {
      if (d > 0) maxSwing = Math.max(maxSwing, Math.abs(dailyPrice[d] - dailyPrice[d - 1]));
    }
    const baseVol = 0.2 + volSrand(i * 7.3 + 42) * 0.5;
    const volSpike = maxSwing > 0.02 ? 1.5 : 1.0;
    volumeData[i] = Math.min(1.0, baseVol * volSpike + volSrand(i * 11.1) * 0.3);
  }
  const volBarVerts = [];
  const volBarHeight = (1 - MB - MT) * 0.18;
  const volBarWidth = (chartW / NUM_VOL_BARS) * 0.7;
  for (let i = 0; i < NUM_VOL_BARS; i++) {
    const cx = dayToX((i + 0.5) * VOL_BAR_PERIOD);
    const halfW = volBarWidth / 2;
    const barTop = MB + volumeData[i] * volBarHeight;
    const barBot = MB;
    const isBullish = candles[i] && candles[i].bullish;
    const r = isBullish ? 0.08 : 0.50;
    const g = isBullish ? 0.40 : 0.14;
    const b = isBullish ? 0.25 : 0.14;
    volBarVerts.push(cx - halfW, barBot, r, g, b);
    volBarVerts.push(cx + halfW, barBot, r, g, b);
    volBarVerts.push(cx - halfW, barTop, r, g, b);
    volBarVerts.push(cx + halfW, barBot, r, g, b);
    volBarVerts.push(cx + halfW, barTop, r, g, b);
    volBarVerts.push(cx - halfW, barTop, r, g, b);
  }
  const volBarData = new Float32Array(volBarVerts);
  const volBarBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, volBarBuf);
  gl.bufferData(gl.ARRAY_BUFFER, volBarData, gl.STATIC_DRAW);
  const VERTS_PER_VOL_BAR = 6;

  // State
  let volDrawProgress = 0;
  let volAlpha = 0;
  let drawProgress = 0;
  let displayedRatio = 1.0;
  let animTime = 0;
  let isActive = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = ycCanvas.getBoundingClientRect();
    ycCanvas.width = rect.width * dpr;
    ycCanvas.height = rect.height * dpr;
    gl.viewport(0, 0, ycCanvas.width, ycCanvas.height);
  }

  function render() {
    if (!isActive) return;
    animTime += 0.016;

    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 1. Grid
    gl.useProgram(gridProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.enableVertexAttribArray(gridPosLoc);
    gl.vertexAttribPointer(gridPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, gridVerts.length / 2);

    const drawCount = Math.floor(drawProgress * SAMPLES) + 1;
    // Head position (normalized x of the tip)
    const headX = drawCount > 0 ? curveVerts[(drawCount - 1) * 2] : ML;

    // 1.5 Volume bars
    if (volAlpha > 0.01 && volDrawProgress > 0) {
      const visibleVolBars = Math.floor(volDrawProgress * NUM_VOL_BARS);
      if (visibleVolBars > 0) {
        gl.useProgram(candleProg);
        gl.uniform1f(uCandleAlpha, volAlpha * 0.7);
        gl.bindBuffer(gl.ARRAY_BUFFER, volBarBuf);
        gl.enableVertexAttribArray(candlePosLoc);
        gl.vertexAttribPointer(candlePosLoc, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(candleColorLoc);
        gl.vertexAttribPointer(candleColorLoc, 3, gl.FLOAT, false, STRIDE, 2 * 4);
        gl.drawArrays(gl.TRIANGLES, 0, visibleVolBars * VERTS_PER_VOL_BAR);
      }
    }

    // 2. Candlestick chart
    if (volAlpha > 0.01 && volDrawProgress > 0) {
      const visibleCandles = Math.floor(volDrawProgress * NUM_CANDLES);
      if (visibleCandles > 0) {
        gl.useProgram(candleProg);
        gl.uniform1f(uCandleAlpha, volAlpha);
        gl.bindBuffer(gl.ARRAY_BUFFER, wickBufGL);
        gl.enableVertexAttribArray(candlePosLoc);
        gl.vertexAttribPointer(candlePosLoc, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(candleColorLoc);
        gl.vertexAttribPointer(candleColorLoc, 3, gl.FLOAT, false, STRIDE, 2 * 4);
        gl.drawArrays(gl.TRIANGLES, 0, visibleCandles * VERTS_PER_CANDLE);
        gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuf);
        gl.enableVertexAttribArray(candlePosLoc);
        gl.vertexAttribPointer(candlePosLoc, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(candleColorLoc);
        gl.vertexAttribPointer(candleColorLoc, 3, gl.FLOAT, false, STRIDE, 2 * 4);
        gl.drawArrays(gl.TRIANGLES, 0, visibleCandles * VERTS_PER_CANDLE);
      }
    }

    // 3. Fill under curve
    if (drawCount > 1) {
      const fv = buildFillVerts(drawCount);
      gl.useProgram(fillProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, fillBuf);
      gl.bufferData(gl.ARRAY_BUFFER, fv, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(fillPosLoc);
      gl.vertexAttribPointer(fillPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uFillTop, curveVerts[drawCount * 2 + 1] || 1.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, fv.length / 2);
    }

    // 4. Glow pass (wide bloom line)
    gl.useProgram(glowProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
    gl.enableVertexAttribArray(glowPosLoc);
    gl.vertexAttribPointer(glowPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uGlowTime, animTime);
    gl.uniform1f(uGlowHeadX, headX);
    gl.lineWidth(Math.min(4, gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1]));
    gl.drawArrays(gl.LINE_STRIP, 0, drawCount);

    // 5. Main curve (bright thin line)
    gl.useProgram(curveProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
    gl.enableVertexAttribArray(curvePosLoc);
    gl.vertexAttribPointer(curvePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uDrawPct, drawProgress);
    gl.uniform1f(uTime, animTime);
    gl.uniform1f(uHeadX, headX);
    gl.lineWidth(Math.min(2, gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1]));
    gl.drawArrays(gl.LINE_STRIP, 0, drawCount);

    // 6. Glowing dot at curve head
    if (drawCount > 1 && drawProgress > 0.01 && drawProgress < 0.99) {
      const hx = curveVerts[(drawCount - 1) * 2];
      const hy = curveVerts[(drawCount - 1) * 2 + 1];
      gl.useProgram(dotProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([hx, hy]), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(dotPosLoc);
      gl.vertexAttribPointer(dotPosLoc, 2, gl.FLOAT, false, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.uniform1f(uDotPointSize, 14.0 * dpr);
      gl.uniform1f(uDotTime, animTime);
      gl.drawArrays(gl.POINTS, 0, 1);
    }

    requestAnimationFrame(render);
  }

  // ── Milestone callout positioning ──
  function positionCallouts() {
    const rect = ycCanvas.getBoundingClientRect();
    const wrapRect = ycWrap.getBoundingClientRect();
    calloutData.forEach(ms => {
      const xNorm = ML + (ms.day / TOTAL_DAYS) * (1 - ML - MR);
      const r = ratioAtDay(ms.day);
      const yNorm = MB + ((r - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * (1 - MB - MT);
      const px = rect.left - wrapRect.left + xNorm * rect.width;
      const py = rect.top - wrapRect.top + (1 - yNorm) * rect.height;
      const cappedPx = Math.min(px, wrapRect.width - 10);
      ms.el.style.left = `${cappedPx}px`;
      ms.el.style.bottom = `${wrapRect.height - py + 4}px`;
      const card = ms.el.querySelector('.yc-callout-card');
      if (card) {
        const edgeSpace = wrapRect.width - cappedPx;
        if (edgeSpace < 60) {
          card.style.transform = 'translateX(-100%)';
          card.style.marginLeft = '0';
        } else if (edgeSpace < 140) {
          card.style.transform = 'translateX(-85%)';
          card.style.marginLeft = '30%';
        } else {
          card.style.transform = 'translateX(-50%)';
          card.style.marginLeft = '50%';
        }
      }
    });
  }

  // ── ScrollTrigger ──
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onEnter: () => { isActive = true; requestAnimationFrame(render); },
    onLeave: () => { isActive = false; },
    onEnterBack: () => { isActive = true; requestAnimationFrame(render); },
    onLeaveBack: () => { isActive = false; },
    onUpdate: (self) => {
      const p = self.progress;
      // Audio (non-DOM)
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.50, 0.86, 0.96], [0.02, 0.06, 0.08, 0.06, 0.02]));

      // Compute all values
      // Scene-pin opacity: opens at 0.00 (was 0.06) to receive the token→accrue
      // handoff cleanly. Token's sceneExit now ends at 1.00 so there's no dark
      // frame between them.
      const sceneOp = multiMapSmooth(p, [0, 0.03, 0.93, 0.99], [0, 1, 1, 0]);
      // Intro + ratio: easeOutCubic arrival gives a confident settle instead
      // of the symmetric smoothstep tween. Stops pushed slightly later
      // (0.04–0.14 / 0.06–0.16) so accrue's opening is a gentle arrival
      // rather than already being fully on at scroll-start.
      const introOp = multiMapEased(p, [0.04, 0.14, 0.76, 0.82], [0, 1, 1, 0], easeOutCubic);
      const ratioOp = multiMapEased(p, [0.06, 0.16, 0.76, 0.82], [0, 1, 1, 0], easeOutCubic);
      const pairOp = multiMapSmooth(p, [0.10, 0.20], [0, 1]);
      const clockOp = multiMapSmooth(p, [0.18, 0.26, 0.76, 0.82], [0, 1, 1, 0]);
      const ycOp = multiMapSmooth(p, [0.22, 0.32, 0.90, 0.97], [0, 1, 1, 0]);
      // TOKEN → ACCRUE handoff: yc-axis-y should appear earlier as a
      // faint vertical ghost so the incoming token-line stub has a
      // successor visible at p≈0 (avoiding a cold reset of the spine).
      const ycAxisEarly = multiMapSmooth(p, [0.00, 0.10, 0.22, 0.32], [0.4, 0.5, 0.7, 1.0]);
      const statsOp = multiMapSmooth(p, [0.38, 0.48, 0.72, 0.80], [0, 1, 1, 0]);
      const eqOp = multiMapSmooth(p, [0.38, 0.48, 0.72, 0.80], [0, 1, 1, 0]);
      const _volAlpha = multiMapSmooth(p, [0.22, 0.30, 0.90, 0.96], [0, 1, 1, 0]);
      const _volDraw = Math.max(0, Math.min(1, multiMapSmooth(p, [0.22, 0.75], [0, 1])));
      const curveP = mapRange(p, 0.28, 0.78, 0, 1);
      const _drawProg = Math.max(0, Math.min(1, curveP));
      const dayFloat = _drawProg * TOTAL_DAYS;
      const currentDay = Math.round(Math.max(0, Math.min(TOTAL_DAYS, dayFloat)));
      const date = new Date(VAULT_LAUNCH);
      date.setDate(date.getDate() + currentDay);
      const dateStr = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
      const clampedRatio = ratioAtDay(currentDay);
      displayedRatio += (clampedRatio - displayedRatio) * 0.12;
      if (Math.abs(displayedRatio - clampedRatio) < 0.0001) displayedRatio = clampedRatio;
      const apy = apyAtDay(currentDay);
      // Closing vol narrative — widened hold so the closing beat reads.
      const volNarrOp = multiMapSmooth(p, [0.72, 0.79, 0.93, 0.985], [0, 1, 1, 0]);
      const volHeadOp = multiMapSmooth(p, [0.72, 0.79, 0.93, 0.985], [0, 1, 1, 0]);
      const volSubOp  = multiMapSmooth(p, [0.76, 0.82, 0.93, 0.985], [0, 1, 1, 0]);

      // Audio: chimes for callouts (non-DOM)
      calloutData.forEach(ms => {
        const wasActive = ms.el.classList.contains('active');
        if (currentDay >= ms.day && !wasActive && !ms.chimed) {
          AudioEngine.playChime(ms.pitch);
          ms.chimed = true;
        }
        if (currentDay < ms.day) ms.chimed = false;
      });

      // Batch DOM writes
      WriteBatch.write(() => {
        volAlpha = _volAlpha;
        volDrawProgress = _volDraw;
        drawProgress = _drawProg;

        section.querySelector('.scene-pin').style.opacity = sceneOp;

        // ── ACCRUE → CCA EXIT: LATERAL ROUTING + DIAGONAL PEEL ──
        // DIRECTIONAL OVERRIDE (boundary 3 = Accrue → CCA):
        //   Brief mandates "lateral routing / diagonal peel / accumulated
        //   value is now routed outward." Prior version used opacity-only
        //   fades on every panel + an inward scale on the ratio display —
        //   no element actually MOVED outward, so the boundary read as a
        //   stationary fade.
        //
        //   New behavior (each component family exits in a different way):
        //     • intro (left text)         → peels diagonally LEFT-DOWN (−18, +12)
        //                                    fades into low-emphasis background
        //     • stats (right panel)       → routes laterally RIGHT (+34px)
        //                                    "the measured value is routed out"
        //     • equation (caption)        → peels diagonally RIGHT-DOWN (+22, +8)
        //                                    follows stats out, slightly delayed
        //     • clock (timestamp pill)    → fade-in-place + tiny scale-down
        //                                    (anchored timestamp, no travel)
        //     • ycWrap (yield curve)      → redirects RIGHT (+28px) + slight
        //                                    scale 1→0.96 — curve logic flows
        //                                    laterally toward distribution
        //     • ratioDisplay              → inward scale-compress (kept) but
        //                                    no Y travel (still anti-upward)
        //     • vol* narrative (closing)  → fade-in-place
        //   This produces a multi-direction exit: 2 lateral-right (stats,
        //   ycWrap), 2 diagonal-down (equation, intro), 2 in-place (clock,
        //   ratio, vol). NO upward translation anywhere.
        const accrueExitRaw = Math.max(0, Math.min(1, (p - 0.78) / (0.96 - 0.78)));
        const accrueExitT   = easeOutCubic(accrueExitRaw);

        // VIEWPORT-SCALED TRAVEL: narrow viewports (320–768px) clamp the peel
        // distances so the outward-routing motion can't push elements past the
        // viewport edge while they're still visible. Desktop (≥900px) keeps
        // the full editorial travel; at 320px the scale is ~0.36 which keeps
        // every routed element safely inside the frame before opacity → 0.
        const accrueExitVw = Math.min(1, window.innerWidth / 900);

        intro.style.opacity = introOp;
        if (intro) {
          // diagonal peel LEFT-DOWN — routes the framing copy out of frame
          // toward the lower-left, matching CCA's incoming-from-right entry.
          const introX = accrueExitT * -18 * accrueExitVw;
          const introY = accrueExitT *  12 * accrueExitVw;
          intro.style.transform = `translate(${introX}px, ${introY}px)`;
        }

        if (ratioDisplay) ratioDisplay.style.opacity = ratioOp;
        // Gate the equation-underline pair on isActive so it doesn't bleed
        // into the close chapter as a ghost horizontal line at y≈296.
        if (pair) pair.style.opacity = self.isActive ? pairOp : 0;

        clock.style.opacity = clockOp;
        if (clock) {
          // Fade-in-place + tiny anchored scale-down. Timestamp stays put;
          // the consequence (CCA distribution) inherits the anchor.
          const clockScale = 1 - accrueExitT * 0.06;
          clock.style.transform = `scale(${clockScale})`;
        }

        if (ycWrap) {
          ycWrap.style.opacity = ycOp;
          // LATERAL ROUTE RIGHT: yield curve redirects toward the side where
          // CCA's distribution structure will materialize. +28px is enough
          // to read as motion without overshooting. Scaled by viewport width
          // so narrow screens (320px) don't route past the right edge.
          const ycRouteX = accrueExitT * 28 * accrueExitVw;
          const ycScale  = 1 - accrueExitT * 0.04;
          ycWrap.style.transform = `translateX(${ycRouteX}px) scale(${ycScale})`;
        }
        if (ycAxisY) ycAxisY.style.opacity = Math.max(ycOp, ycAxisEarly * 0.55);

        stats.style.opacity = statsOp;
        if (stats) {
          // LATERAL ROUTE RIGHT — stats panel migrates outward, completing
          // the "value is routed outward" sentence. Slight scale-down for
          // depth feel. Viewport-scaled so narrow screens stay in-frame.
          const statsX = accrueExitT * 34 * accrueExitVw;
          const statsScale = 1 - accrueExitT * 0.05;
          stats.style.transform = `translateX(${statsX}px) scale(${statsScale})`;
        }

        // ACCRUE → CCA handoff: ratio display compresses INWARD (scale only,
        // no Y travel). Reads as 'the measured value is absorbed/condensed
        // into the next scene' — a counterpoint to the lateral-routing
        // siblings, providing variety within the boundary itself.
        if (p > 0.90 && ratioDisplay) {
          const exitRaw = Math.max(0, Math.min(1, (p - 0.90) / 0.10));
          const exitP = easeOutCubic(exitRaw);
          ratioDisplay.style.transform = `translateY(0) scale(${1 - exitP * 0.28})`;
          Continuity.setBridge('accrueRatioCompress', exitP);
        } else if (ratioDisplay) {
          ratioDisplay.style.transform = 'translateY(0) scale(1)';
        }
        if (equation) {
          equation.style.opacity = eqOp;
          // diagonal peel RIGHT-DOWN — follows stats out (slightly less
          // travel so it trails behind, reads as a related secondary motion).
          // Viewport-scaled so narrow screens stay in-frame.
          // CRITICAL: .accrue-equation is absolutely positioned with
          // `left: 50%; transform: translateX(-50%)` for centering. Our inline
          // transform must PRESERVE that -50% X component or the element
          // becomes left-anchored and spills off the right edge on narrow
          // viewports (mobile bug on 320px).
          const eqX = accrueExitT * 22 * accrueExitVw;
          const eqY = accrueExitT *  8 * accrueExitVw;
          equation.style.transform = `translate(calc(-50% + ${eqX}px), ${eqY}px)`;
        }

        clockDate.textContent = dateStr;
        statDays.textContent = currentDay;
        statRatio.textContent = displayedRatio.toFixed(3);
        statApy.textContent = `${apy.toFixed(1)}%`;
        if (equation) equation.textContent = `1 ■AKITA = ${displayedRatio.toFixed(3)} AKITA`;
        if (ratioValue) ratioValue.textContent = displayedRatio.toFixed(3);

        positionCallouts();
        calloutData.forEach(ms => {
          if (currentDay >= ms.day) ms.el.classList.add('active');
          else ms.el.classList.remove('active');
        });

        if (volNarrative) volNarrative.style.opacity = volNarrOp;
        if (volHeadline) volHeadline.style.opacity = volHeadOp;
        if (volSub) volSub.style.opacity = volSubOp;

        // ── Persistent pair continuity across accrue ──
        // Phase 1 (0.00–0.18): inherit 'tokenEnd' pose and ease toward
        //   'accrue' pose — pair widens to flank the ratio display.
        // Phase 2 (0.20–0.80): HOLD accrue flanks, but add subtle breathing
        //   motion so the viewer perceives the pair as LIVE, not frozen stage
        //   props. Tiny sinusoidal drift + scale oscillation synced to the
        //   yield-curve drawing phase.
        // Phase 3 (0.80–0.98): pair collapses toward CCA center, underlying
        //   fades as it recedes behind the share (CCA protagonist).
        let pairPose;
        let pairFloatOp;
        if (p < 0.20) {
          const t = multiMapSmooth(p, [0.00, 0.20], [0, 1]);
          pairPose = Continuity.lerpPose('tokenEnd', 'accrue', t);
          pairFloatOp = multiMapSmooth(p, [0.00, 0.06], [1, 1]);
        } else if (p < 0.80) {
          pairPose = { ...Continuity.poses.accrue };
          pairFloatOp = multiMapSmooth(p, [0.72, 0.82], [1, 0.85]);
        } else {
          const t = multiMapSmooth(p, [0.80, 0.98], [0, 1]);
          pairPose = Continuity.lerpPose('accrue', 'ccaStart', t);
          pairFloatOp = 1;
        }
        // Subtle 'alive' breathing — 1.5px drift + ±1.5% scale oscillation,
        // centered on the held pose. Keeps perceptual continuity while the
        // yield curve draws; viewer never reads the pair as a static prop.
        {
          const breathP = self.progress;
          const phase = breathP * Math.PI * 6; // ~3 full cycles across chapter
          const drift = Math.sin(phase) * 1.5;
          const scaleOsc = 1 + Math.sin(phase * 1.3) * 0.015;
          pairPose = {
            ...pairPose,
            shareX: pairPose.shareX + drift,
            shareY: pairPose.shareY - Math.cos(phase) * 1.2,
            shareScale: pairPose.shareScale * scaleOsc,
            underX: pairPose.underX - drift,
            underY: pairPose.underY - Math.cos(phase * 0.9) * 1.2,
            underScale: pairPose.underScale * (1 + Math.sin(phase * 1.1) * 0.015),
          };
        }
        Continuity.setLive(pairPose);
        // PAIR BAN — accrue is NOT in PAIR_ALLOWED. Force-hide so the global
        // pair does not carry through as backbone continuity. Non-token
        // handoffs (line→axis/dividers, details→ratio+stats, equation, curve)
        // do the work. We keep `pairFloatOp`/`pairPose` computed above so
        // bridge math downstream (setLive) still works.
        void pairFloatOp; void floatContainerA; void floatShareA; void floatUnderA;
        if (self.isActive) Continuity.hidePair();
      });
    }
  });
})();

// ────────────────────────────────────────────
// 8.5. CHAPTER 3.5: CCA — SHARE TOKEN DISTRIBUTION (700vh)
// Centered node graph: ■AKITA share token → 3 CCA distribution cards
// Uses same dynamic edge system as strategy graph
// ────────────────────────────────────────────
(function chapterCCA() {
  const section = document.getElementById('ch-cca');
  if (!section) return;

  const camera = document.getElementById('cca-camera');
  const depositCoin = document.getElementById('cca-deposit-coin');
  const shareToken = document.getElementById('cca-share-token');
  const shareLabel = document.getElementById('cca-share-label');
  const intro = document.getElementById('cca-intro');
  const nodeGraph = document.getElementById('cca-node-graph');
  const ccaEdgesSvg = document.getElementById('cca-edges-svg');
  const cardAuction = document.getElementById('cca-card-auction');
  const cardVesting = document.getElementById('cca-card-vesting');
  const cardLiquidity = document.getElementById('cca-card-liquidity');
  const summary = document.getElementById('cca-summary');

  // ── Persistent pair handles (inherited from accrue, forwarded to dual) ──
  const floatContainerC = document.getElementById('float-tokens');
  const floatShareC     = document.getElementById('float-share');
  const floatUnderC     = document.getElementById('float-underlying');


  // ── CCA dynamic edge system (FLIPPED: token right → cards left) ──
  const ccaEdgePairs = [
    { base: 'cca-edge-token-auction',   dash: 'cca-dash-token-auction',   from: 'cca-ng-token', to: 'cca-card-auction' },
    { base: 'cca-edge-token-vesting',   dash: 'cca-dash-token-vesting',   from: 'cca-ng-token', to: 'cca-card-vesting' },
    { base: 'cca-edge-token-liquidity', dash: 'cca-dash-token-liquidity', from: 'cca-ng-token', to: 'cca-card-liquidity' },
  ];

  function computeCCAEdgePaths() {
    if (!nodeGraph || !ccaEdgesSvg) return;
    const ngRect = nodeGraph.getBoundingClientRect();
    ccaEdgesSvg.setAttribute('viewBox', `0 0 ${ngRect.width} ${ngRect.height}`);

    for (const ep of ccaEdgePairs) {
      const fromEl = document.getElementById(ep.from);
      const toEl = document.getElementById(ep.to);
      const basePath = document.getElementById(ep.base);
      const dashPath = document.getElementById(ep.dash);
      if (!fromEl || !toEl || !basePath) continue;

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();

      // Flipped: edge from token LEFT side → card RIGHT side
      const x1 = fr.left - ngRect.left;
      const y1 = fr.top + fr.height / 2 - ngRect.top;
      const x2 = tr.right - ngRect.left;
      const y2 = tr.top + tr.height / 2 - ngRect.top;

      const dx = Math.abs(x1 - x2);
      const cx1 = x1 - dx * 0.45;
      const cx2 = x2 + dx * 0.45;

      const d = `M ${x1.toFixed(1)},${y1.toFixed(1)} C ${cx1.toFixed(1)},${y1.toFixed(1)} ${cx2.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      basePath.setAttribute('d', d);
      if (dashPath) dashPath.setAttribute('d', d);
    }
  }
  window.computeCCAEdgePaths = computeCCAEdgePaths;

  let ccaEdgesComputed = false;
  window.addEventListener('resize', () => { ccaEdgesComputed = false; });

  let ccaChimePlayed = false;

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 768;
      const iconHalf = isMobile ? 38 : 48;
      const centerY = vh / 2 - iconHalf;
      const centerX = vw / 2;

      // Audio
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.08, 0.60, 0.90], [0.02, 0.06, 0.06, 0.01]));
      if (p >= 0.14 && p <= 0.16 && !ccaChimePlayed) { AudioEngine.playChime(1.2); ccaChimePlayed = true; }
      if (p < 0.10 || p > 0.24) ccaChimePlayed = false;

      // Scene
      const sceneOp = multiMapSmooth(p, [0, 0.06, 0.90, 0.97], [0, 1, 1, 0]);

      // Deposited asset (AKITA source) — appears then fades
      const coinOp = multiMapSmooth(p, [0.02, 0.06, 0.10, 0.18], [0, 1, 0.6, 0]);
      const coinScale = multiMapSmooth(p, [0.02, 0.06, 0.10, 0.18], [1, 1, 0.7, 0.5]);
      const coinTx = `translate(${centerX}px, ${centerY}px) translate(-50%, 0) scale(${coinScale})`;
      const coinZ = Math.round(multiMapSmooth(p, [0.08, 0.14], [3, 1]));

      // Share token — appears center, then FLIP-TRANSLATES to the
      // #cca-ng-token slot on the right side of the node-graph so the
      // intro AKITA card visually BECOMES the graph's anchor node rather
      // than fading out and having a different node pop in.
      // Window map:
      //   0.04–0.18  — fade-in + scale-up at center (unchanged)
      //   0.18–0.28  — hold at center (intro read)
      //   0.28–0.42  — FLIP to ng-token slot (translateX + scale match),
      //                opacity stays at 1 so we SEE the card travel
      //   0.42+      — fade out quickly while #cca-ng-token takes over
      //                at the same coordinates
      const shareOp = multiMapSmooth(p, [0.04, 0.10, 0.18, 0.42, 0.48], [0, 0.5, 1, 1, 0]);
      const shareScale = multiMapSmooth(p, [0.04, 0.10, 0.18, 0.28, 0.42], [0.5, 0.75, 1, 1, 0.7]);
      // FLIP-to-ng-token travel: 0 at center, 1 at ng-token target slot.
      // easeOutCubic so the card arrives confidently at its final home.
      const shareFlipT = easeOutCubic(Math.max(0, Math.min(1, (p - 0.28) / (0.42 - 0.28))));
      // Compute live target position of #cca-ng-token so the FLIP lands
      // exactly on top of it regardless of viewport width. Read lazily.
      let shareTargetX = centerX;
      let shareTargetY = centerY;
      const ngTokenEl = document.getElementById('cca-ng-token');
      if (ngTokenEl && shareFlipT > 0.001) {
        const r = ngTokenEl.getBoundingClientRect();
        shareTargetX = r.left + r.width / 2;
        shareTargetY = r.top + r.height / 2 - iconHalf; // match original -50% y baseline
      }
      const shareCurX = centerX + (shareTargetX - centerX) * shareFlipT;
      const shareCurY = centerY + (shareTargetY - centerY) * shareFlipT;
      const shareTx = `translate(${shareCurX}px, ${shareCurY}px) translate(-50%, 0) scale(${shareScale})`;
      const shareZ = Math.round(multiMapSmooth(p, [0.08, 0.14], [1, 4]));
      const shareLabelOp = multiMapSmooth(p, [0.14, 0.20, 0.28, 0.32], [0, 1, 1, 0]);

      // Intro text — widened hold so "What happens with ■AKITA?" stays
      // readable while the reader scrolls through the intro beat.
      // POLISH (Accrue → CCA): intro inherits the accrue-ratio inward-compress
      // geometry instead of opening with a generic horizontal slide. The
      // ratio display in accrue compresses INWARD (translateY 0, scale
      // 1→0.72) — a depth compression, not upward travel — so CCA opens
      // with the intro text arriving from a settle-down pose (translateY
      // 10→0, easeOutCubic). The +10 start is a downward settle, not an
      // upward sweep: the intro drops into its resting position as the
      // ratio-behind-it releases its compression. introX is removed; a small
      // blur defocus remains but is shortened and eased so it reads as
      // "focus arriving", not "card sliding in".
      const introOp = multiMapEased(p, [0.15, 0.23, 0.38, 0.44], [0, 1, 1, 0], easeOutCubic);
      const introY = multiMapEased(p, [0.15, 0.25], [10, 0], easeOutCubic);
      const introX = 0; // removed: the boundary inheritance is vertical, not horizontal
      const introBlur = multiMapEased(p, [0.15, 0.22], [3, 0], easeOutCubic);

      // Node graph (centered, no camera pan needed).
      // nodeGraphOp pushed to start at 0.40 (was 0.36) so the graph
      // container becomes visible slightly AFTER the share token's FLIP
      // to the ng-token slot begins landing — that way the card is
      // visibly arriving into the graph rather than popping into a
      // pre-existing structure. The ng-token itself (container child)
      // inherits this ramp.
      const nodeGraphOp = multiMapSmooth(p, [0.40, 0.48, 0.82, 0.90], [0, 1, 1, 0]);
      const edgesOp = multiMapSmooth(p, [0.44, 0.52, 0.80, 0.88], [0, 1, 1, 0]);
      // Card opacity tails extended 0.90 → 0.94 so the horizontal SPLIT
      // (auction←, liquidity→, vesting↓) has visible traversal time before
      // the cards drain. Without the extension, the cards faded too fast
      // and the directional split read as a flicker rather than a peel.
      const c1Op = multiMapSmooth(p, [0.46, 0.52, 0.82, 0.94], [0, 1, 1, 0]);
      const c2Op = multiMapSmooth(p, [0.50, 0.56, 0.82, 0.94], [0, 1, 1, 0]);
      const c3Op = multiMapSmooth(p, [0.54, 0.60, 0.82, 0.94], [0, 1, 1, 0]);
      const summaryOp = multiMapSmooth(p, [0.68, 0.74, 0.86, 0.91], [0, 1, 1, 0]);

      // Compute CCA edges once graph is visible
      if (nodeGraphOp > 0.1 && !ccaEdgesComputed) {
        requestAnimationFrame(() => {
          computeCCAEdgePaths();
          ccaEdgesComputed = true;
        });
      }

      WriteBatch.write(() => {
        section.querySelector('.scene-pin').style.opacity = sceneOp;

        depositCoin.style.transform = coinTx;
        depositCoin.style.opacity = coinOp;
        depositCoin.style.zIndex = coinZ;

        shareToken.style.transform = shareTx;
        shareToken.style.opacity = shareOp;
        shareToken.style.zIndex = shareZ;
        if (shareLabel) shareLabel.style.opacity = shareLabelOp;

        intro.style.opacity = introOp;
        intro.style.transform = `translate(calc(-50% + ${introX}px), ${introY}px)`;
        intro.style.filter = introBlur > 0.1 ? `blur(${introBlur}px)` : 'none';

        // No camera pan — graph is centered
        camera.style.transform = 'none';

        if (nodeGraph) nodeGraph.style.opacity = nodeGraphOp;
        if (ccaEdgesSvg) ccaEdgesSvg.style.opacity = edgesOp;

        // ── EXIT CHOREOGRAPHY: HORIZONTAL SPLIT into left/right branches ──
        // DIRECTIONAL OVERRIDE (boundary 4 = CCA → Dual):
        //   Brief mandates "horizontal widening / structural split / center
        //   anchoring". Prior version drifted all 3 cards LEFT in parallel
        //   (same vector for every component) — exactly the anti-pattern the
        //   brief calls out ("transitions where everything exits in parallel
        //   with the same vector").
        //
        //   New behavior: the THREE CCA cards SPLIT into left vs right exit
        //   vectors, mirroring the dual scene's left/right branch topology:
        //     • Auction (top)     → drifts LEFT  (becomes left branch col)
        //     • Vesting (mid)     → drops slightly DOWN + fades (anchors
        //                            into the divider band, no horizontal
        //                            commitment — it's the structural pivot)
        //     • Liquidity (bot)   → drifts RIGHT (becomes right branch col)
        //   The node-graph container (right-side ng-token + edges) recedes
        //   in DEPTH (scale + blur) instead of drifting — pulls back so the
        //   widening cards read as foreground action.
        //
        // Timing:
        //   p 0.76–0.82 — ccaCardRects bridge captured (natural positions,
        //                 BEFORE any split, so dual FLIP works correctly).
        //   p 0.82–0.96 — cards split outward; graph recedes in depth.
        const splitWindow = easeOutCubic(Math.max(0, Math.min(1, (p - 0.82) / (0.96 - 0.82))));
        const splitDistance = Math.min(vw * 0.08, 110); // ~88–110px outward per side
        // Top card peels LEFT, bottom card peels RIGHT — true widening split.
        const splitA = -splitWindow * splitDistance;          // auction → LEFT
        const splitL =  splitWindow * splitDistance;          // liquidity → RIGHT
        // Middle card (vesting) settles DOWNWARD into the future divider
        // band — anti-upward + structural anchor (locks into the dual
        // divider's horizontal axis as it fades out).
        const settleV = splitWindow * 22;                     // vesting → +22px DOWN
        // Keep tiny entry offset (-12px) so the enter animation still reads
        const entryOffA = (1 - c1Op) * -12;
        const entryOffV = (1 - c2Op) * -12;
        const entryOffL = (1 - c3Op) * -12;
        cardAuction.style.opacity = c1Op;
        cardVesting.style.opacity = c2Op;
        cardLiquidity.style.opacity = c3Op;
        cardAuction.style.transform   = `translateX(${entryOffA + splitA}px)`;
        cardVesting.style.transform   = `translate(${entryOffV}px, ${settleV}px)`;
        cardLiquidity.style.transform = `translateX(${entryOffL + splitL}px)`;

        // Node-graph container recedes in DEPTH on exit (scale 1→0.88 + blur
        // 0→3px) instead of drifting laterally. Reads as "the source/edge
        // map pulls back into the substrate while the cards widen."
        if (nodeGraph) {
          // Mobile: cca graph is relative-positioned vertical stack; skip the
          // desktop translate(-50%, -50%) recede transform to avoid layout shift.
          if (window.innerWidth > 768 && p >= 0.82) {
            const graphRecedeT = easeOutCubic(Math.max(0, Math.min(1, (p - 0.82) / (0.96 - 0.82))));
            const ngScale = 1 - graphRecedeT * 0.12;       // 1 → 0.88
            const ngBlur  = graphRecedeT * 3;              // 0 → 3px
            nodeGraph.style.transform = `translate(-50%, -50%) scale(${ngScale})`;
            nodeGraph.style.filter    = ngBlur > 0.05 ? `blur(${ngBlur}px)` : '';
          } else {
            nodeGraph.style.transform = '';
            nodeGraph.style.filter    = '';
          }
        }

        // CCA → DUAL FLIP: at the start of exit window, capture the CCA
        // card positions (at their NATURAL pre-sweep positions) so
        // dual-branch-{auction,vesting,lp} can open from THESE exact
        // screen coords. This is the invisible handoff: the CCA cards
        // don't 'vanish' — their geometry becomes the entry pose of the
        // dual branches. Capture window (0.76–0.82) sits BEFORE sweep
        // begins so the rects are clean.
        if (p >= 0.76 && p <= 0.82) {
          const rA = cardAuction.getBoundingClientRect();
          const rV = cardVesting.getBoundingClientRect();
          const rL = cardLiquidity.getBoundingClientRect();
          Continuity.setBridge('ccaCardRects', {
            auction:   { x: rA.left + rA.width/2, y: rA.top + rA.height/2, w: rA.width, h: rA.height },
            vesting:   { x: rV.left + rV.width/2, y: rV.top + rV.height/2, w: rV.width, h: rV.height },
            liquidity: { x: rL.left + rL.width/2, y: rL.top + rL.height/2, w: rL.width, h: rL.height },
          });
        }

        summary.style.opacity = summaryOp;
        if (summary) {
          // CCA → DUAL handoff (spec B4 row 5): summary center-anchors and
          // structurally locks toward where the dual-divider will materialize.
          // We apply a small inward scale compression (1→0.92) during the exit
          // window (p 0.86→0.96) with NO Y travel — reads as "distilled into
          // the label band", not as an upward sweep. The dual-divider itself
          // enters with its own downward-settle + letter-spacing lock-in, so
          // this pairing produces a clean compress→settle handoff.
          //
          // REDUCED MOTION: skip the scale compress and clear inline transform.
          // summaryOp (set above) still fades the element, so the handoff is
          // preserved as opacity-only — accessible and still readable.
          if (Motion.reduced) {
            summary.style.transform = '';
          } else {
            const summaryExitRaw = Math.max(0, Math.min(1, (p - 0.86) / 0.10));
            const summaryExitT   = easeOutCubic(summaryExitRaw);
            const summaryScale   = 1 - summaryExitT * 0.08;
            summary.style.transform = `translateY(0) scale(${summaryScale})`;
          }
        }

        // ── Persistent pair continuity across CCA ──
        // Brightened protagonist: the persistent pair is the CONTINUITY
        // THREAD the viewer tracks. We no longer dim it to ambient
        // atmosphere — instead we keep it readable (min op ≈ 0.55) so the
        // viewer can see the SAME tokens they saw accrue now feeding CCA.
        // The in-chapter cca-share-token still plays the lead animation;
        // the persistent pair sits just behind it as a visible bridge.
        let ccaPairPose;
        let ccaPairOp;
        if (p < 0.18) {
          const t = multiMapSmooth(p, [0.00, 0.18], [0, 1]);
          ccaPairPose = Continuity.lerpPose('ccaStart', 'ccaEnd', t * 0.25);
          ccaPairOp = multiMapSmooth(p, [0.00, 0.08, 0.16, 0.20], [1.0, 0.85, 0.55, 0.55]);
        } else if (p < 0.70) {
          const t = multiMapSmooth(p, [0.18, 0.70], [0.25, 0.85]);
          ccaPairPose = Continuity.lerpPose('ccaStart', 'ccaEnd', t);
          // Hold mid-chapter presence at ≈0.55 so pair stays a legible continuity thread
          ccaPairOp = multiMapSmooth(p, [0.18, 0.44, 0.68], [0.55, 0.55, 0.70]);
        } else {
          const t = multiMapSmooth(p, [0.70, 0.96], [0, 1]);
          ccaPairPose = Continuity.lerpPose('ccaEnd', 'dual', t);
          ccaPairOp = multiMapSmooth(p, [0.70, 0.86, 1.00], [0.70, 0.90, 1.0]);
        }
        // Subtle breathing in CCA hold (same language as accrue)
        {
          const phase = p * Math.PI * 5;
          const drift = Math.sin(phase) * 1.2;
          const scaleOsc = 1 + Math.sin(phase * 1.4) * 0.012;
          ccaPairPose = {
            ...ccaPairPose,
            shareX: ccaPairPose.shareX + drift,
            shareY: ccaPairPose.shareY - Math.cos(phase) * 1.0,
            shareScale: ccaPairPose.shareScale * scaleOsc,
            underX: ccaPairPose.underX - drift,
            underY: ccaPairPose.underY - Math.cos(phase * 0.9) * 1.0,
            underScale: ccaPairPose.underScale * (1 + Math.sin(phase * 1.15) * 0.012),
          };
        }
        Continuity.setLive(ccaPairPose);
        // PAIR BAN — CCA is NOT in PAIR_ALLOWED. The CCA chapter carries
        // continuity via edges→dual-edges, cards→branches, headline→dual-headline,
        // and cca-ng-token→dual-divider (all non-token). The floating pair
        // stays hidden; only the scene-native cca-share-token renders here.
        void ccaPairOp; void floatContainerC; void floatShareC; void floatUnderC;
        if (self.isActive) Continuity.hidePair();

      });
    }
  });
})();

// ────────────────────────────────────────────
// 8.75. CHAPTER 3.75: DUAL OVERVIEW (400vh)
// Zoomed-out side-by-side: Share Token → CCA | Underlying Token → Strategies
// ────────────────────────────────────────────
(function chapterDualOverview() {
  const section = document.getElementById('ch-dual-overview');
  if (!section) return;

  const headline = document.getElementById('dual-headline');
  const graph = document.getElementById('dual-graph');
  const edgesSvg = document.getElementById('dual-edges-svg');
  const sideLeft = document.getElementById('dual-side-left');
  const sideRight = document.getElementById('dual-side-right');
  const divider = document.getElementById('dual-divider');
  const nodeShare = document.getElementById('dual-node-share');
  const nodeUnderlying = document.getElementById('dual-node-underlying');
  const branchesLeft = sideLeft ? sideLeft.querySelector('.dual-branches') : null;
  const branchesRight = sideRight ? sideRight.querySelector('.dual-branches') : null;
  const labelLeft = sideLeft ? sideLeft.querySelector('.dual-side-label') : null;
  const labelRight = sideRight ? sideRight.querySelector('.dual-side-label') : null;

  // CCA → DUAL FLIP: pull the 3 left dual branches from the ccaCardRects
  // bridge so they enter from the exact CCA card positions.
  const dualBranchAuction = document.getElementById('dual-branch-auction');
  const dualBranchVesting = document.getElementById('dual-branch-vesting');
  const dualBranchLp      = document.getElementById('dual-branch-lp');

  // Edge pairs: token → branches on each side
  // Left side: token.left → branch.right (right-to-left flow, flipped)
  // Right side: token.right → branch.left (left-to-right flow, normal)
  const dualEdgePairs = [
    // Left: Share token → CCA branches (flipped)
    { base: 'dual-edge-l-auction', dash: 'dual-dash-l-auction', from: 'dual-node-share', to: 'dual-branch-auction', dir: 'rtl' },
    { base: 'dual-edge-l-vesting', dash: 'dual-dash-l-vesting', from: 'dual-node-share', to: 'dual-branch-vesting', dir: 'rtl' },
    { base: 'dual-edge-l-lp',      dash: 'dual-dash-l-lp',      from: 'dual-node-share', to: 'dual-branch-lp',      dir: 'rtl' },
    // Right: Underlying → Strategy branches (normal)
    { base: 'dual-edge-r-ajna',   dash: 'dual-dash-r-ajna',   from: 'dual-node-underlying', to: 'dual-branch-ajna',   dir: 'ltr' },
    { base: 'dual-edge-r-charm',  dash: 'dual-dash-r-charm',  from: 'dual-node-underlying', to: 'dual-branch-charm',  dir: 'ltr' },
    { base: 'dual-edge-r-solana', dash: 'dual-dash-r-solana', from: 'dual-node-underlying', to: 'dual-branch-solana', dir: 'ltr' },
  ];

  function computeDualEdgePaths() {
    if (!graph || !edgesSvg) return;
    const gRect = graph.getBoundingClientRect();
    edgesSvg.setAttribute('viewBox', `0 0 ${gRect.width} ${gRect.height}`);

    for (const ep of dualEdgePairs) {
      const fromEl = document.getElementById(ep.from);
      const toEl = document.getElementById(ep.to);
      const basePath = document.getElementById(ep.base);
      const dashPath = document.getElementById(ep.dash);
      if (!fromEl || !toEl || !basePath) continue;

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();

      let x1, y1, x2, y2, cx1, cx2;
      // Tighter control points (0.30 vs previous 0.45) keep curves from
      // drooping below the pills when endpoints are close in Y. This makes
      // the arcs land flush against pill edges rather than hanging low.
      if (ep.dir === 'rtl') {
        // Token left side → branch right side
        x1 = fr.left - gRect.left;
        y1 = fr.top + fr.height / 2 - gRect.top;
        x2 = tr.right - gRect.left;
        y2 = tr.top + tr.height / 2 - gRect.top;
        const dx = Math.abs(x1 - x2);
        cx1 = x1 - dx * 0.30;
        cx2 = x2 + dx * 0.30;
      } else {
        // Token right side → branch left side
        x1 = fr.right - gRect.left;
        y1 = fr.top + fr.height / 2 - gRect.top;
        x2 = tr.left - gRect.left;
        y2 = tr.top + tr.height / 2 - gRect.top;
        const dx = Math.abs(x2 - x1);
        cx1 = x1 + dx * 0.30;
        cx2 = x2 - dx * 0.30;
      }

      const d = `M ${x1.toFixed(1)},${y1.toFixed(1)} C ${cx1.toFixed(1)},${y1.toFixed(1)} ${cx2.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      basePath.setAttribute('d', d);
      if (dashPath) dashPath.setAttribute('d', d);
    }
  }
  window.computeDualEdgePaths = computeDualEdgePaths;

  let dualEdgesComputed = false;

  // Cache responsive base scale (see node-graph chapter for rationale —
  // avoid per-frame getComputedStyle inside the scroll write loop).
  let dualBaseScaleCached = 1;
  function refreshDualBaseScale() {
    if (!graph) return;
    const v = parseFloat(getComputedStyle(graph).getPropertyValue('--dual-base-scale'));
    if (Number.isFinite(v) && v > 0) dualBaseScaleCached = v;
  }
  refreshDualBaseScale();

  window.addEventListener('resize', () => {
    dualEdgesComputed = false;
    refreshDualBaseScale();
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.08, 0.70, 0.90], [0.01, 0.04, 0.04, 0.01]));

      const sceneOp = multiMapSmooth(p, [0, 0.08, 0.85, 0.95], [0, 1, 1, 0]);

      // ── Phase 1: Headline enters at 0.03–0.11, HOLDS through the entire scene ──
      // User request: keep "Two tokens. One vault." + dual-sub visible during
      // its scene instead of fading out at ~0.46 while the graph/branches/tokens
      // continue to build. Hold extended to 0.82–0.90 so the headline retires
      // in sync with the graph/branches fade (graphOp 0.78–0.86, brLeft/Right
      // 0.68–0.76) at chapter exit — the reader now has the anchoring text
      // present while looking at the structure it describes.
      const headOp = multiMapSmooth(p, [0.03, 0.11, 0.82, 0.90], [0, 1, 1, 0]);
      // Dual headline: was vertical pan (20→0). New transition is letter-spread
      // + fade so the headline "breathes in" laterally rather than panning up.
      // Subtle tiny y (6px) preserved for warmth, not the primary motion.
      // POLISH (CCA → Dual): letter-spread reduced 0.42em → 0.20em so the
      // headline breathes in restrainedly rather than theatrically "snapping
      // open" from a wide-spread pose. Blur reduced 8→5px. easeOutCubic on
      // arrival so the settle is confident rather than a symmetric tween.
      const headY = multiMapEased(p, [0.04, 0.14], [6, 0], easeOutCubic);
      const headLetterSpread = multiMapEased(p, [0.04, 0.18], [0.20, 0.04], easeOutCubic); // em
      const headBlur = multiMapEased(p, [0.04, 0.14], [5, 0], easeOutCubic); // px

      // ── Phase 2: Graph container fades in, tokens float from edges ──
      // Graph (branches/edges/labels) fades out, but token nodes persist via float-tokens handoff
      const graphOp = multiMapSmooth(p, [0.18, 0.26, 0.78, 0.86], [0, 1, 1, 0]);
      // DIRECTIONAL VARIETY — Dual → Vaults exit.
      // Prior state: this boundary was passive (opacity-only fades on branches,
      // graph, divider). Brief calls for CONDENSATION into tangible products:
      // branches should converge inward toward the vault grid, structural
      // pieces should settle into card boundaries, divider should lock to
      // structure rather than drift. Implemented as:
      //   • graphScale: entry 0.92→1, exit 1→0.94 (modest inward telescope)
      //   • graphInwardX: branches parents pull +X (left) and −X (right)
      //     toward center during exit, reading as "two sides fold together"
      //   • divider settles +18px DOWNWARD during exit (anchors to structure,
      //     anti-upward-pan) and tightens letter-spacing as it locks
      //   • scene does NOT translateY upward — any residual y is 0
      // Together this reads as "the two-sided topology folds into a single
      // crystallized product family" — matches the brief's "condensation".
      const graphScale = multiMapEased(p,
        [0.18, 0.30, 0.82, 0.96],
        [0.92, 1, 1, 0.94],
        easeOutCubic
      );
      // Exit inward-fold: left side moves +X (right), right side moves −X (left)
      const exitFoldRaw = Math.max(0, Math.min(1, (p - 0.82) / (0.96 - 0.82)));
      const exitFoldT   = easeOutCubic(exitFoldRaw);
      const sideInwardX = exitFoldT * 34; // px
      // Divider settle-down (NOT up)
      const dividerSettleY      = exitFoldT * 18;
      const dividerLetterSpread = exitFoldT * -0.02; // em tightens

      // Sides become visible (layout containers) but branches stay hidden initially
      const sideOp = multiMapSmooth(p, [0.18, 0.26], [0, 1]);

      // Token nodes float in from far off-screen, converge toward center
      // ■AKITA (left/share) enters from the left edge
      const shareFloatX = multiMapSmooth(p, [0.16, 0.30], [-280, 0]);
      const shareFloatScale = multiMapSmooth(p, [0.16, 0.28], [0.5, 1]);
      const shareNodeOp = multiMapSmooth(p, [0.16, 0.24], [0, 1]);

      // AKITA (right/underlying) enters from the right edge
      const underFloatX = multiMapSmooth(p, [0.20, 0.34], [280, 0]);
      const underFloatScale = multiMapSmooth(p, [0.20, 0.32], [0.5, 1]);
      const underNodeOp = multiMapSmooth(p, [0.20, 0.28], [0, 1]);

      // Lock-in glow: peaks when tokens reach final position, then settles
      const lockGlow = multiMapSmooth(p, [0.28, 0.33, 0.38], [0, 1, 0]);

      // ── Phase 3: Divider appears as tokens converge ──
      const divOp = multiMapSmooth(p, [0.26, 0.34, 0.70, 0.78], [0, 1, 1, 0]);

      // ── Phase 4: Branches fan out from tokens ──
      // POLISH (CCA → Dual): the per-branch FLIP below (from ccaCardRects →
      // dual-branch natural positions) already provides the geometric
      // inheritance; the original parent-container brLeftX/brRightX 40px
      // slide was a redundant second X-axis that compounded with the FLIP
      // and flattened the inheritance read. Reduced 40→12 so the parent
      // container has a whisper of breath-in motion without stomping the
      // FLIP. easeOutCubic for confident arrival.
      const brLeftOp = multiMapSmooth(p, [0.34, 0.44, 0.68, 0.76], [0, 1, 1, 0]);
      const brLeftX = multiMapEased(p, [0.34, 0.44], [12, 0], easeOutCubic);
      const brRightOp = multiMapSmooth(p, [0.38, 0.48, 0.68, 0.76], [0, 1, 1, 0]);
      const brRightX = multiMapEased(p, [0.38, 0.48], [-12, 0], easeOutCubic);

      // Side labels appear with branches, fade with them
      const labelLeftOp = multiMapSmooth(p, [0.34, 0.42, 0.68, 0.76], [0, 1, 1, 0]);
      const labelRightOp = multiMapSmooth(p, [0.38, 0.46, 0.68, 0.76], [0, 1, 1, 0]);

      // ── Phase 5: Edges draw in after branches are placed, fade with branches ──
      const edgesOp = multiMapSmooth(p, [0.44, 0.54, 0.68, 0.76], [0, 1, 1, 0]);

      // ── Phase 6: Token nodes fade as float-tokens take over ──
      const tokenHandoffOp = multiMapSmooth(p, [0.78, 0.88], [1, 0]);

      // Compute edges only when the graph has fully settled at scale 1 and
      // nodes/branches are at their final positions. The previous logic fired
      // once at graphOp > 0.1 (while the graph was still scaling in), which
      // baked in incorrect endpoint coordinates and left paths dangling into
      // empty space. We now recompute every frame while edges are visible so
      // the curves track the live rects and any in-flight transforms.
      if (edgesOp > 0.05 && graphScale > 0.995) {
        requestAnimationFrame(() => {
          computeDualEdgePaths();
          dualEdgesComputed = true;
        });
      }

      WriteBatch.write(() => {
        section.querySelector('.scene-pin').style.opacity = sceneOp;

        headline.style.opacity = headOp;
        headline.style.transform = `translateX(-50%) translateY(${headY}px)`;
        headline.style.letterSpacing = `${headLetterSpread}em`;
        headline.style.filter = headBlur > 0.05 ? `blur(${headBlur}px)` : 'none';

        graph.style.opacity = graphOp;
        // Compose with the responsive --dual-base-scale (CSS) so wide
        // desktops keep the bigger idle scale through entry/exit.
        // dualBaseScaleCached is resolved once at load and refreshed on
        // resize — see refreshDualBaseScale() above. Reading
        // getComputedStyle here would force per-frame style recalc.
        graph.style.transform = `translate(-50%, -50%) scale(${graphScale * dualBaseScaleCached})`;

        // Sides visible for layout, but individual children animate separately
        sideLeft.style.opacity = sideOp;
        sideRight.style.opacity = sideOp;

        // Token nodes — scene-local #dual-node-share / #dual-node-underlying
        // are now the primary renderers (the global persistent pair is allowed
        // but no longer a cross-scroll backbone; dual is PAIR_ALLOWED). Both
        // can render: the global pair at z-index 5 and the in-section nodes
        // are visually aligned at the same center-offset positions. Keeping
        // both on keeps dual visually 'about two tokens' per chapter subject.
        // Token node opacity fade window extended 0.88→0.96 → 0.92→0.99
        // so the tokens remain visible through the inward-fold motion.
        const tokenNodeOp = multiMapSmooth(p, [0.16, 0.24, 0.92, 0.99], [0, 1, 1, 0]);
        // DUAL → VAULTS inward fold on the TWO TOKEN NODES: these are the
        // only visually-persistent elements at dual exit (branches fade by
        // 0.76, divider by 0.78). Share moves +X toward center from the
        // left; underlying moves −X toward center from the right. The two
        // tokens converge toward the divider axis as the scene resolves —
        // reads as "two sides fold into one crystallized product family."
        //   Fold window: p 0.82 → 0.96, cubic-out
        //   Travel: ±46px (matched to the visible gap between tokens)
        const tokenFoldT = easeOutCubic(Math.max(0, Math.min(1, (p - 0.82) / (0.96 - 0.82))));
        const tokenFoldX = tokenFoldT * 46;
        const tokenFoldScale = 1 - tokenFoldT * 0.10; // 1 → 0.90 (compress as they meet)
        if (nodeShare) {
          const glowPx = Math.round(lockGlow * 28);
          nodeShare.style.opacity = tokenNodeOp;
          // Share is on the LEFT side — fold toward center = +X.
          nodeShare.style.transform = `translateX(${shareFloatX + tokenFoldX}px) scale(${shareFloatScale * tokenFoldScale})`;
          nodeShare.style.filter = glowPx > 0 ? `drop-shadow(0 0 ${glowPx}px rgba(90, 140, 255, ${(lockGlow * 0.6).toFixed(2)}))` : 'none';
        }
        if (nodeUnderlying) {
          const glowPx = Math.round(lockGlow * 28);
          nodeUnderlying.style.opacity = tokenNodeOp;
          // Underlying is on the RIGHT side — fold toward center = −X.
          nodeUnderlying.style.transform = `translateX(${underFloatX - tokenFoldX}px) scale(${underFloatScale * tokenFoldScale})`;
          nodeUnderlying.style.filter = glowPx > 0 ? `drop-shadow(0 0 ${glowPx}px rgba(90, 140, 255, ${(lockGlow * 0.6).toFixed(2)}))` : 'none';
        }

        // Branches fan out from tokens, and on EXIT fold inward toward center.
        // Entry: brLeftX (0.34→0.44, 12→0px). Exit (0.82→0.96): left side
        // moves +sideInwardX (toward center from the left), right side moves
        // −sideInwardX (toward center from the right). Directional contrast
        // with the prior lateral-left CCA→Dual boundary (#4) — that pair is
        // single-axis left; this is two-sides-folding-toward-axis.
        if (branchesLeft) {
          branchesLeft.style.opacity = brLeftOp;
          branchesLeft.style.transform = `translateX(${brLeftX + sideInwardX}px)`;
        }
        if (branchesRight) {
          branchesRight.style.opacity = brRightOp;
          branchesRight.style.transform = `translateX(${brRightX - sideInwardX}px)`;
        }

        // ── CCA → DUAL FLIP: per-branch entry delta ──
        // Each of the 3 left branches starts from the exact CCA card
        // position (captured into ccaCardRects at CCA exit), then slides
        // to its natural dual-branch position. FLIP is applied ONLY while
        // the branch is becoming visible (brLeftOp ramp 0→1) so it
        // doesn't interfere with later hold state.
        if (self.isActive && dualBranchAuction && dualBranchVesting && dualBranchLp) {
          const rects = Continuity.getBridge('ccaCardRects');
          // FLIP easing: 1 at entry (fully offset from CCA pos), 0 at settle
          // POLISH (CCA → Dual): easeOutCubic replaces symmetric smoothstep
          // so the cards arrive with confident momentum and actually SETTLE
          // at the destination rather than slow-in both ends.
          const flipRaw = Math.max(0, Math.min(1, (p - 0.34) / (0.52 - 0.34)));
          const flipT = 1 - easeOutCubic(flipRaw);
          if (rects && flipT > 0.001) {
            // Compute destination (natural dual-branch) positions
            const dA = dualBranchAuction.getBoundingClientRect();
            const dV = dualBranchVesting.getBoundingClientRect();
            const dL = dualBranchLp.getBoundingClientRect();
            const dxA = (rects.auction.x  - (dA.left + dA.width/2))  * flipT;
            const dyA = (rects.auction.y  - (dA.top  + dA.height/2)) * flipT;
            const dxV = (rects.vesting.x  - (dV.left + dV.width/2))  * flipT;
            const dyV = (rects.vesting.y  - (dV.top  + dV.height/2)) * flipT;
            const dxL = (rects.liquidity.x - (dL.left + dL.width/2)) * flipT;
            const dyL = (rects.liquidity.y - (dL.top  + dL.height/2)) * flipT;
            // Slight scale shift — CCA cards are a bit bigger, so start at 1.1
            const flipScale = 1 + flipT * 0.1;
            dualBranchAuction.style.transform = `translate(${dxA}px, ${dyA}px) scale(${flipScale})`;
            dualBranchVesting.style.transform = `translate(${dxV}px, ${dyV}px) scale(${flipScale})`;
            dualBranchLp.style.transform      = `translate(${dxL}px, ${dyL}px) scale(${flipScale})`;
          } else {
            // Settled — clear per-branch transforms so container translateX owns positioning
            dualBranchAuction.style.transform = '';
            dualBranchVesting.style.transform = '';
            dualBranchLp.style.transform = '';
          }
        }

        // Side labels
        if (labelLeft) labelLeft.style.opacity = labelLeftOp;
        if (labelRight) labelRight.style.opacity = labelRightOp;

        // Divider: settles DOWNWARD on exit (not up) and tightens
        // letter-spacing — locks to structure rather than drifting away.
        // Note: no translateX(-50%) — the divider is laid out by flex between
        // the two sides, so applying a 50% X-shift would offset it by half
        // its own width to the left and misalign the ERC-4626 VAULT label.
        divider.style.opacity = divOp;
        if (divider) {
          divider.style.transform = `translateY(${dividerSettleY}px)`;
          divider.style.letterSpacing = `${0.04 + dividerLetterSpread}em`;
        }

        if (edgesSvg) edgesSvg.style.opacity = edgesOp;

        // ── DUAL → VAULTS handoff: capture divider + branch rects ──
        // Near dual-exit (p 0.72–0.84), record the geometry of the
        // divider label "ERC-4626 VAULT" and representative branches
        // so the vaults chapter can materialize its title at the
        // divider position and 4 vault cards at branch positions.
        if (p >= 0.72 && p <= 0.88) {
          const dvr = divider.getBoundingClientRect();
          const ba = document.getElementById('dual-branch-auction');
          const bv = document.getElementById('dual-branch-vesting');
          const bl = document.getElementById('dual-branch-lp');
          const br = document.getElementById('dual-branch-ajna');
          const toCenter = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
          };
          Continuity.setBridge('dualExitRects', {
            divider: { x: dvr.left + dvr.width/2, y: dvr.top + dvr.height/2, w: dvr.width, h: dvr.height },
            branches: [toCenter(ba), toCenter(bv), toCenter(bl), toCenter(br)].filter(Boolean),
          });
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 9. CHAPTER 4: CREATOR VAULTS (500vh)
// ────────────────────────────────────────────
(function chapterVaults() {
  const section = document.getElementById('ch-vaults');
  const cards = [
    document.getElementById('vc-0'),
    document.getElementById('vc-1'),
    document.getElementById('vc-2'),
    document.getElementById('vc-3'),
  ];
  const cta = document.getElementById('vaults-cta');
  const disclaimer = document.getElementById('vaults-disclaimer');
  const vaultsHeader = section ? section.querySelector('.vaults-header') : null;

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      // Audio (non-DOM)
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.70, 0.94], [0.02, 0.05, 0.05, 0.01]));

      // Compute
      // Entrance is a scale-reveal + slide-from-right (not upward pan)
      // so the vaults chapter feels distinct from the CCA/accrue/dual
      // sections that preceded it. Exit still fades via sceneOp.
      // POLISH (Vaults→Close handoff): pulled the exit-fade window later
      // so the gap between vaults dimming out and close phase-A resolving
      // shrinks. Was [0.82, 0.94] which left ~6% of the chapter (≈25vh of
      // 420vh) as pure black before the close overture started ramping at
      // p=0.02 of close. Now [0.88, 0.99] — vaults stays present longer
      // and the fade-to-black tail is ≈1vh of scroll, dovetailing into the
      // close overture which now opens at p=0.00 (see chapter-close).
      const sceneOp = multiMapSmooth(p, [0, 0.10, 0.88, 0.99], [0, 1, 1, 0]);
      const sceneY = 0; // retired upward pan
      // POLISH (Dual → Vaults): retired sceneX (56→0px). The per-card FLIP
      // below already carries each vault card from its dual-branch position
      // — layering a whole-scene horizontal slide on top of that made the
      // entry feel like "container slides in AND cards slide in" (two
      // parallel motion axes resolving the same thing). Now the scene
      // arrives via scale (0.962→1) + blur defocus only, while cards
      // crystallize into place via FLIP. easeOutCubic for confident settle.
      // Scene scale: entry 0.962→1, exit 1→0.93 (recedes in depth as
      // cards converge inward). Scene blur: entry 6→0, exit 0→4 so the
      // grid softens into atmosphere as the close chapter focus takes over.
      const sceneScale = multiMapEased(p,
        [0, 0.18, 0.88, 1.00],
        [0.962, 1, 1, 0.93],
        easeOutCubic
      );
      const sceneX = 0;
      const sceneBlur = multiMapEased(p,
        [0, 0.14, 0.88, 1.00],
        [6, 0, 0, 4],
        easeOutCubic
      );
      const cardValues = cards.map((card, i) => {
        const start = 0.12 + i * 0.10;
        const end = 0.30 + i * 0.10;
        const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
        const eased = 1 - Math.pow(1 - t, 3); // cubic-out, already good
        // POLISH (Dual → Vaults): retired per-card rotX 3D tilt (was 8→0deg).
        // With FLIP carrying cards from dual-branch rects and a small y (30px,
        // was 60) and a scale lift (0.92→1) the entry now reads as a confident
        // 2D crystallization. The rotX was an extra axis that muddied the
        // inheritance read — it previously made cards arrive tilted, then un-
        // tilt, AND translate, AND scale, AND FLIP all at once.
        return { op: Math.min(1, Math.max(0, eased)), y: (1 - eased) * 30, scale: 0.94 + eased * 0.06, rotX: 0 };
      });
      const ctaOp = multiMapSmooth(p, [0.56, 0.70], [0, 1]);
      const discOp = multiMapSmooth(p, [0.64, 0.76], [0, 1]);

      // Grid-projected angles + mouse parallax for vault cards
      const vGp = window.__gridProjected || { rx: 0, ry: 0, perspective: 900 };
      const vGridRx = vGp.rx * 0.15; // aggressive tracking for big camera swings
      const vGridRy = vGp.ry * 0.11;
      const vPersp = Math.min(1200, Math.max(500, vGp.perspective));
      const vdm = DepthMouse;
      const vdmA = vdm.active ? 1 : 0;
      // Per-card Z-depth multipliers — different rates = depth separation
      // POLISH (noise cleanup): softened from [20, 14, 8, 24] to [12, 9, 5, 14].
      // The vault cards are the primary subject of the scene and large
      // mouse-driven shifts on them competed with scroll-driven entry
      // motion; halving keeps the depth read without making the grid feel
      // restless when the cursor hovers.
      const vcDepths = [12, 9, 5, 14]; // card 0-3
      // Per-card Z offsets on the grid surface (px)
      const vcZOffsets = [25, 10, -10, 30];

      // DUAL → VAULTS FLIP: pull vault cards from the 4 dual-branch
      // positions captured at dual-exit. Applied during entry (p 0.12–0.44)
      // so vault cards enter from branch geometry instead of cold-stage.
      const dualRects = Continuity.getBridge('dualExitRects');

      // VAULTS → CLOSE directional variety: rather than fading the scene
      // in place or panning upward, the 4 cards CONVERGE INWARD toward
      // center as the close chapter prepares — the outer cards (0, 3)
      // pull harder than the inner cards (1, 2), reading as 'many objects
      // resolve into one'. This matches the close scene's central-focus
      // composition (hero token + central logo), handing off structurally
      // rather than through an upward drift.
      //   Exit window: p 0.88 → 1.00 (was 0.82 → 0.96; tightened to
      //   shrink the black gap before close resolves)
      //   Inward X displacement: outer cards ±30% of their offset from
      //     center, inner cards ±12% — staircase emphasizes the pull.
      //   Depth: scene scale 1 → 0.92 + blur 0 → 4 so the grid recedes
      //     slightly as it condenses.
      const exitConvergeRaw = Math.max(0, Math.min(1, (p - 0.88) / (1.00 - 0.88)));
      const exitConvergeT = easeOutCubic(exitConvergeRaw);
      // Per-card inward pull factors — outer cards move more than inner
      const vcConvergeFactor = [0.30, 0.12, 0.12, 0.30];
      WriteBatch.write(() => {
        section.querySelector('.scene-pin').style.opacity = sceneOp;
        const vaultsContainer = section.querySelector('.vaults-container');
        vaultsContainer.style.transform = `translate(${sceneX}px, ${sceneY}px) scale(${sceneScale})`;
        vaultsContainer.style.filter = sceneBlur > 0.1 ? `blur(${sceneBlur}px)` : 'none';
        cards.forEach((card, i) => {
          const v = cardValues[i];
          const vcd = vcDepths[i] || 14;
          const vcmx = vdm.x * vcd * vdmA;
          const vcmy = vdm.y * vcd * 0.5 * vdmA;
          const vcz = vcZOffsets[i] * v.op; // Z-offset scales with entrance
          // Merge hover tilt (stored as data attributes)
          const hRx = parseFloat(card.dataset.hoverRx) || 0;
          const hRy = parseFloat(card.dataset.hoverRy) || 0;
          const hScale = parseFloat(card.dataset.hoverScale) || 1;
          // Grid-locked rotation + per-card Z-depth + hover tilt
          const totalRx = v.rotX + vGridRx + hRx;
          const totalRy = vGridRy + hRy;

          // FLIP delta from dual-branch position
          let flipDx = 0, flipDy = 0;
          if (dualRects && dualRects.branches && dualRects.branches[i]) {
            const cardRect = card.getBoundingClientRect();
            const cardCx = cardRect.left + cardRect.width / 2;
            const cardCy = cardRect.top + cardRect.height / 2;
            // flipT: 1 at entry, 0 at settle. Uses per-card start offset.
            const flipStart = 0.12 + i * 0.10;
            const flipEnd   = flipStart + 0.22;
            const flipT = 1 - multiMapSmooth(p, [flipStart, flipEnd], [0, 1]);
            if (flipT > 0.001) {
              flipDx = (dualRects.branches[i].x - cardCx) * flipT;
              flipDy = (dualRects.branches[i].y - cardCy) * flipT;
            }
          }

          // Inward convergence displacement on exit: each card's center is
          // pulled toward viewport center by a fraction of its offset.
          // Read from the just-written rect so we account for FLIP/layout.
          let convergeDx = 0, convergeDy = 0;
          if (exitConvergeT > 0.001) {
            const cr = card.getBoundingClientRect();
            const viewCx = window.innerWidth / 2;
            const viewCy = window.innerHeight / 2;
            const cardCx2 = cr.left + cr.width / 2;
            const cardCy2 = cr.top + cr.height / 2;
            const pullX = (viewCx - cardCx2) * vcConvergeFactor[i];
            const pullY = (viewCy - cardCy2) * (vcConvergeFactor[i] * 0.4);
            convergeDx = pullX * exitConvergeT;
            convergeDy = pullY * exitConvergeT;
          }

          card.style.opacity = v.op;
          card.style.transform = `perspective(${vPersp}px) translate(${flipDx + vcmx + convergeDx}px, ${flipDy + Math.max(0, v.y) + vcmy + convergeDy}px) translateZ(${vcz}px) scale(${v.scale * hScale}) rotateX(${totalRx}deg) rotateY(${totalRy}deg)`;
        });
        cta.style.opacity = ctaOp;
        disclaimer.style.opacity = discOp;

        // ── DUAL → VAULTS: .vaults-header inherits dual-divider geometry ──
        // Per spec B5 row 3: #dual-divider transforms into .vaults-header
        // with a "Downward settle + structural lock-in". We FLIP the header
        // from the divider's captured screen rect toward its natural CSS
        // position during the vaults entry window (p 0.00–0.22). The Y delta
        // is typically downward (divider sits higher than the header band),
        // which matches the directional spec exactly. After settle we clear
        // the transform so hover/mouse-parallax math owns the element.
        if (vaultsHeader) {
          // REDUCED MOTION: skip the FLIP translate and letter-spacing relax.
          // The header still reveals normally via its own CSS (no inline
          // opacity override needed here); clearing transform / letterSpacing
          // means it rests at its native CSS geometry throughout vaults entry.
          if (Motion.reduced) {
            vaultsHeader.style.transform = '';
            vaultsHeader.style.letterSpacing = '';
          } else {
            const dRects = Continuity.getBridge('dualExitRects');
            // POLISH (vaults-headline smoothing): widened the FLIP window
            // 0.02–0.22 → 0.02–0.28 (6% longer tail) and swapped easeOutCubic
            // for easeOutQuint — cubic-bezier(0.22, 1, 0.36, 1) equivalent.
            // The quint curve has a much softer asymptote near t=1, which
            // removes the sub-pixel "tick" at FLIP settle that read as
            // jitter on the "Deposit. Earn together." headline. Letter-
            // spacing tween now also runs on the quint curve so its
            // resolution matches the transform, preventing the two
            // channels from parting ways in the final 10% of the arrival.
            const headerFlipRaw = Math.max(0, Math.min(1, (p - 0.02) / (0.28 - 0.02)));
            const headerFlipT   = 1 - easeOutQuint(headerFlipRaw);
            if (dRects && dRects.divider && headerFlipT > 0.001) {
              const hr = vaultsHeader.getBoundingClientRect();
              const hcx = hr.left + hr.width / 2;
              const hcy = hr.top  + hr.height / 2;
              // Quantize to 0.5px to eliminate sub-pixel shimmer that the
              // browser's text rasterizer amplifies as perceptible jitter.
              const dx  = Math.round((dRects.divider.x - hcx) * headerFlipT * 2) / 2;
              const dy  = Math.round((dRects.divider.y - hcy) * headerFlipT * 2) / 2;
              const letterRelax = headerFlipT * 0.02;
              vaultsHeader.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
              vaultsHeader.style.letterSpacing = `${letterRelax.toFixed(4)}em`;
              vaultsHeader.style.willChange = 'transform, letter-spacing';
            } else {
              vaultsHeader.style.transform = '';
              vaultsHeader.style.letterSpacing = '';
              vaultsHeader.style.willChange = '';
            }
          }
        }

        // ── VAULTS → CLOSE handoffs (per boundary matrix §6) ──
        // Six non-token continuity bridges captured at vaults exit so the
        // close chapter can FLIP from these exact screen geometries rather
        // than opening cold. Each bridge maps directly to a matrix row.
        // IMPORTANT: capture window ENDS at 0.82 — BEFORE the inward
        // convergence begins — so the close chapter receives natural
        // pre-convergence card rects for its FLIP inheritance.
        if (p >= 0.72 && p <= 0.82) {
          const vc0 = cards[0];
          // (1) vc-0 share-img → close-card-share (Y)
          const vc0ShareImg = vc0 ? vc0.querySelector('.vault-card-share-img') : null;
          if (vc0ShareImg) {
            const r = vc0ShareImg.getBoundingClientRect();
            Continuity.setBridge('vaultExitShareRect', {
              x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
            });
          }
          // (2) vc-0 vault-card-icon (AKITA underlying coin) → close-card-under (Y)
          const vc0CoinImg = vc0 ? vc0.querySelector('.vault-card-icon') : null;
          if (vc0CoinImg) {
            const r = vc0CoinImg.getBoundingClientRect();
            Continuity.setBridge('vaultExitCoinRect', {
              x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
            });
          }
          // (3) vaults-editorial 4-card aggregation → close-vault-node (Y)
          const grid = section.querySelector('.vaults-editorial');
          if (grid) {
            const r = grid.getBoundingClientRect();
            Continuity.setBridge('vaultExitGridRect', {
              x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
            });
          }
          // (4) vaults-headline → close-tag + close-cta split (I)
          const headline = section.querySelector('.vaults-headline');
          if (headline) {
            const r = headline.getBoundingClientRect();
            Continuity.setBridge('vaultExitHeadlineRect', {
              x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
            });
          }
          // (5) CTA rect for CTA → close-cta continuity
          if (cta) {
            const cr = cta.getBoundingClientRect();
            Continuity.setBridge('vaultExitCtaRect', {
              x: cr.left + cr.width / 2, y: cr.top + cr.height / 2, w: cr.width, h: cr.height,
            });
          }
          // (6) vault-featured-stats border-top rule → close-line (S)
          const statsRule = section.querySelector('.vault-featured-stats');
          if (statsRule) {
            const r = statsRule.getBoundingClientRect();
            Continuity.setBridge('vaultExitStatsRuleRect', {
              x: r.left + r.width / 2, y: r.top, w: r.width, h: 1,
            });
          }
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 9b. DUAL-ONLY FLOATING TOKENS
// Previously this IIFE was the banned globally-persistent pair layer that
// spanned dual→vaults→close as a shortcut continuity backbone. Per the
// non-token continuity rebuild, the #float-share/#float-underlying pair is
// now scoped to the dual overview chapter ONLY (PAIR_ALLOWED.dual = true).
// Vaults and close carry continuity via cards→cards FLIP, grid→node merge,
// stat rows→brand line, and headline splits — NOT via floating tokens.
// ────────────────────────────────────────────
(function floatingTokens() {
  const floatContainer = document.getElementById('float-tokens');
  const floatShare = document.getElementById('float-share');
  const floatUnderlying = document.getElementById('float-underlying');
  const dualSection = document.getElementById('ch-dual-overview');
  const vaultsSection = document.getElementById('ch-vaults');
  if (!floatContainer || !dualSection || !vaultsSection) return;

  function getSectionBounds(el) {
    return { top: el.offsetTop, height: el.clientHeight };
  }

  ScrollTrigger.create({
    trigger: dualSection,
    start: 'top top',
    endTrigger: vaultsSection,
    end: 'top top',
    onUpdate: (self) => {
      const scrollY = window.scrollY || window.pageYOffset;
      const dual = getSectionBounds(dualSection);
      const dualP = Math.max(0, Math.min(1, (scrollY - dual.top) / dual.height));

      // Dual is the ONE scene whose literal subject is 'two tokens'. The
      // pair is visible across the full dual chapter and retires before
      // vaults. Vaults/close no longer render this global pair.
      const floatOp = multiMapSmooth(dualP, [0.00, 0.08, 0.86, 1.00], [1.00, 1.00, 1.00, 0.00]);
      const shareX = -130;
      const underX = 138;
      const pairY = -10;
      const pairScale = 1;

      if (self.isActive && Continuity.guardPair('dual')) {
        const breathT = (performance.now ? performance.now() : Date.now()) * 0.001;
        const breath = Math.sin(breathT * 1.1) * 0.6;
        const breathS = 1 + Math.sin(breathT * 0.8) * 0.006;
        const liveY = pairY + breath;
        const liveScale = pairScale * breathS;

        Continuity.setLive({
          shareX: shareX, shareY: liveY, shareScale: liveScale, shareOp: floatOp,
          underX: underX, underY: liveY, underScale: liveScale, underOp: floatOp,
        });

        WriteBatch.write(() => {
          StyleCache.set(floatContainer, 'opacity', floatOp);
          if (floatShare) {
            StyleCache.set(floatShare, 'transform',
              `translate(calc(-50% + ${shareX}px), calc(-50% + ${liveY}px)) scale(${liveScale})`);
          }
          if (floatUnderlying) {
            StyleCache.set(floatUnderlying, 'transform',
              `translate(calc(-50% + ${underX}px), calc(-50% + ${liveY}px)) scale(${liveScale})`);
          }
        });
      } else {
        // Any non-dual tick that still fires here: hide.
        Continuity.hidePair();
      }
    }
  });
})();

// ────────────────────────────────────────────
// 10. CHAPTER 5: CLOSE (900vh) — cinematic token convergence
// ────────────────────────────────────────────
(function chapterClose() {
  const section = document.getElementById('ch-close');
  if (!section) return;

  // Phase A: hero token entrance
  const phaseA     = document.getElementById('close-phase-a');
  const heroShare  = document.getElementById('close-hero-share');

  // Persistent pair — re-introduced at start of Close (reverse of hero dispersal)
  const floatContainerZ = document.getElementById('float-tokens');
  const floatShareZ     = document.getElementById('float-share');
  const floatUnderZ     = document.getElementById('float-underlying');

  // Phase B-C: token cards
  const cardsLayer = document.getElementById('close-cards-layer');
  const cardShare  = document.getElementById('close-card-share');
  const cardUnder  = document.getElementById('close-card-under');

  // Phase D-E: vault collision
  const vaultLayer = document.getElementById('close-vault-layer');
  const vaultNode  = document.getElementById('close-vault-node');
  const vaultTokL  = document.getElementById('close-vault-tl');
  const vaultTokR  = document.getElementById('close-vault-tr');
  const particleCanvas = document.getElementById('close-particles');

  // Phase F: final
  const finalContainer = document.getElementById('close-final');
  const partners   = document.getElementById('close-partners');
  const brand      = document.getElementById('close-brand');
  const line       = document.getElementById('close-line');
  const cta        = document.getElementById('close-cta');
  const tag        = document.getElementById('close-tag');
  const closeLogo  = document.querySelector('.close-logo');

  // Phase G: crescendo (SIX-beat typographic finale)
  // L1 One vault → L2 Two tokens + sublabels → L3 (3,3)
  // → L3.5 Earn together → L4 4626.fun → L5 Partners + CTA
  const crescendo   = document.getElementById('close-crescendo');
  const cresAura    = document.getElementById('cres-aura');
  const cresLine1   = document.getElementById('cres-line-1');
  const cresLine2   = document.getElementById('cres-line-2');
  const cresLine3   = document.getElementById('cres-line-3');
  const cresLineEarn = document.getElementById('cres-line-earn');
  const cresLine4   = document.getElementById('cres-line-4');
  const cresLineFinale = document.getElementById('cres-line-finale');
  const cresSplitL  = crescendo ? crescendo.querySelector('.cres-split-l') : null;
  const cresSplitR  = crescendo ? crescendo.querySelector('.cres-split-r') : null;
  const cresRuleT   = crescendo ? crescendo.querySelector('.cres-rule-top') : null;
  const cresRuleB   = crescendo ? crescendo.querySelector('.cres-rule-bot') : null;
  // L2 sublabels (added for the paced Two-tokens beat)
  const cresSubs    = document.getElementById('cres-sublabels');
  const cresSubL    = document.getElementById('cres-sublabel-l');
  const cresSubR    = document.getElementById('cres-sublabel-r');
  const cresSubDiv  = document.getElementById('cres-sublabel-divider');
  // Editorial chrome (brand mark/tag, finale meta) — collected once.
  const cresBrandMark = crescendo ? crescendo.querySelector('.cres-brand-mark') : null;
  const cresBrandTag  = crescendo ? crescendo.querySelector('.cres-brand-tag') : null;
  const cresFinaleLabel = crescendo ? crescendo.querySelector('.cres-finale-label') : null;
  const cresFinaleMeta  = crescendo ? crescendo.querySelector('.cres-finale-meta') : null;
  // Finale poster wrapper — L3.5/L4/L5 live here, coexist permanently as a composed page.
  const cresFinalePoster = document.getElementById('cres-finale-poster');
  const cresStack = crescendo ? crescendo.querySelector('.cres-stack') : null;

  let closeSoundPlayed = false;

  // ── Particle system (collision burst) ──
  const particles = [];
  let pCtx = null;
  let particleSeeded = false;

  function seedParticles(cx, cy) {
    particles.length = 0;
    const count = 120;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 2.8;
      particles.push({
        x: cx + Math.cos(angle) * (5 + Math.random() * 20),
        y: cy + Math.sin(angle) * (5 + Math.random() * 20),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1 + Math.random() * 2.5,
        life: 1,
        decay: 0.004 + Math.random() * 0.01,
        hue: 210 + Math.random() * 50,
      });
    }
    particleSeeded = true;
  }

  function drawParticles(prog) {
    if (!pCtx || particles.length === 0) return;
    const w = particleCanvas.width;
    const h = particleCanvas.height;
    pCtx.clearRect(0, 0, w, h);
    const speed = Math.max(0, prog);
    for (const pt of particles) {
      pt.x += pt.vx * speed * 1.5;
      pt.y += pt.vy * speed * 1.5;
      pt.vy += 0.008 * speed;
      pt.life -= pt.decay * speed;
      if (pt.life <= 0) continue;
      const alpha = pt.life * 0.7;
      pCtx.beginPath();
      pCtx.arc(pt.x, pt.y, pt.r * (0.5 + pt.life * 0.5), 0, Math.PI * 2);
      pCtx.fillStyle = `hsla(${pt.hue}, 60%, 70%, ${alpha})`;
      pCtx.fill();
      pCtx.beginPath();
      pCtx.arc(pt.x, pt.y, pt.r * 3 * pt.life, 0, Math.PI * 2);
      pCtx.fillStyle = `hsla(${pt.hue}, 50%, 60%, ${alpha * 0.12})`;
      pCtx.fill();
    }
  }

  // ── Radiating ring system (post-collision ambient loop) ──
  // Creates concentric rings that pulse outward from vault center.
  // Each ring is a circle that expands, fades, and respawns.
  const RING_COUNT = 5;
  const rings = [];
  let ringAnimId = null;
  let ringActive = false;
  let ringOpacity = 0;   // master opacity, scroll-driven

  for (let i = 0; i < RING_COUNT; i++) {
    rings.push({
      radius: 0,
      phase: i / RING_COUNT,   // stagger birth so rings are evenly spaced
      speed: 0.3 + Math.random() * 0.15,
      hue: 215 + i * 8,
      arcGap: 0.15 + Math.random() * 0.2,  // gap in the ring arc for visual interest
      arcOffset: Math.random() * Math.PI * 2,
    });
  }

  function ringLoop(time) {
    if (!ringActive || !pCtx) return;
    ringAnimId = requestAnimationFrame(ringLoop);

    const w = particleCanvas.width;
    const h = particleCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.max(w, h) * 0.45;

    pCtx.clearRect(0, 0, w, h);

    const t = time * 0.001; // seconds

    for (const ring of rings) {
      // Each ring expands from 0 → maxR on a cycle, then resets
      const cycle = 8 + ring.speed * 4; // seconds per full cycle
      const raw = ((t / cycle) + ring.phase) % 1;
      const r = raw * maxR;

      // Fade in near center, full in middle, fade out at edge
      const edgeFade = raw < 0.08 ? raw / 0.08
                     : raw > 0.75 ? 1 - ((raw - 0.75) / 0.25)
                     : 1;
      const alpha = edgeFade * ringOpacity * 0.18;
      if (alpha < 0.005) continue;

      const lineW = 1 + (1 - raw) * 1.5; // thicker near center

      // Draw as arc segments with a gap for organic feel
      const gapAngle = ring.arcGap;
      const startAngle = ring.arcOffset + t * 0.08;

      pCtx.beginPath();
      pCtx.arc(cx, cy, r, startAngle + gapAngle, startAngle + Math.PI * 2 - gapAngle);
      pCtx.strokeStyle = `hsla(${ring.hue}, 50%, 68%, ${alpha})`;
      pCtx.lineWidth = lineW;
      pCtx.stroke();

      // Soft glow behind the ring
      pCtx.beginPath();
      pCtx.arc(cx, cy, r, startAngle + gapAngle, startAngle + Math.PI * 2 - gapAngle);
      pCtx.strokeStyle = `hsla(${ring.hue}, 45%, 60%, ${alpha * 0.2})`;
      pCtx.lineWidth = lineW + 6;
      pCtx.stroke();
    }

    // Ambient dot particles along the rings (sparse, drifting outward)
    const dotCount = 16;
    for (let i = 0; i < dotCount; i++) {
      const dt = ((t * 0.12 + i * 0.0625) % 1);
      const dr = dt * maxR;
      const angle = i * 2.399 + t * 0.04;  // golden angle + slow rotation
      const dx = cx + Math.cos(angle) * dr;
      const dy = cy + Math.sin(angle) * dr;
      const dotFade = dt < 0.1 ? dt / 0.1 : dt > 0.8 ? (1 - dt) / 0.2 : 1;
      const dotAlpha = dotFade * ringOpacity * 0.3;
      if (dotAlpha < 0.01) continue;

      pCtx.beginPath();
      pCtx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      pCtx.fillStyle = `hsla(${220 + i * 3}, 55%, 72%, ${dotAlpha})`;
      pCtx.fill();

      // Dot glow
      pCtx.beginPath();
      pCtx.arc(dx, dy, 4, 0, Math.PI * 2);
      pCtx.fillStyle = `hsla(${220 + i * 3}, 50%, 65%, ${dotAlpha * 0.15})`;
      pCtx.fill();
    }
  }

  function startRings() {
    if (ringActive) return;
    ringActive = true;
    ringAnimId = requestAnimationFrame(ringLoop);
  }
  function stopRings() {
    ringActive = false;
    if (ringAnimId) { cancelAnimationFrame(ringAnimId); ringAnimId = null; }
    if (pCtx && particleCanvas) pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  }

  if (particleCanvas) {
    const resizeCanvas = () => {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    pCtx = particleCanvas.getContext('2d');
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.06, 0.60, 1.0], [0.02, 0.06, 0.06, 0]));
      // Crescendo chime fires as line 4 (brand lock-in) begins.
      if (p >= 0.875 && !closeSoundPlayed) { AudioEngine.playChime(2.0); closeSoundPlayed = true; }
      if (p < 0.80) closeSoundPlayed = false;

      // Scene holds at full opacity through the entire scrollable range so
      // the crescendo poster stays lit; the prior [0.92, 1] fade-out drove
      // the scene to 0.9 at end-of-scroll which dimmed the held finale.
      const sceneOp = multiMapSmooth(p, [0, 0.03], [0, 1]);
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Mouse parallax
      const cdm = DepthMouse;
      const cdmA = cdm.active ? 1 : 0;
      const mx = cdm.x * 12 * cdmA;
      const my = cdm.y * 8 * cdmA;

      // ═══ PHASE A (p 0.00 → 0.20): Typographic overture ═══
      // Replaces the prior circular hero-token + halo. Pure typography: a
      // kicker, a hairline rule, and a serif/sans display title enter with
      // a scale + letter-spread dissolve (NOT an upward pan).
      // POLISH (Vaults → Close): opened cold at p=0.00 (scale 1.04, spread
      // 0.18em, blur 6px) with zero inheritance from the vaults chapter.
      // Originally pushed the entry stops slightly later (0.02–0.08) so
      // vault's exit fade had room to complete before the overture began
      // resolving — but that left a noticeable black pause between scenes.
      // Now: vaults exit was tightened to [0.88, 0.99] and the overture
      // opens at p=0.00 and reaches full opacity by p=0.04 so the two
      // scenes crossfade through a brief overlap and the gap collapses.
      // Reduced amplitudes (scale 1.04→1.02, spread 0.18em→0.10em, blur
      // 6→3px) for a ceremonial restrained resolve rather than a dramatic
      // opening. easeOutCubic throughout so the overture settles confidently.
      const phaseAOp       = multiMapEased(p, [0.00, 0.04, 0.14, 0.20], [0, 1, 1, 0], easeOutCubic);
      const overtureScale  = multiMapEased(p, [0.00, 0.08], [1.02, 1.00], easeOutCubic);
      const overtureSpread = multiMapEased(p, [0.00, 0.10], [0.10, 0], easeOutCubic); // em
      const overtureBlur   = multiMapEased(p, [0.00, 0.08], [3, 0], easeOutCubic); // px

      // ═══ PHASE B-E RETIRED (Restructure round) ═══
      // The card dance (share card → underlying card → converge → vault
      // plate collision) that originally spanned p 0.13 → 0.70 has been
      // retired. The new six-beat crescendo (Phase G, p 0.38 → 0.905)
      // now owns the entire arc: L2 shows ■AKITA + AKITA as sublabels.
      // Holding these values at
      // zero (opacity) or identity (transform) lets the existing write
      // block below run without NaN/undefined references; the DOM is
      // still present but invisible and non-competing so the crescendo
      // owns the visual stage.
      const cardsOp        = 0;
      const shareCardOp    = 0;
      const shareCardX     = 0;
      const shareCardScale = 1;
      const underCardOp    = 0;
      const underCardX     = 0;
      const underCardScale = 1;
      const convergeProg   = 0;
      const cardsFadeOut   = 0;
      const vaultLayerOp   = 0;
      const vaultNodeOp    = 0;
      const vaultNodeScale = 1;
      const vaultNodeY     = 0;
      const vaultRuleT     = 0;
      const markT          = 0;
      const markTravel     = 0;
      const vaultTokOp     = 0;

      // ═══ PHASE E (p 0.56 → 0.70): Convergence moment — restrained ═══
      // Replaced the dramatic "slam" with a gentler pulse and a soft
      // particle wash. No ring glow shadow (the ring no longer exists).
      // POLISH (Vaults → Close): retired vaultPulse 1→1.04→1 (4% scale pop
      // visible as a breathing tick on the plate). The particle wash plus
      // the phase-D vaultNodeScale (0.94→1) already provides the
      // "arrival" cue; the extra pulse felt mechanical against an
      // otherwise held plate. Replaced with a hold-at-1 no-op so downstream
      // vaultNode transform math still works without touching it.
      // Collision/particle system retired along with Phase B-E. The
      // crescendo now carries the entire arc so we don't seed particles.
      const collisionGlow     = 0;
      const collisionParticle = 0;
      const vaultPulse        = 1;
      const vaultFadeOut      = 0;
      particleSeeded = false;

      // ═══ RING RADIATION — REMOVED (user: "no rings or circles, tacky") ═══
      // Legacy radiating ring system deleted to keep the close section
      // premium/editorial. ringOpacity is force-held at 0 and startRings is
      // never called so the particle canvas stays clean. Keeping the
      // variable references alive (void) so downstream code that reads
      // ringOpacity (vaultLayerOpFinal, particleCanvas.style.opacity) still
      // functions with the "no rings" path.
      ringOpacity = 0;
      stopRings();

      // ═══ PHASE G (p 0.36 → 0.908): Crescendo finale — SIX PACED BEATS ═══
      // L1.5 (ERC-4626 plate) and the Roman-numeral eyebrows + L3 gloss were
      // removed for a cleaner, quieter cadence. Each beat now owns more of
      // the stage; L1 holds longer as the sole opener, L2 moves earlier, and
      // L3 keeps its deep hold as the climax before the finale poster.
      //   L1   "One vault."              inward compression (letter-spread)
      //   L2   "Two tokens." + sublabels  horizontal split + sublabel fade
      //   L3   "(3, 3)"                  depth recession (scale + blur)
      //   L3.5 "Earn together."          italic reveal-and-hold (in poster)
      //   L4   "4626.fun"                structural lock-in (in poster, holds)
      //   L5   Partners + CTA finale     ecosystem row + Join Waitlist (holds)
      //
      // PACING (fits into max reachable p ≈ 0.908):
      //   Container opens  0.360 → 0.378
      //   L1        in 0.378→0.410, hold 0.410→0.470, out 0.470→0.500
      //   L2        in 0.510→0.540, hold 0.540→0.625, out 0.625→0.655
      //     └ sublabels 0.530→0.560, fade with L2 at 0.625→0.655
      //       (pulled in from 0.555→0.595 after the mobile pacing audit —
      //        old window gave only ~302ms of L2+sublabel co-visibility at
      //        an 800px/s swipe; new window gives ≥500ms so the Share /
      //        Underlying qualifiers are actually readable on phones)
      //   L3        in 0.680→0.715, HOLD 0.715→0.820, out 0.820→0.845
      //   Stack out 0.840→0.862 ; Poster in 0.858→0.885 (HOLDS to end)
      //   L3.5 (in poster)  0.862→0.880 reveal-and-hold
      //   L4   (in poster)  0.875→0.892 reveal-and-hold
      //     └ rules draw 0.878→0.895, brand tag 0.886→0.900
      //   L5   (in poster)  0.890→0.906 reveal-and-hold (final frame)
      const cresContainerOp = multiMapSmooth(p, [0.360, 0.378], [0, 1]);
      // Ambient aura opacity — gently rises with the container, breathes
      // subtly to keep the page feeling "lit" (soft radial gradient behind
      // every beat). Stays ≈0.85 through the stack, dips only if the stack
      // is fully cleared (which it never is — L5 holds to end).
      const cresAuraOp    = multiMapSmooth(p, [0.360, 0.405], [0, 0.85]);
      const cresAuraScale = 0.88 + easeOutQuint(multiMapSmooth(p, [0.360, 0.440], [0, 1])) * 0.12;

      // L1 — "One vault."  inward compression; deep hold as sole opener.
      const cres1Op    = multiMapSmooth(p, [0.378, 0.410, 0.470, 0.500], [0, 1, 1, 0]);
      const cres1Prog  = multiMapSmooth(p, [0.378, 0.425], [0, 1]); // 0=wide, 1=tight
      // L2 — "Two tokens."  horizontal split with a meet-and-hold.
      const cres2Op    = multiMapSmooth(p, [0.510, 0.540, 0.625, 0.655], [0, 1, 1, 0]);
      const cres2Prog  = multiMapSmooth(p, [0.510, 0.555], [0, 1]); // 0=apart, 1=met
      // Sublabels ("■AKITA · Vault Share" / "○AKITA · Underlying") fade in
      // as L2 reaches its hold and fade with L2. See pacing comment above —
      // window was pulled forward from [0.555, 0.595, 0.625, 0.650] to give
      // the mobile reader enough co-visibility to register the qualifiers.
      const cres2SubOp = multiMapSmooth(p, [0.530, 0.560, 0.625, 0.655], [0, 1, 1, 0]);
      // L3 — "(3, 3)"  depth recession; deep hold as the climax before the
      // finale poster arrives. Gloss removed — the ticker stands alone.
      const cres3Op    = multiMapSmooth(p, [0.680, 0.715, 0.820, 0.845], [0, 1, 1, 0]);
      const cres3Prog  = multiMapSmooth(p, [0.680, 0.730], [0, 1]); // 0=recessed, 1=forward
      // ── FINALE POSTER: L3.5 + L4 + L5 coexist permanently ──
      // These three lines now live inside #cres-finale-poster (a sibling of
      // .cres-stack). The stack (L1–L3) fades OUT 0.840→0.862 while the
      // poster fades IN 0.858→0.885 and HOLDS to end. Inside the poster,
      // L3.5/L4/L5 each reveal on their own micro-window and HOLD — no
      // fade-out curve, so the final frame is a composed editorial page
      // (Earn together. / 4626.fun wordmark + rules + brand tag / partners
      // row + CTA + meta) instead of a caught crossfade.
      const cresStackOp  = multiMapSmooth(p, [0.840, 0.862], [1, 0]);
      const cresPosterOp = multiMapSmooth(p, [0.858, 0.885], [0, 1]);
      // L3.5 — "Earn together."  Reveal-then-hold. Letter-spread still
      // relaxes 0.06em → -0.02em over its progress window for life.
      const cresEarnOp   = multiMapSmooth(p, [0.862, 0.880], [0, 1]);
      const cresEarnProg = multiMapSmooth(p, [0.862, 0.880], [0, 1]);
      // L4 — "4626.fun"  Structural lock-in; holds at full width forever.
      const cres4Op    = multiMapSmooth(p, [0.875, 0.892], [0, 1]);
      const cresRuleW  = Math.max(0, mapRange(p, 0.878, 0.895, 0, 260));
      const cresRuleOp = multiMapSmooth(p, [0.878, 0.895], [0, 1]);
      const cres4BrandTagIn = multiMapSmooth(p, [0.886, 0.900], [0, 1]);
      // L5 — Partners + CTA finale; reveal 0.890→0.906, HOLD to end.
      const cresFinaleOp = multiMapSmooth(p, [0.890, 0.906], [0, 1]);

      // ═══ PHASE F (p 0.95 → end): Brand close — NOW UNDERNEATH L4 ═══
      // The "4626.fun" wordmark and "Earn together." tag are now carried by
      // the crescendo (L4 and L3 respectively), so the corresponding DOM
      // elements (#close-brand, #close-tag, #close-line) are held at 0
      // opacity throughout. Partners row + CTA fade in gently under L4 so
      // the viewer can still act on the page — the final frame is:
      //   (4626.fun wordmark)
      //        — — —
      //   Base · Zora · Uniswap · LayerZero · Chainlink · Solana · Meteora · Ajna · Charm
      //   [ Join Waitlist ]
      // Phase F container (close-final/partners/brand/cta/tag/line) is
      // fully retired in this restructure round. The equivalent roles are
      // now owned by the crescendo L4 (4626.fun) + L5 (partners + CTA).
      // All held at 0 so they never compete with the new sequence.
      const finalOp    = 0;
      const partnersOp = 0;
      const brandOp    = 0;
      const lineW      = 0;
      const lineOp     = 0;
      const tagOp      = 0;
      const ctaOp      = 0;
      const logoConverge = 0;

      WriteBatch.write(() => {
        section.querySelector('.scene-pin').style.opacity = sceneOp;

        // ── PHASE A: persistent pair continues into close ──
        // The float-tokens container is already in the DOM (z-index 5), already
        // on-screen (floatingTokens kept opacity ≥ 0.55 through vaults exit).
        // chapterClose now inherits the live pose from Continuity and eases
        // the SAME pair from its drifted-out pose into the hero position,
        // growing share to hero size. No crossfade to a separate sprite.
        //
        // CRITICAL: gate pair writes on self.isActive. GSAP's onUpdate fires
        // for every trigger on every scroll frame regardless of range, and
        // this block (defined after floatingTokens) was the last writer, so
        // before the gate it stomped floatingTokens' pose during dual/vaults.
        // That's why pair appeared frozen at an arbitrary pose through
        // multiple chapters.
        // PAIR BAN — close is NOT in PAIR_ALLOWED. The prior solution grew
        // the persistent float-share into the close hero sprite; the new
        // solution hands off via cards (vc-0 share-img → close-card-share,
        // vc-0 coin-img → close-card-under), the vault grid→close-vault-node
        // merge, and the headline split into close-tag + close-cta. The
        // glow halo phase A below is preserved but no longer carries a
        // globally persistent token sprite underneath it.
        void floatContainerZ; void floatShareZ; void floatUnderZ;
        if (self.isActive) Continuity.hidePair();

        // ── PHASE A: Typographic overture (no circular image, no halo) ──
        if (phaseA) {
          phaseA.style.opacity = phaseAOp;
        }
        if (heroShare) { // heroShare now refers to .close-overture (same id)
          heroShare.style.transform = `translate(calc(-50% + ${mx * 1.2}px), calc(-50% + ${my * 0.8}px)) scale(${overtureScale})`;
          heroShare.style.letterSpacing = `${overtureSpread}em`;
          heroShare.style.filter = overtureBlur > 0.08 ? `blur(${overtureBlur}px)` : 'none';
        }

        // ── PHASE B-C: Token cards ──
        if (cardsLayer) {
          cardsLayer.style.opacity = cardsOp * cardsFadeOut;
        }
        if (cardShare) {
          // In phase D, converge toward center
          const convX = convergeProg * (vw * 0.20); // pull share card back toward center
          const convScale = 1 - convergeProg * 0.35;

          // VAULTS → CLOSE FLIP: at entry (p 0.13 → 0.22), offset the
          // close-card-share from #vc-0's .vault-card-share-img rect so
          // the card emerges from the vault card the viewer was just
          // watching. flipT=1 at entry, 0 at settle.
          let flipDx = 0, flipDy = 0;
          const vShareRect = Continuity.getBridge('vaultExitShareRect');
          if (vShareRect) {
            const flipT = 1 - multiMapSmooth(p, [0.13, 0.24], [0, 1]);
            if (flipT > 0.001) {
              const csRect = cardShare.getBoundingClientRect();
              const csCx = csRect.left + csRect.width / 2;
              const csCy = csRect.top + csRect.height / 2;
              flipDx = (vShareRect.x - csCx) * flipT;
              flipDy = (vShareRect.y - csCy) * flipT;
            }
          }

          cardShare.style.opacity = shareCardOp;
          cardShare.style.transform = `translate(calc(-50% + ${shareCardX + convX + mx + flipDx}px), calc(-50% + ${my * 0.8 + flipDy}px)) scale(${shareCardScale * convScale})`;
        }
        if (cardUnder) {
          const convX = convergeProg * (-vw * 0.20); // pull underlying card toward center
          const convScale = 1 - convergeProg * 0.35;
          // VAULTS → CLOSE FLIP: close-card-under enters from #vc-0's
          // .vault-card-icon (the AKITA underlying coin). Matrix §6 row (2).
          let flipDx = 0, flipDy = 0;
          const vCoinRect = Continuity.getBridge('vaultExitCoinRect');
          if (vCoinRect) {
            const flipT = 1 - multiMapSmooth(p, [0.26, 0.38], [0, 1]);
            if (flipT > 0.001) {
              const cuRect = cardUnder.getBoundingClientRect();
              const cuCx = cuRect.left + cuRect.width / 2;
              const cuCy = cuRect.top + cuRect.height / 2;
              flipDx = (vCoinRect.x - cuCx) * flipT;
              flipDy = (vCoinRect.y - cuCy) * flipT;
            }
          }
          cardUnder.style.opacity = underCardOp;
          cardUnder.style.transform = `translate(calc(-50% + ${underCardX + convX + mx + flipDx}px), calc(-50% + ${my * 0.8 + flipDy}px)) scale(${underCardScale * convScale})`;
        }

        // ── PHASE D-E: Vault collision ──
        if (vaultLayer) {
          // Don't fade the whole layer when rings are active — the canvas is inside it
          // Instead, control vault node + tokens individually and keep canvas layer visible
          const vaultLayerOpFinal = ringOpacity > 0.01
            ? Math.max(vaultLayerOp, ringOpacity)
            : vaultLayerOp * Math.max(vaultFadeOut, 0);
          vaultLayer.style.opacity = vaultLayerOpFinal;
        }
        if (vaultNode) {
          // VAULTS → CLOSE FLIP: vaultNode merges in from the captured
          // 4-card grid center. Matrix §6 row (3): 4-card aggregation →
          // single 4626 vault node. At entry (p 0.48 → 0.60), the plate
          // rides in from the grid center so the viewer's eye travels
          // from the grid they just watched straight to this plate.
          let gflipDx = 0, gflipDy = 0;
          const vGridRect = Continuity.getBridge('vaultExitGridRect');
          if (vGridRect) {
            const flipT = 1 - multiMapSmooth(p, [0.48, 0.62], [0, 1]);
            if (flipT > 0.001) {
              const vnRect = vaultNode.getBoundingClientRect();
              const vnCx = vnRect.left + vnRect.width / 2;
              const vnCy = vnRect.top + vnRect.height / 2;
              gflipDx = (vGridRect.x - vnCx) * flipT * 0.5; // half-pull for elegance
              gflipDy = (vGridRect.y - vnCy) * flipT * 0.5;
            }
          }
          vaultNode.style.opacity = vaultNodeOp * Math.max(vaultFadeOut, 0);
          vaultNode.style.transform = `translate(calc(-50% + ${gflipDx}px), calc(-50% + ${vaultNodeY + gflipDy}px)) scale(${vaultNodeScale * vaultPulse})`;
          // Drive the two hairline rules as the plate settles
          const ruleTop = vaultNode.querySelector('.close-vault-rule-top');
          const ruleBot = vaultNode.querySelector('.close-vault-rule-bot');
          if (ruleTop) {
            ruleTop.style.opacity = vaultRuleT;
            ruleTop.style.transform = `scaleX(${0.15 + vaultRuleT * 0.85})`;
          }
          if (ruleBot) {
            ruleBot.style.opacity = vaultRuleT;
            ruleBot.style.transform = `scaleX(${0.15 + vaultRuleT * 0.85})`;
          }
        }
        // Convergence marks: vertical hairlines sliding in from outside to
        // meet the plate. Replaces the old orbiting token ghosts.
        if (vaultTokL) { // id=close-vault-tl now points at .close-vault-mark-l
          vaultTokL.style.opacity = markT * 0.9;
          vaultTokL.style.transform = `translate(calc(-50% - ${markTravel}px), -50%)`;
        }
        if (vaultTokR) {
          vaultTokR.style.opacity = markT * 0.9;
          vaultTokR.style.transform = `translate(calc(-50% + ${markTravel}px), -50%)`;
        }

        // Particles — collision burst (rings handle their own drawing via rAF)
        if (collisionParticle > 0 && !ringActive) drawParticles(collisionParticle);
        else if (!ringActive && pCtx && particleCanvas) pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        // Keep particle canvas visible when rings are active (behind final content)
        if (particleCanvas) {
          particleCanvas.style.opacity = (collisionParticle > 0 || ringOpacity > 0.01) ? '1' : '0';
        }

        // ── PHASE F: Final page ──
        if (finalContainer) finalContainer.style.opacity = finalOp;
        if (partners) {
          partners.style.opacity = partnersOp;
          partners.style.transform = `translateX(${mx * 0.8}px) translateY(${my * 0.8}px)`;
        }
        if (brand) {
          brand.style.opacity = brandOp;
          brand.style.transform = `translateX(${mx * 1.2}px) translateY(${my * 1.2}px)`;
        }
        if (line) {
          // VAULTS → CLOSE compress: close-line inherits the x-center of
          // the vault-featured-stats border-top rule it came from. Matrix
          // §6 row (6): stat rows' horizontal rule geometry becomes the
          // close-scene horizontal brand line.
          line.style.width = `${lineW}px`;
          line.style.opacity = lineOp;
        }
        if (tag) {
          // VAULTS → CLOSE split: vaults-headline "Deposit. Earn together."
          // splits — "Deposit." drops away, "Earn together." migrates to
          // #close-tag. Matrix §6 row (4). We don't literally move DOM
          // but we time the tag reveal to pick up where the headline left
          // off (its bridge rect was captured at vaults exit).
          tag.style.opacity = tagOp;
          tag.style.transform = `translateY(${(1 - tagOp) * 6}px)`;
        }
        if (cta) {
          // VAULTS → CLOSE matched-position continuity (matrix §6 row 4):
          // #close-cta inherits the on-screen position of #vaults-cta so the
          // viewer's control affordance feels like the same object across
          // the boundary, not a fresh CTA dropped in. Uses vaultExitCtaRect
          // captured at vaults p 0.72–0.82. FLIP window is the close-cta
          // reveal ramp (p 0.72–0.92); flipT=1 at start, 0 at settle.
          //
          // REDUCED MOTION: skip the FLIP translate AND the mouse-parallax
          // drift (both are decorative non-scroll motion). The reveal ramp
          // (ctaOp) still fades the CTA in, so the handoff degrades to a
          // clean opacity-only arrival at the CTA's native CSS position.
          cta.style.opacity = ctaOp;
          if (Motion.reduced) {
            cta.style.transform = '';
          } else {
            let ctaFlipDx = 0, ctaFlipDy = 0;
            const vCtaRect = Continuity.getBridge('vaultExitCtaRect');
            if (vCtaRect) {
              const ctaFlipT = 1 - multiMapSmooth(p, [0.72, 0.92], [0, 1]);
              if (ctaFlipT > 0.001) {
                const cr = cta.getBoundingClientRect();
                const cx = cr.left + cr.width / 2;
                const cy = cr.top  + cr.height / 2;
                ctaFlipDx = (vCtaRect.x - cx) * ctaFlipT;
                ctaFlipDy = (vCtaRect.y - cy) * ctaFlipT;
              }
            }
            cta.style.transform = `translateX(${mx * 0.5 + ctaFlipDx}px) translateY(${(1 - ctaOp) * 10 + my * 0.5 + ctaFlipDy}px)`;
          }
        }
        if (closeLogo) {
          closeLogo.style.filter = `drop-shadow(0 0 ${12 + logoConverge * 28}px rgba(0, 82, 255, ${logoConverge * 0.28}))`;
          closeLogo.style.transform = `scale(${1 + logoConverge * 0.04}) translateX(${mx * 1.1}px) translateY(${my * 0.8}px)`;
        }

        // ── PHASE G: Crescendo finale ──
        // Four-line typographic poster revealed in sequence (p 0.88 → 1.00).
        // Each line uses a distinct motion family so no adjacent reveal
        // shares a dominant direction, satisfying the motion-direction
        // contract (inward compression → horizontal split → depth recession
        // → structural lock-in). Reduced motion degrades to opacity-only:
        // we skip all transform / letter-spacing / filter writes and let
        // the CSS @media (prefers-reduced-motion: reduce) block provide
        // the final resting poses (letter-spacing on L1, rule widths) for
        // an accessible static reveal.
        if (crescendo) {
          crescendo.style.opacity = cresContainerOp;
        }
        // Ambient aura — soft radial gradient pulse behind the stack. Only
        // opacity + scale are written (CSS owns the gradient, blur, mix-blend).
        // The aura breathes via easeOutQuint on scale so the page feels "lit"
        // without drawing attention to itself.
        if (cresAura) {
          cresAura.style.opacity = cresAuraOp;
          if (!Motion.reduced) {
            cresAura.style.transform = `translate(-50%, -50%) scale(${cresAuraScale.toFixed(4)})`;
          } else {
            cresAura.style.transform = '';
          }
        }
        // ── Stack ↔ Poster handoff ──
        // .cres-stack carries L1/L1.5/L2/L2.5/L3 (stage-cell crossfade). It
        // fades out 0.840→0.862 to clear the field for the composed final
        // poster. #cres-finale-poster (sibling of .cres-stack) carries
        // L3.5/L4/L5 and fades in 0.858→0.885, HOLDING to end. The two
        // curves overlap for 4ms of p so there's never a dark frame between.
        if (cresStack) {
          cresStack.style.opacity = cresStackOp;
        }
        if (cresFinalePoster) {
          cresFinalePoster.style.opacity = cresPosterOp;
          // Poster becomes interactive (CTA click, link hovers) only once
          // it's substantially visible. Avoids stealing clicks during the
          // handoff window when it's still mostly transparent.
          cresFinalePoster.style.pointerEvents = cresPosterOp > 0.5 ? 'auto' : 'none';
        }
        if (cresLine1) {
          cresLine1.style.opacity = cres1Op;
          if (!Motion.reduced) {
            // 0.25em (wide) → -0.015em (tight); inward compression.
            const ls1 = 0.25 - cres1Prog * 0.265;
            cresLine1.style.letterSpacing = `${ls1}em`;
          } else {
            cresLine1.style.letterSpacing = '';
          }
        }
        if (cresLine2) {
          cresLine2.style.opacity = cres2Op;
        }
        if (cresSplitL) {
          cresSplitL.style.opacity = cres2Op;
          if (!Motion.reduced) {
            const tx = -24 * (1 - cres2Prog);
            cresSplitL.style.transform = `translateX(${tx}px)`;
          } else {
            cresSplitL.style.transform = '';
          }
        }
        if (cresSplitR) {
          cresSplitR.style.opacity = cres2Op;
          if (!Motion.reduced) {
            const tx = 24 * (1 - cres2Prog);
            cresSplitR.style.transform = `translateX(${tx}px)`;
          } else {
            cresSplitR.style.transform = '';
          }
        }
        // Sublabels beneath L2 — fade in during L2 hold, lift up 6px → 0.
        if (cresSubs) {
          cresSubs.style.opacity = cres2SubOp;
        }
        if (cresSubL && !Motion.reduced) {
          const ty = 6 * (1 - cres2SubOp);
          cresSubL.style.transform = `translateY(${ty.toFixed(2)}px)`;
        } else if (cresSubL) {
          cresSubL.style.transform = '';
        }
        if (cresSubR && !Motion.reduced) {
          const ty = 6 * (1 - cres2SubOp);
          cresSubR.style.transform = `translateY(${ty.toFixed(2)}px)`;
        } else if (cresSubR) {
          cresSubR.style.transform = '';
        }
        if (cresSubDiv) {
          cresSubDiv.style.opacity = (cres2SubOp * 0.6).toFixed(3);
        }
        if (cresLine3) {
          cresLine3.style.opacity = cres3Op;
          if (!Motion.reduced) {
            // Depth recession: scale 1.22 → 1.00, blur 4px → 0 as prog 0→1.
            const sc3 = 1.22 - cres3Prog * 0.22;
            const bl3 = Math.max(0, 4 * (1 - cres3Prog));
            cresLine3.style.transform = `scale(${sc3})`;
            cresLine3.style.filter = bl3 > 0.05 ? `blur(${bl3.toFixed(2)}px)` : 'none';
          } else {
            cresLine3.style.transform = '';
            cresLine3.style.filter = '';
          }
        }
        // ── L3.5 — "Earn together." (italic crossfade + letter-spread relax) ──
        if (cresLineEarn) {
          cresLineEarn.style.opacity = cresEarnOp;
          if (!Motion.reduced) {
            // 0.06em (wide whisper) → -0.02em (settled); quint tail so the
            // relax arrives softly, matching the italic's implied cadence.
            const lsE = 0.06 - easeOutQuint(cresEarnProg) * 0.08;
            cresLineEarn.style.letterSpacing = `${lsE.toFixed(4)}em`;
          } else {
            cresLineEarn.style.letterSpacing = '';
          }
        }
        if (cresLine4) {
          cresLine4.style.opacity = cres4Op;
        }
        // Brand mark (glowing cream dot) fades with L4 parent; CSS handles
        // the dot glow animation so JS only needs opacity inheritance.
        if (cresBrandMark) {
          cresBrandMark.style.opacity = cres4Op;
        }
        // Brand tag ("Creator vaults on Base") whispers in just after the
        // wordmark lands, then fades with the parent on exit.
        if (cresBrandTag) {
          cresBrandTag.style.opacity = (cres4BrandTagIn * cres4Op).toFixed(3);
        }
        // ── L5 — Partners + CTA finale ──
        if (cresLineFinale) {
          cresLineFinale.style.opacity = cresFinaleOp;
          if (!Motion.reduced) {
            // Subtle lift 8px → 0 on arrival so the row "settles" beneath L4.
            const ty = 8 * (1 - easeOutQuint(cresFinaleOp));
            cresLineFinale.style.transform = `translateY(${ty.toFixed(2)}px)`;
          } else {
            cresLineFinale.style.transform = '';
          }
        }
        // Finale label ("Built with") + meta ("Early access · No spam ·
        // Unsubscribe anytime") inherit the L5 parent opacity. CSS owns
        // their typography and color; JS just keeps them in sync with the
        // row's arrival so they don't flicker.
        if (cresFinaleLabel) cresFinaleLabel.style.opacity = cresFinaleOp;
        if (cresFinaleMeta) cresFinaleMeta.style.opacity = cresFinaleOp;
        if (cresRuleT) {
          cresRuleT.style.opacity = cresRuleOp;
          if (!Motion.reduced) {
            cresRuleT.style.width = `${cresRuleW}px`;
          } else {
            cresRuleT.style.width = '';
          }
        }
        if (cresRuleB) {
          cresRuleB.style.opacity = cresRuleOp;
          if (!Motion.reduced) {
            cresRuleB.style.width = `${cresRuleW}px`;
          } else {
            cresRuleB.style.width = '';
          }
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 11. VAULT CARD 3D TILT ON HOVER
// ────────────────────────────────────────────
// Hover tilt stored as data attributes so the scroll-driven WriteBatch
// can merge it with the depth-parallax transforms without fighting.
(function initVaultCardTilt() {
  const cards = document.querySelectorAll('.vault-card');
  const MAX_TILT = 12;

  cards.forEach(card => {
    card.dataset.hoverRx = '0';
    card.dataset.hoverRy = '0';
    card.dataset.hoverScale = '1';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.dataset.hoverRx = String(-y * MAX_TILT);
      card.dataset.hoverRy = String(x * MAX_TILT);
      card.dataset.hoverScale = '1.02';
    });

    card.addEventListener('mouseleave', () => {
      card.dataset.hoverRx = '0';
      card.dataset.hoverRy = '0';
      card.dataset.hoverScale = '1';
    });
  });
})();

// ────────────────────────────────────────────
// 12. ENHANCED SOUND DESIGN — Additional audio wiring
// ────────────────────────────────────────────
(function enhancedAudio() {
  // Bass pulse on CTA hover
  document.querySelectorAll('.cta-button, .enter-vaults-btn, .nav-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      AudioEngine.playSoftImpact();
    });
  });

  // Chime when vault cards enter view (triggered once)
  let vaultChimePlayed = false;
  const vaultsSection = document.getElementById('ch-vaults');
  if (vaultsSection) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !vaultChimePlayed) {
          AudioEngine.playChime(0.8);
          vaultChimePlayed = true;
        }
      });
    }, { threshold: 0.15 });
    obs.observe(vaultsSection);
  }
})();

// ────────────────────────────────────────────
// 13. PARTICLE CONVERGENCE — Three.js particles drift to center at close
// ────────────────────────────────────────────
// Expose convergence factor as global for the Three.js particle loop to read
window.__particleConverge = 0;
(function trackConvergence() {
  const closeSection = document.getElementById('ch-close');
  if (!closeSection) return;
  ScrollTrigger.create({
    trigger: closeSection,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      window.__particleConverge = multiMapSmooth(self.progress, [0.50, 0.80], [0, 1]);
    },
    onLeave: () => { window.__particleConverge = 0; },
    onLeaveBack: () => { window.__particleConverge = 0; },
  });
})();

/* ── Premium energy-pulse flow animation on node graph ── */
/* Pulse flow animation removed — replaced by CSS stroke-dasharray animation on SVG edges */
