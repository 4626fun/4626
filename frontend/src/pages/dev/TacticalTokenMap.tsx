import { Grid, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

import { PageMeta } from '@/components/seo/PageMeta'

/**
 * Dev experiment — 3D "tactical map" target-acquisition surface.
 *
 * Recreates the synthwave/tactical reference: a tilted grid plane to the
 * horizon, a glowing white perimeter ring, orange low-poly wireframe terrain,
 * and a central rotating hologram on a gear/projector pad — here the hologram is
 * a real 3D Shiba Inu model (Quaternius "Shiba Inu", CC0) projected as a cyan
 * wireframe + fresnel surface with scanlines and a travelling scan band. The
 * Shiba breed matches the AKITA token logo (a red/tan Shiba).
 *
 * Override HUD labels with `?token=0x..&symbol=TICKER&name=Display Name`.
 *
 * Marketing-route safe: no wagmi / Privy hooks. The model is a same-origin GLB
 * at `/dev/akita-hunyuan.glb`.
 */

const AKITA_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'
// Image-to-3D AKITA mesh generated from the token logo (Hunyuan3D-2.1, shape-only).
const SHIBA_MODEL_URL = '/dev/akita-hunyuan.glb'
useGLTF.preload(SHIBA_MODEL_URL)

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

// --- tiny value-noise for static low-poly terrain ---------------------------
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const tl = hash(xi, zi)
  const tr = hash(xi + 1, zi)
  const bl = hash(xi, zi + 1)
  const br = hash(xi + 1, zi + 1)
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  return (tl * (1 - u) + tr * u) * (1 - v) + (bl * (1 - u) + br * u) * v
}
function fbm(x: number, z: number) {
  let a = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < 4; i++) {
    a += amp * vnoise(x * f, z * f)
    f *= 2
    amp *= 0.5
  }
  return a
}

// ---------------------------------------------------------------------------
// Scene pieces
// ---------------------------------------------------------------------------

function TerrainRing() {
  const geometry = useMemo(() => {
    const innerR = 1.5
    const outerR = 4.6
    const radial = 15
    const angular = 104
    const cols = angular + 1
    const rows = radial + 1
    const pos = new Float32Array(cols * rows * 3)
    for (let ri = 0; ri < rows; ri++) {
      const rt = ri / radial
      const r = innerR + (outerR - innerR) * rt
      const env = Math.sin(Math.PI * rt) // 0 at inner/outer edges, 1 mid-band
      for (let ai = 0; ai < cols; ai++) {
        const ang = (ai / angular) * Math.PI * 2
        const x = Math.cos(ang) * r
        const z = Math.sin(ang) * r
        // a few sharp mountain clusters around the rim, mostly-flat between
        const lobes = Math.max(
          Math.sin(ang * 2 + 0.5),
          Math.sin(ang * 3 - 1.2),
          Math.sin(ang * 5 + 2.0),
        )
        const cluster = Math.pow(Math.max(0, lobes), 5)
        const n = Math.pow(Math.max(0, fbm(x * 0.9 + 11, z * 0.9 + 7)), 2.0)
        const h = env * (0.02 + 0.98 * cluster) * n * 2.1
        const idx = (ri * cols + ai) * 3
        pos[idx] = x
        pos[idx + 1] = h
        pos[idx + 2] = z
      }
    }
    const indices: number[] = []
    for (let ri = 0; ri < radial; ri++) {
      for (let ai = 0; ai < angular; ai++) {
        const a = ri * cols + ai
        const b = a + 1
        const c = a + cols
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [])

  // Fade the wireframe by height so flat ground is invisible and only the
  // mountains glow orange (matches the reference's sparse peaks).
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#e8681a') },
          uLow: { value: 0.08 },
          uHigh: { value: 0.95 },
        },
        vertexShader: /* glsl */ `
          varying float vH;
          void main() {
            vH = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uLow;
          uniform float uHigh;
          varying float vH;
          void main() {
            float a = smoothstep(uLow, uHigh, vH);
            if (a < 0.03) discard;
            gl_FragColor = vec4(uColor * (0.3 + 0.7 * a), a * 0.9);
          }
        `,
        wireframe: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  return <mesh geometry={geometry} material={material} position={[0, 0.02, 0]} />
}

function PerimeterRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <torusGeometry args={[4.65, 0.018, 8, 160]} />
      <meshBasicMaterial color="#284a6e" transparent opacity={0.6} toneMapped={false} />
    </mesh>
  )
}

