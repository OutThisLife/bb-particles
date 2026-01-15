'use client'

import { Float, Shadow, Stats } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useControls } from 'leva'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

const Effects = lazy(() =>
  import('./Effects').then(m => ({ default: m.Effects }))
)
const Controls = lazy(() =>
  import('./Controls').then(m => ({ default: m.Controls }))
)

export const PARTICLE_COUNT = 4096

const len = 2

function sampleEdges(
  geo: THREE.BufferGeometry,
  count: number,
  targetRadius = 0.5
) {
  const edges = new THREE.EdgesGeometry(geo, 15)
  const pos = edges.attributes.position
  const segments: [THREE.Vector3, THREE.Vector3][] = []
  const center = new THREE.Vector3()

  geo.computeBoundingBox()
  geo.boundingBox?.getCenter(center)
  geo.computeBoundingSphere()

  const radius = geo.boundingSphere?.radius ?? 1
  const scale = targetRadius / Math.max(radius, 1e-6)

  for (let i = 0; i < pos.count; i += 2) {
    segments.push([
      new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center),
      new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)).sub(
        center
      )
    ])
  }

  if (!segments.length) {
    return new Float32Array(count * 3)
  }

  const lengths = segments.map(([a, b]) => a.distanceTo(b))
  const total = lengths.reduce((a, b) => a + b, 0)
  const result = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const t = (i / count) * total
    let acc = 0
    let segIdx = 0

    for (let j = 0; j < segments.length; j++) {
      if (acc + lengths[j] >= t) {
        segIdx = j
        break
      }

      acc += lengths[j]
    }

    const [a, b] = segments[segIdx]
    const localT = lengths[segIdx] > 0 ? (t - acc) / lengths[segIdx] : 0
    const p = a.clone().lerp(b, localT).multiplyScalar(scale)

    result[i * 3] = p.x
    result[i * 3 + 1] = p.y
    result[i * 3 + 2] = p.z
  }

  return result
}

const LIGHT1_POS = new THREE.Vector3(10, 10, 10)
const LIGHT2_POS = new THREE.Vector3(-10, 10, -10)

