import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import { ZORA_TOKEN_LOGO_URL } from '@/lib/tokens/tokenLogo'

/**
 * Cinematic "trace-sculpt" chooser for the Deploy landing.
 *
 * Faithful re-creation of the Trace Cards 3D interaction
 * (docs/animations/cursor_3d_animated_card_concept.md — live reference:
 * experiments.thisiswhitespace.com/trace-cards). Each card holds a dot
 * formation that, on hover, sculpts a glowing 3D form by streaming a depth
 * layer away from the live plane and connecting the two with trace wires and
 * semi-transparent faceted faces:
 *
 *   - Coin (ERC-20)            -> Zora creator-coin mark (/brands/zora-token.svg)
 *   - Vault (ERC-20 + ERC-4626) -> glass octahedron with soft edge traces
 *
 * The whole card surface is a real WebGL panel (MeshPhysicalMaterial) lit by a
 * 3-point rig with VSM soft shadows; it tilts toward the cursor in true 3D and
 * the formed sculpt slowly spins. HTML chrome (Coordinates readout, LIVE badge,
 * big title, mono spec line) floats above the canvas and quiets on hover so the
 * sculpt is the focus.
 *
 * The card is an accessible navigation link. The 3D layer is decorative and is
 * skipped under prefers-reduced-motion or when WebGL is unavailable, falling
 * back to a static brand-styled card.
 */

type Variant = 'coin' | 'vault'

interface CardConfig {
  variant: Variant
  title: string
  desc: string
  standards: string[]
  requires?: string
  to: string
  /** Core / accent (light) colors — cool, on-brand. */
  core: string
  accent: string
}

const CARDS: CardConfig[] = [
  {
    variant: 'coin',
    title: 'Coin',
    desc: 'Launch your Creator Coin',
    standards: ['ERC-20'],
    to: '/deploy/coin',
    core: '#4d8fff',
    accent: '#a8c8ff',
  },
  {
    variant: 'vault',
    title: 'Vault',
    desc: 'Yield vault for your Creator Coin',
    standards: ['ERC-20', 'ERC-4626'],
    requires: 'Requires a Zora Creator Coin',
    to: '/deploy/vault',
    core: '#1ecad3',
    accent: '#8ee8f0',
  },
]

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}

let webglCache: boolean | null = null
function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache
  try {
    const canvas = document.createElement('canvas')
    webglCache = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    webglCache = false
  }
  return webglCache
}

// ---------------------------------------------------------------------------
// Sculpt topology
// ---------------------------------------------------------------------------

const ETH_R = 0.78 // Ethereum octahedron girdle half-extent
const ETH_TOP = 1.22 // upper pyramid apex height
const ETH_BOT = 0.96 // lower pyramid apex depth

/** A tier is a single center point (count 1) or an n-gon ring (count >= 3). */
interface Tier {
  verts: THREE.Vector3[]
}

const isRing = (t: Tier) => t.verts.length >= 3

/** Horizontal (XZ-plane) ring of n points at height h. */
function ring(r: number, h: number, n: number, phase = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase
    out.push(new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r))
  }
  return out
}

/**
 * Returns the ordered tiers for a variant at sculpt progress p (0..1).
 *
 *   vault -> Ethereum-style octahedron: two square pyramids joined base-to-base
 *            (lower apex -> girdle -> upper apex).
 */
function tiersAt(p: number): Tier[] {
  const lower: Tier = { verts: [new THREE.Vector3(0, -ETH_BOT * p, 0)] }
  const girdle: Tier = { verts: ring(ETH_R * p, 0, 4, 0) }
  const upper: Tier = { verts: [new THREE.Vector3(0, ETH_TOP * p, 0)] }
  return [lower, girdle, upper]
}