function ProjectorPad() {
  const teeth = useMemo(() => {
    const count = 30
    return Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * Math.PI * 2
      return {
        x: Math.cos(ang) * 1.05,
        z: Math.sin(ang) * 1.05,
        ry: -ang,
      }
    })
  }, [])
  return (
    <group position={[0, 0.05, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05, 0.014, 6, 96]} />
        <meshBasicMaterial color="#2c5a86" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {teeth.map((t, i) => (
        <mesh key={i} position={[t.x, 0, t.z]} rotation={[0, t.ry, 0]}>
          <boxGeometry args={[0.05, 0.02, 0.17]} />
          <meshBasicMaterial color="#264f76" transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// Holographic point-cloud projection. Inspired by TSL/WebGPU node-based
// particle holograms (e.g. hologram-particles.vercel.app), recreated on this
// project's WebGL R3F stack: the GLB surface is sampled into ~48k glowing
// points that shimmer, run a vertical scan sweep, and disperse/reform on scan.
const PARTICLE_COUNT = 48000
const SCAN_DURATION_MS = 1700

const HOLO_POINTS_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uUnit;       // model local height (jitter/disperse scale)
  uniform float uDisperse;   // 0 assembled -> 1 fully scattered
  uniform float uScanY;      // current scan sweep height (local space)
  attribute vec3 aNormal;
  attribute vec3 aRand;
  attribute float aSeed;
  varying float vGlow;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    vec3 pos = position;

    // Idle shimmer: tiny breathing along the surface normal + lateral drift.
    float flick = sin(uTime * 3.0 + aSeed * 50.0);
    pos += aNormal * (0.012 * uUnit * flick);
    pos.x += sin(uTime * 1.3 + aRand.x * 30.0) * 0.006 * uUnit;
    pos.z += cos(uTime * 1.1 + aRand.z * 30.0) * 0.006 * uUnit;

    // Continuous ambient drift: a slow, ever-present outward turbulence so the
    // hologram feels alive even when no scan is running.
    vec3 driftDir = normalize(aNormal + (aRand - 0.5));
    float drift = (0.5 + 0.5 * sin(uTime * 0.7 + aSeed * 24.0));
    pos += driftDir * drift * 0.03 * uUnit;

    // Dispersion burst: scatter outward along normal + a random direction,
    // staggered per particle so the cloud blows apart and reassembles.
    float d = clamp(uDisperse - aSeed * 0.25, 0.0, 1.0);
    vec3 dir = normalize(aNormal + (aRand - 0.5) * 1.4);
    pos += dir * d * uUnit * (0.5 + aRand.y * 1.6);

    // Vertical scan band: particles near the sweep line flare bright.
    float scan = smoothstep(0.12 * uUnit, 0.0, abs(position.y - uScanY));

    vGlow = 0.4 + flick * 0.28 + scan * 1.4;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.45 + aRand.y * 0.85 + scan * 1.6);
    gl_PointSize = clamp(size * uPixelRatio * (8.0 / -mv.z), 1.0, 9.0);
  }
`
const HOLO_POINTS_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying float vGlow;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, r);
    float core = smoothstep(0.16, 0.0, r);
    vec3 col = mix(uColor, uColor2, vSeed);
    float a = (soft * 0.45 + core * 0.95) * clamp(vGlow, 0.0, 2.0);
    gl_FragColor = vec4(col * (0.4 + vGlow), a);
  }
`

function HoloDog({ scanTick }: { scanTick: number }) {
  const spin = useRef<THREE.Group>(null)
  const bob = useRef<THREE.Group>(null)
  const burstStart = useRef<number>(-1)
  const { scene } = useGLTF(SHIBA_MODEL_URL)

  // Held in a ref (not useMemo) because the uniforms are mutated per-frame in
  // useFrame; mutating a useMemo result trips react-hooks/immutability.
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const material = (materialRef.current ??= new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 2.6 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uUnit: { value: 1 },
      uDisperse: { value: 0 },
      uScanY: { value: 0 },
      uColor: { value: new THREE.Color('#3fb6ff') },
      uColor2: { value: new THREE.Color('#cdf6ff') },
    },
    vertexShader: HOLO_POINTS_VERT,
    fragmentShader: HOLO_POINTS_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }))

  // Sample the GLB surface into a glowing point cloud + normalize to pad height.
  const { geometry, offset, scale, unit, minY, maxY } = useMemo(() => {
    const root = scene.clone(true)
    root.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    root.traverse((child) => {
      const m = child as THREE.Mesh
      if (m.isMesh && m.geometry) meshes.push(m)
    })

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const normals = new Float32Array(PARTICLE_COUNT * 3)
    const rands = new Float32Array(PARTICLE_COUNT * 3)
    const seeds = new Float32Array(PARTICLE_COUNT)

    // Distribute points across meshes weighted by vertex count.
    const weights = meshes.map((m) => m.geometry.attributes.position!.count)
    const totalW = weights.reduce((a, b) => a + b, 0) || 1

    const tmpP = new THREE.Vector3()
    const tmpN = new THREE.Vector3()
    const nMat = new THREE.Matrix3()
    let ptr = 0
    meshes.forEach((m, i) => {
      const n =
        i === meshes.length - 1
          ? PARTICLE_COUNT - ptr
          : Math.floor((PARTICLE_COUNT * weights[i]!) / totalW)
      const sampler = new MeshSurfaceSampler(m).build()
      nMat.getNormalMatrix(m.matrixWorld)
      for (let k = 0; k < n; k++) {
        sampler.sample(tmpP, tmpN)
        tmpP.applyMatrix4(m.matrixWorld)
        tmpN.applyMatrix3(nMat).normalize()
        const o = (ptr + k) * 3
        positions[o] = tmpP.x
        positions[o + 1] = tmpP.y
        positions[o + 2] = tmpP.z
        normals[o] = tmpN.x
        normals[o + 1] = tmpN.y
        normals[o + 2] = tmpN.z
        rands[o] = Math.random()
        rands[o + 1] = Math.random()
        rands[o + 2] = Math.random()
        seeds[ptr + k] = Math.random()
      }
      ptr += n
    })

    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    for (let k = 0; k < PARTICLE_COUNT; k++) {
      box.expandByPoint(v.set(positions[k * 3]!, positions[k * 3 + 1]!, positions[k * 3 + 2]!))
    }
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const targetHeight = 2.2
    const s = targetHeight / (size.y || 1)

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3))
    geom.setAttribute('aRand', new THREE.BufferAttribute(rands, 3))
    geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

    return {
      geometry: geom,
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s] as [number, number, number],
      unit: size.y || 1,
      minY: box.min.y,
      maxY: box.max.y,
    }
  }, [scene])

  useEffect(() => {
    const m = materialRef.current
    if (m) m.uniforms.uUnit!.value = unit
  }, [unit])

  // Kick off a disperse/reform burst whenever the scan button fires.
  useEffect(() => {
    if (scanTick > 0) burstStart.current = performance.now()
  }, [scanTick])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    material.uniforms.uTime!.value = t

    const range = maxY - minY || 1
    let burst = 0
    let scanY = minY + ((t * 0.35) % 1) * range // gentle idle sweep
    if (burstStart.current >= 0) {
      const p = (performance.now() - burstStart.current) / SCAN_DURATION_MS
      if (p >= 1) {
        burstStart.current = -1
      } else {
        burst = Math.sin(p * Math.PI) * 0.65 // rise then fall
        scanY = minY + p * range // one fast top-to-bottom sweep
      }
    }
    material.uniforms.uDisperse!.value = burst
    material.uniforms.uScanY!.value = scanY

    // Bias to a 3/4 side profile (most dog-readable) and spin slowly.
    if (spin.current) spin.current.rotation.y = Math.PI * 0.5 + t * 0.18
    if (bob.current) bob.current.position.y = 0.12 + Math.sin(t * 1.3) * 0.04
  })

  return (
    <group ref={bob} position={[0, 0.12, 0]}>
      <group ref={spin}>
        <group scale={scale} position={offset}>
          <points geometry={geometry} material={material} />
        </group>
      </group>
    </group>
  )
}

