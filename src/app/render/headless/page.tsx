'use client'

import SceneCore from '@/scene/Core'
import { DEFAULT_PARAMS } from '@/utils/codec'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, SMAA } from '@react-three/postprocessing'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'

declare global {
  interface Window {
    __RENDER_READY__?: boolean
  }
}

function CameraSetup() {
  const { camera, size } = useThree()

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      const aspect = size.width / size.height
      camera.left = -aspect / 2
      camera.right = aspect / 2
      camera.top = 0.5
      camera.bottom = -0.5
      camera.zoom = aspect * 0.2
      camera.updateProjectionMatrix()
    }
  }, [camera, size])

  return null
}

function Inner() {
  const searchParams = useSearchParams()

  const params = useMemo(() => {
    const p = searchParams.get('p')
    if (!p) return DEFAULT_PARAMS
    try {
      return { ...DEFAULT_PARAMS, ...JSON.parse(decodeURIComponent(p)) }
    } catch {
      return DEFAULT_PARAMS
    }
  }, [searchParams])

  return (
    <Canvas
      orthographic
      style={{ width: '100vw', height: '100vh' }}
      gl={{
        antialias: true,
        alpha: true,
        stencil: false,
        depth: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      }}
      onCreated={() => {
        requestAnimationFrame(() => {
          window.__RENDER_READY__ = true
        })
      }}>
      <CameraSetup />
      <SceneCore params={params} />
      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}

export default function Headless() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
