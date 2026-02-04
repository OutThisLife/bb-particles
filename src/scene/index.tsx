'use client'

import useLinkableControls from '@/hooks/useLinkableControls'
import { useSmoothControls } from '@/hooks/useSmoothControls'
import { $layers, $object } from '@/store'
import {
  calcAlpha,
  calcPosition,
  calcRotation,
  calcScale,
  obcChain,
  obcGradient,
  obcInstanced
} from '@/utils'
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
import { button, folder, levaStore, useControls } from 'leva'
import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import Controls from './Controls'
import { Geo, SHAPES } from './Shapes'

const ORIGINS = [
  'center',
  'top-center',
  'bottom-center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

function SyncedTransform({
  levaKey,
  enabled,
  position = [0, 0, 0],
  children
}: {
  levaKey: string
  enabled: boolean
  position?: [number, number, number]
  children: React.ReactNode
}) {
  const ref = useRef<THREE.Group>(null!)

  useEffect(() => {
    const sync = () =>
      ref.current &&
      levaStore.set(
        { [levaKey]: { x: ref.current.position.x, y: ref.current.position.y } },
        false
      )

    window.addEventListener('pointerup', sync)
    return () => window.removeEventListener('pointerup', sync)
  }, [levaKey])

  return (
    <>
      <group ref={ref} position={position}>
        {children}
      </group>
      {enabled && <TransformControls object={ref} showZ={false} />}
    </>
  )
}

interface LayerProps extends InstancesProps {
  scalars?: Record<string, any>
  layerColor?: string
  layerGeometry?: string
}

function Inner() {
  const gltf = useStore($object)
  const layers = useStore($layers)

  const { color, geometry } = useSmoothControls(
    'Element',
    {
      geometry: { label: 'Shape', options: [...SHAPES], value: 'ring' },
      color: { label: 'Color', value: '#FFFDDD' }
    },
    { duration: 0.01 }
  )

  const { repetitions, ...scalars } = useSmoothControls('Scalars', {
    repetitions: { value: 65, min: 1, max: 500, step: 1 },
    alphaFactor: { value: 0.65, min: 0, max: 1, step: 0.01 },
    scaleFactor: { value: 1.05, min: 0, max: 2, step: 0.01 },
    rotationFactor: { value: 0, min: -1, max: 1, step: 0.01 },
    stepFactor: { value: 0.02, min: 0, max: 2, step: 0.01 },
    scaleProgression: {
      options: [
        'linear',
        'exponential',
        'additive',
        'fibonacci',
        'golden',
        'sine'
      ],
      value: 'exponential'
    },
    rotationProgression: {
      options: ['linear', 'golden-angle', 'fibonacci', 'sine'],
      value: 'linear'
    },
    alphaProgression: {
      options: ['exponential', 'linear', 'inverse'],
      value: 'exponential'
    },
    positionProgression: { options: ['index', 'scale'], value: 'index' },
    positionCoupled: { value: true }
  })

  const { xStep, yStep, origin } = useSmoothControls('Spatial', {
    origin: { label: 'Origin', options: ORIGINS, value: 'top-center' },
    xStep: { label: 'X Step', value: -1.5, min: -2, max: 2, step: 0.01 },
    yStep: { label: 'Y Step', value: 0, min: -2, max: 2, step: 0.01 }
  })

  const { debug, transform, position, scale, rotation } = useSmoothControls(
    'Scene',
    {
      debug: { value: false },
      transform: { value: false },
      position: { value: { x: 0, y: -0.5 }, min: -2, max: 2, step: 0.01 },
      rotation: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
      scale: { value: 0.85, min: 0, max: 2, step: 0.01 }
    },
    { collapsed: true, duration: 0.01 }
  )

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
                [`g${i}-color`]: {
                  label: 'color',
                  value: '#FFFDDD',
                  optional: true,
                  disabled: true
                },
                [`g${i}-geometry`]: {
                  label: 'Shape',
                  options: [...SHAPES],
                  value: 'ring',
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

  const sceneLayers = useMemo(
    () =>
      Object.entries(reflections as Record<string, any>)
        .filter(([k, v]) => /g\d+/.test(k) && v !== undefined)
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

  const colorVec = useMemo(() => new THREE.Color(color), [color])

  const Layer = ({
    range = repetitions,
    scalars: s = {},
    layerColor,
    layerGeometry,
    ...props
  }: LayerProps) => {
    const c = useMemo(() => new THREE.Color(layerColor ?? color), [layerColor])
    const sf = s.scaleFactor ?? scalars.scaleFactor ?? 1
    const rf = s.rotationFactor ?? scalars.rotationFactor ?? 0
    const af = s.alphaFactor ?? scalars.alphaFactor ?? 1
    const stf = s.stepFactor ?? scalars.stepFactor ?? 1
    const sp = s.scaleProgression ?? scalars.scaleProgression ?? 'exponential'
    const rp = s.rotationProgression ?? scalars.rotationProgression ?? 'linear'
    const ap = s.alphaProgression ?? scalars.alphaProgression ?? 'exponential'
    const pp = s.positionProgression ?? scalars.positionProgression ?? 'index'
    const coupled = s.positionCoupled ?? scalars.positionCoupled ?? true
    const geo = layerGeometry ?? geometry

    return (
      <Instances {...props}>
        <InstancedAttribute name="opacity" defaultValue={1} />
        <InstancedAttribute name="iColor" defaultValue={[1, 1, 1]} />

        <Geo shape={geo} gltf={gltf} />

        <meshBasicMaterial
          color={colorVec}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          onBeforeCompile={obcChain(obcInstanced, obcGradient)}
        />

        {Array.from({ length: range }, (_, i) => {
          const sc = calcScale(i, sf, sp)
          return (
            <Instance
              key={i}
              scale={sc}
              position={calcPosition(
                i,
                sc,
                xStep,
                yStep,
                stf,
                origin,
                pp,
                coupled,
                !!gltf
              )}
              rotation={[0, 0, (calcRotation(i, rf, rp) * Math.PI) / 180]}
              // @ts-expect-error custom attr
              opacity={calcAlpha(i, range, af, ap)}
              iColor={c.toArray()}
            />
          )
        })}
      </Instances>
    )
  }

  useEffect(() => void $object.set(undefined), [geometry])

  return (
    <group scale={scale} rotation={[0, 0, rotation]}>
      {debug ? (
        <mesh position={[position.x, position.y, 0]}>
          <Geo shape={geometry} gltf={gltf} />
          <meshBasicMaterial />
        </mesh>
      ) : (
        <>
          <SyncedTransform
            levaKey="Scene.position"
            enabled={transform}
            position={[position.x, position.y, 0]}>
            <Layer scalars={scalars} />
          </SyncedTransform>

          {sceneLayers.map((layer, n) => (
            <SyncedTransform
              key={n}
              levaKey={`Groups.g${n}.g${n}-position`}
              enabled={transform || layer.transform}
              position={[layer?.position?.x ?? 0, layer?.position?.y ?? 0, 0]}>
              <Layer
                rotation={[0, 0, layer?.rotation ?? 0]}
                scale={[layer?.scale?.x ?? 1, layer?.scale?.y ?? 1, 1]}
                scalars={layer}
                layerColor={layer?.color}
                layerGeometry={layer?.geometry}
              />
            </SyncedTransform>
          ))}
        </>
      )}
    </group>
  )
}

export default function Scene({ headless }: { headless?: boolean }) {
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
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      }}>
      <Suspense fallback={<Loader />}>
        <Inner />
      </Suspense>

      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>

      <Controls />
      {!headless && <Stats />}
    </Canvas>
  )
}
