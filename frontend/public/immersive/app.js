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

  function animate() {
    requestAnimationFrame(animate);
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
// ── Vertical scroll progress line (left edge) ──
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
  progressBar.style.height = `${pct}%`;
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
  const nodeGraph = document.getElementById('node-graph');
  const engineHub = document.getElementById('engine-hub');
  const ngRowEngine = document.getElementById('ng-row-engine');
  const ngRowIdle = document.getElementById('ng-row-idle');
  const ngBranchSvg = document.getElementById('ng-branch-svg');
  const ngEdgeFan = document.getElementById('ng-edge-fan');
  const strat0 = document.getElementById('strat-0');
  const strat1 = document.getElementById('strat-1');
  const strat2 = document.getElementById('strat-2');
  const downstream1 = document.getElementById('downstream-1');
  const downstream2 = document.getElementById('downstream-2');
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
      // On mobile, lift coin upward during allocation phase to make room for engine below
      const coinLiftY = isMobile ? multiMapSmooth(p, [0.60, 0.68], [0, -vh * 0.28]) : 0;
      coin.style.transform = `translate(${centerX + coinOffsetX}px, ${centerY + coinLiftY}px) translate(-50%, 0) scale(${coinScale})`;
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

      // ── Deposit/allocation labels — fade out before node graph appears ──
      depositInfo.style.opacity = multiMapSmooth(p, [0.65, 0.69, 0.71, 0.74], [0, 1, 1, 0]);
      splitInfo.style.opacity   = multiMapSmooth(p, [0.67, 0.71, 0.71, 0.74], [0, 1, 1, 0]);

      // ── Node Graph — horizontal flow (token logo → engine → strategies → downstreams + idle) ──
      // Tight cascade: token logo + branch → engine hub → fan-out + strategies → downstreams → idle
      // Total reveal window: p 0.74 → 0.88
      if (nodeGraph) {
        nodeGraph.style.opacity = multiMapSmooth(p, [0.74, 0.77], [0, 1]);
      }

      // Branch SVG — fades in from token-coin
      if (ngBranchSvg) ngBranchSvg.style.opacity = multiMapSmooth(p, [0.75, 0.79], [0, 1]);

      // Engine Hub — follows immediately with subtle scale
      if (engineHub) {
        const ehOp = multiMapSmooth(p, [0.76, 0.80], [0, 1]);
        engineHub.style.opacity = ehOp;
        engineHub.style.transform = `scale(${0.92 + ehOp * 0.08})`;
      }

      // Fan-out edges from engine — starts as engine solidifies
      if (ngEdgeFan) ngEdgeFan.style.opacity = multiMapSmooth(p, [0.78, 0.82], [0, 1]);

      // Strategy nodes — tight stagger with slide-in from left
      const s0Op = multiMapSmooth(p, [0.79, 0.83], [0, 1]);
      const s1Op = multiMapSmooth(p, [0.805, 0.845], [0, 1]);
      const s2Op = multiMapSmooth(p, [0.82, 0.86], [0, 1]);
      strat0.style.opacity = s0Op;
      strat1.style.opacity = s1Op;
      strat2.style.opacity = s2Op;
      strat0.style.transform = `translateX(${(1 - s0Op) * 12}px)`;
      strat1.style.transform = `translateX(${(1 - s1Op) * 12}px)`;
      strat2.style.transform = `translateX(${(1 - s2Op) * 12}px)`;

      // Downstreams — appear after their parent strategy has solidified, slide in
      const ds1Op = multiMapSmooth(p, [0.84, 0.87], [0, 1]);
      const ds2Op = multiMapSmooth(p, [0.855, 0.885], [0, 1]);
      downstream1.style.opacity = ds1Op;
      downstream2.style.opacity = ds2Op;
      downstream1.style.transform = `translateX(${(1 - ds1Op) * 8}px)`;
      downstream2.style.transform = `translateX(${(1 - ds2Op) * 8}px)`;

      // Idle row — after engine context is established (engine hub visible)
      if (ngRowIdle) ngRowIdle.style.opacity = multiMapSmooth(p, [0.81, 0.85], [0, 1]);

      // ── Fee label — more breathing room before exit ──
      feeLabel.style.opacity = multiMapSmooth(p, [0.88, 0.91], [0, 1]);

      // ── Scene exit — delayed to let fee label hold ──
      const sceneExit = multiMapSmooth(p, [0.97, 0.995], [1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneExit;
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

      // Audio: drone during accrue
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.10, 0.50, 0.86, 0.96], [0.02, 0.06, 0.08, 0.06, 0.02]));

      const sceneOp = multiMapSmooth(p, [0, 0.06, 0.93, 0.99], [0, 1, 1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      intro.style.opacity = multiMapSmooth(p, [0.06, 0.16, 0.76, 0.82], [0, 1, 1, 0]);
      if (ratioDisplay) ratioDisplay.style.opacity = multiMapSmooth(p, [0.08, 0.18, 0.76, 0.82], [0, 1, 1, 0]);
      if (pair) pair.style.opacity = multiMapSmooth(p, [0.10, 0.20], [0, 1]);
      clock.style.opacity = multiMapSmooth(p, [0.18, 0.26, 0.76, 0.82], [0, 1, 1, 0]);
      if (ycWrap) ycWrap.style.opacity = multiMapSmooth(p, [0.22, 0.32, 0.90, 0.97], [0, 1, 1, 0]);
      stats.style.opacity = multiMapSmooth(p, [0.38, 0.48, 0.72, 0.80], [0, 1, 1, 0]);
      if (equation) equation.style.opacity = multiMapSmooth(p, [0.38, 0.48, 0.72, 0.80], [0, 1, 1, 0]);

      // Candlestick draws first, blue yield curve line lags behind
      volAlpha = multiMapSmooth(p, [0.22, 0.30, 0.90, 0.96], [0, 1, 1, 0]);
      volDrawProgress = Math.max(0, Math.min(1, multiMapSmooth(p, [0.22, 0.75], [0, 1])));

      // Blue curve lags behind candlesticks
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

      // Smooth ratio tick-up
      displayedRatio += (clampedRatio - displayedRatio) * 0.12;
      if (Math.abs(displayedRatio - clampedRatio) < 0.0001) displayedRatio = clampedRatio;

      let apy = apyAtDay(currentDay);

      statDays.textContent = currentDay;
      statRatio.textContent = displayedRatio.toFixed(3);
      statApy.textContent = `${apy.toFixed(1)}%`;
      if (equation) equation.textContent = `1 ■AKITA = ${displayedRatio.toFixed(3)} AKITA`;
      if (ratioValue) ratioValue.textContent = displayedRatio.toFixed(3);

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

      // Volatile price narrative
      if (volNarrative) {
        volNarrative.style.opacity = multiMapSmooth(p, [0.74, 0.80, 0.90, 0.96], [0, 1, 1, 0]);
      }
      if (volHeadline) volHeadline.style.opacity = multiMapSmooth(p, [0.74, 0.80, 0.90, 0.96], [0, 1, 1, 0]);
      if (volSub) volSub.style.opacity = multiMapSmooth(p, [0.78, 0.84, 0.90, 0.96], [0, 1, 1, 0]);
    }
  });
})();