/** Counts that stay fixed for the vault sculpt (used to size buffers + instances). */
function topology() {
  const tiers = tiersAt(1)
  const dotCount = tiers.reduce((n, t) => n + t.verts.length, 0)

  // Wire segments: ring perimeters + spokes between consecutive tiers.
  let segCount = 0
  for (const t of tiers) if (isRing(t)) segCount += t.verts.length
  for (let i = 0; i < tiers.length - 1; i++) {
    segCount += Math.max(tiers[i]!.verts.length, tiers[i + 1]!.verts.length)
  }

  // Face triangles: point->ring fan (n tris) or ring->ring band (2n tris).
  let triCount = 0
  for (let i = 0; i < tiers.length - 1; i++) {
    const a = tiers[i]!
    const b = tiers[i + 1]!
    if (isRing(a) && isRing(b)) triCount += 2 * a.verts.length
    else triCount += Math.max(a.verts.length, b.verts.length)
  }

  return { dotCount, segCount, triCount }
}

// ---------------------------------------------------------------------------
// Sculpt (imperative per-frame geometry under the tilt group)
// ---------------------------------------------------------------------------

interface SharedRefs {
  pointer: React.MutableRefObject<{ x: number; y: number }>
  hover: React.MutableRefObject<boolean>
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Zora creator-coin mark — crisp SVG with stage glow and cursor parallax. */
function ZoraLogoMark() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center" aria-hidden>
      <div className="relative translate-x-[8%] -translate-y-[14%] transition-transform duration-500 ease-out group-hover:scale-[1.05]">
        <div
          className="relative will-change-transform"
          style={{
            transform:
              'perspective(900px) rotateX(calc((var(--my) - 50%) * 0.1deg)) rotateY(calc((var(--mx) - 50%) * -0.14deg))',
          }}
        >
          <div className="absolute inset-[-35%] rounded-full bg-[rgba(77,143,255,0.24)] opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
          <img
            src={ZORA_TOKEN_LOGO_URL}
            alt=""
            width={168}
            height={168}
            decoding="async"
            draggable={false}
            className="relative h-[148px] w-[148px] rounded-full object-cover shadow-[0_28px_90px_-24px_rgba(77,143,255,0.65)] ring-1 ring-white/12 sm:h-[168px] sm:w-[168px]"
          />
        </div>
      </div>
    </div>
  )
}

