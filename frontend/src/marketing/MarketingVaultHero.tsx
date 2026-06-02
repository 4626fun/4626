import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'

import { useVaultHeroMotion } from './useVaultHeroMotion'
import { VaultModel } from './VaultModel'

const POSTER_URL = '/immersive/assets/vault/ethereum_vault_poster.png'

function VaultScene() {
  const root = useRef<THREE.Group>(null)
  const { mouse, scrollY } = useVaultHeroMotion()

  useFrame((_state, dt) => {
    if (!root.current) return
    // obsdn-style continuous turntable; subtle mouse parallax, no vertical bob.
    root.current.rotation.y += dt * 0.14
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      -0.12 + mouse.y * 0.1,
      4,
      dt,
    )
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, mouse.x * 0.08, 4, dt)
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, -scrollY * 0.0004, 4, dt)
  })

  return (
    <>
      <ambientLight intensity={0.45} color="#1a2233" />
      {/* Key — warm-cool white from upper right, the primary read light. */}
      <directionalLight position={[2.6, 3.2, 3.2]} intensity={1.5} color="#eef2ff" />
      {/* Soft side fill. */}
      <directionalLight position={[-2.8, 1.2, -1.4]} intensity={0.65} color="#9fb4d8" />
      {/* Cool fill from below so the lower pyramid reads as a solid, converging
          crystal instead of a black under-mass. */}
      <directionalLight position={[0.0, -2.6, 1.8]} intensity={0.55} color="#7088b8" />
      {/* Rim / back light — crisp luminous edge that separates the silhouette
          from the dusk sky. Kept near-neutral white: a saturated blue back light
          throws blue specular streaks across the facets that read as an energy
          "force field" beam, which we explicitly do not want. */}
      <directionalLight position={[-1.4, 2.6, -3.8]} intensity={1.45} color="#e9eef6" />
      <directionalLight position={[1.8, -1.0, -3.4]} intensity={0.8} color="#dde4f0" />

      <group ref={root}>
        <Suspense fallback={null}>
          <VaultModel />
        </Suspense>
      </group>
    </>
  )
}

export function MarketingVaultHero() {
  const { reduceMotion } = useVaultHeroMotion()

  if (reduceMotion) {
    return (
      <img
        src={POSTER_URL}
        alt=""
        decoding="async"
        className="hero__vault-poster"
        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
      />
    )
  }

  return (
    <Canvas
      className="hero__vault-canvas"
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.3, 5.8], fov: 21, near: 0.05, far: 100 }}
      dpr={[1, 2.5]}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        const tex = makeStudioEnvTexture(gl)
        scene.environment = tex
        scene.background = null
      }}
    >
      <VaultScene />
    </Canvas>
  )
}

function makeStudioEnvTexture(renderer: THREE.WebGLRenderer) {
  // Cool neutral studio: a soft top key + cooler floor so obsidian facets read
  // without a colored cast washing them out.
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
