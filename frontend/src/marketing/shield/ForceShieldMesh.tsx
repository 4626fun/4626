import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { createShieldMaterial } from './shieldShaders'

function seededSigned(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  const frac = s - Math.floor(s)
  return frac * 2 - 1
}

type ForceShieldMeshProps = {
  radius?: number
  lightningPulse?: number
}

export function ForceShieldMesh({ radius = 1.15, lightningPulse = 0 }: ForceShieldMeshProps) {
  const material = useMemo(() => createShieldMaterial(), [])
  const hitSlot = useRef(0)

  useFrame((state) => {
    const u = material.uniforms
    const uTime = u.uTime as THREE.IUniform<number> | undefined
    const uHitTime = u.uHitTime as THREE.IUniform<number[]> | undefined
    const uHitPos = u.uHitPos as THREE.IUniform<THREE.Vector3[]> | undefined
    if (!uTime || !uHitTime || !uHitPos) return
    // three.js shader uniform mutation inside r3f render loop is intentional.
    // eslint-disable-next-line react-hooks/immutability
    uTime.value = state.clock.elapsedTime
    if (lightningPulse > 0.05) {
      const idx = hitSlot.current % 4
      uHitTime.value[idx] = state.clock.elapsedTime
      const seed = state.clock.elapsedTime * 10 + idx * 97 + hitSlot.current * 13
      const dir = new THREE.Vector3(
        seededSigned(seed + 1) * 0.3,
        seededSigned(seed + 2) * 0.2 + 0.2,
        seededSigned(seed + 3) * 0.3,
      ).normalize()
      uHitPos.value[idx]?.copy(dir)
      hitSlot.current += 1
    }
  })

  return (
    <mesh scale={radius}>
      <icosahedronGeometry args={[1, 3]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
