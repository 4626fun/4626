import { Billboard, Grid } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as THREE from 'three'

import { PageMeta } from '@/components/seo/PageMeta'

/**
 * Dev experiment — 3D "tactical map" target-acquisition surface.
 *
 * Recreates the synthwave/tactical reference: a tilted grid plane to the
 * horizon, a glowing white perimeter ring, orange low-poly wireframe terrain,
 * and a central holographic "tower" on a gear/projector pad — except the
 * hologram is a real creator-coin token logo (defaults to AKITA). The logo is
 * keyed by luminance so its dark icon card drops out and only the subject
 * glows as a cyan hologram (scanlines + flicker + travelling scan bar).
 *
 * Override target with `?token=0x..&symbol=TICKER&name=Display Name`.
 *
 * Marketing-route safe: no wagmi / Privy hooks. The logo texture is loaded as a
 * same-origin image from `/api/token/image`.
 */

const AKITA_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'

function tokenImageUrl(address: string, size = 512) {
  // `style=raw` returns the creator artwork without the premium card frame —
  // a cleaner source for the holographic projection.
  return `/api/token/image?address=${address}&size=${size}&style=raw`
}

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

function useImageTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let active = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (t) => {
        if (!active) return
        t.colorSpace = THREE.SRGBColorSpace
        setTex(t)
      },
      undefined,
      () => {
        if (active) setTex(null)
      },
    )
    return () => {
      active = false
    }
  }, [url])
  return tex
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
        const cluster = Math.pow(Math.max(0, lobes), 3)
        const n = Math.pow(Math.max(0, fbm(x * 0.9 + 11, z * 0.9 + 7)), 1.6)
        const h = env * (0.06 + 0.94 * cluster) * n * 2.6
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
          uColor: { value: new THREE.Color('#ff7d1f') },
          uLow: { value: 0.05 },
          uHigh: { value: 0.85 },
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
            gl_FragColor = vec4(uColor * (0.45 + 0.8 * a), a);
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
      <torusGeometry args={[4.65, 0.022, 8, 160]} />
      <meshBasicMaterial color="#eaf4ff" toneMapped={false} />
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
        <torusGeometry args={[1.05, 0.018, 6, 96]} />
        <meshBasicMaterial color="#dfeeff" toneMapped={false} />
      </mesh>
      {teeth.map((t, i) => (
        <mesh key={i} position={[t.x, 0, t.z]} rotation={[0, t.ry, 0]}>
          <boxGeometry args={[0.05, 0.02, 0.17]} />
          <meshBasicMaterial color="#cfe6ff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const HOLO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const HOLO_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    // Soft-feathered panel mask: fade all four edges so the projection reads
    // as a floating hologram, not a hard rectangle.
    float ex = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
    float ey = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float mask = ex * ey;
    if (mask < 0.01) discard;
    // monochrome hologram from photo luminance, with a glow floor
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float tone = 0.28 + 1.05 * pow(lum, 0.92);
    float scan = 0.5 + 0.5 * sin(vUv.y * 150.0 - uTime * 5.0);
    float barPos = fract(uTime * 0.13);
    float bar = smoothstep(0.05, 0.0, abs(vUv.y - barPos));
    float flicker = 0.88 + 0.12 * sin(uTime * 26.0);
    float intensity = (tone * (0.72 + 0.28 * scan) * flicker + bar * 0.32) * mask;
    vec3 col = uColor * intensity;
    float a = clamp(intensity, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`

function HoloLogo({ texture }: { texture: THREE.Texture }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#62e0ff') },
      uOpacity: { value: 1.85 },
    }),
    [texture],
  )
  useFrame((state) => {
    const u = matRef.current?.uniforms.uTime
    if (u) u.value = state.clock.elapsedTime
  })
  return (
    <Billboard position={[0, 1.7, 0]}>
      <mesh>
        <planeGeometry args={[2.5, 2.5]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={HOLO_VERT}
          fragmentShader={HOLO_FRAG}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}

function HoloTower({ texture }: { texture: THREE.Texture | null }) {
  const cage = useRef<THREE.Group>(null)
  const root = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (cage.current) cage.current.rotation.y = t * 0.5
    if (root.current) root.current.position.y = Math.sin(t * 1.4) * 0.05
  })
  return (
    <group ref={root}>
      <ProjectorPad />
      {/* projection beam */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.06, 0.85, 3.6, 36, 1, true]} />
        <meshBasicMaterial
          color="#39b9ff"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* rotating wireframe data tower */}
      <group ref={cage}>
        <mesh position={[0, 1.85, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 3.5, 6, 8, true]} />
          <meshBasicMaterial
            color="#3aa0ff"
            wireframe
            transparent
            opacity={0.11}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* the AKITA hologram itself (when texture is ready) */}
      {texture ? (
        <HoloLogo texture={texture} />
      ) : (
        <Billboard position={[0, 1.85, 0]}>
          <mesh>
            <planeGeometry args={[1.4, 1.4]} />
            <meshBasicMaterial
              color="#62e0ff"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      )}
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
  tokenUrl,
}: {
  scanTick: number
  pointerRef: React.RefObject<{ x: number; y: number }>
  tokenUrl: string
}) {
  const texture = useImageTexture(tokenUrl)
  return (
    <>
      <color attach="background" args={['#02040a']} />
      <fog attach="fog" args={['#02040a', 18, 44]} />
      <ambientLight intensity={0.4} />

      <Grid
        position={[0, 0, 0]}
        infiniteGrid
        followCamera={false}
        cellSize={0.55}
        cellThickness={0.5}
        cellColor="#143158"
        sectionSize={2.75}
        sectionThickness={1}
        sectionColor="#2f6bff"
        fadeDistance={52}
        fadeStrength={2}
      />

      <TerrainRing />
      <PerimeterRing />
      <HoloTower texture={texture} />
      <ScanRing scanTick={scanTick} />

      <Rig pointerRef={pointerRef} />

      <EffectComposer>
        <Bloom intensity={1.05} luminanceThreshold={0.18} luminanceSmoothing={0.22} mipmapBlur />
        <Vignette offset={0.22} darkness={0.86} />
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
  const tokenUrl = useMemo(() => tokenImageUrl(token), [token])

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
        <Scene scanTick={scanTick} pointerRef={pointerRef} tokenUrl={tokenUrl} />
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
