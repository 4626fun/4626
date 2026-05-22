import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import type { ZoraCoin } from '@/lib/zora/types'
import { toDisplayAssetUrl } from '@/features/explore/exploreShared'

type GalleryItem = {
  coin: ZoraCoin
  imageUrl: string
  title: string
  subtitle: string
}

type InfiniteContentGallery3DProps = {
  coins: ZoraCoin[]
  onSelect: (coin: ZoraCoin) => void
  onActiveCoinChange?: (coin: ZoraCoin) => void
  className?: string
  interactive?: boolean
  cameraZ?: number
  cameraFov?: number
  planeScale?: number
  laneSpacing?: number
}

type ScrollState = {
  value: number
  velocity: number
  dragging: boolean
  dragStartX: number
  lastInteractionAt: number
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

function normalizeGalleryItems(coins: ZoraCoin[]): GalleryItem[] {
  return coins
    .map((coin) => {
      const imageUrl = toDisplayAssetUrl(
        coin.mediaContent?.previewImage?.medium ||
          coin.mediaContent?.previewImage?.small ||
          coin.mediaContent?.originalUri,
      )
      if (!imageUrl) return null
      return {
        coin,
        imageUrl: toWebglSafeImageUrl(imageUrl),
        title: coin.name || coin.symbol || 'Untitled',
        subtitle: coin.symbol || '???',
      }
    })
    .filter(Boolean) as GalleryItem[]
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
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.strokeRect(12, 12, 488, 316)
      ctx.fillStyle = 'rgba(226,232,240,0.9)'
      ctx.font = '600 24px Inter, system-ui, sans-serif'
      ctx.fillText(label.slice(0, 26), 26, 176)
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
      (texture: THREE.Texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        resolve(texture)
      },
      undefined,
      () => resolve(createFallbackTexture(fallbackLabel)),
    )
  })
}

