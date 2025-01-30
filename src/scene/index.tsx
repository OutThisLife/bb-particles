'use client'

import { Stats, useAspect, useFBO } from '@react-three/drei'
import { Canvas, createPortal, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

function Inner() {
  const [current, setCurrent] = useState(false)

  const scale = useAspect(1, 1)
  const scene = useMemo(() => new THREE.Scene(), [])

  const fbo0 = useFBO({
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping
  })

  const fbo1 = useFBO({
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping
  })

  const uniforms = useMemo(
    () => ({
      uPreviousFrame: { value: new THREE.Texture() },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() }
    }),
    []
  )

  useFrame(({ clock, camera, gl, size }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uResolution.value = new THREE.Vector2(size.width, size.height)

    gl.setRenderTarget(current ? fbo0 : fbo1)
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    uniforms.uPreviousFrame.value = current ? fbo0.texture : fbo1.texture

    setCurrent(st => !st)
  })

  return (
    <>
      {createPortal(
        <mesh {...{ scale }}>
          <planeGeometry />
          <shaderMaterial {...{ uniforms, fragmentShader, vertexShader }} />
        </mesh>,
        scene
      )}

      <mesh {...{ scale }}>
        <planeGeometry />
        <meshBasicMaterial map={current ? fbo0.texture : fbo1.texture} />
      </mesh>
    </>
  )
}

export default function Scene() {
  return (
    <Canvas
      key={Math.random()}
      style={{ width: '100vw', height: '100vh' }}
      shadows>
      <Suspense>
        <Inner />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
