// =====================================================================
// Cloth-physics vault slider — verlet-integrated cloth meshes textured
// with each vault's identity, draping under gravity with realistic
// tension. Navigate prev/next: current panel falls/folds away, next
// panel drapes into place.
//
// Physics: classic Provot-style verlet cloth.
//   - Particles: mass points at each grid vertex
//   - Constraints: structural (4-neighbor) + shear (diagonal) springs
//   - Integration: verlet (no explicit velocity), 3 constraint passes/frame
//   - Forces: gravity + per-frame wind perturbation + transition impulse
//
// Each vault gets a Three.js PlaneGeometry whose vertex positions are
// driven by the cloth particles. The texture is a procedurally rendered
// canvas (avatar + name + stats baked in) so each panel reads as a
// physical fabric "vault badge".
// =====================================================================

// Resolved via the <script type="importmap"> in index.html, which points
// 'three' at the locally vendored vendor/three/build/three.module.js.
// Keeps everything under 'self' for CSP compliance.
import * as THREE from 'three';

const sceneEl   = document.getElementById('vaults-scene');
const stageEl   = document.getElementById('vaults-stage');
const metaEl    = document.getElementById('vaults-meta');
const prevBtn   = document.getElementById('vaults-prev');
const nextBtn   = document.getElementById('vaults-next');
const currentEl = document.getElementById('vaults-current');
const totalEl   = document.getElementById('vaults-total');
const dataEl    = document.getElementById('vaults-data');

if (!sceneEl || !dataEl) throw new Error('vaults stage missing');

const VAULTS = JSON.parse(dataEl.textContent);
totalEl.textContent = String(VAULTS.length).padStart(2, '0');

