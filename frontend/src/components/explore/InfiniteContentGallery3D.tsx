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
  className?: string
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
}: {
  items: GalleryItem[]
  scrollRef: React.RefObject<ScrollState>
  onSelect: (coin: ZoraCoin) => void
}) {
  const textures = useGalleryTextures(items)
  const materialRef = useRef<Array<THREE.MeshStandardMaterial | null>>([])
  const meshRef = useRef<Array<THREE.Mesh | null>>([])

  useFrame((state, delta) => {
    const scroll = scrollRef.current
    if (!scroll) return

    const idleForMs = performance.now() - scroll.lastInteractionAt
    if (!scroll.dragging && idleForMs > 2400) {
      scroll.velocity += 0.028 * delta
    }
    scroll.value += scroll.velocity
    scroll.velocity *= 0.93

    for (let i = 0; i < items.length; i += 1) {
      const spacing = 2.6
      const loopDepth = items.length * spacing
      const baseZ = i * spacing
      let z = baseZ - scroll.value * spacing
      z = ((z % loopDepth) + loopDepth) % loopDepth
      if (z > loopDepth * 0.5) z -= loopDepth

      const mesh = meshRef.current[i]
      if (mesh) {
        mesh.position.set(Math.sin(i * 1.73) * 1.15, Math.cos(i * 1.27) * 0.58, z)
      }

      const mat = materialRef.current[i]
      if (!mat) continue
      const depthT = Math.min(1, Math.abs(z) / (loopDepth * 0.5))
      mat.opacity = 0.22 + (1 - depthT) * 0.88
      mat.roughness = 0.42 + depthT * 0.25
      mat.emissiveIntensity = 0.1 + (1 - depthT) * 0.2
    }

    state.camera.position.z = 5.8
  })

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight position={[0, 1.8, 3.4]} intensity={1.05} color="#cde7ff" />
      <directionalLight position={[-3.2, -1.1, -1.5]} intensity={0.35} color="#97f6ff" />
      {items.map((item, index) => {
        const x = Math.sin(index * 1.73) * 1.15
        const y = Math.cos(index * 1.27) * 0.58
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
            <planeGeometry args={[2.35, 1.58, 24, 24]} />
            <meshStandardMaterial
              ref={(mat) => {
                materialRef.current[index] = mat
              }}
              map={textures[index] ?? null}
              transparent
              opacity={0.95}
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

export function InfiniteContentGallery3D(props: InfiniteContentGallery3DProps) {
  const items = useMemo(() => normalizeGalleryItems(props.coins).slice(0, 8), [props.coins])
  const scrollRef = useRef<ScrollState>({
    value: 0,
    velocity: 0,
    dragging: false,
    dragStartX: 0,
    lastInteractionAt: 0,
  })
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    scrollRef.current.lastInteractionAt = performance.now()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const dir = event.key === 'ArrowLeft' ? -1 : 1
      scrollRef.current.velocity += dir * 0.1
      scrollRef.current.lastInteractionAt = performance.now()
    }
    host.addEventListener('keydown', onKeyDown)
    return () => host.removeEventListener('keydown', onKeyDown)
  }, [])

  if (items.length === 0) {
    return (
      <div className={`h-full min-h-[220px] sm:min-h-[260px] bg-black/70 ${props.className ?? ''}`}>
        <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400 font-mono uppercase tracking-[1.6px]">
          No visual assets available
        </div>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      className={`group relative h-full min-h-[220px] sm:min-h-[260px] bg-black/90 outline-none ${props.className ?? ''}`}
      onWheel={(event) => {
        event.preventDefault()
        scrollRef.current.velocity += event.deltaY * 0.00065
        scrollRef.current.lastInteractionAt = performance.now()
      }}
      onPointerDown={(event) => {
        scrollRef.current.dragging = true
        scrollRef.current.dragStartX = event.clientX
        scrollRef.current.lastInteractionAt = performance.now()
        setIsDragging(true)
      }}
      onPointerMove={(event) => {
        if (!scrollRef.current.dragging) return
        const delta = event.clientX - scrollRef.current.dragStartX
        scrollRef.current.dragStartX = event.clientX
        scrollRef.current.velocity -= delta * 0.0021
      }}
      onPointerUp={() => {
        scrollRef.current.dragging = false
        scrollRef.current.lastInteractionAt = performance.now()
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
      <Canvas camera={{ position: [0, 0, 5.8], fov: 42 }} dpr={[1, 1.8]} className="h-full w-full">
        <GalleryPlanes items={items} scrollRef={scrollRef} onSelect={props.onSelect} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/70 to-transparent" />
      <div className="pointer-events-none absolute right-3 top-3 text-[10px] font-mono uppercase tracking-[1.8px] text-zinc-300/85">
        {isDragging ? 'Release to glide' : 'Drag / wheel / arrows'}
      </div>
    </div>
  )
}
