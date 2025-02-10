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
import { obcAlpha, obcChain, obcGradient } from '@/utils'
import { upload } from '@/utils/upload'
import { useStore } from '@nanostores/react'
import {
  Instance,
  InstancedAttribute,
  Instances,
  InstancesProps,
  Loader,
  Stats
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import gsap from 'gsap'
import { button } from 'leva'
import { startTransition, Suspense, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import Controls from './Controls'
import * as Shapes from './Shapes'

const originOptions = [
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

function Inner() {
  const gltf = useStore($object)

  const {
    debug,
    position,
    scale,
    rotation,
    geometry: initGeometry
  } = useSmoothControls(
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
      geometry: {
        options: ['ring', 'bar', 'arch', 'disc'],
        value: 'disc'
      },
      debug: { value: false },
      position: { value: { x: 0, y: 0 }, min: -2, max: 2, step: 0.01 },
      scale: { value: 1, min: 0, max: 2, step: 0.01 },
      rotation: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 }
    },
    { duration: 0.01, onReset: () => !!$object.get() && $object.set(undefined) }
  )

  const { repetitions, scaleFactor, rotationFactor, alphaFactor } =
    useSmoothControls('Scalars', {
      repetitions: { value: 50, min: 1, max: 500, step: 1 },
      alphaFactor: { value: 0.5, min: 0, max: 1, step: 0.01 },
      scaleFactor: { value: 0.52, min: 0, max: 4, step: 0.01 },
      rotationFactor: { value: -0.08, min: -1, max: 1, step: 0.01 }
    })

  const { mirrorX, mirrorY } = useSmoothControls('Reflection', {
    mirrorX: { value: 0.01, min: -2, max: 2, step: 0.01 },
    mirrorY: { value: 0.01, min: -2, max: 2, step: 0.01 }
  })

  const { xStep, yStep, origin, stepFactor } = useSmoothControls('Spatial', {
    origin: { options: originOptions, value: 'center' },
    xStep: { value: 0.54, min: -2, max: 2, step: 0.01 },
    yStep: { value: 0.39, min: -2, max: 2, step: 0.01 },
    stepFactor: { value: 0.16, min: 0, max: 2, step: 0.01 }
  })

  const mx = mirrorX === 0.001 ? 0 : mirrorX
  const my = mirrorY === 0.001 ? 0 : mirrorY

  const calcPosition = useCallback(
    (i: number) => {
      const xs = xStep * (gltf ? 40 : 1)
      const ys = yStep * (gltf ? 40 : 1)

      const f = !(i % 2) ? -1 : 1
      let x = i * xs * f
      let y = i * ys * f

      switch (origin) {
        case 'top-left':
          x = -1 + i * xs
          y = 1 - i * ys
          break

        case 'top-right':
          x = 1 - i * xs
          y = 1 - i * ys
          break

        case 'bottom-left':
          x = -1 + i * xs
          y = -1 + i * ys
          break

        case 'bottom-right':
          x = 1 - i * xs
          y = -1 + i * ys
          break
      }

      return new THREE.Vector3(x, y, 0).multiplyScalar(stepFactor / 10)
    },
    [gltf, origin, xStep, yStep, stepFactor]
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

  const Inner = ({ range = repetitions, ...args }: InstancesProps) => (
    <Instances {...args}>
      <InstancedAttribute name="opacity" defaultValue={0.02} />

      {geometry}

      <meshBasicMaterial
        transparent
        alphaToCoverage
        depthTest={false}
        onBeforeCompile={obcChain(obcAlpha, obcGradient)}
        blending={THREE.AdditiveBlending}
      />

      {Array.from({ length: range }).map((_, i) => (
        <Instance
          key={`instance-${i}`}
          scale={gsap.utils.clamp(
            0,
            1,
            Math.pow(1 - i / (range - 1), 1 / scaleFactor)
          )}
          position={calcPosition(i)}
          rotation={[0, 0, (360 * rotationFactor * (i + 1)) / 180]}
          // @ts-expect-error
          opacity={gsap.utils.clamp(0.001, 1, Math.exp(-i * (1 - alphaFactor)))}
        />
      ))}
    </Instances>
  )

  useEffect(() => void $object.set(undefined), [initGeometry])

  return (
    <group
      key={Math.random()}
      position={[position.x, position.y, 0]}
      scale={[scale, scale, 1]}
      rotation={[0, 0, rotation]}>
      {debug ? (
        <mesh>
          {geometry}
          <meshBasicMaterial transparent onBeforeCompile={obcGradient} />
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
