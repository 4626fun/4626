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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // Soft circle texture
  function makeCircleTexture(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  const tex = makeCircleTexture(64);

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
  const mat1 = new THREE.PointsMaterial({
    size: 0.06,
    color: 0x0052FF,
    transparent: true,
    opacity: 0.5,
    map: tex,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
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
  const mat2 = new THREE.PointsMaterial({
    size: 0.04,
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.12,
    map: tex,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
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
  const mat3 = new THREE.PointsMaterial({
    size: 0.12,
    color: 0x3B82FF,
    transparent: true,
    opacity: 0.35,
    map: tex,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geo3, mat3));

  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.4;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
  });

  function updateParticles(posArr, velArr, count, bound) {
    for (let i = 0; i < count; i++) {
      posArr[i * 3]     += velArr[i * 3];
      posArr[i * 3 + 1] += velArr[i * 3 + 1];
      posArr[i * 3 + 2] += velArr[i * 3 + 2];
      if (posArr[i * 3] > bound) posArr[i * 3] = -bound;
      if (posArr[i * 3] < -bound) posArr[i * 3] = bound;
      if (posArr[i * 3 + 1] > bound) posArr[i * 3 + 1] = -bound;
      if (posArr[i * 3 + 1] < -bound) posArr[i * 3 + 1] = bound;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    updateParticles(pos1, vel1, COUNT1, 10);
    updateParticles(pos2, vel2, COUNT2, 15);
    updateParticles(pos3, vel3, COUNT3, 8);
    geo1.attributes.position.needsUpdate = true;
    geo2.attributes.position.needsUpdate = true;
    geo3.attributes.position.needsUpdate = true;

    camera.position.x += (mouseX - camera.position.x) * 0.015;
    camera.position.y += (-mouseY - camera.position.y) * 0.015;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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

  // ── Shaders ──
  const vertSrc = `
    attribute vec2 aStartPos;
    attribute vec2 aEndPos;
    attribute float aRandom;
    attribute float aDelay;
    uniform float uProgress;
    uniform float uTime;
    uniform float uScale;
    varying float vAlpha;
    varying float vRandom;

    void main() {
      float delay = aDelay * 0.3;
      float prog = clamp((uProgress - delay) / (1.0 - delay), 0.0, 1.0);
      // Smooth step with cubic ease
      prog = prog * prog * (3.0 - 2.0 * prog);

      // Explode outward in the middle of the transition
      float explode = sin(prog * 3.14159);
      float noiseX = sin(aRandom * 47.3 + uTime * 2.0) * explode * 0.35;
      float noiseY = cos(aRandom * 91.7 + uTime * 1.7) * explode * 0.35;
      // Spiral component
      float angle = aRandom * 6.28 + prog * 4.0;
      float spiralR = explode * 0.2;
      noiseX += cos(angle) * spiralR;
      noiseY += sin(angle) * spiralR;

      vec2 pos = mix(aStartPos, aEndPos, prog) + vec2(noiseX, noiseY);
      gl_Position = vec4(pos * uScale, 0.0, 1.0);

      // Particle size varies, pulses during explosion
      float sizePulse = 1.0 + explode * 1.5;
      gl_PointSize = (1.5 + aRandom * 2.0) * sizePulse;

      // Fade at edges of transition
      vAlpha = smoothstep(0.0, 0.08, prog) * smoothstep(1.0, 0.92, prog);
      vAlpha *= 0.6 + aRandom * 0.4;
      vAlpha *= (1.0 + explode * 0.5);
      vRandom = aRandom;
    }
  `;

  const fragSrc = `
    precision mediump float;
    varying float vAlpha;
    varying float vRandom;
    uniform float uProgress;

    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float alpha = (1.0 - d * d) * vAlpha;
      // Color: transition from white/bright to blue
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

  function tick() {
    requestAnimationFrame(tick);
    render();
  }
  tick();

  return {
    setProgress(p) { currentProgress = Math.max(0, Math.min(1, p)); },
    getProgress() { return currentProgress; }
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
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
  progressBar.style.width = `${pct}%`;
}, { passive: true });

// ────────────────────────────────────────────
// 5. NAV VISIBILITY
// ────────────────────────────────────────────
const nav = document.getElementById('main-nav');
ScrollTrigger.create({
  trigger: document.body,
  start: 'top -2%',
  onUpdate: (self) => {
    nav.classList.toggle('visible', self.progress > 0.005);
  }
});

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

  chars.forEach((char, i) => {
    const wordIndex = parseInt(char.closest('.hero-word').dataset.word);
    const wordDelay = wordIndex * 0.22;
    entrance.to(char, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 0.6,
      ease: 'power4.out',
    }, 0.6 + wordDelay + i * 0.028);
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

  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5);
    const y = (e.clientY / window.innerHeight - 0.5);
    if (layerBack)  layerBack.style.transform  = `translate(${x * 8}px, ${y * 6}px)`;
    if (layerMid)   layerMid.style.transform   = `translate(${x * 16}px, ${y * 12}px)`;
    if (layerFront) layerFront.style.transform  = `translate(${x * 28}px, ${y * 20}px)`;
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

  // ── Scroll-driven exit + drone audio ──
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio: drone swell during hero
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.15, 0.40, 0.55], [0.04, 0.10, 0.10, 0.03]));

      const contentOp = multiMap(p, [0.40, 0.55], [1, 0]);
      heroContent.style.opacity = contentOp;

      if (heroFloats) heroFloats.style.opacity = contentOp * 0.7;

      if (scrollCue) scrollCue.style.opacity = multiMap(p, [0.05, 0.12], [1, 0]);

      const streakScaleY = multiMap(p, [0.50, 0.72], [1, 0]);
      const streakOp = multiMap(p, [0.65, 0.75], [1, 0]);
      streak.style.transform = `scaleY(${streakScaleY})`;
      streak.style.opacity = streakOp;
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
  const entryCue = document.getElementById('token-entry-cue');
  const labelYou = document.getElementById('label-you');
  const labelVault = document.getElementById('label-vault');
  const labelShares = document.getElementById('label-shares');
  const labelUnderlying = document.getElementById('label-underlying');
  const cameraWrapper = document.getElementById('camera-wrapper');

  const coin = document.getElementById('token-coin');
  const coinLabel = document.getElementById('coin-label');
  const coinDetail = document.getElementById('coin-detail');
  const share = document.getElementById('token-share');
  const shareLabel = document.getElementById('share-label');
  const shareDetail = document.getElementById('share-detail');

  const morphZone = document.getElementById('morph-zone');
  const morphLabel = document.getElementById('morph-label');

  const depositInfo = document.getElementById('deposit-info');
  const splitInfo = document.getElementById('split-info');
  const idleBadge = document.getElementById('idle-badge');
  const flowLine = document.getElementById('flow-line');
  const flowLineFill = document.getElementById('flow-line-fill');
  const engineBox = document.getElementById('engine-box');
  const strat0 = document.getElementById('strat-0');
  const strat1 = document.getElementById('strat-1');
  const strat2 = document.getElementById('strat-2');
  const downstream1 = document.getElementById('downstream-1');
  const downstream2 = document.getElementById('downstream-2');
  const branch0 = document.getElementById('branch-0');
  const branch1 = document.getElementById('branch-1');
  const branch2 = document.getElementById('branch-2');
  const feeLabel = document.getElementById('fee-label');
  const dualCopy = document.getElementById('dual-copy');
  const dualEntry = document.getElementById('dual-entry');

  // Audio state tracking
  let whooshPlayed = false;
  let depositSoundPlayed = false;

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio: drone continues through token journey
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.04, 0.50, 0.60, 0.95, 1.0], [0.03, 0.06, 0.06, 0.08, 0.08, 0.02]));

      // Audio: whoosh during morph
      if (p >= 0.065 && p <= 0.075 && !whooshPlayed) {
        AudioEngine.playWhoosh(0.7);
        whooshPlayed = true;
      }
      if (p < 0.06 || p > 0.13) whooshPlayed = false;

      // Audio: soft impact when deposit info appears
      if (p >= 0.65 && p <= 0.66 && !depositSoundPlayed) {
        AudioEngine.playSoftImpact();
        depositSoundPlayed = true;
      }
      if (p < 0.64 || p > 0.70) depositSoundPlayed = false;

      // ── Intro line — smooth fade/scale ──
      const introLineScaleY = multiMapSmooth(p, [0.003, 0.015], [0, 1]);
      const introLineOp = multiMapSmooth(p, [0.003, 0.007, 0.51, 0.57], [0, 1, 1, 0]);
      tokenLine.style.transform = `translateX(-50%) scaleY(${introLineScaleY})`;
      tokenLine.style.opacity = introLineOp;

      const lineGlow = multiMapSmooth(p, [0.024, 0.035, 0.047, 0.124, 0.176, 0.34, 0.40, 0.51, 0.57], [0.08, 1, 0.55, 0.55, 0.08, 0.08, 0.30, 0.30, 0]);
      tokenLineGlowEl.style.opacity = lineGlow;
      const lineW = multiMapSmooth(p, [0.003, 0.015, 0.024, 0.035, 0.047, 0.124, 0.176], [0, 1, 1, 3.5, 2, 2, 1]);
      tokenLineCoreEl.style.width = `${lineW}px`;

      // ════════════════════════════════════════════
      // TOKEN ALIGNMENT FIX — v5
      // Both coin and share are positioned at top:0,left:0 in CSS.
      // JS applies translate(X, Y) where Y = 50vh - 50px (half icon height)
      // and X = 50vw + offset. This guarantees identical vertical center.
      // ════════════════════════════════════════════
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Center Y: middle of viewport minus half the icon ring height (96px / 2 = 48)
      const centerY = vh / 2 - 48;
      const centerX = vw / 2;
      // Responsive multiplier: 1.0 at desktop (1600px), scales down on mobile
      const rm = Math.min(1, vw / 1200);

      // ── Creator coin (AKITA) — SMOOTH CONTINUOUS MOTION ──
      const coinOffsetX = multiMapSmooth(p,
        [0.018, 0.045, 0.055, 0.08,  0.12,  0.14,  0.165,  0.30,  0.51, 0.60],
        [-340*rm, 0,    0,     0,     0,     180*rm, 220*rm, 220*rm, 220*rm, 20*rm]
      );
      const coinOp = multiMapSmooth(p,
        [0.018, 0.03,  0.055, 0.075, 0.12,  0.14,  0.26, 0.30],
        [0,     1,     1,     0,     0,     1,     0.4,  1]
      );
      const coinScale = multiMapSmooth(p, [0.11, 0.165, 0.26, 0.30], [1, 0.82, 0.82, 1]);
      coin.style.transform = `translate(${centerX + coinOffsetX}px, ${centerY}px) translate(-50%, 0) scale(${coinScale})`;
      coin.style.opacity = coinOp;

      // Toggle depositing class for enhanced glow
      coin.classList.toggle('depositing', p > 0.14 && p < 0.60);

      // ── MORPH ZONE — WebGL particle transition ──
      const morphActive = (p >= 0.055 && p <= 0.135);
      const morphOp = multiMapSmooth(p, [0.055, 0.065, 0.125, 0.135], [0, 1, 1, 0]);

      if (morphZone) {
        morphZone.style.opacity = morphOp;
        if (morphActive && MorphSystem) {
          const morphProgress = mapRange(p, 0.06, 0.12, 0, 1);
          MorphSystem.setProgress(Math.max(0, Math.min(1, morphProgress)));
        }
      }
      if (morphLabel) {
        morphLabel.style.opacity = multiMapSmooth(p, [0.07, 0.085, 0.11, 0.125], [0, 1, 1, 0]);
      }

      // ── Vault share (■AKITA) — ALIGNED with coin, smooth motion ──
      // Emerges after morph, mirrors coin position on the opposite side, SAME centerY
      const shareOp = multiMapSmooth(p,
        [0.10, 0.13, 0.51, 0.60, 0.64, 0.67],
        [0,    1,    1,    0.35, 0.35, 0]
      );
      const shareOffsetX = multiMapSmooth(p,
        [0.10, 0.14, 0.165, 0.30, 0.51, 0.60],
        [0,    -140*rm, -220*rm, -220*rm, -220*rm, -50*rm]
      );
      const shareScale = multiMapSmooth(p, [0.10, 0.14, 0.51, 0.60], [0.6, 1, 1, 0.42]);
      share.style.transform = `translate(${centerX + shareOffsetX}px, ${centerY}px) translate(-50%, 0) scale(${shareScale})`;
      share.style.opacity = shareOp;

      // Toggle minted class for enhanced glow
      share.classList.toggle('minted', p > 0.13 && p < 0.60);

      // ── Copy and labels — smoothed ──
      topCopy.style.opacity = multiMapSmooth(p, [0.02, 0.047, 0.055, 0.065], [0, 1, 1, 0]);
      crossCopy.style.opacity = multiMapSmooth(p, [0.14, 0.176, 0.224, 0.259], [0, 1, 1, 0]);

      const leftLabelOp = multiMapSmooth(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      const rightLabelOp = multiMapSmooth(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      labelYou.style.opacity = leftLabelOp;
      labelVault.style.opacity = rightLabelOp;
      labelShares.style.opacity = leftLabelOp;
      labelUnderlying.style.opacity = rightLabelOp;
      coinLabel.style.opacity = rightLabelOp;
      shareLabel.style.opacity = leftLabelOp;

      entryCue.style.opacity = multiMapSmooth(p, [0.165, 0.20, 0.235, 0.271], [0, 1, 1, 0]);

      // ── Detail panels — smoothed ──
      const rightDetailOp = multiMapSmooth(p, [0.32, 0.37, 0.50, 0.54], [0, 1, 1, 0]);
      const leftDetailOp = multiMapSmooth(p, [0.37, 0.42, 0.49, 0.53], [0, 1, 1, 0]);
      coinDetail.style.opacity = rightDetailOp;
      shareDetail.style.opacity = leftDetailOp;

      dualCopy.style.opacity = multiMapSmooth(p, [0.42, 0.47, 0.50, 0.54], [0, 1, 1, 0]);
      dualEntry.style.opacity = multiMapSmooth(p, [0.46, 0.50, 0.51, 0.54], [0, 1, 1, 0]);

      // ── Camera zoom — smoother easing ──
      const cameraScale = multiMapSmooth(p, [0.50, 0.58, 0.62, 0.68], [1, 1.06, 1.06, 1]);
      const panX = mapEased(p, 0.64, 0.86, 0, -400 * rm);
      cameraWrapper.style.transform = `scale(${cameraScale}) translateX(${panX}px)`;

      // ── Deposit/allocation labels — smoothed ──
      depositInfo.style.opacity = multiMapSmooth(p, [0.65, 0.69], [0, 1]);
      splitInfo.style.opacity = multiMapSmooth(p, [0.68, 0.72], [0, 1]);
      idleBadge.style.opacity = multiMapSmooth(p, [0.70, 0.73], [0, 1]);

      // ── Flow line + engine — smoothed ──
      flowLine.style.opacity = multiMapSmooth(p, [0.71, 0.76], [0, 1]);
      const flowW = mapRange(p, 0.71, 0.77, 0, 100);
      flowLineFill.style.width = `${flowW}%`;
      engineBox.style.opacity = multiMapSmooth(p, [0.75, 0.79], [0, 1]);

      // ── Branches — smoothed ──
      const b0Op = multiMapSmooth(p, [0.79, 0.83], [0, 1]);
      const b1Op = multiMapSmooth(p, [0.83, 0.865], [0, 1]);
      const b2Op = multiMapSmooth(p, [0.875, 0.905], [0, 1]);
      branch0.style.opacity = b0Op;
      branch1.style.opacity = b1Op;
      branch2.style.opacity = b2Op;
      strat0.style.opacity = b0Op;
      strat1.style.opacity = b1Op;
      strat2.style.opacity = b2Op;

      // ── Downstreams ──
      downstream1.style.opacity = multiMapSmooth(p, [0.855, 0.89], [0, 1]);
      downstream2.style.opacity = multiMapSmooth(p, [0.895, 0.93], [0, 1]);

      // ── Fee label ──
      feeLabel.style.opacity = multiMapSmooth(p, [0.92, 0.95], [0, 1]);

      // ── Scene exit ──
      const sceneExit = multiMapSmooth(p, [0.96, 0.995], [1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneExit;
    }
  });
})();

// ────────────────────────────────────────────
// 8. CHAPTER 3: ACCRUE (650vh) + milestone chimes
// ────────────────────────────────────────────
(function chapterAccrue() {
  const section = document.getElementById('ch-accrue');
  const intro = document.getElementById('accrue-intro');
  const pair = document.getElementById('accrue-pair');
  const clock = document.getElementById('accrue-clock');
  const clockDate = document.getElementById('clock-date');
  const timeline = document.getElementById('accrue-timeline');
  const timelineFill = document.getElementById('timeline-fill');
  const timelineHead = document.getElementById('timeline-head');
  const stats = document.getElementById('accrue-stats');
  const statDays = document.getElementById('stat-days');
  const statRatio = document.getElementById('stat-ratio');
  const statApy = document.getElementById('stat-apy');
  const equation = document.getElementById('accrue-equation');

  const TOTAL_DAYS = 243;
  const FINAL_RATIO = 1.034;
  const VAULT_LAUNCH = new Date(2025, 7, 10);
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  const milestones = [
    { days: 30, el: document.getElementById('ms-30'), chimed: false, pitch: 1.0 },
    { days: 60, el: document.getElementById('ms-60'), chimed: false, pitch: 1.12 },
    { days: 90, el: document.getElementById('ms-90'), chimed: false, pitch: 1.25 },
    { days: 180, el: document.getElementById('ms-180'), chimed: false, pitch: 1.5 },
  ];

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio: drone during accrue
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.50, 0.86, 0.96], [0.02, 0.06, 0.08, 0.06, 0.02]));

      const sceneOp = multiMapSmooth(p, [0, 0.06, 0.86, 0.96], [0, 1, 1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      intro.style.opacity = multiMapSmooth(p, [0.06, 0.16], [0, 1]);
      if (pair) pair.style.opacity = multiMapSmooth(p, [0.10, 0.20], [0, 1]);
      clock.style.opacity = multiMapSmooth(p, [0.18, 0.26], [0, 1]);
      timeline.style.opacity = multiMapSmooth(p, [0.26, 0.34], [0, 1]);
      stats.style.opacity = multiMapSmooth(p, [0.38, 0.48], [0, 1]);
      equation.style.opacity = multiMapSmooth(p, [0.38, 0.48], [0, 1]);

      const dayFloat = mapRange(p, 0.24, 0.74, 0, TOTAL_DAYS);
      const currentDay = Math.round(Math.max(0, Math.min(TOTAL_DAYS, dayFloat)));

      const date = new Date(VAULT_LAUNCH);
      date.setDate(date.getDate() + currentDay);
      const dateStr = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
      clockDate.textContent = dateStr;

      const ratio = mapRange(p, 0.30, 0.74, 1.0, FINAL_RATIO);
      const clampedRatio = Math.max(1, Math.min(FINAL_RATIO, ratio));

      let apy = 0;
      if (currentDay > 7) {
        apy = (Math.pow(clampedRatio, 365 / currentDay) - 1) * 100;
      }

      statDays.textContent = currentDay;
      statRatio.textContent = clampedRatio.toFixed(3);
      statApy.textContent = `${apy.toFixed(1)}%`;
      equation.textContent = `1 ■AKITA = ${clampedRatio.toFixed(3)} AKITA`;

      const pct = (currentDay / TOTAL_DAYS) * 100;
      timelineFill.style.width = `${pct}%`;
      timelineHead.style.left = `${pct}%`;

      milestones.forEach(ms => {
        const wasReached = ms.el.classList.contains('reached');
        if (currentDay >= ms.days) {
          ms.el.classList.add('reached');
          // Play chime on first reach
          if (!wasReached && !ms.chimed) {
            AudioEngine.playChime(ms.pitch);
            ms.chimed = true;
          }
        } else {
          ms.el.classList.remove('reached');
          ms.chimed = false; // reset for scroll back
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

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio: drone during vaults
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.70, 0.94], [0.02, 0.05, 0.05, 0.01]));

      const sceneOp = multiMapSmooth(p, [0, 0.10, 0.82, 0.94], [0, 1, 1, 0]);
      const sceneY = multiMapSmooth(p, [0, 0.16], [40, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;
      section.querySelector('.vaults-container').style.transform = `translateY(${sceneY}px)`;

      cards.forEach((card, i) => {
        const start = 0.14 + i * 0.08;
        const end = 0.30 + i * 0.08;
        const op = mapRange(p, start, end, 0, 1);
        const y = mapRange(p, start, end, 30, 0);
        card.style.opacity = Math.min(1, Math.max(0, op));
        card.style.transform = `translateY(${Math.max(0, y)}px)`;
      });

      cta.style.opacity = multiMapSmooth(p, [0.56, 0.70], [0, 1]);
      disclaimer.style.opacity = multiMapSmooth(p, [0.64, 0.76], [0, 1]);
    }
  });
})();

// ────────────────────────────────────────────
// 10. CHAPTER 5: CLOSE (280vh)
// ────────────────────────────────────────────
(function chapterClose() {
  const section = document.getElementById('ch-close');
  const partners = document.getElementById('close-partners');
  const brand = document.getElementById('close-brand');
  const line = document.getElementById('close-line');
  const cta = document.getElementById('close-cta');
  const tag = document.getElementById('close-tag');

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // Audio: drone fades out at close
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.20, 0.70, 1.0], [0.02, 0.04, 0.04, 0]));

      const sceneOp = multiMapSmooth(p, [0.05, 0.25, 0.85, 1], [0, 1, 1, 0.9]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      if (partners) partners.style.opacity = multiMapSmooth(p, [0.05, 0.20], [0, 1]);
      brand.style.opacity = multiMapSmooth(p, [0.10, 0.28], [0, 1]);

      const lineH = mapRange(p, 0.28, 0.50, 0, 80);
      line.style.height = `${Math.max(0, lineH)}px`;
      line.style.opacity = multiMapSmooth(p, [0.28, 0.38], [0, 1]);

      cta.style.opacity = multiMapSmooth(p, [0.40, 0.56], [0, 1]);
      tag.style.opacity = multiMapSmooth(p, [0.52, 0.66], [0, 1]);
    }
  });
})();