// ---------- texture rendering ----------------------------------------
// Each vault's "fabric" texture is a 1024×1280 canvas painted in code:
// dark background + accent gradient + creator avatar + name + stats.
// This makes each panel look like a real textile patch with the vault's
// identity stitched in.
async function renderVaultTexture(vault) {
  const W = 1024, H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Dark base + accent vignette
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#14121e');
  grad.addColorStop(1, '#08070d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent halo from top-left
  const halo = ctx.createRadialGradient(W * 0.3, H * 0.18, 50, W * 0.3, H * 0.18, 700);
  halo.addColorStop(0, vault.accent + 'cc');
  halo.addColorStop(0.4, vault.accent + '44');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Subtle weave pattern (diagonal lines simulating fabric weave)
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = vault.accent + '55';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Eyebrow
  ctx.fillStyle = vault.accent;
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '0.32em';
  ctx.fillText('// CREATOR VAULT', 80, 110);

  // Avatar (circular)
  try {
    const avatar = await loadImage(vault.avatar);
    const cx = W / 2, cy = 380, r = 180;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // ring around avatar
    ctx.strokeStyle = vault.accent + 'aa';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {
    // Fallback if avatar fails — just a glowing circle
    ctx.fillStyle = vault.accent;
    ctx.beginPath();
    ctx.arc(W / 2, 380, 180, 0, Math.PI * 2);
    ctx.fill();
  }

  // Creator name (small caps)
  ctx.fillStyle = 'rgba(220, 220, 230, 0.5)';
  ctx.font = '500 24px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(vault.creator.toUpperCase(), W / 2, 640);

  // Vault name (display serif)
  ctx.fillStyle = 'rgba(248, 245, 235, 0.96)';
  ctx.font = '400 64px "Instrument Serif", Georgia, serif';
  ctx.fillText(vault.name, W / 2, 720);

  // Ticker (italic)
  ctx.font = 'italic 400 38px "Instrument Serif", Georgia, serif';
  ctx.fillStyle = vault.accent;
  ctx.fillText(vault.ticker, W / 2, 780);

  // Stats grid
  ctx.textAlign = 'left';
  const statY = 920;
  const statGap = 250;
  const stats = [
    { label: 'TVL',     value: vault.tvl },
    { label: 'APY',     value: vault.apy },
    { label: 'HOLDERS', value: vault.holders },
  ];
  stats.forEach((s, i) => {
    const x = 120 + i * statGap;
    ctx.fillStyle = 'rgba(200, 200, 215, 0.45)';
    ctx.font = '500 18px Inter, system-ui, sans-serif';
    ctx.fillText(s.label, x, statY);
    ctx.fillStyle = 'rgba(248, 245, 235, 0.96)';
    ctx.font = '400 44px "Instrument Serif", Georgia, serif';
    ctx.fillText(s.value, x, statY + 56);
  });

  // Footer chip "BASE · ERC-4626"
  ctx.fillStyle = 'rgba(155, 180, 255, 0.7)';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('B A S E   ·   E R C - 4 6 2 6', W / 2, H - 80);

  return new THREE.CanvasTexture(canvas);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- renderer / scene / camera --------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 6.5);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const key = new THREE.DirectionalLight(0xffe0b0, 1.0);
key.position.set(2, 3, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9bb4ff, 0.4);
rim.position.set(-2, -1, -2);
scene.add(rim);

// ---------- cloth simulation -----------------------------------------
// A cloth is a grid of particles (positions) connected by constraints
// (distance springs). Verlet integration: pos += pos - prev + accel*dt^2
const WIDTH = 2.6;     // world units
const HEIGHT = 3.25;   // 4:5 aspect
const NX = 24;         // grid resolution (NX × NY particles)
const NY = 30;
const DT = 0.016;
const GRAV = -2.4;

class Cloth {
  constructor(texture, accent) {
    // Particle arrays — each particle has current pos + previous pos
    this.cols = NX;
    this.rows = NY;
    this.pos = new Float32Array(NX * NY * 3);
    this.prev = new Float32Array(NX * NY * 3);
    this.pinned = new Uint8Array(NX * NY);
    this.accent = accent;

    // Initialize at rest pose: a flat plane facing camera
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const x = (i / (NX - 1) - 0.5) * WIDTH;
        const y = (1 - j / (NY - 1) - 0.5) * HEIGHT;
        const idx = (j * NX + i) * 3;
        this.pos[idx]     = x;
        this.pos[idx + 1] = y;
        this.pos[idx + 2] = 0;
        this.prev[idx]     = x;
        this.prev[idx + 1] = y;
        this.prev[idx + 2] = 0;
      }
    }
    // Pin top row so the cloth hangs from a rod
    for (let i = 0; i < NX; i++) this.pinned[i] = 1;

    // Build constraint list: structural (right + down) + shear (diagonals)
    this.constraints = [];
    const restH = WIDTH / (NX - 1);
    const restV = HEIGHT / (NY - 1);
    const restD = Math.hypot(restH, restV);
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (i < NX - 1) this.constraints.push([j * NX + i, j * NX + i + 1, restH]);
        if (j < NY - 1) this.constraints.push([j * NX + i, (j + 1) * NX + i, restV]);
        if (i < NX - 1 && j < NY - 1) {
          this.constraints.push([j * NX + i, (j + 1) * NX + i + 1, restD]);
          this.constraints.push([j * NX + i + 1, (j + 1) * NX + i, restD]);
        }
      }
    }

    // Three.js mesh — PlaneGeometry with NX×NY vertices that we drive
    const geo = new THREE.PlaneGeometry(WIDTH, HEIGHT, NX - 1, NY - 1);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.05,
      transparent: true,
      opacity: 1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 0, 0);

    // Soft drop shadow under the cloth
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH * 1.4, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -HEIGHT / 2 - 0.3, 0);
    this.shadow = shadow;
  }

  /** Advance the simulation one step. */
  step(time, transitionImpulse = 0) {
    const ax = 0;
    const ay = GRAV;
    const az = 0;
    const dt2 = DT * DT;
    // Wind: per-frame slow z perturbation so the cloth has organic motion
    const wind = Math.sin(time * 0.7) * 0.4 + Math.cos(time * 0.4 + 1.2) * 0.25;
    // Verlet integration
    for (let p = 0; p < NX * NY; p++) {
      if (this.pinned[p]) continue;
      const i = p * 3;
      const px = this.pos[i],     py = this.pos[i + 1], pz = this.pos[i + 2];
      const qx = this.prev[i],    qy = this.prev[i + 1], qz = this.prev[i + 2];
      // damping ~0.99
      const damp = 0.985;
      const nx = px + (px - qx) * damp + ax * dt2;
      const ny = py + (py - qy) * damp + ay * dt2;
      const nz = pz + (pz - qz) * damp + (az + wind * 0.05 + transitionImpulse) * dt2;
      this.prev[i] = px; this.prev[i + 1] = py; this.prev[i + 2] = pz;
      this.pos[i] = nx;  this.pos[i + 1] = ny;  this.pos[i + 2] = nz;
    }

    // Constraint relaxation — 3 passes converges nicely without explosion
    for (let pass = 0; pass < 3; pass++) {
      for (const [a, b, rest] of this.constraints) {
        const ai = a * 3, bi = b * 3;
        const dx = this.pos[bi] - this.pos[ai];
        const dy = this.pos[bi + 1] - this.pos[ai + 1];
        const dz = this.pos[bi + 2] - this.pos[ai + 2];
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (dist - rest) / dist;
        const moveX = dx * 0.5 * diff;
        const moveY = dy * 0.5 * diff;
        const moveZ = dz * 0.5 * diff;
        if (!this.pinned[a]) {
          this.pos[ai]     += moveX;
          this.pos[ai + 1] += moveY;
          this.pos[ai + 2] += moveZ;
        }
        if (!this.pinned[b]) {
          this.pos[bi]     -= moveX;
          this.pos[bi + 1] -= moveY;
          this.pos[bi + 2] -= moveZ;
        }
      }
    }

    // Push positions into the mesh geometry buffer
    const posAttr = this.mesh.geometry.attributes.position;
    for (let p = 0; p < NX * NY; p++) {
      const i = p * 3;
      posAttr.setXYZ(p, this.pos[i], this.pos[i + 1], this.pos[i + 2]);
    }
    posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /** Drop animation: release pins so cloth falls under gravity. */
  release() {
    for (let i = 0; i < NX; i++) this.pinned[i] = 0;
  }

  /** Reset to flat hanging pose (used when bringing a panel in). */
  reset() {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const x = (i / (NX - 1) - 0.5) * WIDTH;
        const y = (1 - j / (NY - 1) - 0.5) * HEIGHT;
        const idx = (j * NX + i) * 3;
        // Start slightly higher and behind so it "drapes" down on entry
        this.pos[idx]     = x;
        this.pos[idx + 1] = y + 0.5;
        this.pos[idx + 2] = -0.3;
        this.prev[idx]     = x;
        this.prev[idx + 1] = y + 0.5;
        this.prev[idx + 2] = -0.3;
      }
    }
    // Re-pin top row
    for (let p = 0; p < NX * NY; p++) this.pinned[p] = 0;
    for (let i = 0; i < NX; i++) this.pinned[i] = 1;
  }
}

