'use client'

import { Stats, useAspect, useFBO } from '@react-three/drei'
import { Canvas, ShaderMaterialProps, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

function FBOPipeline({ passes }: { passes: any[] }) {
  const scale = useAspect(1, 1)

  // Create individual FBOs using separate hooks
  const pingFBO = useFBO()
  const pongFBO = useFBO()
  const pass1FBO = useFBO()
  const pass2FBO = useFBO()
  const pass3FBO = useFBO()
  // Add more as needed

  const passOutputFBOs = [pass1FBO, pass2FBO, pass3FBO]
  const toggle = useRef(false)

  const passMaterials = useMemo(
    () =>
      passes.map((i, n) => ({
        transparent: true,
        precision: 'highp',
        uniforms: {
          uChannel0: { value: new THREE.Texture() },
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2() },
          ...i.uniforms
        },
        fragmentShader,
        vertexShader,
        defines: i.defines || { PASS: n }
      })),
    [passes]
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
      const readFBO = toggle.current ? pongFBO : pingFBO
      const writeFBO = toggle.current ? pingFBO : pongFBO

      const w = width * dpr
      const h = height * dpr
      const time = clock.getElapsedTime()
      const resolution = new THREE.Vector2(w, h)

      // PASS 0: Generate trail
      const material0 = passMaterials[0]
      material0.uniforms.uTime.value = time
      material0.uniforms.uResolution.value = resolution
      material0.uniforms.uChannel0.value = readFBO.texture

      gl.setRenderTarget(writeFBO)
      gl.clear(true, true, false)
      gl.render(scene, camera)

      // PASS 1: Process trail
      const material1 = passMaterials[1]
      material1.uniforms.uTime.value = time
      material1.uniforms.uResolution.value = resolution
      material1.uniforms.uChannel0.value = material0.uniforms.uChannel0.value

      gl.setRenderTarget(null)

      toggle.current = !toggle.current
    }
  )

  return (
    <group {...{ scale }}>
      {passMaterials.map((material, index) => (
        <mesh key={index}>
          <planeGeometry />
          <shaderMaterial {...material} />
        </mesh>
      ))}
    </group>
  )
}

function Inner() {
  const scale = useAspect(1, 1)
  const fbo0 = useFBO()
  const fbo1 = useFBO()
  const toggle = useRef(false)

  const args = useMemo<ShaderMaterialProps>(
    () => ({
      transparent: true,
      precision: 'highp',
      uniforms: {
        uChannel0: { value: new THREE.Texture() },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() }
      },
      fragmentShader,
      vertexShader
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

      args.uniforms.uTime.value = clock.getElapsedTime()
      args.uniforms.uResolution.value = new THREE.Vector2(w, h)
      args.uniforms.uChannel0.value = readFBO.texture

      gl.setRenderTarget(writeFBO)
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      toggle.current = !toggle.current
    }
  )

  return (
    <>
      <mesh {...{ scale }}>
        <planeGeometry />
        <shaderMaterial {...args} defines={{ PASS: 0 }} />
      </mesh>

      <mesh {...{ scale }}>
        <planeGeometry />
        <shaderMaterial {...args} defines={{ PASS: 1 }} />
      </mesh>
    </>
  )
}

export default function Scene() {
  return (
    <Canvas key={Math.random()} style={{ width: '100vw', height: '100vh' }}>
      <Suspense>
        <FBOPipeline
          passes={[{ defines: { PASS: 0 } }, { defines: { PASS: 1 } }]}
        />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
