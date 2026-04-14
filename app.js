// ═══════════════════════════════════════════════
// 4626.fun — Immersive 3D Frontend
// Three.js Particle System + GSAP Scroll
// ═══════════════════════════════════════════════

import * as THREE from 'three';

// ─── THREE.JS PARTICLE FIELD ───
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

// Particle system
const PARTICLE_COUNT = 3000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const velocities = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const opacities = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3 = i * 3;
  // Distribute in a large sphere
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 20 + Math.random() * 60;

  positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = r * Math.cos(phi) - 30;

  velocities[i3]     = (Math.random() - 0.5) * 0.01;
  velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
  velocities[i3 + 2] = (Math.random() - 0.5) * 0.005;

  sizes[i] = Math.random() * 2.5 + 0.5;
  opacities[i] = Math.random() * 0.4 + 0.1;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

// Custom shader for particles
const vertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  uniform float uTime;
  uniform float uScrollY;

  void main() {
    vOpacity = aOpacity;
    vec3 pos = position;

    // Gentle drift based on time
    pos.x += sin(uTime * 0.3 + pos.y * 0.05) * 1.5;
    pos.y += cos(uTime * 0.2 + pos.x * 0.04) * 1.0;
    pos.z += sin(uTime * 0.15 + pos.z * 0.03) * 0.8;

    // Scroll parallax — particles drift as user scrolls
    pos.y += uScrollY * 30.0;
    pos.z += uScrollY * 5.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vOpacity;
  uniform float uAccentMix;

  void main() {
    // Soft circle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;

    // Color: mix between white and accent blue based on scroll
    vec3 white = vec3(0.93, 0.93, 0.93);
    vec3 blue = vec3(0.0, 0.322, 1.0);
    vec3 color = mix(white, blue, uAccentMix * 0.6);

    gl_FragColor = vec4(color, alpha);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uScrollY: { value: 0 },
    uAccentMix: { value: 0 }
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// Accent glow orb in center
const orbGeometry = new THREE.SphereGeometry(1.5, 32, 32);
const orbMaterial = new THREE.MeshBasicMaterial({
  color: 0x0052FF,
  transparent: true,
  opacity: 0.04
});
const orb = new THREE.Mesh(orbGeometry, orbMaterial);
scene.add(orb);

// Connection lines between nearby particles (subtle)
const LINE_COUNT = 200;
const lineGeometry = new THREE.BufferGeometry();
const linePositions = new Float32Array(LINE_COUNT * 6);
const lineColors = new Float32Array(LINE_COUNT * 6);
lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
const lineMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.12,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
scene.add(lines);

// Mouse interaction
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Scroll tracking
let scrollProgress = 0;
let targetScroll = 0;

window.addEventListener('scroll', () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  targetScroll = window.scrollY / maxScroll;
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
const clock = new THREE.Clock();

function updateLines() {
  const pos = geometry.attributes.position.array;
  let idx = 0;
  const threshold = 12;

  for (let i = 0; i < PARTICLE_COUNT && idx < LINE_COUNT; i += 10) {
    for (let j = i + 10; j < PARTICLE_COUNT && idx < LINE_COUNT; j += 10) {
      const i3 = i * 3, j3 = j * 3;
      const dx = pos[i3] - pos[j3];
      const dy = pos[i3+1] - pos[j3+1];
      const dz = pos[i3+2] - pos[j3+2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < threshold) {
        const lineIdx = idx * 6;
        linePositions[lineIdx]   = pos[i3];
        linePositions[lineIdx+1] = pos[i3+1];
        linePositions[lineIdx+2] = pos[i3+2];
        linePositions[lineIdx+3] = pos[j3];
        linePositions[lineIdx+4] = pos[j3+1];
        linePositions[lineIdx+5] = pos[j3+2];

        const alpha = 1 - dist / threshold;
        const b = 0.4 + scrollProgress * 0.6;
        lineColors[lineIdx]   = alpha * 0.3;
        lineColors[lineIdx+1] = alpha * 0.35;
        lineColors[lineIdx+2] = alpha * b;
        lineColors[lineIdx+3] = alpha * 0.3;
        lineColors[lineIdx+4] = alpha * 0.35;
        lineColors[lineIdx+5] = alpha * b;
        idx++;
      }
    }
  }

  // Clear remaining lines
  for (let i = idx * 6; i < LINE_COUNT * 6; i++) {
    linePositions[i] = 0;
    lineColors[i] = 0;
  }
  lineGeometry.attributes.position.needsUpdate = true;
  lineGeometry.attributes.color.needsUpdate = true;
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Smooth mouse
  mouse.x += (targetMouse.x - mouse.x) * 0.05;
  mouse.y += (targetMouse.y - mouse.y) * 0.05;

  // Smooth scroll
  scrollProgress += (targetScroll - scrollProgress) * 0.03;

  // Update uniforms
  material.uniforms.uTime.value = elapsed;
  material.uniforms.uScrollY.value = scrollProgress;
  material.uniforms.uAccentMix.value = Math.min(scrollProgress * 3, 1);

  // Camera follows mouse subtly
  camera.position.x += (mouse.x * 3 - camera.position.x) * 0.02;
  camera.position.y += (mouse.y * 2 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, -10);

  // Orb pulses
  const scale = 1 + Math.sin(elapsed * 0.8) * 0.2;
  orb.scale.set(scale, scale, scale);
  orbMaterial.opacity = 0.03 + Math.sin(elapsed * 0.5) * 0.02;

  // Particle rotation
  particles.rotation.y = elapsed * 0.02 + scrollProgress * 0.5;
  particles.rotation.x = Math.sin(elapsed * 0.1) * 0.05;

  // Update lines periodically
  if (Math.floor(elapsed * 10) % 3 === 0) {
    updateLines();
  }

  renderer.render(scene, camera);
}
animate();


// ─── GSAP SCROLL ANIMATIONS ───
gsap.registerPlugin(ScrollTrigger);

// Hero entrance
const heroTL = gsap.timeline({ delay: 0.3 });
heroTL
  .to('#hero-label', {
    opacity: 1, y: 0, duration: 0.8,
    ease: 'power3.out'
  })
  .to('#hero-headline', {
    opacity: 1, y: 0, duration: 1,
    ease: 'power3.out'
  }, '-=0.5')
  .to('#hero-sub', {
    opacity: 1, y: 0, duration: 0.8,
    ease: 'power3.out'
  }, '-=0.6')
  .to('#hero-cta', {
    opacity: 1, y: 0, duration: 0.8,
    ease: 'power3.out'
  }, '-=0.5')
  .to('#scroll-cue', {
    opacity: 0.6, duration: 1,
    ease: 'power2.out'
  }, '-=0.3');

// Nav show on scroll
ScrollTrigger.create({
  trigger: '#mechanics',
  start: 'top 80%',
  onEnter: () => document.getElementById('main-nav').classList.add('visible'),
  onLeaveBack: () => document.getElementById('main-nav').classList.remove('visible'),
});

// Scroll-triggered reveals
const reveals = document.querySelectorAll('.reveal');
reveals.forEach((el) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => el.classList.add('visible'),
    once: true,
  });
});

