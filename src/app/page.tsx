'use client'

import { rand, random2D } from '@/utils'
import { Instance, Instances, OrbitControls, Stage } from '@react-three/drei'
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  AfterimagePass,
  EffectComposer,
  RenderPass
} from 'three/examples/jsm/Addons.js'

extend({ EffectComposer, RenderPass, AfterimagePass })

const MAX_V = 0.001
const PARTICLE_COUNT = 1e3

function Inner() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const colorsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 4))

  const particles = useMemo<Particle[]>(() => {
    const temp = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      temp.push({
        position: new THREE.Vector3(rand(), rand(), rand()),
        velocity: new THREE.Vector3(
          rand() * 0.0004 - 0.0002,
          rand() * 0.0004 - 0.0002,
          rand() * 0.0004 - 0.0002
        ),
        scale: new THREE.Vector3(1, 1, 1).multiplyScalar(
          rand() * 0.001 + 0.0005
        ),
        opacity: rand(0.5, 1)
      })
    }

    return temp
  }, [])

  useEffect(() => {
    const colors = colorsRef.current

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i4 = i * 4

      colors[i4 + 0] = 1
      colors[i4 + 1] = 1
      colors[i4 + 2] = 1
      colors[i4 + 3] = particles[i].opacity!
    }
  }, [particles])

  useFrame(() => {
    particles.forEach((i, n) => {
      i.velocity
        .add(random2D().multiplyScalar(0.000013))
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

  return (
    <Instances limit={PARTICLE_COUNT} ref={ref as any}>
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
  )
}

function Effects() {
  const { gl, scene, camera } = useThree()
  const fx = useMemo(() => new EffectComposer(gl as any), [gl])

  useEffect(() => {
    fx.addPass(new RenderPass(scene as any, camera as any))
    fx.addPass(new AfterimagePass(0.8))
  }, [fx])

  useFrame(() => void fx?.render(), 1)

  return null
}

export default function Scene() {
  return (
    <Canvas key={Math.random()} orthographic className="!w-svw !h-svh">
      <Suspense>
        <Stage>
          <Inner />
        </Stage>

        <Effects />
      </Suspense>

      <OrbitControls />
    </Canvas>
  )
}
