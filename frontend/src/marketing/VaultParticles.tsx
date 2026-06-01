import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function seeded01(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

const VERT = /* glsl */ `
  attribute float aPhase;
  varying float vPhase;
  void main() {
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.2 * (220.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  varying float vPhase;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float pulse = 0.55 + 0.45 * sin(uTime * 1.4 + vPhase * 6.28);
    vec3 col = mix(vec3(0.25, 0.08, 0.45), vec3(0.65, 0.45, 1.0), pulse);
    float alpha = smoothstep(0.5, 0.08, d) * 0.35 * pulse;
    gl_FragColor = vec4(col, alpha);
  }
`

type VaultParticlesProps = {
  count?: number
}

export function VaultParticles({ count = 420 }: VaultParticlesProps) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.4 + seeded01(i + 1) * 1.6
      const theta = seeded01(i + 11) * Math.PI * 2
      const phi = Math.acos(2 * seeded01(i + 23) - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65
      positions[i * 3 + 2] = r * Math.cos(phi)
      phases[i] = seeded01(i + 37)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    return geo
  }, [count])

  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    const uTime = material.uniforms.uTime as THREE.IUniform<number> | undefined
    // three.js shader uniform mutation inside r3f render loop is intentional.
    // eslint-disable-next-line react-hooks/immutability
    if (uTime) uTime.value = state.clock.elapsedTime
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.04
  })

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} />
    </group>
  )
}
