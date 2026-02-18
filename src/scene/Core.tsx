'use client'

import { useStore } from '@nanostores/react'
import type { InstancesProps } from '@react-three/drei'
import { Instance, InstancedAttribute, Instances } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

import { $object } from '@/store'
import {
  calcAlpha,
  calcPosition,
  calcRotation,
  calcScale,
  gradientAngleUniform,
  gradientRangeUniform,
  obcChain,
  obcGradient,
  obcInstanced
} from '@/utils'
import type { LayerParams, SceneParams } from '@/utils/codec'

import { Geo } from './Shapes'

export type { LayerParams, SceneParams }

interface LayerProps extends InstancesProps {
  p: SceneParams
  o?: LayerParams
  gltf?: THREE.BufferGeometry[]
}

function Layer({ gltf, o, p, ...rest }: LayerProps) {
  const sf = o?.scaleFactor ?? p.scaleFactor
  const rf = o?.rotationFactor ?? p.rotationFactor
  const af = o?.alphaFactor ?? p.alphaFactor
  const stf = o?.stepFactor ?? p.stepFactor
  const geo = o?.geometry ?? p.geometry
  const col = o?.color ?? p.color
  const w = o?.geoWidth ?? p.geoWidth
  const sa = o?.startAngle ?? p.startAngle ?? 0

  const color = useMemo(() => new THREE.Color(col), [col])

  return (
    <Instances {...rest}>
      <InstancedAttribute defaultValue={1} name="opacity" />
      <InstancedAttribute defaultValue={[1, 1, 1]} name="iColor" />

      <Geo gltf={gltf} shape={geo} startAngle={sa} width={w} />

      <meshBasicMaterial
        blending={THREE.AdditiveBlending}
        color={color}
        depthTest={false}
        depthWrite={false}
        onBeforeCompile={obcChain(obcInstanced, obcGradient)}
        transparent
      />

      {Array.from({ length: p.repetitions }, (_, i) => {
        const sc = calcScale(i, sf, p.scaleProgression)

        return (
          <Instance
            // @ts-expect-error custom attributes
            iColor={color.toArray()}
            key={i}
            opacity={calcAlpha(
              i,
              p.repetitions,
              af,
              p.alphaProgression ?? 'exponential'
            )}
            position={calcPosition(
              i,
              sc,
              p.xStep,
              p.yStep,
              stf,
              p.origin,
              p.positionProgression,
              p.positionCoupled ?? true,
              !!gltf
            )}
            rotation={[
              0,
              0,
              (calcRotation(i, rf, p.rotationProgression) * Math.PI) / 180
            ]}
            scale={sc}
          />
        )
      })}
    </Instances>
  )
}

export const SceneCore = ({ params: p }: { params: SceneParams }) => {
  const gltf = useStore($object)
  gradientAngleUniform.value = p.gradientAngle
  gradientRangeUniform.value = p.gradientRange ?? [0.2, 1.0]

  if (p.debug) {
    return (
      <group
        position={[p.position.x, p.position.y, 0]}
        rotation={[0, 0, p.rotation]}
        scale={p.scale}
      >
        <mesh>
          <Geo
            gltf={gltf}
            shape={p.geometry}
            startAngle={p.startAngle ?? 0}
            width={p.geoWidth}
          />
          <meshBasicMaterial />
        </mesh>
      </group>
    )
  }

  return (
    <group
      position={[p.position.x, p.position.y, 0]}
      rotation={[0, 0, p.rotation]}
      scale={p.scale}
    >
      <Layer gltf={gltf} p={p} />

      {p.layers.map((layer, i) => (
        <group
          key={i}
          position={[layer.position?.x ?? 0, layer.position?.y ?? 0, 0]}
          rotation={[0, 0, layer.rotation ?? 0]}
          scale={[layer.scale?.x ?? 1, layer.scale?.y ?? 1, 1]}
        >
          <Layer gltf={gltf} o={layer} p={p} />
        </group>
      ))}
    </group>
  )
}
