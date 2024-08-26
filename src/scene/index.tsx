import { rand, rand2d, rand3d } from '@/utils'
import { Float, Instance, Instances } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { lazy, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mapLinear } from 'three/src/math/MathUtils.js'

const MAX_V = 0.001
const PARTICLE_COUNT = 5e3

class Particle {
  position = new THREE.Vector3().set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
  velocity = rand3d()
  scale = new THREE.Vector3().setScalar(rand(0.0005, 0.0015))
  opacity = rand(0.5, 1)
  force = new THREE.Vector3()
  original?: THREE.Vector3

  constructor() {
    this.original = this.position.clone()
  }

  update(dt: number, obstacles: THREE.Object3D[]) {
    this.force = new THREE.Vector3()
    this.opacity = mapLinear(this.velocity.length() * 5, 0, MAX_V, 0.035, 1)

    obstacles.forEach(j => {
      j.updateMatrixWorld()

      const bbox = new THREE.Box3().setFromObject(j)
      const center = bbox.getCenter(new THREE.Vector3())
      const size = bbox.getSize(new THREE.Vector3())
      const r = Math.max(...size.toArray()) * 0.5

      const toCenter = new THREE.Vector3().subVectors(center, this.position)
      const dist3D = toCenter.length()

      if (dist3D <= r + 0.1) {
        if (!bbox.containsPoint(this.position)) {
          if (dist3D < 0.2) {
            this.force.add(toCenter.normalize().multiplyScalar(0.001))
          }

          return
        }

        const m = new THREE.Vector3(
          this.position.x - center.x,
          this.position.y - center.y,
          this.position.z - center.z
        ).clampLength(0, r)

        const tanForce = new THREE.Vector3()
          .crossVectors(new THREE.Vector3(0, 1, 0), m)
          .normalize()
          .multiplyScalar(r * 0.0002)

        const radForce = new THREE.Vector3()
          .subVectors(this.position, center)
          .normalize()
          .multiplyScalar(
            mapLinear(
              m.length(),
              0,
              r,
              0.00005,
              (Math.random() < 0.5 ? 1 : -1) * 0.0001
            )
          )

        this.force
          .add(tanForce)
          .add(radForce)
          .multiplyScalar(dist3D * 0.000001)
          .lerp(rand2d().multiplyScalar(0.00003), 0.5)

        if (this.velocity.length() > MAX_V * 0.95) {
          this.velocity.add(
            new THREE.Vector3()
              .subVectors(this.original!, this.position)
              .normalize()
              .multiplyScalar(0.000001)
          )
        }
      }
    })

    this.velocity
      .add(this.force.multiplyScalar(dt + 1))
      .add(rand2d().multiplyScalar(0.0000053))
      .multiplyScalar(0.99)
      .clampLength(0, MAX_V)

    this.position
      .add(this.velocity)
      .setX(((this.position.x + 1) % 2) - 1)
      .setY(((this.position.y + 1) % 2) - 1)
      .setZ(((this.position.z + 1) % 2) - 1)
  }
}

export default function Scene() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const colorsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 4))

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const obstacles = useRef<THREE.Object3D[]>([])

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
      obstacles.current = rest
    }
  }, [particles])

  useFrame(({ clock }) => {
    const dt = clock.getDelta()

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i]

      p.update(dt, obstacles.current)
      colorsRef.current[i * 4 + 3] = p.opacity!

      tmp.position.copy(p.position)
      tmp.scale.copy(p.scale)
      tmp.updateMatrix()

      ref.current?.setMatrixAt(i, tmp.matrix)
    }

    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true
      ref.current.geometry.attributes.color.needsUpdate = true
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
        floatIntensity={0}
        rotation={[0, Math.PI / 3, Math.PI / 2.5]}
        position={[0.3, 0, 0.2]}>
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
        speed={2}
        floatIntensity={0.2}
        rotationIntensity={6}
        position={[-0.3, 0.1, 0.4]}>
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
