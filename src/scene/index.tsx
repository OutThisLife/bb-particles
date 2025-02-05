'use client'

import { Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useControls } from 'leva'
import { lazy, Suspense } from 'react'
import * as THREE from 'three'

const Effects = lazy(() => import('./Effects'))
const Controls = lazy(() => import('./Controls'))

const GEOMETRIES = {
  quad: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.RingGeometry(0.5, 1, 32),
  line: new THREE.BoxGeometry(1, 0.1, 0.1)
}

function Inner() {
  const {
    geometry,
    repetitions,
    scaleFactor,
    rotationFactor,
    alphaFactor,
    positionStep
  } = useControls({
    geometry: {
      value: 'quad',
      options: Object.keys(GEOMETRIES)
    },
    repetitions: { value: 10, min: 1, max: 50, step: 1 },
    alphaFactor: { value: 0.1, min: 0, max: 1, step: 0.01 },
    scaleFactor: { value: 0.1, min: 0, max: 1, step: 0.01 },
    rotationFactor: { value: 10, min: -360, max: 360, step: 1 },
    positionStep: { value: 0.05, min: 0, max: 1, step: 0.01 }
  })

  return (
    <group scale={0.5}>
      {Array.from({ length: repetitions }).map((_, i) => (
        <group
          key={i}
          scale={1 - scaleFactor * i}
          position={[i * positionStep, i * positionStep, i * positionStep * 2]}
          rotation={[0, 0, (rotationFactor * i * Math.PI) / 180]}>
          <mesh geometry={GEOMETRIES[geometry]}>
            <meshStandardMaterial
              transparent
              depthTest={false}
              blending={THREE.AdditiveBlending}
              opacity={Math.max(0, 1 - alphaFactor * i)}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Scene() {
  return (
    <Canvas
      orthographic
      style={{ width: '100vw', height: '100vh' }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false
      }}>
      <ambientLight intensity={0.5} />

      <Suspense>
        <Inner />
        <Controls />
        <Effects />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
