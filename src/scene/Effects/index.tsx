import { extend, useFrame, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  AfterimagePass,
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass
} from 'three/examples/jsm/Addons.js'

import { RGBADelayShader } from './rgba-delay'

extend({
  AfterimagePass,
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass
})

export function Effects() {
  const { gl, scene, camera, size } = useThree()

  const composerRef = useRef<EffectComposer | null>(null)
  const afterimagePassRef = useRef<AfterimagePass | null>(null)
  const bloomPassRef = useRef<null | UnrealBloomPass>(null)
  const rgbaPassRef = useRef<null | ShaderPass>(null)

  const maxFrames = 10
  const frameBuffer = useRef<THREE.WebGLRenderTarget[]>([])
  const frameIndex = useRef(0)

  const { afterimageAmount, afterimageEnabled } = useControls('Afterimage', {
    afterimageAmount: { max: 1, min: 0, step: 0.001, value: 0.91 },
    afterimageEnabled: true
  })

  const {
    bloomEnabled,
    bloomRadius,
    bloomScale,
    bloomStrength,
    bloomThreshold
  } = useControls('Bloom', {
    bloomEnabled: true,
    bloomRadius: { max: 1, min: 0, step: 0.01, value: 0 },
    bloomScale: {
      label: 'Resolution Scale',
      max: 1,
      min: 0.1,
      step: 0.05,
      value: 0.5
    },
    bloomStrength: { max: 3, min: 0, step: 0.01, value: 0.63 },
    bloomThreshold: { max: 1, min: 0, step: 0.01, value: 0.88 }
  })

  const {
    alphaDelay,
    blueDelay,
    dryWet,
    enabled: rgbaEnabled,
    gain,
    greenDelay,
    redDelay,
    refractAmount
  } = useControls('RGBA Delay', {
    delays: folder({
      alphaDelay: { max: maxFrames - 1, min: 0, step: 1, value: 0 },
      blueDelay: { max: maxFrames - 1, min: 0, step: 1, value: 9 },
      greenDelay: { max: maxFrames - 1, min: 0, step: 1, value: 7 },
      redDelay: { max: maxFrames - 1, min: 0, step: 1, value: 8 }
    }),
    dryWet: { max: 1, min: 0, step: 0.01, value: 0.09 },
    enabled: true,
    gain: { max: 2, min: 0, step: 0.01, value: 2 },
    refractAmount: { max: 0.01, min: 0, step: 0.0001, value: 0.004 }
  })

  useEffect(() => {
    frameBuffer.current = Array.from(
      { length: maxFrames },
      () =>
        new THREE.WebGLRenderTarget(size.width, size.height, {
          format: THREE.RGBAFormat,
          magFilter: THREE.LinearFilter,
          minFilter: THREE.LinearFilter,
          type: THREE.HalfFloatType
        })
    )

    const composer = new EffectComposer(gl)
    composer.setSize(size.width, size.height)
    composerRef.current = composer

    composer.addPass(new RenderPass(scene, camera))

    const afterimage = new AfterimagePass(afterimageAmount)
    afterimagePassRef.current = afterimage
    composer.addPass(afterimage)

    const rgbaPass = new ShaderPass(RGBADelayShader)
    rgbaPassRef.current = rgbaPass

    frameBuffer.current.forEach((buffer, i) => {
      rgbaPass.uniforms[`frame${i}`].value = buffer.texture
    })

    composer.addPass(rgbaPass)

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width * bloomScale, size.height * bloomScale),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    )

    bloomPassRef.current = bloom
    composer.addPass(bloom)

    return () => {
      frameBuffer.current.forEach(b => b.dispose())
      composer.dispose()
      composerRef.current = null
      afterimagePassRef.current = null
      bloomPassRef.current = null
      rgbaPassRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size])

  useFrame(({ clock }) => {
    const composer = composerRef.current
    const afterimage = afterimagePassRef.current
    const bloom = bloomPassRef.current
    const rgbaPass = rgbaPassRef.current

    if (!composer || !afterimage || !bloom || !rgbaPass) {
      return
    }

    afterimage.enabled = afterimageEnabled
    afterimage.uniforms.damp.value = afterimageAmount

    bloom.enabled = bloomEnabled
    bloom.strength = bloomStrength
    bloom.radius = bloomRadius
    bloom.threshold = bloomThreshold

    rgbaPass.enabled = rgbaEnabled

    if (rgbaEnabled) {
      rgbaPass.uniforms.alphaDelay.value = alphaDelay
      rgbaPass.uniforms.blueDelay.value = blueDelay
      rgbaPass.uniforms.dryWet.value = dryWet
      rgbaPass.uniforms.gain.value = gain
      rgbaPass.uniforms.greenDelay.value = greenDelay
      rgbaPass.uniforms.motionFrame.value =
        frameBuffer.current[frameIndex.current].texture
      rgbaPass.uniforms.redDelay.value = redDelay
      rgbaPass.uniforms.refractAmount.value = refractAmount
      rgbaPass.uniforms.time.value = clock.elapsedTime

      frameIndex.current = (frameIndex.current + 1) % maxFrames

      for (let i = 0; i < maxFrames; i++) {
        const bufferIdx = (frameIndex.current - i - 1 + maxFrames) % maxFrames
        rgbaPass.uniforms[`frame${i}`].value =
          frameBuffer.current[bufferIdx].texture
      }
    }

    composer.render()
  }, 1)

  return null
}
