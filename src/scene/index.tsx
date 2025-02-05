/**
 * choose geometry
 * set repetition [x] numbers
 * - opacity by x*.1
 * - scaling down by x*.1
 * - opacity distribution per step by x*.1
 * - rotate by x*10 degrees
 * - translucent gradient to create blur and lighting
 * - mirror X xor Y?
 */

'use client'

import { clamp } from '@/utils'
import { GradientTexture, GradientType, Stats } from '@react-three/drei'
import { Canvas, GroupProps } from '@react-three/fiber'
import { useControls } from 'leva'
import { lazy, Suspense } from 'react'
import * as THREE from 'three'

const Effects = lazy(() => import('./Effects'))
const Controls = lazy(() => import('./Controls'))

function Inner() {
  const { repetitions, scaleFactor, rotationFactor, alphaFactor } = useControls(
    'Scalars',
    {
      repetitions: { value: 50, min: 1, max: 100, step: 1 },
      alphaFactor: { value: 0.3, min: 0, max: 1, step: 0.01 },
      scaleFactor: { value: 0.03, min: 0, max: 1, step: 0.01 },
      rotationFactor: { value: 0, min: -1, max: 1, step: 0.01 }
    }
  )

  const { mirrorX, mirrorY } = useControls('Reflection', {
    mirrorX: { value: 0.01, min: -2, max: 2, step: 0.01 },
    mirrorY: { value: 0.01, min: -2, max: 2, step: 0.01 }
  })

  const { xStep, yStep, origin } = useControls('Spatial', {
    origin: {
      options: [
        'center',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right'
      ],
      value: 'top-left'
    },
    xStep: { value: 0.2, min: -2, max: 2, step: 0.01 },
    yStep: { value: 0.2, min: -2, max: 2, step: 0.01 }
  })

  const { theta, phi } = useControls('Geometry', {
    theta: { value: Math.PI, min: 0, max: Math.PI * 2, step: 0.01 },
    phi: { value: 4.75, min: 0, max: Math.PI * 2, step: 0.01 }
  })

  const calcPosition = (i: number) => {
    let x = i * xStep
    let y = i * yStep

    switch (origin) {
      case 'top-left':
        x = -1 + i * xStep
        y = 1 - i * yStep
        break

      case 'top-right':
        x = 1 - i * xStep
        y = 1 - i * yStep
        break

      case 'bottom-left':
        x = -1 + i * xStep
        y = -1 + i * yStep
        break

      case 'bottom-right':
        x = 1 - i * xStep
        y = -1 + i * yStep
        break
    }

    return new THREE.Vector3(x, y, 0)
  }

  const Inner = (args: GroupProps) => (
    <group {...args}>
      {Array.from({ length: repetitions }).map((_, i) => (
        <mesh
          key={i}
          scale={Math.pow(1 - scaleFactor, i)}
          position={calcPosition(i)}
          rotation={[0, 0, (360 * rotationFactor * (i + 1)) / 180]}>
          <ringGeometry args={[0.9, 1, 64, 8, theta, phi]} />
          <meshBasicMaterial
            transparent
            depthTest={false}
            blending={THREE.NormalBlending}
            opacity={clamp(Math.exp(-(i + 1) * (1 - alphaFactor)), 0.02, 1)}>
            <GradientTexture
              stops={[0, 0.5, 1]}
              colors={['black', 'white', 'black']}
              type={GradientType.Radial}
            />
          </meshBasicMaterial>
        </mesh>
      ))}
    </group>
  )

  return (
    <>
      <Inner position={[mirrorX, 0, 0]} />

      {mirrorX !== 0.0 && (
        <Inner position={[-mirrorX, 0, 0]} scale={[-1, 1, 1]} />
      )}

      {mirrorY !== 0.0 && (
        <Inner position={[mirrorX, -mirrorY, 0]} scale={[1, -1, 1]} />
      )}

      {mirrorX !== 0.0 && mirrorY !== 0.0 && (
        <Inner position={[-mirrorX, -mirrorY, 0]} scale={[-1, -1, 1]} />
      )}
    </>
  )
}

export default function Scene() {
  return (
    <Canvas orthographic style={{ width: '100svw', height: '100svh' }}>
      <Suspense>
        <Inner />
        <Controls />
        <Effects />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
