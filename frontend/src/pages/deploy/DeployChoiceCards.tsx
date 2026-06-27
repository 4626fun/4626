import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import { VaultModel } from '@/marketing/VaultModel'
import { ZORA_TOKEN_LOGO_URL } from '@/lib/tokens/tokenLogo'

const VAULT_POSTER_URL = '/immersive/assets/vault/ethereum_vault_poster.png'

/**
 * Deploy flow chooser cards.
 *
 *   - Coin  -> Zora creator-coin mark (/brands/zora-token.svg)
 *   - Vault -> obsidian vault GLB from the 4626.fun landing hero (VaultModel)
 *
 * The vault card reuses the landing-page lighting rig and turntable motion.
 * Decorative 3D is skipped under prefers-reduced-motion or when WebGL is unavailable.
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
// Vault card 3D (landing-page obsidian gem)
// ---------------------------------------------------------------------------

interface SharedRefs {
  pointer: React.MutableRefObject<{ x: number; y: number }>
  hover: React.MutableRefObject<boolean>
}

function makeStudioEnvTexture(renderer: THREE.WebGLRenderer) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!
  const base = ctx.createLinearGradient(0, 0, 0, 256)
  base.addColorStop(0, '#1a2030')
  base.addColorStop(0.5, '#0c1018')
  base.addColorStop(1, '#05070e')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)
  const key = ctx.createRadialGradient(256, 56, 8, 256, 56, 240)
  key.addColorStop(0, 'rgba(220, 232, 255, 0.85)')
  key.addColorStop(0.5, 'rgba(130, 162, 222, 0.24)')
  key.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = key
  ctx.fillRect(0, 0, 512, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(tex).texture
  pmrem.dispose()
  tex.dispose()
  return env
}

function VaultCardModel({ shared }: { shared: SharedRefs }) {
  const root = useRef<THREE.Group>(null)

  useFrame((_state, dt) => {
    if (!root.current) return
    const on = shared.hover.current
    const px = on ? shared.pointer.current.x : 0
    const py = on ? shared.pointer.current.y : 0
    root.current.rotation.y += dt * (on ? 0.22 : 0.12)
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -0.12 + py * 0.12, 4, dt)
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, 0.12 + px * 0.1, 4, dt)
    const targetScale = on ? 1.05 : 1
    const s = THREE.MathUtils.damp(root.current.scale.x, targetScale, 5, dt)
    root.current.scale.setScalar(s)
  })

  return (
    <group ref={root} position={[0.1, 0.02, 0]}>
      <Suspense fallback={null}>
        <VaultModel />
      </Suspense>
    </group>
  )
}

function CardScene({ shared }: { shared: SharedRefs }) {
  return (
    <Canvas
      className="absolute inset-0 z-0"
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ position: [0, 0.28, 5.8], fov: 24, near: 0.05, far: 100 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        scene.environment = makeStudioEnvTexture(gl)
        gl.setClearColor(0x000000, 0)
      }}
    >
      <ambientLight intensity={0.45} color="#1a2233" />
      <directionalLight position={[2.6, 3.2, 3.2]} intensity={1.5} color="#eef2ff" />
      <directionalLight position={[-2.8, 1.2, -1.4]} intensity={0.65} color="#9fb4d8" />
      <directionalLight position={[0, -2.6, 1.8]} intensity={0.55} color="#7088b8" />
      <directionalLight position={[-1.4, 2.6, -3.8]} intensity={1.45} color="#e9eef6" />
      <directionalLight position={[1.8, -1.0, -3.4]} intensity={0.8} color="#dde4f0" />
      <VaultCardModel shared={shared} />
    </Canvas>
  )
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
        <CardScene shared={{ pointer, hover }} />
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
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <img
            src={VAULT_POSTER_URL}
            alt=""
            width={220}
            height={220}
            decoding="async"
            draggable={false}
            className="relative h-[52%] max-h-[220px] w-auto translate-x-[6%] -translate-y-[16%] object-contain opacity-90"
          />
        </div>
      )}
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
