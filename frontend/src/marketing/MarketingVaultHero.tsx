import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { Bloom, EffectComposer } from '@react-three/postprocessing'

import { ForceShieldMesh } from './shield/ForceShieldMesh'
import { useVaultHeroMotion } from './useVaultHeroMotion'
import { VaultModel } from './VaultModel'
import { VaultParticles } from './VaultParticles'

const POSTER_URL = '/immersive/assets/vault/ethereum_vault_poster.png'

function VaultScene() {
  const root = useRef<THREE.Group>(null)
  const { lightningPulse, mouse, scrollY, lowPower } = useVaultHeroMotion()

  useFrame((state, dt) => {
    if (!root.current) return
    root.current.rotation.y += dt * 0.1
    const t = state.clock.elapsedTime
    const tx = mouse.x * 0.6
    const ty = mouse.y * 0.36
    root.current.rotation.y += tx * 0.012
    root.current.rotation.x = -0.22 + ty * 0.28
    root.current.position.y = Math.sin(t * 0.7) * 0.04 - scrollY * 0.0006
    root.current.position.x = mouse.x * 0.16
  })

  const particleCount = lowPower ? 120 : 420

  return (
    <>
      <ambientLight intensity={0.35} color="#1a1035" />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={1.2} color="#c4b5fd" />
      <directionalLight position={[-2.5, -0.5, 0.5]} intensity={0.55} color="#6366f1" />

      <group ref={root}>
        <Suspense fallback={null}>
          <VaultModel lightningPulse={lightningPulse} />
        </Suspense>
        <ForceShieldMesh radius={1.12} lightningPulse={lightningPulse} />
      </group>

      <VaultParticles count={particleCount} />

      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={0.35}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
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
      camera={{ position: [0, 0.35, 6.6], fov: 22, near: 0.05, far: 100 }}
      dpr={[1, 2.5]}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        const tex = makePurpleEnvTexture(gl)
        scene.environment = tex
        scene.background = null
      }}
    >
      <VaultScene />
    </Canvas>
  )
}

function makePurpleEnvTexture(renderer: THREE.WebGLRenderer) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#030208'
  ctx.fillRect(0, 0, 512, 256)
  const g = ctx.createRadialGradient(256, 80, 8, 256, 80, 220)
  g.addColorStop(0, 'rgba(90, 40, 160, 0.55)')
  g.addColorStop(0.45, 'rgba(40, 18, 80, 0.22)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
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
