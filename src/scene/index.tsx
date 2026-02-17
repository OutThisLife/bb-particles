'use client'

import { useStore } from '@nanostores/react'
import type { InstancesProps } from '@react-three/drei'
import {
  Instance,
  InstancedAttribute,
  Instances,
  Loader,
  Stats,
  TransformControls
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { button, folder, levaStore, useControls } from 'leva'
import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import useLinkableControls, {
  initDisabled,
  initVal
} from '@/hooks/useLinkableControls'
import { useSmoothControls } from '@/hooks/useSmoothControls'
import { $layers, $object } from '@/store'
import {
  calcAlpha,
  calcPosition,
  calcRotation,
  calcScale,
  gradientAngleUniform,
  obcChain,
  obcGradient,
  obcInstanced
} from '@/utils'

import { Controls } from './Controls'
import Effects from './Effects'
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
  children,
  enabled,
  levaKey,
  position = [0, 0, 0]
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
      <group position={position} ref={ref}>
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
  layerGeoWidth?: number
}

function Inner() {
  const gltf = useStore($object)
  const layers = useStore($layers)

  const { color, geometry, geoWidth, gradientAngle } = useSmoothControls(
    'Element',
    {
      color: { label: 'Color', value: '#efeddb' },
      geometry: { label: 'Shape', options: [...SHAPES], value: 'ring' },
      geoWidth: {
        label: 'Width',
        max: 0.1,
        min: 0.001,
        step: 0.001,
        value: 0.041
      },
      gradientAngle: {
        label: 'Gradient',
        max: Math.PI,
        min: -Math.PI,
        step: 0.01,
        value: 0
      }
    },
    { duration: 0.01 }
  )

  gradientAngleUniform.value = gradientAngle

  const { repetitions, ...scalars } = useSmoothControls('Scalars', {
    alphaFactor: { max: 1, min: 0, step: 0.01, value: 0.68 },
    alphaProgression: {
      options: ['exponential', 'linear', 'inverse'],
      value: 'exponential'
    },
    positionCoupled: { value: true },
    positionProgression: { options: ['index', 'scale'], value: 'index' },
    repetitions: { max: 500, min: 1, step: 1, value: 75 },
    rotationFactor: { max: 1, min: -1, step: 0.01, value: -0.48 },
    rotationProgression: {
      options: ['linear', 'golden-angle', 'fibonacci', 'sine'],
      value: 'linear'
    },
    scaleFactor: { max: 2, min: 0, step: 0.01, value: 1.03 },
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
    stepFactor: { max: 2, min: 0, step: 0.01, value: 0.02 }
  })

  const { origin, xStep, yStep } = useSmoothControls('Spatial', {
    origin: { label: 'Origin', options: ORIGINS, value: 'top-center' },
    xStep: { label: 'X Step', max: 2, min: -2, step: 0.01, value: -1.5 },
    yStep: { label: 'Y Step', max: 2, min: -2, step: 0.01, value: 0 }
  })

  const { debug, position, rotation, scale, transform } = useSmoothControls(
    'Scene',
    {
      debug: { value: false },
      position: { max: 2, min: -2, step: 0.01, value: { x: 0, y: -0.5 } },
      rotation: { max: Math.PI, min: -Math.PI, step: 0.01, value: 0 },
      scale: { max: 2, min: 0, step: 0.01, value: 0.4 },
      transform: { value: false }
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
                [`g${i}-alphaFactor`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-alphaFactor`),
                  label: 'alphaFactor',
                  max: 1,
                  min: 0,
                  optional: true,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-alphaFactor`, 0.65)
                },
                [`g${i}-color`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-color`),
                  label: 'color',
                  optional: true,
                  value: initVal(`Groups.g${i}.g${i}-color`, '#FFFDDD')
                },
                [`g${i}-geometry`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-geometry`),
                  label: 'Shape',
                  optional: true,
                  options: [...SHAPES],
                  value: initVal(`Groups.g${i}.g${i}-geometry`, 'ring')
                },
                [`g${i}-geoWidth`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-geoWidth`),
                  label: 'Width',
                  max: 0.1,
                  min: 0.001,
                  optional: true,
                  step: 0.001,
                  value: initVal(`Groups.g${i}.g${i}-geoWidth`, 0.041)
                },
                [`g${i}-position`]: {
                  label: 'Position',
                  max: 2,
                  min: -2,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-position`, {
                    x: -0.003,
                    y: -0.462
                  })
                },
                [`g${i}-rotation`]: {
                  label: 'Rotation',
                  max: Math.PI,
                  min: -Math.PI,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-rotation`, 0)
                },
                [`g${i}-rotationFactor`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-rotationFactor`),
                  label: 'rotationFactor',
                  max: 1,
                  min: -1,
                  optional: true,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-rotationFactor`, 0)
                },
                [`g${i}-scale`]: {
                  label: 'Scale',
                  max: 2,
                  min: -2,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-scale`, { x: -1, y: 1 })
                },
                [`g${i}-scaleFactor`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-scaleFactor`),
                  label: 'scaleFactor',
                  max: 2,
                  min: 0,
                  optional: true,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-scaleFactor`, 1.05)
                },
                [`g${i}-stepFactor`]: {
                  disabled: initDisabled(`Groups.g${i}.g${i}-stepFactor`),
                  label: 'stepFactor',
                  max: 2,
                  min: 0,
                  optional: true,
                  step: 0.01,
                  value: initVal(`Groups.g${i}.g${i}-stepFactor`, 0.13)
                },
                [`g${i}-transform`]: { label: 'Transform', value: false },
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
    layerColor,
    layerGeometry,
    layerGeoWidth,
    range = repetitions,
    scalars: s = {},
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
    const w = layerGeoWidth ?? geoWidth

    return (
      <Instances {...props}>
        <InstancedAttribute defaultValue={1} name="opacity" />
        <InstancedAttribute defaultValue={[1, 1, 1]} name="iColor" />

        <Geo gltf={gltf} shape={geo} width={w} />

        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={colorVec}
          depthTest={false}
          depthWrite={false}
          onBeforeCompile={obcChain(obcInstanced, obcGradient)}
          transparent
        />

        {Array.from({ length: range }, (_, i) => {
          const sc = calcScale(i, sf, sp)

          return (
            <Instance
              // @ts-expect-error custom attr
              iColor={c.toArray()}
              key={i}
              opacity={calcAlpha(i, range, af, ap)}
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
              scale={sc}
            />
          )
        })}
      </Instances>
    )
  }

  useEffect(() => void $object.set(undefined), [geometry])

  return (
    <group rotation={[0, 0, rotation]} scale={scale}>
      {debug ? (
        <mesh position={[position.x, position.y, 0]}>
          <Geo gltf={gltf} shape={geometry} width={geoWidth} />
          <meshBasicMaterial />
        </mesh>
      ) : (
        <>
          <SyncedTransform
            enabled={transform}
            levaKey="Scene.position"
            position={[position.x, position.y, 0]}>
            <Layer scalars={scalars} />
          </SyncedTransform>

          {sceneLayers.map((layer, n) => (
            <SyncedTransform
              enabled={transform || layer.transform}
              key={n}
              levaKey={`Groups.g${n}.g${n}-position`}
              position={[layer?.position?.x ?? 0, layer?.position?.y ?? 0, 0]}>
              <Layer
                layerColor={layer?.color}
                layerGeometry={layer?.geometry}
                layerGeoWidth={layer?.geoWidth}
                rotation={[0, 0, layer?.rotation ?? 0]}
                scalars={layer}
                scale={[layer?.scale?.x ?? 1, layer?.scale?.y ?? 1, 1]}
              />
            </SyncedTransform>
          ))}
        </>
      )}
    </group>
  )
}

declare global {
  interface Window {
    __RENDER_READY__?: boolean
  }
}

export const Scene = ({ headless }: { headless?: boolean }) => {
  useLinkableControls()

  return (
    <Canvas
      gl={{
        alpha: true,
        antialias: true,
        depth: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
        stencil: false
      }}
      onCreated={() => {
        requestAnimationFrame(() => {
          window.__RENDER_READY__ = true
        })
      }}
      orthographic
      style={{ height: '100svh', width: '100svw' }}>
      <Suspense fallback={<Loader />}>
        <Inner />
      </Suspense>

      <Effects />
      <Controls />
      {!headless && <Stats />}
    </Canvas>
  )
}