function HoloProjection({ scanTick }: { scanTick: number }) {
  return (
    <group>
      <ProjectorPad />
      <Suspense fallback={null}>
        <HoloDog scanTick={scanTick} />
      </Suspense>
    </group>
  )
}

function ScanRing({ scanTick }: { scanTick: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const startRef = useRef<number>(-1)
  useEffect(() => {
    if (scanTick > 0) startRef.current = performance.now()
  }, [scanTick])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const start = startRef.current
    if (start < 0) {
      m.visible = false
      return
    }
    const p = (performance.now() - start) / 1700
    if (p >= 1) {
      m.visible = false
      startRef.current = -1
      return
    }
    m.visible = true
    const s = 0.2 + p * 9
    m.scale.set(s, s, s)
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = (1 - p) * 0.9
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={false}>
      <torusGeometry args={[0.5, 0.012, 6, 128]} />
      <meshBasicMaterial color="#7fe6ff" transparent opacity={0} toneMapped={false} />
    </mesh>
  )
}

function Rig({ pointerRef }: { pointerRef: React.RefObject<{ x: number; y: number }> }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = pointerRef.current
    const a = Math.sin(t * 0.04) * 0.16 + p.x * 0.3
    const r = 13.2
    state.camera.position.x = Math.sin(a) * r
    state.camera.position.z = Math.cos(a) * r
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 7.0 - p.y * 0.8, 0.06)
    state.camera.lookAt(0, 0.5, 0)
  })
  return null
}

