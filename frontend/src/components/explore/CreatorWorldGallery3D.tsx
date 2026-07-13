import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import type { CreatorWorldItem } from '@/features/explore/creatorWorld'
import { cn } from '@/lib/shared/utils'

const GLOBE_RADIUS = 7
const CARD_WIDTH = 2.65
const CARD_HEIGHT = 3.25
const CAMERA_Z_DESKTOP = 19
const CAMERA_Z_MOBILE = 24
const MIN_CAMERA_Z = 13
const MAX_CAMERA_Z = 28
const DRAG_SPEED = 0.004
const FRICTION = 0.92
const IDLE_ROTATION_FORCE = 0.00012
const IDLE_DELAY_MS = 2_000

type RotationState = {
  x: number
  y: number
}

type WorldMotionState = {
  rotation: RotationState
  velocity: RotationState
  dragging: boolean
  lastInteraction: number
}

type WorldCardData = {
  item: CreatorWorldItem
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: number
}

type CreatorWorldGallery3DProps = {
  items: CreatorWorldItem[]
  className?: string
}

function supportsWebGl(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (!window.WebGLRenderingContext) return false

  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    const loseContext = context?.getExtension('WEBGL_lose_context')
    loseContext?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}

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

function stableScale(address: string): number {
  let hash = 0
  for (let index = 0; index < address.length; index += 1) {
    hash = (hash * 31 + address.charCodeAt(index)) >>> 0
  }
  return 0.74 + (hash % 38) / 100
}

function buildCardData(items: CreatorWorldItem[]): WorldCardData[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return items.map((item, index) => {
    const y = 1 - (index / Math.max(items.length - 1, 1)) * 2
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * index
    const position = new THREE.Vector3(
      Math.cos(theta) * radial * GLOBE_RADIUS,
      y * GLOBE_RADIUS,
      Math.sin(theta) * radial * GLOBE_RADIUS,
    )
    const object = new THREE.Object3D()
    object.position.copy(position)
    object.lookAt(position.clone().multiplyScalar(2))

    return {
      item,
      position,
      quaternion: object.quaternion.clone(),
      scale: stableScale(item.address),
    }
  })
}

function createCurvedCardGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 16, 16)
  const positions = geometry.getAttribute('position')

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const theta = x / GLOBE_RADIUS
    const phi = y / GLOBE_RADIUS

    positions.setXYZ(
      index,
      GLOBE_RADIUS * Math.sin(theta) * Math.cos(phi),
      GLOBE_RADIUS * Math.sin(phi),
      GLOBE_RADIUS * Math.cos(theta) * Math.cos(phi) - GLOBE_RADIUS,
    )
  }

  geometry.computeVertexNormals()
  return geometry
}

