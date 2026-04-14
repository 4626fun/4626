/* app.js — 4626.fun Cinematic Scroll Experience v3
   Enhanced Three.js dual-layer particles + GSAP ScrollTrigger choreography
   Real token images, richer visual effects */

import * as THREE from 'three';

// ────────────────────────────────────────────
// 0. REGISTER GSAP
// ────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

// ────────────────────────────────────────────
// 1. THREE.JS PARTICLE FIELD (dual-layer)
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
// 2. SET SCENE HEIGHTS
// ────────────────────────────────────────────
document.querySelectorAll('.scroll-scene').forEach(scene => {
  const vh = parseInt(scene.dataset.height || '300', 10);
  scene.style.height = `${vh}vh`;
});

// ────────────────────────────────────────────
// 3. SCROLL PROGRESS BAR
// ────────────────────────────────────────────
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
  progressBar.style.width = `${pct}%`;
}, { passive: true });

// ────────────────────────────────────────────
// 4. NAV VISIBILITY
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

// ────────────────────────────────────────────
// 5. CHAPTER 1: HERO (280vh)
// ────────────────────────────────────────────
(function chapterHero() {
  const section = document.getElementById('ch-hero');
  const heroLine = document.getElementById('hero-line');
  const heroContent = document.getElementById('hero-content');
  const heroFloats = document.getElementById('hero-floats');

  // Entrance animation
  gsap.to(heroLine, {
    opacity: 1,
    duration: 1.4,
    ease: 'power3.out',
    delay: 0.2,
  });
  gsap.fromTo(heroLine, { scaleY: 0 }, {
    scaleY: 1,
    duration: 1.6,
    ease: 'power3.out',
    delay: 0.2,
  });
  gsap.to(heroContent, {
    opacity: 1,
    y: 0,
    duration: 1.2,
    ease: 'power3.out',
    delay: 0.6,
  });
  if (heroFloats) {
    gsap.to(heroFloats, {
      opacity: 1,
      duration: 2,
      ease: 'power2.out',
      delay: 1.2,
    });
  }

  // Scroll-driven exit
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      const textOp = multiMap(p, [0.45, 0.60], [1, 0]);
      heroContent.style.opacity = textOp;
      if (heroFloats) heroFloats.style.opacity = textOp * 0.15;
      const lineScaleY = multiMap(p, [0.55, 0.78], [1, 0]);
      const lineOp = multiMap(p, [0.74, 0.80], [1, 0]);
      heroLine.style.transform = `scaleY(${lineScaleY})`;
      heroLine.style.opacity = lineOp;
    }
  });
})();

// ────────────────────────────────────────────
// 6. CHAPTER 2: TOKEN JOURNEY (1800vh)
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

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      // ── Intro line ──
      const introLineScaleY = mapRange(p, 0.003, 0.015, 0, 1);
      const introLineOp = multiMap(p, [0.003, 0.007, 0.51, 0.57], [0, 1, 1, 0]);
      tokenLine.style.transform = `translateX(-50%) scaleY(${introLineScaleY})`;
      tokenLine.style.opacity = introLineOp;

      const lineGlow = multiMap(p, [0.024, 0.035, 0.047, 0.124, 0.176, 0.34, 0.40, 0.51, 0.57], [0.08, 1, 0.55, 0.55, 0.08, 0.08, 0.30, 0.30, 0]);
      tokenLineGlowEl.style.opacity = lineGlow;
      const lineW = multiMap(p, [0.003, 0.015, 0.024, 0.035, 0.047, 0.124, 0.176], [0, 1, 1, 3.5, 2, 2, 1]);
      tokenLineCoreEl.style.width = `${lineW}px`;

      // ── Creator coin (AKITA) — real image ──
      const coinX = multiMap(p, [0.02, 0.165, 0.51, 0.60], [-340, 220, 220, 20]);
      const coinOp = multiMap(p, [0.018, 0.03, 0.14, 0.19, 0.26, 0.30], [0, 1, 1, 0.4, 0.4, 1]);
      const coinScale = multiMap(p, [0.11, 0.165, 0.26, 0.30], [1, 0.82, 0.82, 1]);
      coin.style.transform = `translateX(${coinX}px) scale(${coinScale})`;
      coin.style.opacity = coinOp;

      // ── Vault share (■AKITA) — real image ──
      const shareOp = multiMap(p, [0.032, 0.044, 0.51, 0.60, 0.64, 0.67], [0, 1, 1, 0.35, 0.35, 0]);
      const shareX = multiMap(p, [0.032, 0.165, 0.51, 0.60], [0, -220, -220, -50]);
      const shareScale = multiMap(p, [0.032, 0.059, 0.51, 0.60], [0.6, 1, 1, 0.42]);
      share.style.transform = `translateX(${shareX}px) scale(${shareScale})`;
      share.style.opacity = shareOp;

      // ── Copy and labels ──
      topCopy.style.opacity = multiMap(p, [0.02, 0.047, 0.082, 0.106], [0, 1, 1, 0]);
      crossCopy.style.opacity = multiMap(p, [0.14, 0.176, 0.224, 0.259], [0, 1, 1, 0]);

      const leftLabelOp = multiMap(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      const rightLabelOp = multiMap(p, [0.13, 0.159, 0.235, 0.271], [0, 1, 1, 0]);
      labelYou.style.opacity = leftLabelOp;
      labelVault.style.opacity = rightLabelOp;
      labelShares.style.opacity = leftLabelOp;
      labelUnderlying.style.opacity = rightLabelOp;
      coinLabel.style.opacity = rightLabelOp;
      shareLabel.style.opacity = leftLabelOp;

      entryCue.style.opacity = multiMap(p, [0.165, 0.20, 0.235, 0.271], [0, 1, 1, 0]);

      // ── Detail panels ──
      const rightDetailOp = multiMap(p, [0.32, 0.37, 0.50, 0.54], [0, 1, 1, 0]);
      const leftDetailOp = multiMap(p, [0.37, 0.42, 0.49, 0.53], [0, 1, 1, 0]);
      coinDetail.style.opacity = rightDetailOp;
      shareDetail.style.opacity = leftDetailOp;

      dualCopy.style.opacity = multiMap(p, [0.42, 0.47, 0.50, 0.54], [0, 1, 1, 0]);
      dualEntry.style.opacity = multiMap(p, [0.46, 0.50, 0.51, 0.54], [0, 1, 1, 0]);

      // ── Camera zoom ──
      const cameraScale = multiMap(p, [0.50, 0.58, 0.62, 0.68], [1, 1.06, 1.06, 1]);
      const panX = mapEased(p, 0.64, 0.86, 0, -400);
      cameraWrapper.style.transform = `scale(${cameraScale}) translateX(${panX}px)`;

      // ── Deposit/allocation labels ──
      depositInfo.style.opacity = multiMap(p, [0.65, 0.69], [0, 1]);
      splitInfo.style.opacity = multiMap(p, [0.68, 0.72], [0, 1]);
      idleBadge.style.opacity = multiMap(p, [0.70, 0.73], [0, 1]);

      // ── Flow line + engine ──
      flowLine.style.opacity = multiMap(p, [0.71, 0.76], [0, 1]);
      const flowW = mapRange(p, 0.71, 0.77, 0, 100);
      flowLineFill.style.width = `${flowW}%`;
      engineBox.style.opacity = multiMap(p, [0.75, 0.79], [0, 1]);

      // ── Branches ──
      const b0Op = multiMap(p, [0.79, 0.83], [0, 1]);
      const b1Op = multiMap(p, [0.83, 0.865], [0, 1]);
      const b2Op = multiMap(p, [0.875, 0.905], [0, 1]);
      branch0.style.opacity = b0Op;
      branch1.style.opacity = b1Op;
      branch2.style.opacity = b2Op;
      strat0.style.opacity = b0Op;
      strat1.style.opacity = b1Op;
      strat2.style.opacity = b2Op;

      // ── Downstreams ──
      downstream1.style.opacity = multiMap(p, [0.855, 0.89], [0, 1]);
      downstream2.style.opacity = multiMap(p, [0.895, 0.93], [0, 1]);

      // ── Fee label ──
      feeLabel.style.opacity = multiMap(p, [0.92, 0.95], [0, 1]);

      // ── Scene exit ──
      const sceneExit = multiMap(p, [0.96, 0.995], [1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneExit;
    }
  });
})();

