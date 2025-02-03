import { extend, useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { EffectComposer, RenderPass } from 'three/examples/jsm/Addons.js'
import { CustomAfterPass } from './AfterPass'

extend({ EffectComposer, RenderPass, CustomAfterPass })

export default function Effects() {
  const { gl, scene, camera } = useThree()

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl)

    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new CustomAfterPass(0.1))

    return composer
  }, [gl, scene, camera])

  useFrame(() => void fx?.render(), 1)

  return null
}
