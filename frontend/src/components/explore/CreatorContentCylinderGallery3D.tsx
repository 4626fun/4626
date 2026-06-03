import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import type { ZoraCoin } from '@/lib/zora/types'
import { toDisplayAssetUrl } from '@/features/explore/exploreShared'
import { cn } from '@/lib/shared/utils'

/**
 * Cylindrical / helix content gallery inspired by showcase-images.vercel.app.
 * Content-coin images are mapped onto a rotating cylinder and driven by a
 * momentum scroll + auto-rotate, with a holographic shader (chromatic
 * aberration, scan lines, flicker, depth fade, edge brackets).
 *
 * Interaction is scoped to the canvas so it never hijacks page scroll.
 */

type GalleryItem = {
  coin: ZoraCoin
  imageUrl: string
  title: string
  symbol: string
}

type CreatorContentCylinderGallery3DProps = {
  coins: ZoraCoin[]
  getImage: (coin: ZoraCoin) => string | undefined
  onSelect: (coin: ZoraCoin) => void
  /** Fires when the front-most plane changes (e.g. to highlight a sidebar list). */
  onActiveCoinChange?: (coin: ZoraCoin) => void
  /** When true, fills the parent (absolute inset-0) instead of a fixed rounded panel. */
  fill?: boolean
  /**
   * Accumulated external scroll delta (e.g. from a pinned page section). The gallery
   * consumes and zeroes this each frame, orbiting exactly like a wheel event. When set,
   * the canvas's own wheel handling is disabled so page-scroll is the single driver.
   */
  externalScrollRef?: React.MutableRefObject<number>
  className?: string
}

// --- Layout / motion tuning (embedded panel, not fullscreen) ---
const MAX_ITEMS = 24
const RADIUS = 4.2
const PLANE_WIDTH = 2.6
const PLANE_HEIGHT = 1.7
const PLANE_SEGMENTS_X = 32
const PLANE_SEGMENTS_Y = 16
const IMAGES_PER_TURN = 6
const SPIRAL_STEP = 0.62
const IMAGE_SCALE = 1.0
const CURVATURE = 1.5
const CAMERA_FOV = 40
const CAMERA_Z = RADIUS + 2.4

const SCROLL_ADVANCE_SPEED = 0.16
const SCROLL_ROTATE_FORCE = 1.6
const AUTO_ROTATE_SPEED = 0.0016
const MAX_ROTATION_SPEED = 0.14
const ROTATION_SMOOTHING = 0.09
const FRICTION = 0.9
const SQUEEZE_MAX = 0.42
const SQUEEZE_WIDTH = 7.5