// ────────────────────────────────────────────
// 7. CHAPTER 3: ACCRUE (650vh)
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
    { days: 30, el: document.getElementById('ms-30') },
    { days: 60, el: document.getElementById('ms-60') },
    { days: 90, el: document.getElementById('ms-90') },
    { days: 180, el: document.getElementById('ms-180') },
  ];

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;

      const sceneOp = multiMap(p, [0, 0.06, 0.86, 0.96], [0, 1, 1, 0]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      intro.style.opacity = multiMap(p, [0.06, 0.16], [0, 1]);
      if (pair) pair.style.opacity = multiMap(p, [0.10, 0.20], [0, 1]);
      clock.style.opacity = multiMap(p, [0.18, 0.26], [0, 1]);
      timeline.style.opacity = multiMap(p, [0.26, 0.34], [0, 1]);
      stats.style.opacity = multiMap(p, [0.38, 0.48], [0, 1]);
      equation.style.opacity = multiMap(p, [0.38, 0.48], [0, 1]);

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
        if (currentDay >= ms.days) {
          ms.el.classList.add('reached');
        } else {
          ms.el.classList.remove('reached');
        }
      });
    }
  });
})();

// ────────────────────────────────────────────
// 8. CHAPTER 4: CREATOR VAULTS (500vh)
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

      const sceneOp = multiMap(p, [0, 0.10, 0.82, 0.94], [0, 1, 1, 0]);
      const sceneY = mapRange(p, 0, 0.16, 40, 0);
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

      cta.style.opacity = multiMap(p, [0.56, 0.70], [0, 1]);
      disclaimer.style.opacity = multiMap(p, [0.64, 0.76], [0, 1]);
    }
  });
})();

// ────────────────────────────────────────────
// 9. CHAPTER 5: CLOSE (280vh)
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

      const sceneOp = multiMap(p, [0.05, 0.25, 0.85, 1], [0, 1, 1, 0.9]);
      section.querySelector('.scene-pin').style.opacity = sceneOp;

      if (partners) partners.style.opacity = multiMap(p, [0.05, 0.20], [0, 1]);
      brand.style.opacity = multiMap(p, [0.10, 0.28], [0, 1]);

      const lineH = mapRange(p, 0.28, 0.50, 0, 80);
      line.style.height = `${Math.max(0, lineH)}px`;
      line.style.opacity = multiMap(p, [0.28, 0.38], [0, 1]);

      cta.style.opacity = multiMap(p, [0.40, 0.56], [0, 1]);
      tag.style.opacity = multiMap(p, [0.52, 0.66], [0, 1]);
    }
  });
})();