function Inner() {
  const { gl } = useThree()
  const pointsRef = useRef<THREE.Points>(null)
  const geoRef = useRef<THREE.InstancedBufferGeometry>(null)

  const {
    alphaFactor,
    autoplay,
    manualProgress,
    mirrorX,
    mirrorY,
    pointSize,
    repetitions,
    rotationFactor,
    scaleFactor
  } = useControls({
    alphaFactor: { max: 1, min: 0, step: 0.01, value: 0.12 },
    autoplay: { value: true },
    manualProgress: { max: 1, min: 0, step: 1.0 / len, value: 0 },
    mirrorX: { value: false },
    mirrorY: { value: false },
    pointSize: { max: 10, min: 1, step: 0.5, value: 3 },
    repetitions: { max: 100, min: 1, step: 1, value: 20 },
    rotationFactor: { max: 360, min: -360, step: 1, value: 100 },
    scaleFactor: { max: 1, min: 0, step: 0.01, value: 0.06 }
  })

  const uniforms = useMemo(
    () => ({
      uAlpha: new THREE.Uniform(alphaFactor),
      uChannel0: new THREE.Uniform(new THREE.Texture()),
      uDpr: new THREE.Uniform(gl.getPixelRatio()),
      uLight1Pos: new THREE.Uniform(LIGHT1_POS),
      uLight1Color: new THREE.Uniform(new THREE.Color(1, 1, 1)),
      uLight1Intensity: new THREE.Uniform(1.0),
      uLight2Pos: new THREE.Uniform(LIGHT2_POS),
      uLight2Color: new THREE.Uniform(new THREE.Color(1, 1, 1)),
      uLight2Intensity: new THREE.Uniform(0.5),
      uAmbient: new THREE.Uniform(0.1),
      uPointSize: new THREE.Uniform(pointSize),
      uProgress: new THREE.Uniform(0),
      uStep: new THREE.Uniform(1.0 / len),
      uSteps: new THREE.Uniform(len),
      uTime: new THREE.Uniform(0)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const positions = useMemo(() => {
    const offset = 0.2
    const xs = mirrorX ? [-offset, offset] : [0]
    const ys = mirrorY ? [-offset, offset] : [0]

    return xs.flatMap(x => ys.map(y => [x, y, 0] as const))
  }, [mirrorX, mirrorY])

  const instanceCount = repetitions * positions.length

  const { instanceAttribs, particleAttribs } = useMemo(() => {
    const denom = Math.max(repetitions - 1, 1)

    const instanceOffset = new Float32Array(instanceCount * 3)
    const instanceScale = new Float32Array(instanceCount)
    const instanceRotation = new Float32Array(instanceCount)
    const instanceLayer = new Float32Array(instanceCount)

    let idx = 0

    for (let i = 0; i < repetitions; i++) {
      for (const pos of positions) {
        instanceOffset[idx * 3] = pos[0]
        instanceOffset[idx * 3 + 1] = pos[1]
        instanceOffset[idx * 3 + 2] = pos[2]
        instanceScale[idx] = 1 - scaleFactor * i
        instanceRotation[idx] = (rotationFactor * i * Math.PI) / (180 * denom)
        instanceLayer[idx] = i / denom
        idx++
      }
    }

    const particleIndex = Float32Array.from(
      { length: PARTICLE_COUNT },
      (_, n) => n / PARTICLE_COUNT
    )

    return {
      instanceAttribs: {
        instanceLayer,
        instanceOffset,
        instanceRotation,
        instanceScale
      },
      particleAttribs: { particleIndex }
    }
  }, [instanceCount, positions, repetitions, rotationFactor, scaleFactor])

  useEffect(() => {
    const geo = geoRef.current

    if (!geo) {
      return
    }

    const setOrUpdate = (
      name: string,
      data: Float32Array,
      size: number,
      instanced = false
    ) => {
      const existing = geo.getAttribute(name)

      if (existing?.array.length === data.length) {
        ;(existing.array as Float32Array).set(data)
        existing.needsUpdate = true
      } else {
        const attr = instanced
          ? new THREE.InstancedBufferAttribute(data, size)
          : new THREE.BufferAttribute(data, size)

        geo.setAttribute(name, attr)
      }
    }

    setOrUpdate('position', new Float32Array(PARTICLE_COUNT * 3), 3)
    setOrUpdate('particleIndex', particleAttribs.particleIndex, 1)
    setOrUpdate('instanceOffset', instanceAttribs.instanceOffset, 3, true)
    setOrUpdate('instanceScale', instanceAttribs.instanceScale, 1, true)
    setOrUpdate('instanceRotation', instanceAttribs.instanceRotation, 1, true)
    setOrUpdate('instanceLayer', instanceAttribs.instanceLayer, 1, true)
  }, [instanceAttribs, particleAttribs])

  useEffect(() => {
    const geo = geoRef.current

    if (geo) {
      geo.instanceCount = instanceCount
    }
  }, [instanceCount])

  useEffect(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const sphere = new THREE.IcosahedronGeometry(0.5, 1)

    const geometries = [
      sampleEdges(box, PARTICLE_COUNT),
      sampleEdges(sphere, PARTICLE_COUNT)
    ]

    const data = new Float32Array(PARTICLE_COUNT * len * 4)

    geometries.forEach((positions, n) => {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const offset = n * PARTICLE_COUNT * 4
        data[offset + i * 4] = positions[i * 3]
        data[offset + i * 4 + 1] = positions[i * 3 + 1]
        data[offset + i * 4 + 2] = positions[i * 3 + 2]
        data[offset + i * 4 + 3] = 1.0
      }
    })

    const tex = new THREE.DataTexture(
      data,
      PARTICLE_COUNT,
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
    const step = uniforms.uStep.value

    for (let i = 0; i < len; i++) {
      const target = Math.min((i + 1) * step, 1)

      tl.to(uniforms.uProgress, {
        value: target,
        duration: step / 0.1,
        ease: 'power2.inOut'
      })

      if (i < len - 1) {
        tl.to({}, { duration: 3 })
      }
    }

    return () => void tl.kill()
  }, [autoplay, uniforms])

  useEffect(() => {
    uniforms.uProgress.value = manualProgress
    uniforms.uAlpha.value = alphaFactor
    uniforms.uPointSize.value = pointSize
    uniforms.uDpr.value = gl.getPixelRatio()
  }, [manualProgress, pointSize, alphaFactor, gl, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group scale={5.5}>
      <Float floatIntensity={0.15} rotationIntensity={0.08}>
        <points ref={pointsRef}>
          <instancedBufferGeometry instanceCount={instanceCount} ref={geoRef} />

          <shaderMaterial
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            glslVersion={THREE.GLSL3}
            key={`${fragmentShader + vertexShader}`}
            transparent
            {...{ vertexShader, fragmentShader, uniforms }}
          />
        </points>
      </Float>

      <Shadow
        color="#fff"
        opacity={0.05}
        position={[0, -0.35, 0.01]}
        scale={0.8}
      />
    </group>
  )
}

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 30 }}
      gl={{
        alpha: true,
        antialias: false,
        depth: true,
        powerPreference: 'high-performance',
        stencil: false
      }}
      shadows
      style={{ height: '100dvh', width: '100dvw' }}
    >
      <color args={['#000']} attach="background" />
      <fog args={['#000', 5, 30]} attach="fog" />

      <ambientLight intensity={0.1} />

      <spotLight
        angle={0.15}
        castShadow
        intensity={1}
        penumbra={1}
        position={[10, 10, 10]}
      />

      <spotLight
        angle={0.15}
        castShadow
        intensity={0.5}
        penumbra={1}
        position={[-10, 10, -10]}
      />

      <Suspense>
        <Inner />
        <Controls />
        <Effects />
      </Suspense>

      <mesh position={[0, -2, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />

        <meshStandardMaterial
          color="#fff"
          emissive="#fff"
          emissiveIntensity={0.02}
          metalness={0.9}
          roughness={0.5}
        />
      </mesh>

      <Stats />
    </Canvas>
  )
}
