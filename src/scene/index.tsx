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

import { useSmoothControls } from '@/hooks/useSmoothControls'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

function Inner() {
  const ref = useRef<THREE.RawShaderMaterial>(null!)

  const config = useSmoothControls('Scene', {
    steps: { value: 19, min: 1, max: 100, step: 1 },
    rotate: { value: 0.5, min: -1, max: 1, step: 0.1 },
    light: { value: 150, min: 0, max: 360, step: 1 },
    scale: { value: 0.9, min: 0, max: 1, step: 0.1 }
  })

  useFrame(({ size, clock, camera }) => {
    if (ref.current) {
      ref.current.uniforms.uResolution.value.set(size.width, size.height)

      ref.current.uniforms.uTime.value = clock.elapsedTime

      if (camera instanceof THREE.OrthographicCamera) {
        ref.current.uniforms.uZoom.value = camera.zoom
        ref.current.uniforms.uPan.value = camera.position.clone()
      }

      ref.current.uniforms.uSteps.value = config.steps
      ref.current.uniforms.uRotate.value = config.rotate
      ref.current.uniforms.uScale.value = config.scale
      ref.current.uniforms.uLight.value = config.light
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
          uZoom: new THREE.Uniform(1),
          uSteps: new THREE.Uniform(10),
          uRotate: new THREE.Uniform(0.1),
          uScale: new THREE.Uniform(0.1),
          uPan: new THREE.Uniform(new THREE.Vector3()),
          uLight: new THREE.Uniform(150)
        }}
        {...{ ref, vertexShader, fragmentShader }}
      />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas orthographic style={{ width: '100svw', height: '100svh' }}>
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
