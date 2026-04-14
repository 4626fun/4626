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
          float dofScale = 1.0 + vDoF * 2.5;
          float dofAlpha = mix(1.0, 0.35, vDoF);

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
  const mat1 = makeBokehMaterial(0x0052FF, 6, 0.5, FOCAL_Z);
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
  const mat3 = makeBokehMaterial(0x3B82FF, 12, 0.35, FOCAL_Z);
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
    // Update pixel ratio uniform on all bokeh materials
    const pr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    [mat1, mat2, mat3].forEach(m => { if (m.uniforms) m.uniforms.uPixelRatio.value = pr; });
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
      float prog = clamp((uProgress - delay) / (1.0 - delay), 0.0, 1.0);
      prog = prog * prog * (3.0 - 2.0 * prog);

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
      const isMobile = vw < 768;
      // Responsive multiplier: 1.0 at desktop (1600px), scales down on mobile
      const rm = Math.min(1, vw / 1200);
      // Center Y: middle of viewport minus half the icon ring height
      // Desktop: 96px rings → 48px offset, Mobile: 76px rings → 38px offset
      const iconHalf = isMobile ? 38 : 48;
      const centerY = vh / 2 - iconHalf;
      const centerX = vw / 2;

      // ── Creator coin (AKITA) — SMOOTH CONTINUOUS MOTION ──
      // On mobile, use wider spread multiplier so detail panels don't collide
      const spread = isMobile ? Math.max(rm, 0.55) : rm;
      const coinOffsetX = multiMapSmooth(p,
        [0.018, 0.045, 0.055, 0.08,  0.12,  0.14,  0.165,  0.30,  0.51, 0.60],
        [-340*rm, 0,    0,     0,     0,     180*spread, 220*spread, 220*spread, 220*spread, 20*rm]
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
        [0,    -140*spread, -220*spread, -220*spread, -220*spread, -50*rm]
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
      // On mobile, skip the panX that reveals the allocation engine (hidden on mobile)
      const panX = isMobile ? 0 : mapEased(p, 0.64, 0.86, 0, -400 * rm);
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
// 8. CHAPTER 3: ACCRUE (650vh) + WebGL yield curve
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

  const TOTAL_DAYS = 243;
  const VAULT_LAUNCH = new Date(2025, 7, 10);
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  // ── Organic variable-rate model ──
  // Piecewise daily growth rates that create a believable yield curve:
  //   Days 0-30:   aggressive early yield  (~82% annualized)
  //   Days 30-75:  momentum builds          (~95% annualized)
  //   Days 75-120: correction/cooldown      (~38% annualized)
  //   Days 120-165: recovery phase           (~72% annualized)
  //   Days 165-210: mature steady yield      (~54% annualized)
  //   Days 210-243: late compression          (~41% annualized)
  const RATE_SEGMENTS = [
    { end:  30, apy: 0.82 },
    { end:  75, apy: 0.95 },
    { end: 120, apy: 0.38 },
    { end: 165, apy: 0.72 },
    { end: 210, apy: 0.54 },
    { end: 243, apy: 0.41 },
  ];

  // Pre-compute daily ratios with micro-noise for organic feel
  const _dailyRatio = new Float64Array(TOTAL_DAYS + 1);
  _dailyRatio[0] = 1.0;
  // Seeded pseudo-random for deterministic noise
  function seededRand(seed) {
    let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  {
    let seg = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      while (seg < RATE_SEGMENTS.length - 1 && d > RATE_SEGMENTS[seg].end) seg++;
      const baseDaily = Math.pow(1 + RATE_SEGMENTS[seg].apy, 1 / 365) - 1;
      // Add ±12% noise to daily rate for organic texture
      const noise = (seededRand(d) - 0.5) * 0.24 * baseDaily;
      _dailyRatio[d] = _dailyRatio[d - 1] * (1 + baseDaily + noise);
    }
  }
  const FINAL_RATIO = _dailyRatio[TOTAL_DAYS];

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

  // Populate milestone callout labels
  [30, 90, 180, 243].forEach(d => {
    const rSpan = document.getElementById('yc-r-' + d);
    const aSpan = document.getElementById('yc-a-' + d);
    if (rSpan) rSpan.textContent = ratioAtDay(d).toFixed(3);
    if (aSpan) aSpan.textContent = apyAtDay(d).toFixed(1) + '% APY';
  });

  // ── WebGL Yield Curve Renderer ──
  const gl = ycCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) { console.warn('WebGL not supported for yield curve'); return; }

  // Chart margins (normalized 0-1)
  const ML = 0.08, MR = 0.06, MT = 0.08, MB = 0.14;

  // Generate curve points (365 samples for smooth curve)
  const SAMPLES = 365;
  const curveVerts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const day = (i / SAMPLES) * TOTAL_DAYS;
    const r = ratioAtDay(day);
    // Map to chart space
    const x = ML + (day / TOTAL_DAYS) * (1 - ML - MR);
    const y = MB + ((r - 1.0) / (FINAL_RATIO - 1.0)) * (1 - MB - MT);
    curveVerts.push(x, y);
  }

  // Grid lines (horizontal) — dynamic based on final ratio
  const gridVerts = [];
  const gridStepCount = 5;
  const gridSteps = [];
  for (let i = 0; i < gridStepCount; i++) {
    gridSteps.push(1.0 + (FINAL_RATIO - 1.0) * (i / (gridStepCount - 1)));
  }
  gridSteps.forEach(r => {
    const y = MB + ((r - 1.0) / (FINAL_RATIO - 1.0)) * (1 - MB - MT);
    gridVerts.push(ML, y, 1 - MR, y);
  });
  // Vertical grid
  [0, 60, 120, 180, TOTAL_DAYS].forEach(d => {
    const x = ML + (d / TOTAL_DAYS) * (1 - ML - MR);
    gridVerts.push(x, MB, x, 1 - MT);
  });

  // Shaders
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

  // Grid shader (simple)
  const gridVS = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const gridFS = `
    precision mediump float;
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 0.04);
    }`;
  const gridProg = linkProgram(
    compileShader(gridVS, gl.VERTEX_SHADER),
    compileShader(gridFS, gl.FRAGMENT_SHADER)
  );
  const gridPosLoc = gl.getAttribLocation(gridProg, 'a_pos');
  const gridBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVerts), gl.STATIC_DRAW);

  // Curve shader (glowing blue with bloom)
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
    varying vec2 v_uv;
    void main() {
      float glow = 0.85 + 0.15 * sin(u_time * 2.0 + v_uv.x * 12.0);
      gl_FragColor = vec4(0.0, 0.32 * glow, 1.0 * glow, 1.0);
    }`;
  const curveProg = linkProgram(
    compileShader(curveVS, gl.VERTEX_SHADER),
    compileShader(curveFS, gl.FRAGMENT_SHADER)
  );
  const curvePosLoc = gl.getAttribLocation(curveProg, 'a_pos');
  const uDrawPct = gl.getUniformLocation(curveProg, 'u_drawPct');
  const uTime = gl.getUniformLocation(curveProg, 'u_time');
  const curveBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(curveVerts), gl.STATIC_DRAW);

  // Glow pass shader (thicker, dimmer line for bloom)
  const glowFS = `
    precision mediump float;
    uniform float u_time;
    varying vec2 v_uv;
    void main() {
      float pulse = 0.7 + 0.3 * sin(u_time * 1.5 + v_uv.x * 8.0);
      gl_FragColor = vec4(0.0, 0.2 * pulse, 0.8 * pulse, 0.35);
    }`;
  const glowProg = linkProgram(
    compileShader(curveVS, gl.VERTEX_SHADER),
    compileShader(glowFS, gl.FRAGMENT_SHADER)
  );
  const glowPosLoc = gl.getAttribLocation(glowProg, 'a_pos');
  const uGlowTime = gl.getUniformLocation(glowProg, 'u_time');

  // Fill shader (gradient under curve)
  // Build fill geometry: for each curve point, add a bottom vertex
  function buildFillVerts(count) {
    const verts = [];
    for (let i = 0; i <= count && i <= SAMPLES; i++) {
      const x = curveVerts[i * 2];
      const y = curveVerts[i * 2 + 1];
      verts.push(x, y);         // top (on curve)
      verts.push(x, MB);        // bottom (baseline)
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
      float alpha = h * 0.12;
      gl_FragColor = vec4(0.0, 0.2, 1.0, alpha);
    }`;
  const fillProg = linkProgram(
    compileShader(fillVS, gl.VERTEX_SHADER),
    compileShader(fillFS, gl.FRAGMENT_SHADER)
  );
  const fillPosLoc = gl.getAttribLocation(fillProg, 'a_pos');
  const uFillTop = gl.getUniformLocation(fillProg, 'u_top');

  // State
  let drawProgress = 0; // 0-1 how much of curve is drawn
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

    // 2. Fill under curve
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

    // 3. Glow pass (wide line)
    gl.useProgram(glowProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
    gl.enableVertexAttribArray(glowPosLoc);
    gl.vertexAttribPointer(glowPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uGlowTime, animTime);
    gl.lineWidth(Math.min(4, gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1]));
    gl.drawArrays(gl.LINE_STRIP, 0, drawCount);

    // 4. Main curve (thin bright line)
    gl.useProgram(curveProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
    gl.enableVertexAttribArray(curvePosLoc);
    gl.vertexAttribPointer(curvePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uDrawPct, drawProgress);
    gl.uniform1f(uTime, animTime);
    gl.lineWidth(Math.min(2, gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1]));
    gl.drawArrays(gl.LINE_STRIP, 0, drawCount);

    requestAnimationFrame(render);
  }

  // ── Milestone callouts positioning ──
  const calloutData = [
    { day: 30,  el: document.getElementById('yc-ms-30'),  chimed: false, pitch: 1.0 },
    { day: 90,  el: document.getElementById('yc-ms-90'),  chimed: false, pitch: 1.25 },
    { day: 180, el: document.getElementById('yc-ms-180'), chimed: false, pitch: 1.5 },
    { day: 243, el: document.getElementById('yc-ms-243'), chimed: false, pitch: 1.8 },
  ];

  function positionCallouts() {
    const rect = ycCanvas.getBoundingClientRect();
    const wrapRect = ycWrap.getBoundingClientRect();
    calloutData.forEach(ms => {
      const xNorm = ML + (ms.day / TOTAL_DAYS) * (1 - ML - MR);
      const r = ratioAtDay(ms.day);
      const yNorm = MB + ((r - 1.0) / (FINAL_RATIO - 1.0)) * (1 - MB - MT);
      const px = rect.left - wrapRect.left + xNorm * rect.width;
      const py = rect.top - wrapRect.top + (1 - yNorm) * rect.height;
      // Cap the callout position so the card doesn't clip the right edge
      const cappedPx = Math.min(px, wrapRect.width - 10);
      ms.el.style.left = `${cappedPx}px`;
      ms.el.style.bottom = `${wrapRect.height - py + 4}px`;
      // Shift callout card alignment based on proximity to right edge
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

      // Audio: drone during accrue
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.50, 0.86, 0.96], [0.02, 0.06, 0.08, 0.06, 0.02]));

      const sceneOp = multiMapSmooth(p, [0, 0.06, 0.86, 0.96], [0, 1, 1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      intro.style.opacity = multiMapSmooth(p, [0.06, 0.16], [0, 1]);
      if (ratioDisplay) ratioDisplay.style.opacity = multiMapSmooth(p, [0.08, 0.18], [0, 1]);
      if (pair) pair.style.opacity = multiMapSmooth(p, [0.10, 0.20], [0, 1]);
      clock.style.opacity = multiMapSmooth(p, [0.18, 0.26], [0, 1]);
      if (ycWrap) ycWrap.style.opacity = multiMapSmooth(p, [0.22, 0.32], [0, 1]);
      stats.style.opacity = multiMapSmooth(p, [0.38, 0.48], [0, 1]);
      if (equation) equation.style.opacity = multiMapSmooth(p, [0.38, 0.48], [0, 1]);

      // Map scroll to curve draw progress
      const curveP = mapRange(p, 0.28, 0.78, 0, 1);
      drawProgress = Math.max(0, Math.min(1, curveP));

      // Day + ratio from draw progress
      const dayFloat = drawProgress * TOTAL_DAYS;
      const currentDay = Math.round(Math.max(0, Math.min(TOTAL_DAYS, dayFloat)));

      const date = new Date(VAULT_LAUNCH);
      date.setDate(date.getDate() + currentDay);
      const dateStr = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
      clockDate.textContent = dateStr;

      const clampedRatio = ratioAtDay(currentDay);

      // Rolling 7-day APY for organic feel
      let apy = apyAtDay(currentDay);

      statDays.textContent = currentDay;
      statRatio.textContent = clampedRatio.toFixed(3);
      statApy.textContent = `${apy.toFixed(1)}%`;
      if (equation) equation.textContent = `1 ■AKITA = ${clampedRatio.toFixed(3)} AKITA`;
      if (ratioValue) ratioValue.textContent = clampedRatio.toFixed(3);

      // Position + activate callouts
      positionCallouts();
      calloutData.forEach(ms => {
        const wasActive = ms.el.classList.contains('active');
        if (currentDay >= ms.day) {
          ms.el.classList.add('active');
          if (!wasActive && !ms.chimed) {
            AudioEngine.playChime(ms.pitch);
            ms.chimed = true;
          }
        } else {
          ms.el.classList.remove('active');
          ms.chimed = false;
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