// Closing line animation
gsap.to('#closing-line', {
  height: 100,
  duration: 1.2,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '#closing',
    start: 'top 60%',
    once: true,
  }
});

// ─── ANIMATED COUNTERS ───
function animateCounters() {
  // APY/TVL vault cards
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    // Check the sibling label element — the label is a prior sibling in the same parent
    const prevLabel = el.previousElementSibling;
    const isTVL = prevLabel && prevLabel.textContent.trim() === 'TVL';

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target,
          duration: 1.5,
          ease: 'power3.out',
          onUpdate: function() {
            const v = this.targets()[0].val;
            if (isTVL) {
              if (v >= 1000) {
                el.textContent = '$' + (v / 1000).toFixed(1) + 'M';
              } else {
                el.textContent = '$' + Math.round(v) + 'k';
              }
            } else {
              el.textContent = v.toFixed(1) + '%';
            }
          }
        });
      }
    });
  });

  // Stats row
  document.querySelectorAll('[data-count-int]').forEach(el => {
    const target = parseInt(el.dataset.countInt);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target,
          duration: 2,
          ease: 'power3.out',
          onUpdate: function() {
            el.textContent = Math.round(this.targets()[0].val);
          }
        });
      }
    });
  });

  document.querySelectorAll('[data-count-ratio]').forEach(el => {
    const target = parseFloat(el.dataset.countRatio);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 1.0 }, {
          val: target,
          duration: 2,
          ease: 'power3.out',
          onUpdate: function() {
            el.textContent = this.targets()[0].val.toFixed(3);
          }
        });
      }
    });
  });

  document.querySelectorAll('[data-count-apy]').forEach(el => {
    const target = parseFloat(el.dataset.countApy);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target,
          duration: 2,
          ease: 'power3.out',
          onUpdate: function() {
            el.textContent = this.targets()[0].val.toFixed(1) + '%';
          }
        });
      }
    });
  });
}

animateCounters();

// ─── PARALLAX ON SECTIONS ───
document.querySelectorAll('.section-inner').forEach(inner => {
  gsap.to(inner, {
    y: -30,
    ease: 'none',
    scrollTrigger: {
      trigger: inner,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1,
    }
  });
});

// ─── VAULT CARD TILT EFFECT ───
document.querySelectorAll('.vault-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(600px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-2px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(600px) rotateY(0) rotateX(0) translateY(0)';
  });
});

console.log('4626.fun — Immersive frontend loaded');
