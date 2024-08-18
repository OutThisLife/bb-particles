import type { RenderCallback } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

export default function useCappedFrame(cb: RenderCallback, max = 60) {
  const last = useRef(performance.now())
  const interval = 1e3 / max

  useFrame(
    (st, delta) =>
      performance.now() - last.current > interval &&
      ((last.current = performance.now()), cb(st, delta))
  )
}
