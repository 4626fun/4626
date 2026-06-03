import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { applyPremiumObsidian, type PremiumObsidianResult } from './vaultMaterial'

const GLB_URL = '/immersive/assets/vault/ethereum_vault.glb'

useGLTF.preload(GLB_URL)

export function VaultModel() {
  const group = useRef<THREE.Group>(null)
  const gltf = useGLTF(GLB_URL)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const obsidian = useRef<PremiumObsidianResult | null>(null)
  useEffect(() => {
    obsidian.current = applyPremiumObsidian(scene)
    return () => {
      obsidian.current?.dispose()
      obsidian.current = null
    }
  }, [scene])

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    // The GLB is a tall 1.62:1 bipyramid which reads as a stretched ETH logo.
    // Compress the vertical axis so it reads as a balanced obsidian octahedron
    // (~1.3:1, like a cut gem) and size it a touch larger while staying fully
    // framed (camera sees ~2.1 units tall — never crop, that re-creates the
    // dark "box").
    const base = 2.05 / maxDim
    const vSquash = 0.82
    scene.scale.set(base, base * vSquash, base)
    scene.position.set(
      -center.x * base,
      -center.y * base * vSquash,
      -center.z * base,
    )
  }, [scene])

  // The gem is pure obsidian stone — no emissive veins, no seam glow. Lightning
  // lives in the sky (CSS bolts/flash), never as a blue "force field" beam on
  // the crystal itself. Materials initialise with emissiveIntensity 0 and stay
  // there, so there is no per-frame material mutation to run here.

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}
