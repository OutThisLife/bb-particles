import { extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { EffectComposer, RenderPass } from 'three/examples/jsm/Addons.js'
import { CustomAfterPass } from './AfterPass'

extend({ EffectComposer, RenderPass, CustomAfterPass })

export default function Effects() {
  const { gl, scene, camera, size } = useThree()

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl)

    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new CustomAfterPass(0.1))

    return composer
  }, [gl, scene, camera])

  useEffect(() => {
    fx.setSize(size.width, size.height)
    fx.setPixelRatio?.(gl.getPixelRatio())
  }, [fx, gl, size])

  useFrame(() => void fx?.render(), 1)

  return null
}
