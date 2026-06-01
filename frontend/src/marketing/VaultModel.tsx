import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const GLB_URL = '/immersive/assets/vault/ethereum_vault.glb'

useGLTF.preload(GLB_URL)

type VaultModelProps = {
  lightningPulse: number
}

export function VaultModel({ lightningPulse }: VaultModelProps) {
  const group = useRef<THREE.Group>(null)
  const gltf = useGLTF(GLB_URL)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const emissiveMats = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = []
    scene.traverse((obj) => {
      if (!('isMesh' in obj) || !(obj as THREE.Mesh).isMesh) return
      const mesh = obj as THREE.Mesh
      const mat = mesh.material
      const list = Array.isArray(mat) ? mat : [mat]
      for (const m of list) {
        if (m && 'emissive' in m) mats.push(m as THREE.MeshStandardMaterial)
      }
    })
    return mats
  }, [scene])

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const scale = 1.75 / maxDim
    scene.scale.setScalar(scale)
    scene.position.sub(center.multiplyScalar(scale))
  }, [scene])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const breath = 0.75 + Math.sin(t * 1.6) * 0.2 + lightningPulse * 1.8
    for (const m of emissiveMats) {
      // three.js material mutation inside r3f render loop is intentional.
      // eslint-disable-next-line react-hooks/immutability
      m.emissiveIntensity = breath
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}
