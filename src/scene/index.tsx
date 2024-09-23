import { rand } from '@/utils'
import { Float, Instance, Instances } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { lazy, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import Particle from './Particle'

const PARTICLE_COUNT = 1e4
let frameCount = 0

export default function Scene() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const colorsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 4))

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const objects = useRef<THREE.Object3D[]>([])

  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, () => new Particle()),
    []
  )

  useEffect(() => {
    const colors = colorsRef.current

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      colors[i * 4 + 0] = rand(0.7, 1)
      colors[i * 4 + 1] = rand(0.7, 1)
      colors[i * 4 + 2] = rand(0.7, 1)
      colors[i * 4 + 3] = particles[i].opacity!
    }

    ref.current?.geometry.setAttribute(
      'color',
      new THREE.InstancedBufferAttribute(colors, 4)
    )

    if (ref.current) {
      const [, ...rest] = groupRef.current.children
      objects.current = rest
    }
  }, [particles])

  useFrame((_, dt) => {
    particles.forEach((p, i) => {
      p.update(dt, objects.current, frameCount)
      colorsRef.current[i * 4 + 3] = p.opacity!

      tmp.position.copy(p.position)
      tmp.scale.copy(p.scale)
      tmp.updateMatrix()

      ref.current?.setMatrixAt(i, tmp.matrix)
    })

    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true
      ref.current.geometry.attributes.color.needsUpdate = true

      frameCount++
    }
  })

  return (
    <group ref={groupRef}>
      <Instances limit={PARTICLE_COUNT} {...{ ref }}>
        <octahedronGeometry args={[1, 3]} />
        <meshBasicMaterial vertexColors transparent />

        {particles.map((i, n) => (
          <Instance key={n} {...i} />
        ))}
      </Instances>

      <Float
        speed={2}
        rotationIntensity={5}
        floatIntensity={0.1}
        rotation={[0, Math.PI / 3, Math.PI / 2.5]}
        position={[0.1, -0.2, 0.2]}>
        <mesh>
          <boxGeometry args={[0.1, 0.1, 0.1, 4, 1, 4]} />
          <meshBasicMaterial
            transparent
            opacity={0.05}
            depthWrite={false}
            wireframe
          />
        </mesh>
      </Float>

      <Float
        name="sphere"
        speed={2}
        floatIntensity={0.2}
        rotationIntensity={6}
        position={[-0.1, 0.1, 0.4]}>
        <mesh>
          <sphereGeometry args={[0.04, 32, 32]} />
          <meshBasicMaterial
            transparent
            opacity={0.01}
            depthWrite={false}
            wireframe
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.102, 32, 32]} />
          <meshBasicMaterial
            transparent
            opacity={0.008}
            depthWrite={false}
            wireframe
          />
        </mesh>
      </Float>
    </group>
  )
}

export const Cursor = lazy(() => import('./Cursor'))
export const Effects = lazy(() => import('./Effects'))
export const Controls = lazy(() => import('./Controls'))