// ---------- build cloths for every vault ----------------------------
const cloths = [];
for (const vault of VAULTS) {
  const tex = await renderVaultTexture(vault);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const cloth = new Cloth(tex, vault.accent);
  cloth.mesh.visible = false;
  cloth.shadow.visible = false;
  scene.add(cloth.mesh);
  scene.add(cloth.shadow);
  cloths.push(cloth);
}

// Show first vault on top
let activeIdx = 0;
let leavingIdx = -1;
let leavingTimer = 0;
cloths[0].mesh.visible = true;
cloths[0].shadow.visible = true;

// ---------- resize ----------------------------------------------------
function resize() {
  const w = sceneEl.clientWidth;
  const h = sceneEl.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Keep full cloth in frame regardless of aspect
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distH = (HEIGHT / 2) / Math.tan(fov / 2) + 1.0;
  const distW = (WIDTH  / 2) / Math.tan(fov / 2) / camera.aspect + 1.0;
  camera.position.z = Math.max(distH, distW);
  camera.updateProjectionMatrix();
}
resize();
new ResizeObserver(resize).observe(sceneEl);

// ---------- transition logic ----------------------------------------
function gotoVault(newIdx) {
  if (newIdx === activeIdx || newIdx < 0 || newIdx >= cloths.length) return;
  // Release current — it will fall away
  const leaving = cloths[activeIdx];
  leaving.release();
  // Apply a strong sideways + downward impulse so it tumbles dramatically
  // out of frame in the direction of travel.
  const dir = newIdx > activeIdx ? -1 : 1;
  for (let p = NX; p < NX * NY; p++) {
    const i = p * 3;
    const j = Math.floor(p / NX);
    const rowFactor = j / NY;        // bottom rows get stronger push (whip effect)
    leaving.prev[i]     -= dir * (0.08 + rowFactor * 0.05);
    leaving.prev[i + 1] -= 0.02;
    leaving.prev[i + 2] -= 0.04 + rowFactor * 0.02;
  }
  leavingIdx = activeIdx;
  leavingTimer = 0;

  // Bring new in — start it draping from above
  const incoming = cloths[newIdx];
  incoming.reset();
  incoming.mesh.visible = true;
  incoming.shadow.visible = true;
  incoming.mesh.material.opacity = 1;

  activeIdx = newIdx;
  updateMeta();
}

