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
import { InstancesProps, Loader, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import { Suspense } from 'react'
import * as THREE from 'three'
import Controls from './Controls'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

function Inner() {
  const ref = useRef<THREE.RawShaderMaterial>(null!)

  useFrame(({ size, clock, camera }) => {
    if (ref.current) {
      ref.current.uniforms.uResolution.value.set(size.width, size.height)

      ref.current.uniforms.uTime.value = clock.elapsedTime

      if (camera instanceof THREE.OrthographicCamera) {
        ref.current.uniforms.uZoom.value = camera.zoom
      }
    }
  })

  return (
    <mesh key={Math.random()}>
      <planeGeometry args={[2, 2]} />

      <rawShaderMaterial
        transparent
        side={THREE.FrontSide}
        glslVersion={THREE.GLSL3}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: new THREE.Uniform(0),
          uResolution: new THREE.Uniform(new THREE.Vector2(0, 0)),
          uZoom: new THREE.Uniform(1)
        }}
        {...{ ref, vertexShader, fragmentShader }}
      />
    </mesh>
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

interface LayerProps extends InstancesProps {
  scalars?: {
    stepFactor?: number
    scaleFactor?: number
    rotationFactor?: number
    alphaFactor?: number
  }
}
