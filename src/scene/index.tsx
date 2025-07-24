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
import useLinkableControls from '@/hooks/useLinkableControls'
import { useSmoothControls } from '@/hooks/useSmoothControls'
import { presets, type PresetName } from '@/presets'
import { $layers, $object } from '@/store'
import { obcAlpha, obcChain, obcGradient } from '@/utils'
import { upload } from '@/utils/upload'
import { useStore } from '@nanostores/react'
import {
  Instance,
  InstancedAttribute,
  Instances,
  InstancesProps,
  Loader,
  Stats,
  TransformControls
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import gsap from 'gsap'
import { button, folder, levaStore, useControls } from 'leva'
import { startTransition, Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'

import Controls from './Controls'
import * as Shapes from './Shapes'
import fragmentShader from './frag.fs'

const originOptions = [
  'center',
  'top-center',
  'bottom-center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

function Inner() {
  const gltf = useStore($object)
  const layers = useStore($layers)

  const { preset } = useControls('Presets', {
    preset: {
      options: ['None', ...Object.keys(presets)],
      value: 'None'
    }
  })

  useEffect(() => {
    if (preset !== 'None') {
      const config = presets[preset as PresetName]
      Object.entries(config).forEach(([key, val]) => {
        levaStore.setValueAtPath(key, val, false)
      })
    }
  }, [preset])

  const { blend, geometry: initGeometry } = useSmoothControls(
    'Element',
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
      geometry: {
        label: 'Primitive',
        options: ['ring', 'bar', 'arch', 'disc', 'q'],
        value: 'ring'
      },
      blend: { value: false }
    },
    { duration: 0.01, onReset: () => !!$object.get() && $object.set(undefined) }
  )

  const { repetitions, ...scalars } = useSmoothControls('Scalars', {
    repetitions: { value: 65, min: 1, max: 500, step: 1 },
    alphaFactor: { value: 0.65, min: 0, max: 1, step: 0.01 },
    scaleFactor: { value: 1.05, min: 0, max: 2, step: 0.01 },
    rotationFactor: { value: 0, min: -1, max: 1, step: 0.01 },
    stepFactor: { value: 0.02, min: 0, max: 2, step: 0.01 },
    scaleProgression: {
      options: ['linear', 'exponential', 'fibonacci', 'golden', 'sine'],
      value: 'exponential'
    },
    rotationProgression: {
      options: ['linear', 'golden-angle', 'fibonacci', 'sine'],
      value: 'linear'
    }
  })

  const [reflections] = useControls(
    'Groups',
    () => ({
      'add layer': button(() => $layers.set($layers.get() + 1)),
      ...Object.fromEntries(
        Array.from({ length: layers }).flatMap((_, i) => [
          [
            `g${i}`,
            folder(
              {
                [`g${i}-transform`]: { label: 'Transform', value: false },
                [`g${i}-position`]: {
                  label: 'Position',
                  value: { x: 0, y: 0 },
                  min: -2,
                  max: 2,
                  step: 0.01
                },
                [`g${i}-rotation`]: {
                  label: 'Rotation',
                  value: 0,
                  min: -Math.PI,
                  max: Math.PI,
                  step: 0.01
                },
                [`g${i}-scale`]: {
                  label: 'Scale',
                  value: { x: -1, y: 1 },
                  min: -2,
                  max: 2,
                  step: 0.01
                },
                [`g${i}-stepFactor`]: {
                  label: 'stepFactor',
                  value: 0.13,
                  min: 0,
                  max: 2,
                  step: 0.01,
                  optional: true,
                  disabled: true
                },
                [`g${i}-alphaFactor`]: {
                  label: 'alphaFactor',
                  value: 0.65,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  optional: true,
                  disabled: true
                },
                [`g${i}-scaleFactor`]: {
                  label: 'scaleFactor',
                  value: 1.05,
                  min: 0,
                  max: 2,
                  step: 0.01,
                  optional: true,
                  disabled: true
                },
                [`g${i}-rotationFactor`]: {
                  label: 'rotationFactor',
                  value: 0,
                  min: -1,
                  max: 1,
                  step: 0.01,
                  optional: true,
                  disabled: true
                },
                [`remove-g${i}`]: button(() => $layers.set($layers.get() - 1))
              },
              { collapsed: true }
            )
          ]
        ])
      )
    }),
    [layers]
  )

  const { xStep, yStep, origin } = useSmoothControls('Spatial', {
    origin: {
      label: 'Origin',
      options: originOptions,
      value: 'top-center'
    },
    xStep: {
      label: 'X Step',
      value: -1.5,
      min: -2,
      max: 2,
      step: 0.01
    },
    yStep: {
      label: 'Y Step',
      value: 0,
      min: -2,
      max: 2,
      step: 0.01
    }
  })

  const { debug, transform, position, scale, rotation } = useSmoothControls(
    'Scene',
    {
      debug: { label: 'Debug', value: false },
      transform: { label: 'Transform', value: false },
      position: {
        label: 'Position',
        value: { x: 0, y: -0.5 },
        min: -2,
        max: 2,
        step: 0.01
      },
      rotation: {
        label: 'Rotation',
        value: 0,
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      scale: {
        label: 'Scale',
        value: 0.85,
        min: 0,
        max: 2,
        step: 0.01
      }
    },
    { collapsed: true, duration: 0.01 }
  )

  const sceneLayers = useMemo(
    () =>
      Object.entries(reflections as Record<string, any>)
        .filter(([k, v]) => /g\d+/.test(k) && typeof v !== 'undefined')
        .reduce(
          (acc, [k, v]) => {
            const [k0, k1] = k.split('-')
            const idx = +k0.replace('g', '')

            acc[idx] = { ...acc[idx], [k1]: v }

            return acc
          },
          [] as Record<string, any>[]
        ),
    [reflections]
  )

  const geometry = gltf ? (
    gltf.map(i => <bufferGeometry key={i.uuid} {...i} />)
  ) : (
    <>
      {initGeometry === 'ring' && <Shapes.Ring />}
      {initGeometry === 'disc' && <Shapes.Disc />}
      {initGeometry === 'bar' && <Shapes.Bar />}
      {initGeometry === 'arch' && <Shapes.Arch />}
      {initGeometry === 'q' && <Shapes.Q />}
    </>
  )

  const material = (
    <meshBasicMaterial
      color="#FFFDDD"
      transparent
      depthTest={false}
      depthWrite={false}
      onBeforeCompile={obcChain(obcAlpha, obcGradient)}
      blending={blend ? THREE.AdditiveBlending : THREE.NormalBlending}
      {...{ fragmentShader }}
    />
  )

  const Layer = ({
    range = repetitions,
    scalars: {
      stepFactor,
      scaleFactor,
      rotationFactor,
      alphaFactor,
      scaleProgression,
      rotationProgression
    } = {},
    ...args
  }: LayerProps) => (
    <Instances {...args}>
      <InstancedAttribute name="opacity" defaultValue={0.01} />
      {geometry}
      {material}

      {Array.from({ length: range }).map((_, i) => {
        const getScaleValue = (i: number) => {
          const factor = scaleFactor ?? scalars.scaleFactor ?? 1
          const progression =
            scaleProgression ?? scalars.scaleProgression ?? 'exponential'

          switch (progression) {
            case 'linear':
              return Math.max(0.01, 1 - i * 0.02)
            case 'fibonacci': {
              const phi = 1.618
              const fibRatio = Math.abs(Math.sin(i * phi * 0.1))
              return Math.pow(factor, i * fibRatio)
            }
            case 'golden':
              return Math.pow(factor, i * (2 - 1.618))
            case 'sine':
              return Math.pow(
                factor,
                i * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.2)))
              )
            default: // exponential
              return Math.pow(factor, i)
          }
        }

        const getRotationValue = (i: number) => {
          const factor = rotationFactor ?? scalars.rotationFactor ?? 0
          const progression =
            rotationProgression ?? scalars.rotationProgression ?? 'linear'

          switch (progression) {
            case 'golden-angle':
              return 137.5 * factor * i // Golden angle in degrees
            case 'fibonacci':
              const fib = (n: number): number =>
                n <= 1 ? n : fib(n - 1) + fib(n - 2)
              return fib(i % 12) * factor * 15
            case 'sine':
              return Math.sin(i * 0.2) * factor * 180
            default: // linear
              return 360 * factor * (i + 1)
          }
        }

        const s = getScaleValue(i)

        return (
          <Instance
            key={`instance-${i}`}
            scale={s}
            position={(() => {
              let xs = xStep * (gltf ? 15 : 1)
              let ys = yStep * (gltf ? 15 : 1)

              xs *= s * 1.5
              ys *= s * 1.5

              let x = i * xs
              let y = i * ys

              if (/top/i.test(origin)) {
                y = 1 - y
              } else if (/bottom/i.test(origin)) {
                y = -1 + y
              }

              if (/left/i.test(origin)) {
                x = -1 + x
              } else if (/right/i.test(origin)) {
                x = 1 - x
              }

              return new THREE.Vector3(x, y, 0).multiplyScalar(
                stepFactor ?? scalars?.stepFactor ?? 1
              )
            })()}
            rotation={new THREE.Euler().setFromVector3(
              new THREE.Vector3(0, 0, (getRotationValue(i) / 180) * Math.PI)
            )}
            // @ts-expect-error
            opacity={Math.max(
              0.02,
              Math.exp(
                -i * (1 - (alphaFactor ?? scalars?.alphaFactor ?? 1)) * 0.3
              )
            )}
          />
        )
      })}
    </Instances>
  )

  useEffect(() => void $object.set(undefined), [initGeometry])

  return (
    <group
      position={[position.x, position.y, 0]}
      scale={[scale, scale, 1]}
      rotation={[0, 0, rotation]}>
      {debug ? (
        <mesh>
          {geometry}

          <meshBasicMaterial />
        </mesh>
      ) : (
        <>
          <TransformControls
            enabled={transform}
            showX={transform}
            showY={transform}
            showZ={false}
            position={[0, 0, 0]}>
            <Layer {...{ scalars }} />
          </TransformControls>

          {sceneLayers.map((i, n) => (
            <TransformControls
              key={`g${n}`}
              enabled={transform || i.transform}
              showX={transform || i.transform}
              showY={transform || i.transform}
              showZ={false}
              position={[i?.position?.x ?? 0, i?.position?.y ?? 0, 0]}>
              <Layer
                rotation={[0, 0, i?.rotation ?? 0]}
                scale={[i?.scale?.x ?? 1, i?.scale?.y ?? 1, 1]}
                scalars={i}
              />
            </TransformControls>
          ))}
        </>
      )}
    </group>
  )
}

export default function Scene() {
  useLinkableControls()

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
      <Suspense fallback={<Loader />}>
        <Inner />
      </Suspense>

      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>

      <Controls />
      <Stats />
    </Canvas>
  )
}

interface LayerProps extends InstancesProps {
  scalars?: {
    stepFactor?: number
    scaleFactor?: number
    rotationFactor?: number
    alphaFactor?: number
    scaleProgression?: string
    rotationProgression?: string
  }
}