// ────────────────────────────────────────────
// 8.5. CHAPTER 3.5: CCA — SHARE TOKEN DISTRIBUTION (700vh)
// Token swap reversal: deposited asset → back, share token → front
// Camera pan right, left-side node graph reveals distribution segments
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
  const branchSvg = document.getElementById('cca-branch-svg');
  const cardAuction = document.getElementById('cca-card-auction');
  const cardVesting = document.getElementById('cca-card-vesting');
  const cardLiquidity = document.getElementById('cca-card-liquidity');
  const summary = document.getElementById('cca-summary');

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
      const rm = Math.min(1, vw / 1200);
      const iconHalf = isMobile ? 38 : 48;
      const centerY = vh / 2 - iconHalf;
      const centerX = vw / 2;

      // Audio
      AudioEngine.setDroneLevel(multiMap(p, [0, 0.08, 0.60, 0.90], [0.02, 0.06, 0.06, 0.01]));

      // Scene entrance/exit
      const sceneOp = multiMapSmooth(p, [0, 0.06, 0.90, 0.97], [0, 1, 1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      // ============================
      // PHASE 1 (p 0.02–0.20): REVERSE SWAP
      // Deposited asset (AKITA circle) fades to back,
      // Share token (■AKITA square) comes to front
      // ============================

      // Deposited asset: starts centered, visible, scales down + fades back
      const coinOp = multiMapSmooth(p, [0.02, 0.06, 0.10, 0.18], [0, 1, 0.6, 0]);
      const coinScale = multiMapSmooth(p, [0.02, 0.06, 0.10, 0.18], [1, 1, 0.7, 0.5]);
      const coinZ = multiMapSmooth(p, [0.08, 0.14], [3, 1]);
      depositCoin.style.transform = `translate(${centerX}px, ${centerY}px) translate(-50%, 0) scale(${coinScale})`;
      depositCoin.style.opacity = coinOp;
      depositCoin.style.zIndex = Math.round(coinZ);

      // Share token: starts small + behind, grows + comes forward
      const shareOp = multiMapSmooth(p,
        [0.04, 0.10, 0.18, 0.28, 0.40, 0.88, 0.94],
        [0,    0.5,  1,    1,    1,    1,    0]
      );
      const shareScale = multiMapSmooth(p,
        [0.04, 0.10, 0.18, 0.28],
        [0.5,  0.75, 1,    1]
      );
      // After p=0.28, share token moves right (like deposited asset in token journey)
      const shareOffsetX = multiMapSmooth(p,
        [0.18, 0.28, 0.38, 0.88],
        [0,    0,    220*rm, 220*rm]
      );
      shareToken.style.transform = `translate(${centerX + shareOffsetX}px, ${centerY}px) translate(-50%, 0) scale(${shareScale})`;
      shareToken.style.opacity = shareOp;
      shareToken.style.zIndex = Math.round(multiMapSmooth(p, [0.08, 0.14], [1, 4]));

      // Share label
      if (shareLabel) shareLabel.style.opacity = multiMapSmooth(p, [0.14, 0.20, 0.40, 0.88], [0, 1, 0, 0]);

      // Audio: chime when share token comes forward
      if (p >= 0.14 && p <= 0.16 && !ccaChimePlayed) {
        AudioEngine.playChime(1.2);
        ccaChimePlayed = true;
      }
      if (p < 0.10 || p > 0.24) ccaChimePlayed = false;

      // ============================
      // PHASE 2 (p 0.16–0.34): INTRO TEXT
      // "What happens with ■AKITA?"
      // ============================
      const introOp = multiMapSmooth(p, [0.16, 0.22, 0.30, 0.36], [0, 1, 1, 0]);
      const introY = multiMapSmooth(p, [0.16, 0.24], [20, 0]);
      intro.style.opacity = introOp;
      intro.style.transform = `translateX(-50%) translateY(${introY}px)`;

      // ============================
      // PHASE 3 (p 0.32–0.46): CAMERA PAN RIGHT
      // Mirror of ch-token's left pan
      // ============================
      const panX = isMobile ? 0 : multiMapSmooth(p, [0.32, 0.46], [0, 400*rm]);
      camera.style.transform = `translateX(${panX}px)`;

      // ============================
      // PHASE 4 (p 0.42–0.75): LEFT-SIDE NODE GRAPH
      // Distribution cards cascade in from right
      // ============================
      if (nodeGraph) {
        nodeGraph.style.opacity = multiMapSmooth(p, [0.42, 0.48], [0, 1]);
      }
      if (branchSvg) branchSvg.style.opacity = multiMapSmooth(p, [0.44, 0.50], [0, 1]);

      // Distribution cards — staggered reveal
      const c1Op = multiMapSmooth(p, [0.48, 0.54], [0, 1]);
      const c2Op = multiMapSmooth(p, [0.52, 0.58], [0, 1]);
      const c3Op = multiMapSmooth(p, [0.56, 0.62], [0, 1]);
      cardAuction.style.opacity = c1Op;
      cardVesting.style.opacity = c2Op;
      cardLiquidity.style.opacity = c3Op;
      cardAuction.style.transform = `translateX(${(1 - c1Op) * -12}px)`;
      cardVesting.style.transform = `translateX(${(1 - c2Op) * -12}px)`;
      cardLiquidity.style.transform = `translateX(${(1 - c3Op) * -12}px)`;

      // ============================
      // PHASE 5 (p 0.78–0.90): SUMMARY + EXIT
      // ============================
      summary.style.opacity = multiMapSmooth(p, [0.78, 0.84, 0.88, 0.93], [0, 1, 1, 0]);
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

      // ── Vault cards — dramatic staggered entrance with scale + rotation ──
      cards.forEach((card, i) => {
        const start = 0.12 + i * 0.10;
        const end = 0.30 + i * 0.10;
        const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
        // Smooth ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        const op = eased;
        const y = (1 - eased) * 60;
        const scale = 0.92 + eased * 0.08;
        const rotX = (1 - eased) * 8;
        card.style.opacity = Math.min(1, Math.max(0, op));
        card.style.transform = `translateY(${Math.max(0, y)}px) scale(${scale}) perspective(800px) rotateX(${rotX}deg)`;
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
  const closeLogo = document.querySelector('.close-logo');
  let closeSoundPlayed = false;

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

      // ── Close chapter: particle convergence effect ──
      // Scale particles toward center as user reaches the end
      const converge = multiMapSmooth(p, [0.50, 0.90], [0, 1]);
      if (closeLogo) {
        const logoGlow = converge * 0.4;
        closeLogo.style.filter = `drop-shadow(0 0 ${20 + converge * 40}px rgba(0, 82, 255, ${logoGlow}))`;
        closeLogo.style.transform = `scale(${1 + converge * 0.08})`;
      }
      // Chime at convergence peak
      if (p >= 0.85 && !closeSoundPlayed) {
        AudioEngine.playChime(2.0);
        closeSoundPlayed = true;
      }
      if (p < 0.80) closeSoundPlayed = false;
    }
  });
})();

