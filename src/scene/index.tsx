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
  Stats,
  TransformControls
} from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import gsap from 'gsap'
import { button } from 'leva'
import { startTransition, Suspense, useEffect } from 'react'
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
  const { gl, scene, camera, size } = useThree()
  const gltf = useStore($object)

  const {
    debug,
    transform,
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
        value: 'ring'
      },
      debug: { value: false },
      transform: { value: false },
      position: { value: { x: 0, y: -0.5 }, min: -2, max: 2, step: 0.01 },
      scale: { value: 0.85, min: 0, max: 2, step: 0.01 },
      rotation: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 }
    },
    { duration: 0.01, onReset: () => !!$object.get() && $object.set(undefined) }
  )

  const { repetitions, scaleFactor, rotationFactor, alphaFactor } =
    useSmoothControls('Scalars', {
      repetitions: { value: 65, min: 1, max: 500, step: 1 },
      alphaFactor: { value: 0.33, min: 0, max: 1, step: 0.01 },
      scaleFactor: { value: 1.05, min: 0, max: 2, step: 0.01 },
      rotationFactor: { value: 0, min: -1, max: 1, step: 0.01 }
    })

  const { mirrorX, mirrorY } = useSmoothControls('Reflection', {
    mirrorX: { value: 0.85, min: -2, max: 2, step: 0.01 },
    mirrorY: { value: -1.22, min: -2, max: 2, step: 0.01 }
  })

  const { xStep, yStep, origin, stepFactor } = useSmoothControls('Spatial', {
    origin: { options: originOptions, value: 'top-center' },
    xStep: { value: -0.55, min: -2, max: 2, step: 0.01 },
    yStep: { value: -0.8, min: -2, max: 2, step: 0.01 },
    stepFactor: { value: 0.13, min: 0, max: 2, step: 0.01 }
  })

  const mx = mirrorX === 0.001 ? 0 : mirrorX
  const my = mirrorY === 0.001 ? 0 : mirrorY

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
      <InstancedAttribute name="opacity" defaultValue={1} />

      {geometry}

      <meshBasicMaterial
        depthTest={false}
        depthWrite={false}
        onBeforeCompile={obcChain(obcAlpha, obcGradient)}
        blending={THREE.AdditiveBlending}
        // blending={THREE.CustomBlending}
        //   blendSrc={THREE.OneFactor}
        //   blendDst={THREE.OneMinusSrcAlphaFactor}
        //   blendEquation={THREE.AddEquation}
      />

      {Array.from({ length: range }).map((_, i) => (
        <Instance
          key={`instance-${i}`}
          scale={gsap.utils.clamp(0, 4, Math.exp(-(i + 1) * (1 - scaleFactor)))}
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

            return new THREE.Vector3(x, y, 0).multiplyScalar(stepFactor)
          })()}
          rotation={new THREE.Euler().setFromVector3(
            new THREE.Vector3(
              0,
              0,
              (360 * rotationFactor * (i + 1)) / 180
            ).multiplyScalar(i % 2 ? 1 : -1)
          )}
          // @ts-expect-error
          opacity={gsap.utils.clamp(0.001, 1, Math.exp(-i * alphaFactor))}
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
            position={[mx, 0, 0]}>
            <Inner />
          </TransformControls>

          {mirrorX !== 0.0 && (
            <TransformControls
              enabled={transform}
              position={[-mx, 0, 0]}
              showX={transform}
              showY={transform}
              showZ={false}>
              <Inner scale={[-1, 1, 1]} />
            </TransformControls>
          )}

          {mirrorY !== 0.0 && (
            <TransformControls
              enabled={transform}
              position={[mx, -my, 0]}
              showX={transform}
              showY={transform}
              showZ={false}>
              <Inner scale={[1, -1, 1]} />
            </TransformControls>
          )}

          {mirrorX !== 0.0 && mirrorY !== 0.0 && (
            <TransformControls
              enabled={transform}
              position={[-mx, -my, 0]}
              showX={transform}
              showY={transform}
              showZ={false}>
              <Inner scale={[-1, -1, 1]} />
            </TransformControls>
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