function Scene({
  scanTick,
  pointerRef,
}: {
  scanTick: number
  pointerRef: React.RefObject<{ x: number; y: number }>
}) {
  return (
    <>
      <color attach="background" args={['#010309']} />
      <fog attach="fog" args={['#010309', 16, 46]} />
      <ambientLight intensity={0.28} />

      <Grid
        position={[0, 0, 0]}
        infiniteGrid
        followCamera={false}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#0c1f3a"
        sectionSize={2.5}
        sectionThickness={0.8}
        sectionColor="#1c4488"
        fadeDistance={50}
        fadeStrength={2.4}
      />

      <TerrainRing />
      <PerimeterRing />
      <HoloProjection scanTick={scanTick} />
      <ScanRing scanTick={scanTick} />

      <Rig pointerRef={pointerRef} />

      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.32} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette offset={0.2} darkness={0.95} />
      </EffectComposer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TacticalTokenMap() {
  const [params] = useSearchParams()
  const token = (params.get('token') || AKITA_TOKEN).toLowerCase()
  const symbol = (params.get('symbol') || 'AKITA').toUpperCase()
  const name = params.get('name') || 'Akita'

  const pointerRef = useRef({ x: 0, y: 0 })
  const [scanTick, setScanTick] = useState(0)
  const [scanning, setScanning] = useState(false)

  const nodes = useMemo(
    () => [
      { id: 'TWR-00', label: `${symbol} core`, core: true },
      { id: 'TWR-01', label: 'Relay 1', core: false },
      { id: 'TWR-02', label: 'Relay 2', core: false },
      { id: 'TWR-03', label: 'Relay 3', core: false },
      { id: 'TWR-04', label: 'Relay 4', core: false },
    ],
    [symbol],
  )

  function launchScan() {
    setScanTick((n) => n + 1)
    setScanning(true)
    window.setTimeout(() => setScanning(false), 1700)
  }

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-[#02040a] font-mono text-[rgba(170,210,255,0.92)] select-none"
      onPointerMove={(e) => {
        pointerRef.current = {
          x: (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1,
          y: (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1,
        }
      }}
    >
      <PageMeta
        title="Tactical token map"
        description="Dev-only 3D target-acquisition surface with a holographic creator-coin logo"
        canonicalPath="/dev/tactical-map"
      />

      <Canvas
        className="absolute inset-0"
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        camera={{ position: [0, 7, 12.5], fov: 36, near: 0.1, far: 100 }}
      >
        <Scene scanTick={scanTick} pointerRef={pointerRef} />
      </Canvas>

      {/* CRT scanlines + vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(120,200,255,0.6) 0px, rgba(120,200,255,0.6) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* HUD corners */}
      <div className="pointer-events-none absolute left-4 top-4 h-9 w-9 border-l-2 border-t-2 border-[rgba(80,170,255,0.4)]" />
      <div className="pointer-events-none absolute right-4 top-4 h-9 w-9 border-r-2 border-t-2 border-[rgba(80,170,255,0.4)]" />
      <div className="pointer-events-none absolute bottom-4 left-4 h-9 w-9 border-b-2 border-l-2 border-[rgba(80,170,255,0.4)]" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-9 w-9 border-b-2 border-r-2 border-[rgba(80,170,255,0.4)]" />

      {/* Top-left title */}
      <div className="pointer-events-none absolute left-7 top-6 text-[11px] leading-relaxed">
        <div className="text-[13px] font-semibold uppercase tracking-[0.32em] text-[rgba(150,205,255,0.95)]">
          ◇ Tactical Map
        </div>
        <div className="mt-1 text-[rgba(120,170,240,0.6)] uppercase tracking-[0.18em]">
          4626 // creator-coin recon
        </div>
      </div>

      {/* Top-right status */}
      <div className="pointer-events-none absolute right-7 top-6 text-right text-[11px] leading-relaxed">
        <div className="flex items-center justify-end gap-2 text-[rgba(140,200,255,0.9)]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[rgba(120,230,255,1)]" />
          {scanning ? 'SCANNING' : 'STANDBY'}
        </div>
        <div className="mt-1 text-[rgba(120,170,240,0.65)]">GRID A–F · 1–5</div>
      </div>

      {/* Bottom-left node list */}
      <div className="pointer-events-none absolute bottom-7 left-7 text-[11px] leading-relaxed">
        <div className="mb-1 text-[rgba(120,170,240,0.55)] uppercase tracking-[0.24em]">
          Nodes 0{nodes.length}
        </div>
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                n.core ? 'bg-[rgba(120,230,255,1)]' : 'bg-[rgba(255,140,50,0.85)]'
              }`}
            />
            <span className={n.core ? 'text-[rgba(150,220,255,0.95)]' : 'text-[rgba(120,160,225,0.7)]'}>
              {n.id}
            </span>
            <span className="text-[rgba(110,150,215,0.55)]">{n.label}</span>
          </div>
        ))}
        <div className="mt-2 text-[rgba(110,150,215,0.55)]">{shortAddr(token)}</div>
      </div>

      {/* Bottom-center: launch scan */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={launchScan}
          className="border border-[rgba(90,190,255,0.5)] bg-[rgba(20,60,120,0.25)] px-6 py-2 text-[12px] uppercase tracking-[0.28em] text-[rgba(160,220,255,0.95)] backdrop-blur-sm transition hover:border-[rgba(130,220,255,0.9)] hover:bg-[rgba(30,80,150,0.4)] hover:text-white"
        >
          ◊ Launch scan
        </button>
        <div className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-[rgba(120,170,240,0.5)]">
          target · {name} <span className="text-[rgba(120,180,255,0.6)]">/ ${symbol}</span>
        </div>
      </div>

      {/* Bottom-right info */}
      <div className="pointer-events-none absolute bottom-7 right-7 text-right text-[11px] text-[rgba(120,170,240,0.6)]">
        ⓘ INFO
      </div>
    </div>
  )
}

export default TacticalTokenMap