function useGalleryTextures(items: GalleryItem[]): THREE.Texture[] {
  const [textures, setTextures] = useState<THREE.Texture[]>([])

  useEffect(() => {
    let cancelled = false
    const previous = textures
    void Promise.all(items.map((item) => loadTextureSafe(item.imageUrl, item.title))).then((nextTextures) => {
      if (cancelled) {
        nextTextures.forEach((texture: THREE.Texture) => texture.dispose())
        return
      }
      setTextures(nextTextures)
      previous.forEach((texture: THREE.Texture) => texture.dispose())
    })
    return () => {
      cancelled = true
    }
    // Intentionally keyed to item URLs/titles only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((item) => `${item.imageUrl}|${item.title}`).join('::')])

  return textures
}

function GalleryPlanes({
  items,
  scrollRef,
  onSelect,
  onActiveCoinChange,
  cameraZ,
  planeScale,
  laneSpacing,
}: {
  items: GalleryItem[]
  scrollRef: React.RefObject<ScrollState>
  onSelect: (coin: ZoraCoin) => void
  onActiveCoinChange?: (coin: ZoraCoin) => void
  cameraZ: number
  planeScale: number
  laneSpacing: number
}) {
  const textures = useGalleryTextures(items)
  const materialRef = useRef<Array<THREE.MeshStandardMaterial | null>>([])
  const meshRef = useRef<Array<THREE.Mesh | null>>([])
  const activeIndexRef = useRef<number | null>(null)
  const horizontalSpread = 2.15
  const verticalSpread = 1.12

  useFrame((state, delta) => {
    const scroll = scrollRef.current
    if (!scroll) return

    const idleForMs = performance.now() - scroll.lastInteractionAt
    if (!scroll.dragging && idleForMs > 2400) {
      scroll.velocity += 0.028 * delta
    }
    scroll.value += scroll.velocity
    scroll.velocity *= 0.93

    let nearestIndex = -1
    let nearestDepth = Number.POSITIVE_INFINITY
    for (let i = 0; i < items.length; i += 1) {
      const spacing = laneSpacing
      const loopDepth = items.length * spacing
      const baseZ = i * spacing
      // Reverse lane flow so cards travel toward the viewer by default.
      let z = baseZ + scroll.value * spacing
      z = ((z % loopDepth) + loopDepth) % loopDepth
      if (z > loopDepth * 0.5) z -= loopDepth
      const absZ = Math.abs(z)
      if (absZ < nearestDepth) {
        nearestDepth = absZ
        nearestIndex = i
      }

      const mesh = meshRef.current[i]
      if (mesh) {
        mesh.position.set(
          Math.sin(i * 1.73) * horizontalSpread,
          Math.cos(i * 1.27) * verticalSpread,
          z,
        )
      }

      const mat = materialRef.current[i]
      if (!mat) continue
      const depthT = Math.min(1, Math.abs(z) / (loopDepth * 0.5))
      mat.opacity = 0.62 + (1 - depthT) * 0.34
      mat.roughness = 0.42 + depthT * 0.25
      mat.emissiveIntensity = 0.1 + (1 - depthT) * 0.2
    }
    if (nearestIndex >= 0 && nearestIndex !== activeIndexRef.current) {
      activeIndexRef.current = nearestIndex
      onActiveCoinChange?.(items[nearestIndex]!.coin)
    }

    state.camera.position.z = cameraZ
  })

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight position={[0, 1.8, 3.4]} intensity={1.05} color="#cde7ff" />
      <directionalLight position={[-3.2, -1.1, -1.5]} intensity={0.35} color="#97f6ff" />
      {items.map((item, index) => {
        const x = Math.sin(index * 1.73) * horizontalSpread
        const y = Math.cos(index * 1.27) * verticalSpread
        const rotY = Math.sin(index * 1.19) * 0.22
        const rotX = Math.cos(index * 1.41) * 0.08

        return (
          <mesh
            key={item.coin.address || `${item.title}-${index}`}
            ref={(mesh) => {
              meshRef.current[index] = mesh
            }}
            position={[x, y, 0]}
            rotation={[rotX, rotY, 0]}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(item.coin)
              const scrollState = scrollRef.current
              if (scrollState) {
                scrollState.lastInteractionAt = performance.now()
              }
            }}
          >
            <planeGeometry args={[2.35 * planeScale, 1.58 * planeScale, 24, 24]} />
            <meshStandardMaterial
              ref={(mat) => {
                materialRef.current[index] = mat
              }}
              map={textures[index] ?? null}
              transparent
              opacity={1}
              metalness={0.08}
              roughness={0.55}
              emissive={new THREE.Color('#091216')}
              emissiveIntensity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function InfiniteContentGallery3D({
  coins,
  onSelect,
  onActiveCoinChange,
  className,
  interactive: interactiveProp,
  cameraZ: cameraZProp,
  cameraFov: cameraFovProp,
  planeScale: planeScaleProp,
  laneSpacing: laneSpacingProp,
}: InfiniteContentGallery3DProps) {
  const items = useMemo(() => normalizeGalleryItems(coins).slice(0, 8), [coins])
  const interactive = interactiveProp ?? true
  const cameraZ = cameraZProp ?? 5.8
  const cameraFov = cameraFovProp ?? 42
  const planeScale = planeScaleProp ?? 1
  const laneSpacing = laneSpacingProp ?? 3.2
  const scrollRef = useRef<ScrollState>({
    value: 0,
    velocity: 0,
    dragging: false,
    dragStartX: 0,
    lastInteractionAt: 0,
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    scrollRef.current.lastInteractionAt = performance.now()
  }, [])

  useEffect(() => {
    if (!onActiveCoinChange || items.length === 0) return
    onActiveCoinChange(items[0]!.coin)
  }, [items, onActiveCoinChange])

  if (items.length === 0) {
    return (
      <div className={`relative w-full h-full ${className ?? ''}`}>
        <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400 font-mono uppercase tracking-[1.6px]">
          No visual assets available
        </div>
      </div>
    )
  }

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, cameraZ], fov: cameraFov }}
        dpr={[1, 1.8]}
      tabIndex={interactive ? 0 : -1}
        className="r3f-force-fill absolute inset-0 h-full w-full"
        style={{ display: 'block' }}
        onWheel={interactive ? (event) => {
          event.preventDefault()
          event.stopPropagation()
          scrollRef.current.velocity += event.deltaY * 0.00065
          scrollRef.current.lastInteractionAt = performance.now()
        } : undefined}
        onKeyDown={interactive ? (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          const dir = event.key === 'ArrowLeft' ? -1 : 1
          scrollRef.current.velocity += dir * 0.1
          scrollRef.current.lastInteractionAt = performance.now()
        } : undefined}
        onPointerDown={interactive ? (event) => {
          scrollRef.current.dragging = true
          scrollRef.current.dragStartX = event.clientX
          scrollRef.current.lastInteractionAt = performance.now()
          setIsDragging(true)
        } : undefined}
        onPointerMove={interactive ? (event) => {
          if (!scrollRef.current.dragging) return
          const delta = event.clientX - scrollRef.current.dragStartX
          scrollRef.current.dragStartX = event.clientX
          scrollRef.current.velocity -= delta * 0.0021
        } : undefined}
        onPointerUp={interactive ? () => {
          scrollRef.current.dragging = false
          scrollRef.current.lastInteractionAt = performance.now()
          setIsDragging(false)
        } : undefined}
        onPointerCancel={interactive ? () => {
          scrollRef.current.dragging = false
          setIsDragging(false)
        } : undefined}
        onPointerLeave={interactive ? () => {
          scrollRef.current.dragging = false
          setIsDragging(false)
        } : undefined}
      >
        <GalleryPlanes
          items={items}
          scrollRef={scrollRef}
          onSelect={onSelect}
          onActiveCoinChange={onActiveCoinChange}
          cameraZ={cameraZ}
          planeScale={planeScale}
          laneSpacing={laneSpacing}
        />
      </Canvas>
      {interactive ? (
        <div className="pointer-events-none absolute right-3 top-3 sm:right-6 sm:top-6 text-[10px] font-mono uppercase tracking-[1.8px] text-zinc-300/85">
          {isDragging ? 'Release to glide' : 'Drag / wheel / arrows'}
        </div>
      ) : null}
    </>
  )
}
