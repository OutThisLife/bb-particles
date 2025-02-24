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
import { button, folder, useControls } from 'leva'
import { startTransition, Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import Controls from './Controls'
import * as Shapes from './Shapes'

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
        options: ['ring', 'bar', 'arch', 'disc'],
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
    stepFactor: { value: 0.13, min: 0, max: 2, step: 0.01 }
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
      value: -0.55,
      min: -2,
      max: 2,
      step: 0.01
    },
    yStep: {
      label: 'Y Step',
      value: -0.8,
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
    </>
  )

  const Layer = ({
    range = repetitions,
    scalars: { stepFactor, scaleFactor, rotationFactor, alphaFactor } = {},
    ...args
  }: LayerProps) => (
    <Instances {...args}>
      <InstancedAttribute name="opacity" defaultValue={0.01} />
      {geometry}

      <meshBasicMaterial
        transparent
        depthTest={false}
        depthWrite={false}
        onBeforeCompile={obcChain(obcAlpha, obcGradient)}
        blending={blend ? THREE.AdditiveBlending : THREE.NormalBlending}
      />

      {Array.from({ length: range }).map((_, i) => (
        <Instance
          key={`instance-${i}`}
          scale={gsap.utils.clamp(
            0,
            4,
            Math.exp(-(i + 1) * (1 - (scaleFactor ?? scalars.scaleFactor ?? 1)))
          )}
          position={(() => {
            const xs = xStep * (gltf ? 15 : 1)
            const ys = yStep * (gltf ? 15 : 1)

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
            new THREE.Vector3(
              0,
              0,
              (360 *
                (rotationFactor ?? scalars?.rotationFactor ?? 1) *
                (i + 1)) /
                180
            )
          )}
          // @ts-expect-error
          opacity={gsap.utils.clamp(
            0,
            1,
            Math.exp(-i * (1 - (alphaFactor ?? scalars?.alphaFactor ?? 1)))
          )}
        />
      ))}
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

          <meshBasicMaterial
            transparent
            alphaToCoverage
            onBeforeCompile={obcGradient}
          />
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
  }
}