function updateMeta() {
  const v = VAULTS[activeIdx];
  const inner = metaEl.querySelector('.vaults__meta-inner');
  // Fade out → swap → fade in
  inner.style.opacity = '0';
  inner.style.transform = 'translateY(8px)';
  setTimeout(() => {
    inner.dataset.vault = String(activeIdx);
    inner.querySelector('.vaults__creator').textContent = v.creator;
    inner.querySelector('.vaults__name').textContent = v.name;
    inner.querySelector('.vaults__pitch').textContent = v.pitch;
    const stats = inner.querySelectorAll('.vaults__stats li b');
    stats[0].textContent = v.tvl;
    stats[1].textContent = v.apy;
    stats[2].textContent = v.holders;
    stats[3].textContent = v.ticker;
    inner.style.setProperty('--accent', v.accent);
    inner.style.opacity = '1';
    inner.style.transform = 'translateY(0)';
  }, 280);

  currentEl.textContent = String(activeIdx + 1).padStart(2, '0');
  // Update accent on stage
  stageEl.style.setProperty('--accent', v.accent);
}

prevBtn.addEventListener('click', () => gotoVault((activeIdx - 1 + cloths.length) % cloths.length));
nextBtn.addEventListener('click', () => gotoVault((activeIdx + 1) % cloths.length));
// Touch / swipe
let touchStartX = null;
sceneEl.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
sceneEl.addEventListener('touchend',   (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) gotoVault((activeIdx + (dx < 0 ? 1 : -1) + cloths.length) % cloths.length);
  touchStartX = null;
}, { passive: true });

updateMeta();

// ---------- animation loop -------------------------------------------
const clock = new THREE.Clock();
function tick() {
  const time = clock.getElapsedTime();
  // Step active cloth (always)
  cloths[activeIdx].step(time);
  // Step leaving cloth if any — fades out as it falls
  if (leavingIdx >= 0) {
    cloths[leavingIdx].step(time, -0.1);
    leavingTimer += DT;
    const t = Math.min(1, leavingTimer / 1.8);
    cloths[leavingIdx].mesh.material.opacity = 1 - t;
    cloths[leavingIdx].shadow.material.opacity = 0.35 * (1 - t);
    if (t >= 1) {
      cloths[leavingIdx].mesh.visible = false;
      cloths[leavingIdx].shadow.visible = false;
      // Reset shadow opacity for next time
      cloths[leavingIdx].shadow.material.opacity = 0.35;
      leavingIdx = -1;
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
