import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox, Text, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

import {
  OBSIDIAN_BLOOM,
  OBSIDIAN_CAMERA,
  OBSIDIAN_COLORS,
  OBSIDIAN_DPR,
  OBSIDIAN_GLB_DEFAULT,
  OBSIDIAN_MATERIAL,
  OBSIDIAN_VIGNETTE,
  type VaultHeroMode,
} from '@/lib/vault/obsidianVaultTokens'

import './VaultHero.css'

type VaultHeroProps = {
  mode?: VaultHeroMode
  modelUrl?: string | null
  className?: string
}

function usePrefersReducedMotionRef() {
  const reduce = useRef(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      reduce.current = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduce
}

function PremiumMotionGroup({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotionRef()

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const px = THREE.MathUtils.clamp(state.pointer.x, -1, 1)
    const py = THREE.MathUtils.clamp(state.pointer.y, -1, 1)
    const targetY = 0.62 + (reduced.current ? 0 : t * 0.045) + px * 0.09
    const targetX = -0.22 - py * 0.045

    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 2.8, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 2.8, delta)
    g.position.y = reduced.current ? 0 : Math.sin(t * 0.48) * 0.025
  })

  return <group ref={group}>{children}</group>
}

function materialTuning(material: THREE.Material, role: string) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return
  material.fog = false
  material.envMapIntensity = role === 'shell' ? 2.25 : 1.55
  material.needsUpdate = true

  if (role === 'shell' || /shell|glass|smoked/i.test(role)) {
    Object.assign(material, OBSIDIAN_MATERIAL.shell)
    material.transparent = true
    material.depthWrite = false
  } else if (/emission|glow|hidden/i.test(role)) {
    material.color = new THREE.Color(OBSIDIAN_COLORS.core)
    material.emissive = new THREE.Color(OBSIDIAN_COLORS.glow)
    material.emissiveIntensity = 0.025
    material.roughness = 0.42
  } else {
    Object.assign(material, OBSIDIAN_MATERIAL.core)
  }
}

function GLBVault({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl)
  const root = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      child.geometry?.computeVertexNormals?.()
      const role = String(child.userData?.role ?? child.name ?? '')
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) materialTuning(mat, role)
    })
  }, [root])

  return <primitive object={root} scale={1.05} />
}

function SeamBar({
  position,
  scale,
  rotation = [0, 0, 0] as const,
  subtle = false,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  subtle?: boolean
}) {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color={subtle ? OBSIDIAN_COLORS.seamSubtle : OBSIDIAN_COLORS.seam}
        metalness={subtle ? 0.25 : OBSIDIAN_MATERIAL.seam.metalness}
        roughness={subtle ? 0.44 : OBSIDIAN_MATERIAL.seam.roughness}
        clearcoat={1}
        clearcoatRoughness={0.12}
        emissive={subtle ? '#05070a' : '#000000'}
        emissiveIntensity={subtle ? 0.018 : 0}
        envMapIntensity={1.35}
      />
    </mesh>
  )
}

type FaceName = 'front' | 'right' | 'top'

function FaceFrame({ face = 'front' }: { face?: FaceName }) {
  const z = 0.895
  const inset = 0.52
  const length = 1.06
  const thick = 0.018
  const depth = 0.012
  const bars = [
    { p: [0, inset, z] as const, s: [length, thick, depth] as const },
    { p: [0, -inset, z] as const, s: [length, thick, depth] as const },
    { p: [inset, 0, z] as const, s: [thick, length, depth] as const },
    { p: [-inset, 0, z] as const, s: [thick, length, depth] as const },
  ]

  const transform = {
    front: {
      r: [0, 0, 0] as const,
      map: ([x, y, zz]: readonly [number, number, number]) => [x, y, zz] as const,
      scale: ([x, y, zz]: readonly [number, number, number]) => [x, y, zz] as const,
    },
    right: {
      r: [0, Math.PI / 2, 0] as const,
      map: ([x, y, zz]: readonly [number, number, number]) => [zz, y, -x] as const,
      scale: ([x, y, zz]: readonly [number, number, number]) => [zz, y, x] as const,
    },
    top: {
      r: [-Math.PI / 2, 0, 0] as const,
      map: ([x, y, zz]: readonly [number, number, number]) => [x, zz, -y] as const,
      scale: ([x, y, zz]: readonly [number, number, number]) => [x, zz, y] as const,
    },
  }[face]

  return (
    <group>
      {bars.map((bar, i) => (
        <SeamBar
          key={`${face}-${i}`}
          position={[...transform.map(bar.p)]}
          scale={[...transform.scale(bar.s)]}
          rotation={[...transform.r]}
          subtle={face !== 'front'}
        />
      ))}
    </group>
  )
}

