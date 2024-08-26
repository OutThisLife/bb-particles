import { extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AfterimagePass,
  EffectComposer,
  RenderPass
} from 'three/examples/jsm/Addons.js'

extend({ EffectComposer, RenderPass, AfterimagePass })

export default function Effects() {
  const { gl, scene, camera, viewport } = useThree()
  const fx = useMemo(() => new EffectComposer(gl), [gl])

  useEffect(() => {
    fx.addPass(new RenderPass(scene, camera))
    fx.addPass(new AfterimagePass(0.8))
  }, [fx])

  useFrame(() => void fx?.render(), 1)

  return null
}
