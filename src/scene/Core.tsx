'use client'

import { $object } from '@/store'
import {
  calcAlpha,
  calcPosition,
  calcRotation,
  calcScale,
  obcChain,
  obcGradient,
  obcInstanced
} from '@/utils'
import type { LayerParams, SceneParams } from '@/utils/codec'
import { useStore } from '@nanostores/react'
import {
  Instance,
  InstancedAttribute,
  Instances,
  InstancesProps
} from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

import { Geo } from './Shapes'

export type { LayerParams, SceneParams }

interface LayerProps extends InstancesProps {
  p: SceneParams
  o?: LayerParams
  gltf?: THREE.BufferGeometry[]
}

function Layer({ p, o, gltf, ...rest }: LayerProps) {
  const sf = o?.scaleFactor ?? p.scaleFactor
  const rf = o?.rotationFactor ?? p.rotationFactor
  const af = o?.alphaFactor ?? p.alphaFactor
  const stf = o?.stepFactor ?? p.stepFactor
  const geo = o?.geometry ?? p.geometry
  const col = o?.color ?? p.color

  const color = useMemo(() => new THREE.Color(col), [col])

  return (
    <Instances {...rest}>
      <InstancedAttribute name="opacity" defaultValue={1} />
      <InstancedAttribute name="iColor" defaultValue={[1, 1, 1]} />

      <Geo shape={geo} gltf={gltf} />

      <meshBasicMaterial
        color={color}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onBeforeCompile={obcChain(obcInstanced, obcGradient)}
      />

      {Array.from({ length: p.repetitions }, (_, i) => {
        const sc = calcScale(i, sf, p.scaleProgression)
        return (
          <Instance
            key={i}
            scale={sc}
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
            // @ts-expect-error custom attributes
            opacity={calcAlpha(
              i,
              p.repetitions,
              af,
              p.alphaProgression ?? 'exponential'
            )}
            iColor={color.toArray()}
          />
        )
      })}
    </Instances>
  )
}

export default function SceneCore({ params: p }: { params: SceneParams }) {
  const gltf = useStore($object)

  if (p.debug) {
    return (
      <group
        position={[p.position.x, p.position.y, 0]}
        scale={p.scale}
        rotation={[0, 0, p.rotation]}>
        <mesh>
          <Geo shape={p.geometry} gltf={gltf} />
          <meshBasicMaterial />
        </mesh>
      </group>
    )
  }

  return (
    <group
      position={[p.position.x, p.position.y, 0]}
      scale={p.scale}
      rotation={[0, 0, p.rotation]}>
      <Layer p={p} gltf={gltf} />

      {p.layers.map((layer, i) => (
        <group
          key={i}
          position={[layer.position?.x ?? 0, layer.position?.y ?? 0, 0]}
          rotation={[0, 0, layer.rotation ?? 0]}
          scale={[layer.scale?.x ?? 1, layer.scale?.y ?? 1, 1]}>
          <Layer p={p} o={layer} gltf={gltf} />
        </group>
      ))}
    </group>
  )
}