function ProceduralVaultFallback() {
  return (
    <group>
      <RoundedBox args={[1.72, 1.72, 1.72]} radius={0.115} smoothness={18}>
        <meshPhysicalMaterial {...OBSIDIAN_MATERIAL.core} />
      </RoundedBox>

      <FaceFrame face="front" />
      <FaceFrame face="right" />
      <FaceFrame face="top" />

      <Text
        position={[0, -0.03, 0.905]}
        fontSize={0.16}
        anchorX="center"
        anchorY="middle"
        color={OBSIDIAN_COLORS.mark}
        material-toneMapped={false}
      >
        4626
        <meshBasicMaterial color={OBSIDIAN_COLORS.mark} transparent opacity={0.34} />
      </Text>

      <RoundedBox args={[1.84, 1.84, 1.84]} radius={0.145} smoothness={24}>
        <meshPhysicalMaterial {...OBSIDIAN_MATERIAL.shell} />
      </RoundedBox>
    </group>
  )
}

function VaultObject({ modelUrl }: { modelUrl: string | null }) {
  return (
    <PremiumMotionGroup>
      <Suspense fallback={<ProceduralVaultFallback />}>
        {modelUrl ? <GLBVault modelUrl={modelUrl} /> : <ProceduralVaultFallback />}
      </Suspense>
    </PremiumMotionGroup>
  )
}

function BlackStudio() {
  return (
    <>
      <ambientLight intensity={0.015} color="#050609" />
      <directionalLight position={[-3.2, 2.2, -2.6]} intensity={1.45} color="#dfe8ff" />
      <directionalLight position={[2.6, -1.1, 2.8]} intensity={0.12} color="#8a7158" />
      <Environment resolution={128} background={false}>
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#e7eeff"
          position={[-3.2, 2.0, -3.0]}
          rotation={[0, 0.8, 0]}
          scale={[0.045, 3.1, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.45}
          color="#6f7fa8"
          position={[2.4, 1.6, -2.4]}
          rotation={[0, -0.8, 0]}
          scale={[0.04, 1.8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.18}
          color="#8a6a4c"
          position={[0.5, -1.9, 2.0]}
          rotation={[1.2, 0, 0]}
          scale={[1.2, 0.035, 1]}
        />
      </Environment>
    </>
  )
}

export function preloadVaultModel(modelUrl: string = OBSIDIAN_GLB_DEFAULT) {
  useGLTF.preload(modelUrl)
}

export function VaultHero({ mode = 'procedural', modelUrl = null, className = '' }: VaultHeroProps) {
  const resolvedUrl =
    mode === 'glb' ? (modelUrl ?? OBSIDIAN_GLB_DEFAULT) : null

  return (
    <section className={`vaultHero ${className}`.trim()} aria-label="Obsidian vault artifact">
      <div className="vaultHero__atmosphere" />
      <Canvas
        camera={{
          position: [...OBSIDIAN_CAMERA.position],
          fov: OBSIDIAN_CAMERA.fov,
          near: OBSIDIAN_CAMERA.near,
          far: OBSIDIAN_CAMERA.far,
        }}
        dpr={OBSIDIAN_DPR}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.82
          gl.outputColorSpace = THREE.SRGBColorSpace
          scene.background = null
        }}
      >
        <color attach="background" args={['#000000']} />
        <BlackStudio />
        <VaultObject modelUrl={resolvedUrl} />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={OBSIDIAN_BLOOM.intensity}
            luminanceThreshold={OBSIDIAN_BLOOM.luminanceThreshold}
            luminanceSmoothing={OBSIDIAN_BLOOM.luminanceSmoothing}
            radius={OBSIDIAN_BLOOM.radius}
            mipmapBlur
          />
          <Vignette offset={OBSIDIAN_VIGNETTE.offset} darkness={OBSIDIAN_VIGNETTE.darkness} />
        </EffectComposer>
      </Canvas>
    </section>
  )
}

export default VaultHero
