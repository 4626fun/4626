import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'

import { useVaultHeroMotion } from './useVaultHeroMotion'
import { VaultModel } from './VaultModel'
import { VaultParticles } from './VaultParticles'

const POSTER_URL = '/immersive/assets/vault/ethereum_vault_poster.png'

function VaultScene() {
  const root = useRef<THREE.Group>(null)
  const { lightningPulse, mouse, scrollY, lowPower } = useVaultHeroMotion()

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

  const particleCount = lowPower ? 70 : 150

  return (
    <>
      <ambientLight intensity={0.34} color="#0d1018" />
      <directionalLight position={[2.6, 3.2, 3.2]} intensity={1.05} color="#eef2ff" />
      <directionalLight position={[-2.8, 1.0, -1.8]} intensity={0.5} color="#9fb4d8" />
      <directionalLight position={[0.2, -2.0, 1.4]} intensity={0.22} color="#1b2336" />

      <group ref={root}>
        <Suspense fallback={null}>
          <VaultModel lightningPulse={lightningPulse} />
        </Suspense>
      </group>

      <VaultParticles count={particleCount} />
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
        gl.toneMappingExposure = 1.0
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
  base.addColorStop(0, '#0c1018')
  base.addColorStop(0.5, '#060810')
  base.addColorStop(1, '#03040a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)
  const key = ctx.createRadialGradient(256, 56, 8, 256, 56, 240)
  key.addColorStop(0, 'rgba(210, 224, 255, 0.55)')
  key.addColorStop(0.5, 'rgba(120, 150, 210, 0.16)')
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
