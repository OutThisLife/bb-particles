'use client'

import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'

export default function Controls() {
  const { camera, size } = useThree()
  const [enabled, set] = useState<boolean>(false)

  useEffect(() => {
    const ac = new AbortController()
    const { signal } = ac

    const handle = () => set(window.innerWidth <= 1024)

    ;(['keyup', 'keydown'] as const).forEach(evt =>
      window.addEventListener(
        evt,
        e => set(window.innerWidth >= 1024 && e.altKey),
        { signal }
      )
    )

    window.addEventListener('resize', handle, { signal })
    window.requestAnimationFrame(handle)

    return () => ac?.abort()
  }, [])

  useEffect(() => {
    const aspect = size.width / size.height

    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = (1 * aspect) / -2
      camera.right = (1 * aspect) / 2
      camera.top = 1 / 2
      camera.bottom = 1 / -2
      camera.updateProjectionMatrix()
    }
  }, [size, camera])

  return (
    <OrbitControls
      makeDefault
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0}
      {...{ enablePan: enabled, enableRotate: enabled }}
    />
  )
}
