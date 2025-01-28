import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useControls } from 'leva'
import { lazy, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

const PARTICLE_COUNT = 1e4

export default function Scene() {
  const { mixFactor, pointSize } = useControls({
    mixFactor: { value: 0, min: 0, max: 1, step: 0.01 },
    pointSize: { value: 4.0, min: 0, max: 100, step: 0.01 }
  })

  const uniforms = useMemo(
    () => ({
      mixFactor: { value: 0 },
      positionsTexture: { value: new THREE.Texture() },
      numKeyframes: { value: 2 },
      keyframeStep: { value: 1.0 / 2 },
      pointSize: { value: 4 },
      uTime: { value: 0 }
    }),
    []
  )

  useEffect(() => {
    const resample = (geometry: THREE.BufferGeometry, targetCount: number) => {
      const attr = geometry.attributes.position
      const count = attr.count
      const r = new Float32Array(targetCount * 3)

      for (let i = 0; i < targetCount; i++) {
        const srcIndex = Math.floor((i / targetCount) * count)
        r[i * 3] = attr.getX(srcIndex)
        r[i * 3 + 1] = attr.getY(srcIndex)
        r[i * 3 + 2] = attr.getZ(srcIndex)
      }

      return new THREE.BufferGeometry()
        .setAttribute('position', new THREE.BufferAttribute(r, 3))
        .center()
    }

    const geometries = [
      resample(new THREE.BoxGeometry(1, 1, 1, 32, 32, 32), PARTICLE_COUNT),
      resample(new THREE.SphereGeometry(0.2, 32, 32), PARTICLE_COUNT),
      resample(new THREE.ConeGeometry(0.2, 1, 32, 32), PARTICLE_COUNT),
      resample(new THREE.CylinderGeometry(0.2, 1, 1, 32, 32), PARTICLE_COUNT)
    ]

    const maxV = Math.max(...geometries.map(g => g.attributes.position.count))
    const positions = new Float32Array(maxV * geometries.length * 4)

    geometries.forEach((g, n) => {
      const attr = g.attributes.position
      const count = attr.count
      const r = new Float32Array(count * 4)

      for (let i = 0; i < count; i++) {
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
      geometries.length,
      THREE.RGBAFormat,
      THREE.FloatType
    )

    tex.needsUpdate = true
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    uniforms.positionsTexture.value = tex
    uniforms.numKeyframes.value = geometries.length
    uniforms.keyframeStep.value = 1.0 / geometries.length
  }, [uniforms])

  useEffect(() => {
    gsap.to(uniforms.mixFactor, {
      value: mixFactor,
      duration: 0.6,
      ease: 'power2.out'
    })

    gsap.to(uniforms.pointSize, {
      value: pointSize,
      duration: 0.5,
      ease: 'power2.out'
    })
  }, [mixFactor, pointSize, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
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
            Array.from({ length: PARTICLE_COUNT }, (_, i) => i / PARTICLE_COUNT)
          )}
          itemSize={1}
        />
      </bufferGeometry>

      <shaderMaterial
        key={`${fragmentShader + vertexShader}-${mixFactor}-${pointSize}`}
        glslVersion={THREE.GLSL3}
        transparent
        {...{ vertexShader, fragmentShader, uniforms }}
      />
    </points>
  )
}

export const Effects = lazy(() => import('./Effects'))
export const Controls = lazy(() => import('./Controls'))