// ────────────────────────────────────────────
// 11. VAULT CARD 3D TILT ON HOVER
// ────────────────────────────────────────────
(function initVaultCardTilt() {
  const cards = document.querySelectorAll('.vault-card');
  const MAX_TILT = 12; // degrees

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const rotY = x * MAX_TILT;
      const rotX = -y * MAX_TILT;
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
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
      window.__particleConverge = multiMapSmooth(self.progress, [0.40, 0.90], [0, 1]);
    },
    onLeave: () => { window.__particleConverge = 0; },
    onLeaveBack: () => { window.__particleConverge = 0; },
  });
})();

/* ── Premium energy-pulse flow animation on node graph ── */
(function initPulseFlow() {
  const canvas = document.getElementById('ng-pulse-canvas');
  const nodeGraph = document.getElementById('node-graph');
  if (!canvas || !nodeGraph) return;
  const ctx = canvas.getContext('2d');

  /* Pulse particle config */
  const PULSE_COLOR = [0, 82, 255];
  const IDLE_COLOR  = [138, 143, 152];
  const PULSE_RADIUS = 2.0;
  const GLOW_RADIUS  = 10;
  const TRAIL_COUNT  = 6;
  const TRAIL_SPACING = 0.065;
  const SPEED        = 0.00035;
  const IDLE_SPEED   = 0.00020;

  function cubicBezier(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return {
      x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
      y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
    };
  }

  function evalPath(segments, t) {
    const n = segments.length;
    const si = Math.min(Math.floor(t * n), n - 1);
    const lt = (t * n) - si;
    return cubicBezier(lt, segments[si].p0, segments[si].p1, segments[si].p2, segments[si].p3);
  }



  /**
   * Convert an SVG path's viewBox-space cubic bezier to screen-space,
   * accounting for preserveAspectRatio="none" (linear stretch).
   * svgEl: the <svg> element
   * vb: { minX, minY, w, h } — the viewBox
   * d: path definition as array of {cmd, points} or a bezier: [{vx,vy},...]
   */
  function svgToScreen(svgEl, vbMinX, vbMinY, vbW, vbH, vx, vy) {
    const r  = svgEl.getBoundingClientRect();
    const nr = nodeGraph.getBoundingClientRect();
    return {
      x: ((vx - vbMinX) / vbW) * r.width  + r.left - nr.left,
      y: ((vy - vbMinY) / vbH) * r.height + r.top  - nr.top
    };
  }

  /* Parse SVG cubic bezier path "M x,y C x,y x,y x,y C x,y x,y x,y" into segments */
  function parseSvgCubic(svgEl, vbMinX, vbMinY, vbW, vbH, pathD) {
    // Extract all coordinate pairs
    const nums = pathD.match(/-?[\d.]+/g).map(Number);
    // M startX,startY C cp1x,cp1y cp2x,cp2y endX,endY [C ...]
    const segments = [];
    let i = 0;
    const startVx = nums[i++], startVy = nums[i++];
    let cur = svgToScreen(svgEl, vbMinX, vbMinY, vbW, vbH, startVx, startVy);

    while (i < nums.length) {
      // Each C command has 3 pairs = 6 numbers
      const cp1 = svgToScreen(svgEl, vbMinX, vbMinY, vbW, vbH, nums[i],   nums[i+1]);
      const cp2 = svgToScreen(svgEl, vbMinX, vbMinY, vbW, vbH, nums[i+2], nums[i+3]);
      const end = svgToScreen(svgEl, vbMinX, vbMinY, vbW, vbH, nums[i+4], nums[i+5]);
      segments.push({ p0: cur, p1: cp1, p2: cp2, p3: end });
      cur = end;
      i += 6;
    }
    return segments;
  }

  let paths = [];

  /* Path definitions matching the actual SVG <path d="..."> in index.html */
  const BRANCH_ENGINE_D = 'M 1,-11 C 12,-11 18,6 30,18 C 42,30 60,38 75,38 C 85,38 92,38 100,38';
  const BRANCH_IDLE_D   = 'M 1,-11 C 12,-11 18,10 30,32 C 45,58 65,88 75,95 C 85,102 92,105 100,105';
  const FAN_AJNA_D      = 'M 0,50 C 16,50 18,16 34,16 C 46,16 54,16 60,16';
  const FAN_CHARM_D     = 'M 0,50 C 14,50 22,50 32,50 C 42,50 48,50 60,50';
  const FAN_SOLANA_D    = 'M 0,50 C 16,50 18,84 34,84 C 46,84 54,84 60,84';
  const DS1_D           = 'M 0,8 C 8,8 10,4 16,4 C 22,4 24,8 30,8';
  const DS2_D           = 'M 0,8 C 8,8 10,12 16,12 C 22,12 24,8 30,8';

  function rebuildPaths() {
    const branchSvg = document.getElementById('ng-branch-svg');
    const fanSvg    = document.getElementById('ng-edge-fan');
    const ds1Svg    = document.querySelector('#downstream-1 .ng-ds-edge');
    const ds2Svg    = document.querySelector('#downstream-2 .ng-ds-edge');
    if (!branchSvg || !fanSvg) return;

    paths = [];

    // Branch SVG: viewBox 0 -15 100 130
    paths.push({
      segments: parseSvgCubic(branchSvg, 0, -15, 100, 130, BRANCH_ENGINE_D),
      color: PULSE_COLOR, speed: SPEED, trailCount: TRAIL_COUNT, phase: 0
    });
    paths.push({
      segments: parseSvgCubic(branchSvg, 0, -15, 100, 130, BRANCH_IDLE_D),
      color: IDLE_COLOR, speed: IDLE_SPEED, trailCount: 3, phase: 0.3
    });

    // Fan-out SVG: viewBox 0 0 60 100
    paths.push({
      segments: parseSvgCubic(fanSvg, 0, 0, 60, 100, FAN_AJNA_D),
      color: PULSE_COLOR, speed: SPEED, trailCount: TRAIL_COUNT, phase: 0.0
    });
    paths.push({
      segments: parseSvgCubic(fanSvg, 0, 0, 60, 100, FAN_CHARM_D),
      color: PULSE_COLOR, speed: SPEED, trailCount: TRAIL_COUNT, phase: 0.33
    });
    paths.push({
      segments: parseSvgCubic(fanSvg, 0, 0, 60, 100, FAN_SOLANA_D),
      color: PULSE_COLOR, speed: SPEED, trailCount: TRAIL_COUNT, phase: 0.66
    });

    // Downstream SVGs: viewBox 0 0 30 16
    if (ds1Svg) {
      paths.push({
        segments: parseSvgCubic(ds1Svg, 0, 0, 30, 16, DS1_D),
        color: PULSE_COLOR, speed: SPEED * 0.7, trailCount: 3, phase: 0.15
      });
    }
    if (ds2Svg) {
      paths.push({
        segments: parseSvgCubic(ds2Svg, 0, 0, 30, 16, DS2_D),
        color: PULSE_COLOR, speed: SPEED * 0.7, trailCount: 3, phase: 0.5
      });
    }
  }

  function resizeCanvas() {
    const cr = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = cr.width * dpr;
    canvas.height = cr.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPulse(x, y, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, GLOW_RADIUS);
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${0.55*alpha})`);
    g.addColorStop(0.3, `rgba(${color[0]},${color[1]},${color[2]},${0.18*alpha})`);
    g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, GLOW_RADIUS, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${1.0*alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, PULSE_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }

  /* Phase state — persists across rebuildPaths calls */
  let phases = [0, 0.3, 0.0, 0.33, 0.66, 0.15, 0.5];
  let pathsBuilt = false;
  let lastTime = 0, running = false;

  function buildOnce() {
    rebuildPaths();
    // Sync phase array length to paths
    while (phases.length < paths.length) phases.push(Math.random());
    pathsBuilt = true;
  }

  function render(time) {
    if (!running) return;
    requestAnimationFrame(render);
    const dt = lastTime ? (time - lastTime) : 16;
    lastTime = time;

    const ngOp = parseFloat(nodeGraph.style.opacity || 0);
    if (ngOp < 0.05) return;

    if (!pathsBuilt) buildOnce();
    resizeCanvas();
    // Rebuild geometry (positions may shift with scroll) but preserve phases
    rebuildPaths();

    const w = canvas.width / (window.devicePixelRatio||1);
    const h = canvas.height / (window.devicePixelRatio||1);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // Canvas extends 670px left of nodeGraph; offset pulse coordinates
    const canvasR = canvas.getBoundingClientRect();
    const ngR = nodeGraph.getBoundingClientRect();
    const offsetX = ngR.left - canvasR.left;

    for (let pi = 0; pi < paths.length; pi++) {
      const p = paths[pi];
      phases[pi] = (phases[pi] + p.speed * dt) % 1;
      for (let i = 0; i < p.trailCount; i++) {
        const t = (phases[pi] + i * TRAIL_SPACING) % 1;
        const pt = evalPath(p.segments, t);
        const edgeFade = Math.min(t/0.08, (1-t)/0.08, 1);
        const trailFade = 1 - (i/p.trailCount)*0.65;
        const alpha = edgeFade * trailFade * ngOp;
        if (alpha > 0.01) drawPulse(pt.x + offsetX, pt.y, p.color, alpha);
      }
    }
  }

  function start() { if (running) return; running = true; lastTime = 0; requestAnimationFrame(render); }
  function stop() { running = false; }

  const obs = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) start(); else stop(); });
  }, { threshold: 0.05 });
  obs.observe(nodeGraph);

  window.addEventListener('resize', () => { if (running) { resizeCanvas(); rebuildPaths(); } });
})();
