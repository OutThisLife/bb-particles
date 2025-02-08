'use client'

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
import { useSmoothControls } from '@/hooks/useSmoothControls'
import { $object } from '@/store'
import { obcAlpha } from '@/utils'
import { upload } from '@/utils/upload'
import { useStore } from '@nanostores/react'
import {
  GradientTexture,
  GradientType,
  Instance,
  InstancedAttribute,
  Instances,
  InstancesProps,
  Stats
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import gsap from 'gsap'
import { button } from 'leva'
import { lazy, startTransition, Suspense, useCallback } from 'react'
import * as THREE from 'three'

const Controls = lazy(() => import('./Controls'))

const originOptions = [
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

function Inner() {
  const gltf = useStore($object)

  const { debug, position, scale, rotation } = useSmoothControls(
    'Scene',
    {
      'upload (gltf, glb)': button(() => {
        const $input = document.createElement('input')
        $input.type = 'file'
        $input.accept = '.gltf,.glb'
        $input.style.display = 'none'

        $input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0]

          if (file) {
            startTransition(() => upload(file))
          }
        }

        document.body.appendChild($input)
        $input.click()
        $input.parentElement?.removeChild($input)
      }),
      debug: { value: false },
      position: { value: { x: 0, y: 0 }, min: -2, max: 2, step: 0.01 },
      scale: { value: 1, min: 0, max: 2, step: 0.01 },
      rotation: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 }
    },
    { duration: 0.01, onReset: () => $object.set(undefined) }
  )

  const { repetitions, scaleFactor, rotationFactor, alphaFactor } =
    useSmoothControls('Scalars', {
      repetitions: { value: 50, min: 1, max: 500, step: 1 },
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

  const { thetaSegments, phiSegments, thetaStart, thetaEnd, radius } =
    useSmoothControls(
      'Geometry',
      {
        radius: { value: 0.94, min: 0.1, max: 0.99, step: 0.01 },
        thetaSegments: { value: 100, min: 1, max: 100, step: 1 },
        phiSegments: { value: 1, min: 1, max: 100, step: 1 },
        thetaStart: { value: 0, min: 0, max: Math.PI * 2, step: 0.01 },
        thetaEnd: {
          value: Math.PI * 2,
          min: 0,
          max: Math.PI * 2,
          step: 0.01
        }
      },
      {
        collapsed: true,
        render: () => !gltf,
        onReset: () => $object.set(undefined)
      },
      [gltf]
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

  const mx = mirrorX === 0.001 ? 0 : mirrorX
  const my = mirrorY === 0.001 ? 0 : mirrorY

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

  const geometry = gltf ? (
    gltf.map(i => <bufferGeometry key={i.uuid} {...i} />)
  ) : (
    <ringGeometry
      args={[radius, 1, thetaSegments, phiSegments, thetaStart, thetaEnd]}
    />
  )

  const Inner = ({ range = repetitions, ...args }: InstancesProps) => (
    <Instances {...args}>
      <InstancedAttribute name="opacity" defaultValue={0.02} />

      {geometry}

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
          key={`instance-${i}`}
          scale={gsap.utils.clamp(0.01, 1, Math.pow(1 - scaleFactor, i))}
          position={calcPosition(i)}
          rotation={[0, 0, (360 * rotationFactor * (i + 1)) / 180]}
          // @ts-expect-error
          opacity={gsap.utils.clamp(0.04, 1, Math.exp(-i * (1 - alphaFactor)))}
        />
      ))}
    </Instances>
  )

  return (
    <group
      position={[position.x, position.y, 0]}
      scale={[scale, scale, 1]}
      rotation={[0, 0, rotation]}>
      {debug ? (
        <mesh>
          {geometry}

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
        </EffectComposer>
      </Suspense>

      <Stats />
    </Canvas>
  )
}
