'use client'

import { useSmoothControls } from '@/hooks/useSmoothControls'
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
import { $object } from '@/store'
import { obcAlpha } from '@/utils'
import { useStore } from '@nanostores/react'
import {
  GradientTexture,
  GradientType,
  Instance,
  InstancedAttribute,
  Instances,
  InstancesProps,
  Stats,
  useGLTF
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing'
import gsap from 'gsap'
import { lazy, Suspense, useCallback } from 'react'
import * as THREE from 'three'

const Controls = lazy(() => import('./Controls'))

const originOptions = [
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

function CustomGeometry({ url }: { url: string }) {
  const { scene } = useGLTF(url)

  return <primitive object={scene} />
}

function Inner() {
  const objFile = useStore($object)

  const { position, scale, rotation } = useSmoothControls(
    'Scene',
    {
      position: { value: { x: 0, y: 0 }, min: -2, max: 2, step: 0.01 },
      scale: { value: 1, min: 0, max: 2, step: 0.01 },
      rotation: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 }
    },
    undefined,
    0.01
  )

  const { repetitions, scaleFactor, rotationFactor, alphaFactor } =
    useSmoothControls('Scalars', {
      repetitions: { value: 50, min: 1, max: 100, step: 1 },
      alphaFactor: { value: 0.5, min: 0, max: 1, step: 0.01 },
      scaleFactor: { value: 0.03, min: 0, max: 1, step: 0.01 },
      rotationFactor: { value: -0.08, min: -1, max: 1, step: 0.01 }
    })

  const { mirrorX, mirrorY } = useSmoothControls('Reflection', {
    mirrorX: { value: 0.01, min: -2, max: 2, step: 0.01 },
    mirrorY: { value: 0.01, min: -2, max: 2, step: 0.01 }
  })

  const { xStep, yStep, origin, stepFactor } = useSmoothControls('Spatial', {
    origin: { options: originOptions, value: 'bottom-left' },
    xStep: { value: 0.54, min: -2, max: 2, step: 0.01 },
    yStep: { value: 0.39, min: -2, max: 2, step: 0.01 },
    stepFactor: { value: 0.16, min: 0, max: 2, step: 0.01 }
  })

  const { debug, thetaSegments, phiSegments, thetaStart, thetaEnd, radius } =
    useSmoothControls(
      'Geometry',
      {
        debug: { value: false },
        radius: { value: 0.94, min: 0.1, max: 0.99, step: 0.01 },
        thetaSegments: { value: 100, min: 1, max: 100, step: 1 },
        phiSegments: { value: 1, min: 1, max: 100, step: 1 },
        thetaStart: { value: 0, min: 0, max: Math.PI * 2, step: 0.01 },
        thetaEnd: { value: Math.PI * 2, min: 0, max: Math.PI * 2, step: 0.01 }
      },
      { collapsed: true }
    )

  const { blending, gradType, gradStops, gradColor1, gradColor2, color } =
    useSmoothControls(
      'Material',
      {
        blending: {
          options: ['None', 'Normal', 'Additive'],
          value: 'Additive'
        },
        gradType: {
          options: [GradientType.Radial, GradientType.Linear],
          value: GradientType.Radial
        },
        color: { value: 'white' },
        gradColor1: { value: 'white' },
        gradColor2: { value: 'black' },
        gradStops: { value: [0, 1], min: 0, max: 1, step: 0.01 }
      },
      { collapsed: true }
    )

  const calcPosition = useCallback(
    (i: number) => {
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

      return new THREE.Vector3(x, y, 0).multiplyScalar(stepFactor)
    },
    [origin, xStep, yStep, stepFactor]
  )

  const Inner = ({ range = repetitions, ...args }: InstancesProps) => (
    <Instances {...args}>
      <InstancedAttribute name="opacity" defaultValue={0.02} />

      {objFile ? (
        <Suspense fallback={null}>
          <CustomGeometry url={objFile!} />
        </Suspense>
      ) : (
        <ringGeometry
          args={[radius, 1, thetaSegments, phiSegments, thetaStart, thetaEnd]}
        />
      )}

      <meshBasicMaterial
        transparent
        alphaToCoverage
        depthTest={false}
        onBeforeCompile={obcAlpha}
        blending={
          {
            None: THREE.NoBlending,
            Normal: THREE.NormalBlending,
            Additive: THREE.AdditiveBlending
          }[blending]
        }
        {...{ color }}>
        <GradientTexture
          stops={gradStops}
          colors={[gradColor1, gradColor2]}
          type={gradType}
        />
      </meshBasicMaterial>

      {Array.from({ length: range }).map((_, i) => (
        <Instance
          key={i}
          scale={gsap.utils.clamp(0.01, 1, Math.pow(1 - scaleFactor, i))}
          position={calcPosition(i)}
          rotation={[0, 0, (360 * rotationFactor * (i + 1)) / 180]}
          // @ts-expect-error
          opacity={gsap.utils.clamp(0.02, 1, Math.exp(-i * (1 - alphaFactor)))}
        />
      ))}
    </Instances>
  )

  const mx = mirrorX === 0.001 ? 0 : mirrorX
  const my = mirrorY === 0.001 ? 0 : mirrorY

  return (
    <group
      position={[position.x, position.y, 0]}
      scale={[scale, scale, 1]}
      rotation={[0, 0, rotation]}>
      {debug ? (
        <mesh
          position={[position.x, position.y, 0]}
          scale={[scale, scale, 1]}
          rotation={[0, 0, rotation]}>
          {objFile ? (
            <Suspense>
              <CustomGeometry url={objFile!} />
            </Suspense>
          ) : (
            <ringGeometry
              args={[
                radius,
                1,
                thetaSegments,
                phiSegments,
                thetaStart,
                thetaEnd
              ]}
            />
          )}

          <meshBasicMaterial transparent>
            <GradientTexture
              stops={gradStops}
              colors={[gradColor1, gradColor2]}
              type={gradType}
            />
          </meshBasicMaterial>
        </mesh>
      ) : (
        <>
          <Inner position={[mx, 0, 0]} />

          {mirrorX !== 0.0 && (
            <Inner position={[-mx, 0, 0]} scale={[-1, 1, 1]} />
          )}

          {mirrorY !== 0.0 && (
            <Inner position={[mx, -my, 0]} scale={[1, -1, 1]} />
          )}

          {mirrorX !== 0.0 && mirrorY !== 0.0 && (
            <Inner position={[-mx, -my, 0]} scale={[-1, -1, 1]} />
          )}
        </>
      )}
    </group>
  )
}

export default function Scene() {
  return (
    <Canvas
      orthographic
      style={{ width: '100svw', height: '100svh' }}
      gl={{
        antialias: true,
        alpha: true,
        stencil: false,
        depth: false,
        powerPreference: 'high-performance'
      }}>
      <Suspense>
        <Inner />
        <Controls />

        <EffectComposer multisampling={0}>
          <SMAA />

          <Bloom
            intensity={0.2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.01}
            mipmapBlur={false}
          />
        </EffectComposer>
      </Suspense>

      <Stats />
    </Canvas>
  )
}