const vertexShader = /* glsl */ `
  uniform float uRadius;
  uniform float uScrollOffset;
  uniform float uTotalHeight;
  uniform float uScale;
  uniform float uCurvature;
  uniform float uRotation;
  uniform float uAngleOffset;
  uniform float uPositionY;
  uniform float uSqueezeAmount;
  uniform float uSqueezeWidth;

  varying vec2 vUv;
  varying float vDepthFade;
  varying float vWorldY;

  void main() {
    vUv = uv;

    vec3 scaled = position * uScale;

    float scrolledY = uPositionY + uScrollOffset;
    scrolledY = mod(scrolledY + uTotalHeight * 0.5, uTotalHeight) - uTotalHeight * 0.5;

    float y = scrolledY + scaled.y;

    float squeezeGauss = exp(-(y * y) / (uSqueezeWidth * uSqueezeWidth));
    float squeezedRadius = uRadius * (1.0 - uSqueezeAmount * squeezeGauss);

    float angle = uAngleOffset + uRotation;
    float theta = scaled.x / (squeezedRadius * uCurvature);
    float finalAngle = angle + theta;

    float x = sin(finalAngle) * squeezedRadius;
    float z = cos(finalAngle) * squeezedRadius;

    vDepthFade = smoothstep(-squeezedRadius, squeezedRadius * 0.5, z);
    vWorldY = y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, z, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uChromaticAberration;
  uniform float uOpacity;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uEmission;
  uniform float uScanLines;
  uniform float uScanLineSpeed;
  uniform float uScanLineDensity;
  uniform float uDistanceFadeStart;
  uniform float uDistanceFadeEnd;
  uniform float uFlickerIntensity;
  uniform float uFlickerSpeed;
  uniform float uBorderWidth;
  uniform vec3 uBorderColor;
  uniform float uBorderEmission;
  uniform float uBorderRadius;
  uniform float uCornerSize;
  uniform float uCornerWidth;
  uniform float uCornerOffset;

  varying vec2 vUv;
  varying float vDepthFade;
  varying float vWorldY;

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  float cornerMask(vec2 uv, float cornerLen, float lineW, float offset) {
    float mask = 0.0;
    float o = offset;
    if (uv.x >= o && uv.x < o + cornerLen && uv.y >= o && uv.y < o + lineW) mask = 1.0;
    if (uv.x >= o && uv.x < o + lineW && uv.y >= o && uv.y < o + cornerLen) mask = 1.0;
    if (uv.x > 1.0 - o - cornerLen && uv.x <= 1.0 - o && uv.y >= o && uv.y < o + lineW) mask = 1.0;
    if (uv.x > 1.0 - o - lineW && uv.x <= 1.0 - o && uv.y >= o && uv.y < o + cornerLen) mask = 1.0;
    if (uv.x >= o && uv.x < o + cornerLen && uv.y > 1.0 - o - lineW && uv.y <= 1.0 - o) mask = 1.0;
    if (uv.x >= o && uv.x < o + lineW && uv.y > 1.0 - o - cornerLen && uv.y <= 1.0 - o) mask = 1.0;
    if (uv.x > 1.0 - o - cornerLen && uv.x <= 1.0 - o && uv.y > 1.0 - o - lineW && uv.y <= 1.0 - o) mask = 1.0;
    if (uv.x > 1.0 - o - lineW && uv.x <= 1.0 - o && uv.y > 1.0 - o - cornerLen && uv.y <= 1.0 - o) mask = 1.0;
    return mask;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    vec2 halfSize = vec2(0.5);
    float aa = 0.005;

    float imgDist = sdRoundedBox(centered, halfSize, uBorderRadius);
    float imageMask = 1.0 - smoothstep(-aa, aa, imgDist);

    float borderDist = sdRoundedBox(centered, halfSize, uBorderRadius);
    float outerEdge = 1.0 - smoothstep(-aa, aa, borderDist);
    float innerEdge = 1.0 - smoothstep(-aa, aa, borderDist + uBorderWidth);
    float borderMask = clamp(outerEdge - innerEdge, 0.0, 1.0);

    float caStrength = uChromaticAberration * (0.3 + 0.7 * (1.0 - vDepthFade));
    vec2 caOffset = vec2(caStrength, 0.0);
    float r = texture2D(uMap, vUv + caOffset).r;
    float g = texture2D(uMap, vUv).g;
    float b = texture2D(uMap, vUv - caOffset).b;
    vec3 color = vec3(r, g, b);

    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, uSaturation);
    color *= uBrightness;

    if (uScanLines > 0.0) {
      float scanLine = sin((vWorldY * uScanLineDensity + uTime * uScanLineSpeed) * 3.14159) * 0.5 + 0.5;
      color *= 1.0 - uScanLines * (1.0 - scanLine) * 0.3;
    }

    float darkening = smoothstep(0.0, 0.5, vDepthFade);
    color *= mix(0.15, 1.0, darkening);
    color += color * uEmission;

    vec3 borderGlow = uBorderColor * (1.0 + uBorderEmission);
    color = mix(color, borderGlow, borderMask);
    float corners = cornerMask(vUv, uCornerSize, uCornerWidth, uCornerOffset);
    color = mix(color, borderGlow, corners);

    float distFade = 1.0 - smoothstep(uDistanceFadeStart, uDistanceFadeEnd, abs(vWorldY));

    float flicker = 1.0;
    if (uFlickerIntensity > 0.0) {
      float t = uTime * uFlickerSpeed;
      float f1 = sin(t * 13.0) * 0.5 + 0.5;
      float f2 = sin(t * 37.0 + 1.7) * 0.5 + 0.5;
      float f3 = sin(t * 59.0 + 4.1) * 0.5 + 0.5;
      float combined = f1 * f2 + f3 * 0.3;
      float glitchSeed = fract(sin(floor(t * 8.0)) * 43758.5453);
      float glitch = step(0.92, glitchSeed);
      combined = mix(combined, 0.1, glitch);
      flicker = 1.0 - uFlickerIntensity * (1.0 - clamp(combined, 0.3, 1.0));
    }

    float finalAlpha = max(imageMask, max(borderMask, corners));
    gl_FragColor = vec4(color * flicker, finalAlpha * uOpacity * distFade);
  }
`

