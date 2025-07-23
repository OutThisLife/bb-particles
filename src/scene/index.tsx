'use client'

import { resample } from '@/utils'
import { Float, Shadow, Stats } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

const Effects = lazy(() => import('./effects'))
const Controls = lazy(() => import('./controls'))

export const PARTICLE_COUNT = 1e4

const geometries = [
  new THREE.BoxGeometry(1, 1, 1, 64, 64, 64),
  new THREE.SphereGeometry(0.8, 64, 64),
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0)
    ]),
    64,
    0.1,
    8,
    false
  ),
  new THREE.RingGeometry(0.2, 0.5, 64, 64),
  new THREE.CylinderGeometry(0.5, 0.5, 1, 64, 64),
  new THREE.SphereGeometry(0.5, 64, 64),
  new THREE.TorusGeometry(0.5, 0.2, 64, 64),
  new THREE.TorusKnotGeometry(0.3, 0.1, 64, 64),
  new THREE.OctahedronGeometry(0.7, 0),
  new THREE.TetrahedronGeometry(0.8, 0),
  new THREE.DodecahedronGeometry(0.5, 0),
  new THREE.IcosahedronGeometry(0.5, 0),
  new THREE.BoxGeometry(1, 1, 1, 64, 64, 64),
  new THREE.TetrahedronGeometry(0.8, 0),
  new THREE.PlaneGeometry(1, 1, 64, 64),
  new THREE.RingGeometry(0.2, 0.5, 64, 64),
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0)
    ]),
    64,
    0.1,
    8,
    false
  ),
  new THREE.TetrahedronGeometry(0.8, 0),
  new THREE.BoxGeometry(1, 1, 1, 64, 64, 64),
  new THREE.SphereGeometry(1, 64, 64)
].map(i => resample(i))

const len = geometries.length + 1

function Inner() {
  const uniforms = useMemo(
    () => ({
      mixFactor: { value: 0 },
      positionsTexture: { value: new THREE.Texture() },
      numKeyframes: { value: len },
      keyframeStep: { value: 1.0 / len },
      pointSize: { value: 1.86 },
      uTime: { value: 0 }
    }),
    []
  )

  useEffect(() => {
    const maxV = Math.max(...geometries.map(g => g.attributes.position.count))
    const positions = new Float32Array(maxV * len * 4)

    geometries.forEach((g, n) => {
      const attr = g.attributes.position
      const count = attr.count
      const r = new Float32Array(count * 4)

      for (let i = 0; i < count; i++) {
        r[i * 4] = attr.getX(i) / 2
        r[i * 4 + 1] = attr.getY(i) / 2
        r[i * 4 + 2] = attr.getZ(i) / 2
        r[i * 4 + 3] = 1.0
      }

      const offset = n * maxV * 4

      for (let i = 0; i < r.length; i++) {
        positions[offset + i] = r[i]
      }
    })

    const tex = new THREE.DataTexture(
      positions,
      maxV,
      geometries.length,
      THREE.RGBAFormat,
      THREE.FloatType
    )

    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    uniforms.positionsTexture.value = tex
    uniforms.numKeyframes.value = geometries.length
    uniforms.keyframeStep.value = 1.0 / geometries.length
  }, [uniforms])

  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true })
    const dur = 1 / geometries.length

    let cur = 0
    while (cur < 1) {
      const next = Math.min(cur + dur, 1)

      tl.to(uniforms.mixFactor, {
        value: next,
        duration: (next - cur) / 0.01,
        ease: 'none'
      })

      if (next < 1 && cur > 0) {
        tl.to({}, { duration: 6 })
      }

      cur = next
    }
  }, [])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group scale={5.5} castShadow receiveShadow>
      <Float floatIntensity={0.2} rotationIntensity={0.1}>
        {Array.from({ length: 4 }).map((_, i) => (
          <points
            key={i}
            position={[0, 0, 0]}
            rotation={[0, 0, (Math.PI / 2) * i]}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={PARTICLE_COUNT}
                array={new Float32Array(PARTICLE_COUNT * 3)}
                itemSize={3}
              />

              <bufferAttribute
                attach="attributes-particleIndex"
                count={PARTICLE_COUNT}
                array={Float32Array.from(
                  Array.from({ length: PARTICLE_COUNT * 2 }, (_, idx) =>
                    // Even index: normalized vertex index, Odd index: random seed
                    idx % 2 === 0 ? idx / 2 / PARTICLE_COUNT : Math.random()
                  )
                )}
                itemSize={2}
              />
            </bufferGeometry>

            <shaderMaterial
              key={`${fragmentShader + vertexShader}}`}
              glslVersion={THREE.GLSL3}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              {...{ vertexShader, fragmentShader, uniforms }}
            />
          </points>
        ))}
      </Float>

      <Shadow
        position={[0, -0.35, 0.01]}
        color="#ffffff"
        opacity={0.05}
        scale={0.8}
      />
    </group>
  )
}

export default function Scene() {
  return (
    <Canvas
      key={Math.random()}
      camera={{ position: [0, 0, 10], fov: 30 }}
      style={{ width: '100vw', height: '100vh' }}
      shadows>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 5, 30]} />

      <ambientLight intensity={0.1} />

      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
      />

      <spotLight
        position={[-10, 10, -10]}
        angle={0.15}
        penumbra={1}
        intensity={0.5}
        castShadow
      />

      <Suspense>
        <Inner />
        <Controls />
        <Effects />
      </Suspense>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.02}
          roughness={0.5}
          metalness={0.9}
        />
      </mesh>

      <Stats />
    </Canvas>
  )
}
