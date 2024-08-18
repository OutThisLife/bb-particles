'use client'

import { OrbitControls } from '@react-three/drei'
import { useEffect, useState } from 'react'

export default function Controls() {
  const [enabled, set] = useState<boolean>(false)

  useEffect(() => {
    const ac = new AbortController()
    const { signal } = ac

    const handle = () => set(window.innerWidth <= 1024)

    ;(['keyup', 'keydown'] as const).forEach(evt =>
      window.addEventListener(evt, e => set(e.altKey), { signal })
    )

    window.addEventListener('resize', handle, { signal })
    window.requestAnimationFrame(handle)

    return () => ac?.abort()
  }, [])

  return (
    <OrbitControls
      makeDefault
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0}
      {...{ enablePan: enabled, enableRotate: enabled }}
    />
  )
}
