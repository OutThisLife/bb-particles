'use client'

import { Stats, useAspect, useFBO } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

function Inner() {
  const scale = useAspect(1, 1)
  const fbo0 = useFBO()
  const fbo1 = useFBO()
  const toggle = useRef(false)

  const uniforms = useMemo(
    () => ({
      uChannel0: { value: new THREE.Texture() },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() }
    }),
    []
  )

  useFrame(
    ({
      clock,
      camera,
      scene,
      gl,
      size: { width, height },
      viewport: { dpr }
    }) => {
      const readFBO = toggle.current ? fbo1 : fbo0
      const writeFBO = toggle.current ? fbo0 : fbo1

      const w = width * dpr
      const h = height * dpr

      uniforms.uTime.value = clock.getElapsedTime()
      uniforms.uResolution.value = new THREE.Vector2(w, h)
      uniforms.uChannel0.value = readFBO.texture

      gl.setRenderTarget(writeFBO)
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      toggle.current = !toggle.current
    }
  )

  return (
    <mesh {...{ scale }}>
      <planeGeometry />
      <shaderMaterial
        transparent
        {...{ uniforms, fragmentShader, vertexShader }}
      />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas key={Math.random()} style={{ width: '100vw', height: '100vh' }}>
      <Suspense>
        <Inner />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