function VaultSculpt({ config, shared }: { config: CardConfig; shared: SharedRefs }) {
  const { accent } = config
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const wires = useRef<THREE.LineSegments>(null)
  const faces = useRef<THREE.Mesh>(null)

  const p = useRef(0)
  const spinAngle = useRef(0)
  const glowT = useRef(0)

  const topo = useMemo(() => topology(), [])

  const FLOOR_Y = -1.0
  const yOffset = FLOOR_Y + ETH_BOT * 1.05
  const baseScale = 1.05

  const wireGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(topo.segCount * 6), 3))
    return g
  }, [topo.segCount])

  const faceGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(topo.triCount * 9), 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(topo.triCount * 9), 3))
    return g
  }, [topo.triCount])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    return () => {
      wireGeo.dispose()
      faceGeo.dispose()
    }
  }, [wireGeo, faceGeo])

  useFrame((_state, dt) => {
    const d = Math.min(dt, 0.05)

    if (tilt.current) {
      const on = shared.hover.current
      const px = on ? shared.pointer.current.x : 0
      const py = on ? shared.pointer.current.y : 0
      const REST_PITCH = -0.34
      const targetX = REST_PITCH - py * 0.26
      const targetY = px * 0.42
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, targetX, 7, d)
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, targetY, 7, d)
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, on ? px * 0.06 : 0, 6, d)
    }

    const REST = 0.72
    p.current = THREE.MathUtils.damp(p.current, shared.hover.current ? 1 : REST, 4, d)
    const prog = easeInOut(Math.min(1, Math.max(0, p.current)))

    // Gentle idle spin at rest, accelerating as the form blooms on hover.
    spinAngle.current += d * (0.08 + 0.45 * Math.max(0, (prog - REST) / (1 - REST)))
    if (spin.current) {
      spin.current.rotation.y = spinAngle.current
      spin.current.scale.setScalar(baseScale * (1 + 0.04 * glowT.current))
    }

    glowT.current = THREE.MathUtils.damp(glowT.current, shared.hover.current ? 1 : 0, 6, d)
    const g = glowT.current
    if (dots.current) {
      ;(dots.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + 0.45 * g
    }
    if (wires.current) {
      ;(wires.current.material as THREE.LineBasicMaterial).opacity = 0.22 + 0.38 * g
    }
    if (faces.current) {
      const m = faces.current.material as THREE.MeshPhysicalMaterial
      m.opacity = 0.14 + 0.12 * g
      m.emissiveIntensity = 0.15 + 0.2 * g
      m.transmission = 0.72 + 0.12 * g
    }

    const tiers = tiersAt(prog)
    const flat: THREE.Vector3[] = []
    for (const t of tiers) for (const vert of t.verts) flat.push(vert)

    // --- dots ---
    if (dots.current) {
      const dotScale = 0.028 + 0.014 * prog
      for (let i = 0; i < flat.length; i++) {
        dummy.position.copy(flat[i]!)
        dummy.scale.setScalar(dotScale)
        dummy.updateMatrix()
        dots.current.setMatrixAt(i, dummy.matrix)
      }
      dots.current.count = flat.length
      dots.current.instanceMatrix.needsUpdate = true
    }

    // --- wires ---
    if (wires.current) {
      const arr = (wireGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      let o = 0
      const push = (a: THREE.Vector3, b: THREE.Vector3) => {
        arr[o++] = a.x; arr[o++] = a.y; arr[o++] = a.z
        arr[o++] = b.x; arr[o++] = b.y; arr[o++] = b.z
      }
      // ring perimeters
      for (const t of tiers) {
        if (isRing(t)) {
          const n = t.verts.length
          for (let i = 0; i < n; i++) push(t.verts[i]!, t.verts[(i + 1) % n]!)
        }
      }
      for (let i = 0; i < tiers.length - 1; i++) {
        const a = tiers[i]!
        const b = tiers[i + 1]!
        if (a.verts.length === 1) {
          for (let k = 0; k < b.verts.length; k++) push(a.verts[0]!, b.verts[k]!)
        } else if (b.verts.length === 1) {
          for (let k = 0; k < a.verts.length; k++) push(a.verts[k]!, b.verts[0]!)
        } else {
          const n = a.verts.length
          for (let k = 0; k < n; k++) push(a.verts[k]!, b.verts[k]!)
        }
      }
      wireGeo.getAttribute('position').needsUpdate = true
      wireGeo.setDrawRange(0, o / 3)
    }

    // --- faces ---
    if (faces.current) {
      const arr = (faceGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      let o = 0
      const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
        arr[o++] = a.x; arr[o++] = a.y; arr[o++] = a.z
        arr[o++] = b.x; arr[o++] = b.y; arr[o++] = b.z
        arr[o++] = c.x; arr[o++] = c.y; arr[o++] = c.z
      }
      for (let i = 0; i < tiers.length - 1; i++) {
        const a = tiers[i]!
        const b = tiers[i + 1]!
        if (a.verts.length === 1) {
          const n = b.verts.length
          for (let k = 0; k < n; k++) tri(a.verts[0]!, b.verts[k]!, b.verts[(k + 1) % n]!)
        } else if (b.verts.length === 1) {
          const n = a.verts.length
          for (let k = 0; k < n; k++) tri(a.verts[k]!, a.verts[(k + 1) % n]!, b.verts[0]!)
        } else {
          const n = a.verts.length
          for (let k = 0; k < n; k++) {
            const k2 = (k + 1) % n
            tri(a.verts[k]!, a.verts[k2]!, b.verts[k2]!)
            tri(a.verts[k]!, b.verts[k2]!, b.verts[k]!)
          }
        }
      }
      faceGeo.getAttribute('position').needsUpdate = true
      faceGeo.setDrawRange(0, topo.triCount * 3)
      faceGeo.computeVertexNormals()
    }
  })

  return (
    <group ref={tilt}>
      {/* invisible floor that only catches the soft contact shadow */}
      <mesh position={[0, FLOOR_Y - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <shadowMaterial transparent opacity={0.45} />
      </mesh>
      <group ref={spin} position={[0.15, yOffset, 0]} scale={baseScale}>
        <instancedMesh ref={dots} args={[undefined, undefined, topo.dotCount]} castShadow>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color="#f8fbff"
            emissive={accent}
            emissiveIntensity={0.45}
            roughness={0.15}
            metalness={0.05}
            toneMapped={false}
          />
        </instancedMesh>

        <lineSegments ref={wires} geometry={wireGeo}>
          <lineBasicMaterial color={accent} transparent opacity={0.35} toneMapped={false} />
        </lineSegments>

        <mesh ref={faces} geometry={faceGeo} castShadow>
          <meshPhysicalMaterial
            color={config.core}
            emissive={config.core}
            emissiveIntensity={0.18}
            metalness={0.08}
            roughness={0.06}
            transmission={0.78}
            thickness={0.55}
            ior={1.42}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

function CardScene({ config, shared }: { config: CardConfig; shared: SharedRefs }) {
  return (
    <Canvas
      className="absolute inset-0 z-0"
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ position: [0, 0.05, 5.6], fov: 40, near: 0.1, far: 50 }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.VSMShadowMap
        gl.setClearColor(0x000000, 0)
      }}
    >
      <ambientLight intensity={0.55} color="#eef4ff" />
      <directionalLight
        position={[2.2, 4.8, 4.5]}
        intensity={2.2}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.002}
        shadow-normalBias={0.02}
        shadow-radius={18}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-camera-left={-3.5}
        shadow-camera-right={3.5}
        shadow-camera-top={3.5}
        shadow-camera-bottom={-3.5}
      />
      <directionalLight position={[-2.8, 2.6, 3.2]} intensity={1.1} color="#c8e0ff" />
      <pointLight position={[0, 1.2, 2.4]} intensity={0.6} color={config.accent} distance={8} decay={2} />
      <VaultSculpt config={config} shared={shared} />
    </Canvas>
  )
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const CARD_SHELL =
  'group relative block aspect-[16/10] overflow-hidden rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-[#0a0e16] to-[#05070b] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow,transform] duration-500 ease-out hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_50px_120px_-44px_rgba(0,0,0,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60'

