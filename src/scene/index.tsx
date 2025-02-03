/**
 * upload geometry [q, rings, lines]
 * set repetition [x] numbers
 * set opacity distribution
 * - repeat x times
 * - scaling down by x*.1
 * - opacity distribution per step by x*.1
 * - rotate by x*10 degrees
 * - translucent gradient to create blur and lighting
 * - mirror X xor Y?
 */

'use client'

import { resample } from '@/utils'
import { Stats } from '@react-three/drei'
import { Canvas, GroupProps, useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useControls } from 'leva'
import { lazy, Suspense, useEffect } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

const Effects = lazy(() => import('./Effects'))
const Controls = lazy(() => import('./Controls'))

export const PARTICLE_COUNT = 1e4

const geometries = [
  new THREE.BoxGeometry(1, 1, 1, 64, 64, 64),
  new THREE.SphereGeometry(0.8, 64, 64)
].map(i => resample(i))

const len = geometries.length

const uniforms = {
  uProgress: new THREE.Uniform(0),
  uChannel0: new THREE.Uniform(new THREE.Texture()),
  uSteps: new THREE.Uniform(len),
  uStep: new THREE.Uniform(1.0 / len),
  uTime: new THREE.Uniform(0),
  uPointSize: new THREE.Uniform(2),
  uAlpha: new THREE.Uniform(1),
  uResolution: new THREE.Uniform(new THREE.Vector2())
}

function Iteration({ index: i, ...props }: { index: number } & GroupProps) {
  const { repetitions, scaleFactor, rotationFactor } = useControls({
    repetitions: { value: 20, min: 1, max: 1e3, step: 1 },
    scaleFactor: { value: 0.06, min: 0, max: 1, step: 0.01 },
    rotationFactor: { value: 100, min: -360, max: 360, step: 1 }
  })

  return (
    <group
      scale={1 - scaleFactor * i}
      rotation={[
        0,
        0,
        (rotationFactor * i * Math.PI) / (180 * (repetitions - 1))
      ]}
      {...props}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={new Float32Array(PARTICLE_COUNT * 3)}
            itemSize={3}
          />

          <bufferAttribute
            attach="attributes-particleIndex"
            count={PARTICLE_COUNT}
            array={Float32Array.from(
              Array.from(
                { length: PARTICLE_COUNT },
                (_, i) => i / PARTICLE_COUNT
              )
            )}
            itemSize={1}
          />

          <bufferAttribute
            attach="attributes-layerIndex"
            count={PARTICLE_COUNT}
            array={Float32Array.from(
              Array.from(
                { length: PARTICLE_COUNT },
                () => i / (repetitions - 1)
              )
            )}
            itemSize={1}
          />
        </bufferGeometry>

        <shaderMaterial
          key={`${fragmentShader + vertexShader}}`}
          glslVersion={THREE.GLSL3}
          transparent
          depthTest={false}
          blending={THREE.AdditiveBlending}
          {...{ vertexShader, fragmentShader, uniforms }}
        />
      </points>
    </group>
  )
}

function Inner() {
  const {
    mirrorX,
    mirrorY,
    autoplay,
    manualProgress,
    repetitions,
    pointSize,
    scaleFactor,
    alphaFactor
  } = useControls({
    mirrorX: { value: false },
    mirrorY: { value: false },
    pointSize: { value: 2, min: 1, max: 10, step: 1 },
    autoplay: { value: true },
    manualProgress: { value: 0, min: 0, max: 1, step: 1.0 / len },
    repetitions: { value: 20, min: 1, max: 50, step: 1 },
    alphaFactor: { value: 0.01, min: 0, max: 1, step: 0.01 },
    scaleFactor: { value: 0.06, min: 0, max: 1, step: 0.01 }
  })

  useEffect(() => {
    const maxV = Math.max(...geometries.map(g => g.attributes.position.count))
    const positions = new Float32Array(maxV * len * 4)

    geometries.forEach((g, n) => {
      const attr = g.attributes.position
      const r = new Float32Array(attr.count * 4)

      for (let i = 0; i < attr.count; i++) {
        r[i * 4] = attr.getX(i) / 2
        r[i * 4 + 1] = attr.getY(i) / 2
        r[i * 4 + 2] = attr.getZ(i) / 2
        r[i * 4 + 3] = 1.0
      }

      const offset = n * maxV * 4

      for (let i = 0; i < r.length; i++) {
        positions[offset + i] = r[i]
      }
    })

    const tex = new THREE.DataTexture(
      positions,
      maxV,
      len,
      THREE.RGBAFormat,
      THREE.FloatType
    )

    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    uniforms.uChannel0.value = tex
  }, [uniforms])

  useEffect(() => {
    if (!autoplay) {
      return
    }

    const tl = gsap.timeline({ repeat: -1, yoyo: true })
    const dur = uniforms.uStep.value

    let cur = 0
    while (cur < 1) {
      const next = Math.min(cur + dur, 1)

      tl.to(uniforms.uProgress, {
        value: next,
        duration: (next - cur) / 0.1,
        ease: 'none'
      })

      if (next < 1 && cur > 0) {
        tl.to({}, { duration: 6 })
      }

      cur = next
    }

    return () => void tl.kill()
  }, [autoplay])

  useEffect(() => {
    gsap.to(uniforms.uProgress, {
      value: manualProgress,
      duration: 1,
      ease: 'none'
    })

    gsap.to(uniforms.uAlpha, {
      value: alphaFactor,
      duration: 0,
      ease: 'none'
    })

    gsap.to(uniforms.uPointSize, {
      value: pointSize,
      duration: 0,
      ease: 'none'
    })
  }, [manualProgress, pointSize, alphaFactor])

  useFrame(({ clock, size }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uResolution.value.set(size.width, size.height)
  })

  return (
    <group key={`${repetitions}.${scaleFactor}.${alphaFactor}`}>
      {Array.from({ length: repetitions }).map((_, i) => (
        <Iteration key={i} index={i} position={[mirrorX ? -0.2 : 0, 0, 0]} />
      ))}

      {mirrorX &&
        Array.from({ length: repetitions }).map((_, i) => (
          <Iteration key={i} index={i} position={[0.2, 0, 0]} />
        ))}
    </group>
  )
}

export default function Scene() {
  return (
    <Canvas
      key={Math.random()}
      orthographic
      style={{ width: '100vw', height: '100vh' }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false
      }}>
      <Suspense>
        <Inner />
        <Controls />
        <Effects />
      </Suspense>

      <Stats />
    </Canvas>
  )
}