function toWebglSafeImageUrl(raw: string): string {
  if (typeof window === 'undefined') return raw
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin === window.location.origin) return parsed.toString()
    return `/api/image/external?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return raw
  }
}

function normalizeGalleryItems(
  coins: ZoraCoin[],
  getImage: (coin: ZoraCoin) => string | undefined,
): GalleryItem[] {
  return coins
    .map((coin) => {
      const rawImage = getImage(coin) || coin.mediaContent?.previewImage?.medium || coin.mediaContent?.previewImage?.small
      const imageUrl = toDisplayAssetUrl(rawImage)
      if (!imageUrl) return null
      return {
        coin,
        imageUrl: toWebglSafeImageUrl(imageUrl),
        title: coin.name || coin.symbol || 'Untitled',
        symbol: coin.symbol || '???',
      }
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS) as GalleryItem[]
}

function createFallbackTexture(label: string): THREE.Texture {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 340
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 512, 340)
      gradient.addColorStop(0, '#0a1117')
      gradient.addColorStop(1, '#111827')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 512, 340)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.strokeRect(12, 12, 488, 316)
      ctx.fillStyle = 'rgba(226,232,240,0.9)'
      ctx.font = '600 26px Inter, system-ui, sans-serif'
      ctx.fillText(label.slice(0, 24), 26, 178)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }
  const data = new Uint8Array([15, 23, 42, 255])
  const texture = new THREE.DataTexture(data, 1, 1)
  texture.needsUpdate = true
  return texture
}

async function loadTextureSafe(url: string, fallbackLabel: string): Promise<THREE.Texture> {
  return await new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        resolve(texture)
      },
      undefined,
      () => resolve(createFallbackTexture(fallbackLabel)),
    )
  })
}

function useGalleryTextures(items: GalleryItem[]): THREE.Texture[] {
  const [textures, setTextures] = useState<THREE.Texture[]>([])
  const key = items.map((item) => `${item.imageUrl}|${item.title}`).join('::')

  useEffect(() => {
    let cancelled = false
    let loaded: THREE.Texture[] = []
    void Promise.all(items.map((item) => loadTextureSafe(item.imageUrl, item.title))).then((next) => {
      if (cancelled) {
        next.forEach((texture) => texture.dispose())
        return
      }
      loaded = next
      setTextures(next)
    })
    return () => {
      cancelled = true
      loaded.forEach((texture) => texture.dispose())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return textures
}

type ScrollState = {
  offset: number
  velocity: number
  pendingDelta: number
  dragging: boolean
  lastPointerX: number
  lastDirection: number
}

/**
 * Builds the shared shader uniforms object. Dynamic values (uTotalHeight, uScanLines,
 * uFlickerIntensity) start neutral and are set from useFrame / the reduced-motion effect.
 * Defined at module scope so the inferred return type stays precise and the value is stable.
 */
function createSharedUniforms() {
  return {
    uRadius: { value: RADIUS },
    uScrollOffset: { value: 0 },
    uTotalHeight: { value: 0 },
    uScale: { value: IMAGE_SCALE },
    uCurvature: { value: CURVATURE },
    uRotation: { value: 0 },
    uSqueezeAmount: { value: 0 },
    uSqueezeWidth: { value: SQUEEZE_WIDTH },
    uTime: { value: 0 },
    uChromaticAberration: { value: 0.015 },
    uOpacity: { value: 1 },
    uSaturation: { value: 1.25 },
    uBrightness: { value: 1.1 },
    uEmission: { value: 0.5 },
    uScanLines: { value: 0 },
    uScanLineSpeed: { value: 3.5 },
    uScanLineDensity: { value: 22 },
    uDistanceFadeStart: { value: 2.6 },
    uDistanceFadeEnd: { value: 6.5 },
    uFlickerIntensity: { value: 0 },
    uFlickerSpeed: { value: 4.5 },
    uBorderWidth: { value: 0.006 },
    uBorderColor: { value: new THREE.Color('#dbeafe') },
    uBorderEmission: { value: 0.6 },
    uBorderRadius: { value: 0.02 },
    uCornerSize: { value: 0.06 },
    uCornerWidth: { value: 0.006 },
    uCornerOffset: { value: 0.03 },
  }
}

function CylinderMeshes({
  items,
  textures,
  scrollRef,
  externalScrollRef,
  onSelect,
  onActiveCoinChange,
  reducedMotion,
}: {
  items: GalleryItem[]
  textures: THREE.Texture[]
  scrollRef: React.MutableRefObject<ScrollState>
  externalScrollRef?: React.MutableRefObject<number>
  onSelect: (coin: ZoraCoin) => void
  onActiveCoinChange?: (coin: ZoraCoin) => void
  reducedMotion: boolean
}) {
  const rotation = useRef(0)
  const rotationSpeed = useRef(0.001)
  const smoothSqueeze = useRef(0)
  const activeIndexRef = useRef<number | null>(null)

  const totalHeight = items.length * SPIRAL_STEP

  // One shared uniforms object, held in a stable ref so the per-frame mutation in useFrame
  // is allowed by the react-hooks immutability rule; per-mesh uniforms add uMap/uAngleOffset.
  const sharedRef = useRef<ReturnType<typeof createSharedUniforms> | null>(null)
  const shared = (sharedRef.current ??= createSharedUniforms())

  // Keep motion-sensitive uniforms in sync with the reduced-motion preference. Reads the ref
  // (not the `shared` alias) so the assignment expression above is not a hook dependency.
  useEffect(() => {
    const u = sharedRef.current
    if (!u) return
    u.uScanLines.value = reducedMotion ? 0 : 0.5
    u.uFlickerIntensity.value = reducedMotion ? 0 : 0.12
  }, [reducedMotion])

  const layout = useMemo(() => {
    const startY = -(totalHeight / 2)
    return items.map((_, i) => ({
      angleOffset: i * ((Math.PI * 2) / IMAGES_PER_TURN),
      positionY: startY + i * SPIRAL_STEP,
    }))
  }, [items, totalHeight])

  const materials = useMemo(
    () =>
      items.map(
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
              ...(sharedRef.current ?? {}),
              uMap: { value: null as THREE.Texture | null },
              uAngleOffset: { value: layout[i]?.angleOffset ?? 0 },
              uPositionY: { value: layout[i]?.positionY ?? 0 },
            },
          }),
      ),
    [items, layout],
  )

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose())
    }
  }, [materials])

  useEffect(() => {
    materials.forEach((material, i) => {
      const uMap = material.uniforms.uMap
      if (uMap) uMap.value = textures[i] ?? null
    })
  }, [materials, textures])

  useFrame((state, delta) => {
    const scroll = scrollRef.current

    // Consume any externally-driven scroll (pinned page section) as if it were a wheel.
    if (externalScrollRef && externalScrollRef.current !== 0) {
      scroll.pendingDelta += externalScrollRef.current
      externalScrollRef.current = 0
    }

    scroll.velocity += scroll.pendingDelta
    scroll.pendingDelta = 0
    scroll.velocity *= FRICTION
    if (Math.abs(scroll.velocity) < 0.0001) scroll.velocity = 0
    scroll.offset += scroll.velocity

    const vel = scroll.velocity
    if (Math.abs(vel) > 0.001) scroll.lastDirection = vel > 0 ? 1 : -1

    const idleSpeed = reducedMotion ? 0 : AUTO_ROTATE_SPEED * scroll.lastDirection
    const targetSpeed = THREE.MathUtils.clamp(
      idleSpeed + vel * SCROLL_ROTATE_FORCE,
      -MAX_ROTATION_SPEED,
      MAX_ROTATION_SPEED,
    )
    rotationSpeed.current += (targetSpeed - rotationSpeed.current) * ROTATION_SMOOTHING
    rotation.current += rotationSpeed.current * delta * 60

    const targetSqueeze = Math.min(Math.abs(vel) * 3, 1) * SQUEEZE_MAX
    smoothSqueeze.current += (targetSqueeze - smoothSqueeze.current) * 0.08

    shared.uTime.value = state.clock.elapsedTime
    shared.uRotation.value = rotation.current
    shared.uScrollOffset.value = scroll.offset * SCROLL_ADVANCE_SPEED
    shared.uSqueezeAmount.value = smoothSqueeze.current
    shared.uTotalHeight.value = totalHeight

    // Resolve the front-most plane (closest to camera + near center height).
    if (onActiveCoinChange && items.length > 0) {
      const scrollY = scroll.offset * SCROLL_ADVANCE_SPEED
      let best = -1
      let bestScore = -Infinity
      for (let i = 0; i < items.length; i += 1) {
        const angle = (layout[i]?.angleOffset ?? 0) + rotation.current
        let scrolledY = (layout[i]?.positionY ?? 0) + scrollY
        scrolledY = ((scrolledY + totalHeight * 0.5) % totalHeight + totalHeight) % totalHeight - totalHeight * 0.5
        const score = Math.cos(angle) - 0.18 * Math.abs(scrolledY)
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      }
      if (best >= 0 && best !== activeIndexRef.current) {
        activeIndexRef.current = best
        const coin = items[best]?.coin
        if (coin) onActiveCoinChange(coin)
      }
    }

    // Subtle mouse parallax — camera drifts toward the pointer, keeps cylinder framed.
    const targetX = state.pointer.x * 0.8
    const targetY = state.pointer.y * 0.5
    state.camera.position.x += (targetX - state.camera.position.x) * 0.05
    state.camera.position.y += (targetY - state.camera.position.y) * 0.05
    state.camera.position.z = CAMERA_Z
    state.camera.lookAt(0, 0, 0)
  })

  return (
    <group>
      {items.map((item, i) => (
        <mesh
          key={item.coin.address || `${item.title}-${i}`}
          material={materials[i]}
          frustumCulled={false}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(item.coin)
            scrollRef.current.velocity = 0
          }}
        >
          <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT, PLANE_SEGMENTS_X, PLANE_SEGMENTS_Y]} />
        </mesh>
      ))}
    </group>
  )
}

export function CreatorContentCylinderGallery3D({
  coins,
  getImage,
  onSelect,
  onActiveCoinChange,
  fill = false,
  externalScrollRef,
  className,
}: CreatorContentCylinderGallery3DProps) {
  const externalDriven = Boolean(externalScrollRef)
  const items = useMemo(() => normalizeGalleryItems(coins, getImage), [coins, getImage])
  const textures = useGalleryTextures(items)
  const scrollRef = useRef<ScrollState>({
    offset: 0,
    velocity: 0,
    pendingDelta: 0,
    dragging: false,
    lastPointerX: 0,
    lastDirection: 1,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [touchLikeInput, setTouchLikeInput] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const coarse = window.matchMedia('(pointer: coarse)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setTouchLikeInput(coarse.matches)
      setReducedMotion(motion.matches)
    }
    sync()
    coarse.addEventListener('change', sync)
    motion.addEventListener('change', sync)
    return () => {
      coarse.removeEventListener('change', sync)
      motion.removeEventListener('change', sync)
    }
  }, [])

  // Seed the active coin immediately so dependent UI (e.g. a sidebar) highlights on mount.
  useEffect(() => {
    if (onActiveCoinChange && items.length > 0) onActiveCoinChange(items[0]!.coin)
  }, [items, onActiveCoinChange])

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-xs font-mono uppercase tracking-[1.8px] text-zinc-500',
          fill
            ? 'absolute inset-0 h-full w-full bg-transparent'
            : 'h-[420px] w-full rounded-3xl border border-white/10 bg-[#070b10]',
          className,
        )}
      >
        No content coins available for showcase yet.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        fill
          ? 'absolute inset-0 h-full w-full bg-transparent'
          : 'h-[440px] sm:h-[520px] lg:h-[600px] w-full rounded-3xl border border-white/10 bg-[#070b10] shadow-[0_30px_80px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      {/* soft radial glow backdrop (panel mode only — hero supplies its own) */}
      {fill ? null : (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 40%, rgba(56,132,255,0.16) 0%, rgba(7,11,16,0) 60%)',
          }}
          aria-hidden
        />
      )}
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
        dpr={[1, 1.8]}
        className="r3f-force-fill absolute inset-0 h-full w-full"
        style={{ display: 'block', touchAction: 'pan-y' }}
        onWheel={(event) => {
          event.stopPropagation()
          // In pinned mode the page-scroll driver is authoritative; avoid double-feeding.
          if (externalDriven) return
          scrollRef.current.pendingDelta += event.deltaY * 0.01
        }}
        onPointerDown={(event) => {
          scrollRef.current.dragging = true
          scrollRef.current.lastPointerX = event.clientX
          setIsDragging(true)
        }}
        onPointerMove={(event) => {
          if (!scrollRef.current.dragging) return
          const delta = event.clientX - scrollRef.current.lastPointerX
          scrollRef.current.lastPointerX = event.clientX
          scrollRef.current.pendingDelta -= delta * 0.01
        }}
        onPointerUp={() => {
          scrollRef.current.dragging = false
          setIsDragging(false)
        }}
        onPointerCancel={() => {
          scrollRef.current.dragging = false
          setIsDragging(false)
        }}
        onPointerLeave={() => {
          scrollRef.current.dragging = false
          setIsDragging(false)
        }}
      >
        <ambientLight intensity={0.6} />
        <CylinderMeshes
          items={items}
          textures={textures}
          scrollRef={scrollRef}
          externalScrollRef={externalScrollRef}
          onSelect={onSelect}
          onActiveCoinChange={onActiveCoinChange}
          reducedMotion={reducedMotion}
        />
      </Canvas>

      {fill ? null : (
        <div className="pointer-events-none absolute left-4 bottom-4 text-[10px] font-mono uppercase tracking-[1.8px] text-zinc-300/80">
          {isDragging ? 'Release to glide' : touchLikeInput ? 'Swipe / drag to orbit' : 'Drag or scroll to orbit · click to open'}
        </div>
      )}
    </div>
  )
}