function StandardChip({ standard }: { standard: string }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-300 backdrop-blur-sm">
      {standard}
    </span>
  )
}

function StandardChips({ standards }: { standards: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {standards.map((s) => (
        <StandardChip key={s} standard={s} />
      ))}
    </div>
  )
}

function RequiresNote({ text, accent }: { text: string; accent: string }) {
  return (
    <p className="mt-2.5 flex items-center gap-2 text-[12px] leading-snug text-zinc-500">
      <span aria-hidden className="inline-block h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
      {text}
    </p>
  )
}

function CardChrome({ config }: { config: CardConfig }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-7">
      {/* top-left: token standards */}
      <div className="transition-opacity duration-500 group-hover:opacity-70">
        <StandardChips standards={config.standards} />
      </div>

      {/* bottom: title + description */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-semibold leading-none tracking-tight text-transparent drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-[2.9rem]">
            {config.title}
          </h2>
          <p className="mt-3 text-[13px] leading-snug text-zinc-400">{config.desc}</p>
          {config.requires ? <RequiresNote text={config.requires} accent={config.accent} /> : null}
        </div>
        <span
          aria-hidden
          className="mb-1 inline-flex translate-x-1.5 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-white/90 opacity-0 backdrop-blur-sm transition-all duration-400 ease-out group-hover:translate-x-0 group-hover:opacity-100"
        >
          Enter
          <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </div>
  )
}

