'use client'

import { Controls, Cursor, Effects } from '@/scene'
import { rand, random2D } from '@/utils'
import {
  Environment,
  Float,
  Instance,
  Instances,
  Stats
} from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mapLinear } from 'three/src/math/MathUtils.js'

const MAX_V = 0.001
const PARTICLE_COUNT = 2e3

function Inner() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const colorsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 4))

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        position: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5),
        velocity: new THREE.Vector3(
          rand() * 0.0004 - 0.0002,
          rand() * 0.0004 - 0.0002,
          rand() * 0.0004 - 0.0002
        ),
        scale: new THREE.Vector3(1, 1, 1).multiplyScalar(rand(0.0001, 0.001)),
        opacity: rand(0.5, 1)
      })),
    []
  )

  useEffect(() => {
    const colors = colorsRef.current

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i4 = i * 4

      colors[i4 + 0] = rand(0.7, 1)
      colors[i4 + 1] = rand(0.7, 1)
      colors[i4 + 2] = rand(0.7, 1)
      colors[i4 + 3] = particles[i].opacity!
    }
  }, [particles])

  useFrame(() => {
    particles.forEach((i, n) => {
      const force = new THREE.Vector3()

      if (!i.original?.length()) {
        i.original = i.position.clone()
      }

      groupRef.current?.children?.forEach(j => {
        if (j instanceof THREE.InstancedMesh) {
          return
        }

        j.updateMatrixWorld()

        const bbox = new THREE.Box3().setFromObject(j)
        const center = bbox.getCenter(new THREE.Vector3())
        const size = bbox.getSize(new THREE.Vector3())
        const r = Math.max(...size.toArray()) * 0.5

        const toCenter = new THREE.Vector3().subVectors(center, i.position)
        const dist3D = toCenter.length()

        colorsRef.current[n * 4 + 3] = mapLinear(
          i.velocity.length() * 5,
          0,
          MAX_V,
          0.035,
          1
        )

        if (dist3D <= r + 0.2) {
          const dir = new THREE.Vector3()
            .subVectors(center, i.position)
            .normalize()

          if (!bbox.containsPoint(i.position)) {
            if (dist3D < 0.2) {
              force.add(dir.multiplyScalar(0.000003))
            }

            return
          }

          const m = new THREE.Vector3(
            i.position.x - center.x,
            i.position.y - center.y,
            i.position.z - center.z
          ).clampLength(0, r)

          const angle = Math.atan2(m.y, m.x) + (Math.PI / 2) * (n % 2 ? 1 : -1)

          const tanForce = new THREE.Vector3(
            Math.cos(angle),
            Math.sin(angle),
            0
          ).multiplyScalar(r * 0.0001333)

          const radForce = new THREE.Vector3()
            .subVectors(i.position, center)
            .normalize()
            .multiplyScalar(
              mapLinear(m.length(), 0, r, 0.00005, (n % 2) * -0.0001)
            )

          force
            .add(tanForce)
            .add(radForce)
            .lerp(random2D().multiplyScalar(0.00003), 0.5)

          if (i.velocity.length() > MAX_V * 0.95) {
            i.velocity.add(
              new THREE.Vector3()
                .subVectors(i.original, i.position)
                .normalize()
                .multiplyScalar(0.0001)
            )
          }
        }
      })

      i.velocity
        .add(force.multiplyScalar(0.3))
        .add(random2D().multiplyScalar(0.0000053))
        .multiplyScalar(0.99)
        .clampLength(0, MAX_V)

      i.position
        .add(i.velocity)
        .setX(((i.position.x + 1) % 2) - 1)
        .setY(((i.position.y + 1) % 2) - 1)
        .setZ(((i.position.z + 1) % 2) - 1)

      ref.current?.setMatrixAt(
        n,
        new THREE.Matrix4().setPosition(i.position).scale(i.scale)
      )
    })

    ref.current.instanceMatrix.needsUpdate = true
    ref.current.geometry.attributes.color.needsUpdate = true
  })

  useEffect(() => {
    ref.current.traverse(function fn(j) {
      if (!j.name?.startsWith('obj')) {
        return
      }

      console.log(j)
    })
  }, [])

  return (
    <group ref={groupRef}>
      <Instances limit={PARTICLE_COUNT} {...{ ref }}>
        <octahedronGeometry args={[1, 3]}>
          <instancedBufferAttribute
            attach="attributes-color"
            args={[colorsRef.current, 4]}
          />
        </octahedronGeometry>

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
        position={[0.2, 0.2, 0]}>
        <mesh>
          <boxGeometry args={[0.05, 0.05, 0.05, 4, 1, 4]} />
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
        position={[-0.2, -0.2, 0]}>
        <mesh name="obj3">
          <sphereGeometry args={[0.02]} />
          <meshBasicMaterial
            transparent
            opacity={0.01}
            depthWrite={false}
            wireframe
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.051]} />
          <meshBasicMaterial
            transparent
            opacity={0.008}
            depthWrite={false}
            wireframe
          />
        </mesh>
      </Float>

      <Cursor />
    </group>
  )
}

export default function Scene() {
  return (
    <main>
      <Canvas
        orthographic
        camera={{ zoom: 1200 }}
        className="cursor-crosshair !w-svw !h-svh">
        <Environment preset="studio" />

        <Suspense>
          <Inner />
          <Effects />
          <Controls />
        </Suspense>

        <Stats />
      </Canvas>

      <footer className="z-10 fixed inset-x-0 bottom-0 p-5 text-center text-xs text-white text-opacity-75">
        alt + (l|r)mb to (rotate|pan)
      </footer>
    </main>
  )
}