function createFallbackTexture(item: CreatorWorldItem): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 640
  const context = canvas.getContext('2d')

  if (context) {
    const gradient = context.createLinearGradient(0, 0, 512, 640)
    gradient.addColorStop(0, '#172554')
    gradient.addColorStop(0.55, '#111827')
    gradient.addColorStop(1, '#09090b')
    context.fillStyle = gradient
    context.fillRect(0, 0, 512, 640)
    context.strokeStyle = 'rgba(255,255,255,0.18)'
    context.lineWidth = 3
    context.strokeRect(18, 18, 476, 604)
    context.fillStyle = 'rgba(255,255,255,0.92)'
    context.font = '600 52px Inter, system-ui, sans-serif'
    context.fillText((item.symbol || item.name).slice(0, 9).toUpperCase(), 38, 536)
    context.fillStyle = 'rgba(255,255,255,0.55)'
    context.font = '500 24px Inter, system-ui, sans-serif'
    context.fillText('CREATOR', 40, 579)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function useWorldTextures(items: CreatorWorldItem[]): Array<THREE.Texture | undefined> {
  const [textures, setTextures] = useState<Array<THREE.Texture | undefined>>([])
  const textureKey = items.map((item) => `${item.address}:${item.imageUrl ?? ''}`).join('|')

  useEffect(() => {
    let cancelled = false
    const loadedTextures = new Set<THREE.Texture>()
    const fallbackTextures = items.map((item) => createFallbackTexture(item))
    fallbackTextures.forEach((texture) => loadedTextures.add(texture))
    setTextures(fallbackTextures)

    items.forEach((item, index) => {
      if (!item.imageUrl) return
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
      loader.load(
        toWebglSafeImageUrl(item.imageUrl),
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          loadedTextures.add(texture)
          if (cancelled) {
            texture.dispose()
            return
          }
          setTextures((current) => {
            const next = [...current]
            next[index] = texture
            return next
          })
        },
        undefined,
        () => undefined,
      )
    })

    return () => {
      cancelled = true
      loadedTextures.forEach((texture) => texture.dispose())
    }
    // The stable key intentionally owns the texture lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureKey])

  return textures
}

function CameraController({
  targetZ,
}: {
  targetZ: React.MutableRefObject<number>
}) {
  useFrame((state) => {
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ.current, 0.08)
  })
  return null
}

function CreatorWorldScene({
  items,
  motionRef,
  reducedMotion,
  onActiveItemChange,
}: {
  items: CreatorWorldItem[]
  motionRef: React.MutableRefObject<WorldMotionState>
  reducedMotion: boolean
  onActiveItemChange: (item: CreatorWorldItem) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const geometry = useMemo(() => createCurvedCardGeometry(), [])
  const cards = useMemo(() => buildCardData(items), [items])
  const textures = useWorldTextures(items)

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const motion = motionRef.current

    motion.rotation.x += motion.velocity.x
    motion.rotation.y += motion.velocity.y
    motion.rotation.x = THREE.MathUtils.clamp(
      motion.rotation.x,
      -Math.PI / 2.5,
      Math.PI / 2.5,
    )

    if (!motion.dragging) {
      motion.velocity.x *= FRICTION
      motion.velocity.y *= FRICTION
      if (!reducedMotion && Date.now() - motion.lastInteraction > IDLE_DELAY_MS) {
        motion.velocity.y += IDLE_ROTATION_FORCE
      }
    } else {
      motion.velocity.x *= 0.3
      motion.velocity.y *= 0.3
    }

    group.rotation.x = motion.rotation.x
    group.rotation.y = motion.rotation.y
  })

  return (
    <group ref={groupRef}>
      {cards.map((card, index) => {
        const texture = textures[index]
        return (
          <mesh
            key={card.item.address}
            position={card.position}
            quaternion={card.quaternion}
            scale={card.scale}
            geometry={geometry}
            onClick={(event) => {
              event.stopPropagation()
              if (!motionRef.current.dragging) onActiveItemChange(card.item)
            }}
            onPointerOver={(event) => {
              event.stopPropagation()
              onActiveItemChange(card.item)
            }}
          >
            <meshBasicMaterial
              map={texture ?? null}
              color={texture ? '#ffffff' : '#172033'}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function CreatorWorldFallback({ items }: { items: CreatorWorldItem[] }) {
  return (
    <div className="grid h-full grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.address}
          to={item.detailPath}
          className="group relative min-h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/75 to-transparent p-3 pt-10">
            <p className="truncate text-sm font-medium text-white">{item.name}</p>
            {item.symbol ? <p className="text-xs text-zinc-400">${item.symbol}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  )
}

export function CreatorWorldGallery3D({ items, className }: CreatorWorldGallery3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPointer = useRef({ x: 0, y: 0 })
  const targetZ = useRef(CAMERA_Z_DESKTOP)
  const motionRef = useRef<WorldMotionState>({
    rotation: { x: 0, y: 0 },
    velocity: { x: 0, y: 0.002 },
    dragging: false,
    lastInteraction: 0,
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreferences = () => {
      targetZ.current = mobile.matches ? CAMERA_Z_MOBILE : CAMERA_Z_DESKTOP
      setReducedMotion(motionPreference.matches)
    }
    const initialFrame = window.requestAnimationFrame(() => {
      motionRef.current.lastInteraction = Date.now() - IDLE_DELAY_MS
      syncPreferences()
      setWebGlAvailable(supportsWebGl())
    })
    mobile.addEventListener('change', syncPreferences)
    motionPreference.addEventListener('change', syncPreferences)
    return () => {
      window.cancelAnimationFrame(initialFrame)
      mobile.removeEventListener('change', syncPreferences)
      motionPreference.removeEventListener('change', syncPreferences)
    }
  }, [])

  const safeActiveIndex = Math.min(activeIndex, Math.max(items.length - 1, 0))
  const activeItem = items[safeActiveIndex]
  const setActiveItem = (item: CreatorWorldItem) => {
    const nextIndex = items.findIndex((candidate) => candidate.address === item.address)
    if (nextIndex >= 0) setActiveIndex(nextIndex)
  }
  const moveActiveItem = (direction: -1 | 1) => {
    if (items.length === 0) return
    setActiveIndex((current) => (current + direction + items.length) % items.length)
    motionRef.current.lastInteraction = Date.now()
  }
  const releasePointer = () => {
    motionRef.current.dragging = false
    setIsDragging(false)
    motionRef.current.lastInteraction = Date.now()
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-3xl border border-white/10 bg-[#070b10] text-sm text-zinc-400">
        No creators with displayable addresses are available yet.
      </div>
    )
  }

  return (
    <section
      className={cn(
        'relative h-[min(72vh,760px)] min-h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-[#05070b] shadow-[0_30px_100px_rgba(0,0,0,0.5)]',
        className,
      )}
      aria-label="Creator World"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(77,122,255,0.19), rgba(5,7,11,0) 48%), radial-gradient(circle at 12% 90%, rgba(133,74,255,0.13), rgba(5,7,11,0) 36%)',
        }}
        aria-hidden
      />

      {webGlAvailable === false ? (
        <CreatorWorldFallback items={items} />
      ) : webGlAvailable === true ? (
        <div
          ref={containerRef}
          className={cn('absolute inset-0', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
          style={{ touchAction: 'pan-y' }}
          onWheel={(event) => {
            event.preventDefault()
            targetZ.current = THREE.MathUtils.clamp(
              targetZ.current + event.deltaY * 0.012,
              MIN_CAMERA_Z,
              MAX_CAMERA_Z,
            )
            motionRef.current.lastInteraction = Date.now()
          }}
          onPointerDown={(event) => {
            motionRef.current.dragging = true
            setIsDragging(true)
            lastPointer.current = { x: event.clientX, y: event.clientY }
            motionRef.current.lastInteraction = Date.now()
            containerRef.current?.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!motionRef.current.dragging) return
            const deltaX = event.clientX - lastPointer.current.x
            const deltaY = event.clientY - lastPointer.current.y
            lastPointer.current = { x: event.clientX, y: event.clientY }
            motionRef.current.velocity.y += deltaX * DRAG_SPEED
            motionRef.current.velocity.x += deltaY * DRAG_SPEED
            motionRef.current.lastInteraction = Date.now()
          }}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onPointerLeave={releasePointer}
        >
          <Canvas
            camera={{ position: [0, 0, CAMERA_Z_DESKTOP], fov: 45, near: 0.1, far: 100 }}
            dpr={[1, 1.6]}
            className="r3f-force-fill absolute inset-0 h-full w-full"
          >
            <CameraController targetZ={targetZ} />
            <CreatorWorldScene
              items={items}
              motionRef={motionRef}
              reducedMotion={reducedMotion}
              onActiveItemChange={setActiveItem}
            />
          </Canvas>
        </div>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-white/[0.03]" aria-label="Loading Creator World" />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            Creator World
          </p>
          <p className="mt-1 max-w-xs text-xs text-zinc-500">
            Drag to orbit · scroll to zoom · choose a creator to explore
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur">
          {items.length} creators
        </div>
      </div>

      {activeItem ? (
        <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[340px]">
          <div className="rounded-2xl border border-white/12 bg-black/75 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{activeItem.name}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {activeItem.symbol ? `$${activeItem.symbol}` : 'Creator Coin'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveActiveItem(-1)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Previous creator"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveActiveItem(1)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Next creator"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <Link
              to={activeItem.detailPath}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Explore creator
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}