function TraceCard({ config }: { config: CardConfig }) {
  const pointer = useRef({ x: 0, y: 0 })
  const hover = useRef(false)

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1
    // Drive the cursor-following spotlight via CSS vars.
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  const isCoin = config.variant === 'coin'
  // Dramatic stage glow behind the form + interactive cursor spotlight.
  const stageGlow = isCoin ? 'rgba(77,143,255,0.12)' : 'rgba(30,202,211,0.12)'
  const cursorGlow = isCoin ? 'rgba(140,180,255,0.14)' : 'rgba(120,235,245,0.14)'

  return (
    <Link
      to={config.to}
      className={CARD_SHELL}
      style={{ ['--mx' as string]: '58%', ['--my' as string]: '40%' } as React.CSSProperties}
      onPointerEnter={() => {
        hover.current = true
      }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        hover.current = false
        pointer.current.x = 0
        pointer.current.y = 0
      }}
      aria-label={`${config.title} — ${config.desc}`}
    >
      {/* dramatic stage spotlight behind the sculpt (painted under the canvas) */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(58% 52% at 58% 38%, ${stageGlow}, transparent 72%)`, opacity: 0.55 }}
      />
      {isCoin ? (
        <ZoraLogoMark />
      ) : (
        <CardScene config={config} shared={{ pointer, hover }} />
      )}
      {/* interactive cursor-following spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(240px circle at var(--mx) var(--my), ${cursorGlow}, transparent 72%)` }}
      />
      {/* cinematic edge vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: 'inset 0 0 72px 8px rgba(0,0,0,0.45)' }}
      />
      {/* legibility scrim under the title */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[42%] bg-gradient-to-t from-[#05070b] via-[#05070b]/40 to-transparent" />
      {/* glassy top highlight + inner hairline ring */}
      <div className="pointer-events-none absolute inset-x-5 top-0 z-30 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-30 rounded-[22px] ring-1 ring-inset ring-white/[0.06]" />
      <CardChrome config={config} />
    </Link>
  )
}

function StaticCard({ config }: { config: CardConfig }) {
  return (
    <Link
      to={config.to}
      className="vault-hover-lift relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-[#0a0e16] to-[#05070b] p-6 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] sm:p-7"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            config.variant === 'coin'
              ? 'radial-gradient(58% 52% at 58% 38%, rgba(77,143,255,0.16), transparent 72%)'
              : 'radial-gradient(68% 58% at 64% 32%, rgba(30,202,211,0.12), transparent 70%)',
        }}
      />
      {config.variant === 'coin' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <img
            src={ZORA_TOKEN_LOGO_URL}
            alt=""
            width={148}
            height={148}
            decoding="async"
            draggable={false}
            className="relative h-[148px] w-[148px] translate-x-[8%] -translate-y-[18%] rounded-full object-cover shadow-[0_24px_80px_-24px_rgba(77,143,255,0.55)] ring-1 ring-white/10"
          />
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: 'inset 0 0 90px 12px rgba(0,0,0,0.5)' }}
      />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute left-6 top-6 z-10 sm:left-7 sm:top-7">
        <StandardChips standards={config.standards} />
      </div>
      <div className="relative z-10">
        <h2 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-3xl font-semibold leading-none tracking-tight text-transparent sm:text-4xl">
          {config.title}
        </h2>
        <p className="mt-3 text-[13px] leading-snug text-zinc-400">{config.desc}</p>
        {config.requires ? <RequiresNote text={config.requires} accent={config.accent} /> : null}
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function DeployChoiceCards() {
  const reducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Defer to the next frame so the client-only upgrade does not run as a
    // synchronous setState inside the effect body (react-hooks/set-state-in-effect).
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const interactive = mounted && !reducedMotion

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {CARDS.map((config) => {
        const canAnimate = interactive && (config.variant === 'coin' || hasWebGL())
        return canAnimate ? (
          <TraceCard key={config.variant} config={config} />
        ) : (
          <StaticCard key={config.variant} config={config} />
        )
      })}
    </div>
  )
}
