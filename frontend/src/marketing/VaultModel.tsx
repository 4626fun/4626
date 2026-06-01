import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { applyPremiumObsidian, type PremiumObsidianResult } from './vaultMaterial'

const GLB_URL = '/immersive/assets/vault/ethereum_vault.glb'

useGLTF.preload(GLB_URL)

type VaultModelProps = {
  lightningPulse: number
}

export function VaultModel({ lightningPulse }: VaultModelProps) {
  const group = useRef<THREE.Group>(null)
  const gltf = useGLTF(GLB_URL)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const obsidian = useRef<PremiumObsidianResult | null>(null)
  useMemo(() => {
    obsidian.current?.dispose()
    obsidian.current = applyPremiumObsidian(scene)
  }, [scene])

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const scale = 4.0 / maxDim
    scene.scale.setScalar(scale)
    scene.position.sub(center.multiplyScalar(scale))
  }, [scene])

  useEffect(() => () => obsidian.current?.dispose(), [])

  useFrame((state) => {
    const o = obsidian.current
    if (!o) return
    const t = state.clock.elapsedTime
    // Veins stay dark at idle; blue glow spikes only on lightning beats.
    // three.js material mutation inside r3f render loop is intentional.
    o.veinMat.emissiveIntensity = lightningPulse * 1.8
    const accentGlow = 0.18 + Math.sin(t * 0.9) * 0.04 + lightningPulse * 0.6
    for (const a of o.accents) {
      // eslint-disable-next-line react-hooks/immutability
      a.emissiveIntensity = accentGlow
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}
