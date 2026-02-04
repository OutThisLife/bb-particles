import { extend, useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { EffectComposer, RenderPass } from 'three/examples/jsm/Addons.js'

import { CustomAfterPass } from './AfterPass'

extend({ CustomAfterPass, EffectComposer, RenderPass })

export default function Effects() {
  const { camera, gl, scene } = useThree()

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl)

    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new CustomAfterPass(0.99))

    return composer
  }, [gl, scene, camera])

  useFrame(() => void fx?.render(), 1)

  return null
}
