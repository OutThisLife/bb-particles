import { extend, useFrame, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  AfterimagePass,
  EffectComposer,
  RenderPass,
  ShaderPass
} from 'three/examples/jsm/Addons.js'
import RGBADelayShader from './rgba-delay'

extend({ EffectComposer, RenderPass, ShaderPass, AfterimagePass })

export default function Effects() {
  const { gl, scene, camera, size } = useThree()

  const maxFrames = 10
  const frameBuffer = useRef<THREE.WebGLRenderTarget[]>([])
  const frameIndex = useRef(0)

  const afterimageTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(size.width, size.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType
      }),
    [size]
  )

  const copyMaterial = useMemo(() => new THREE.MeshBasicMaterial(), [])
  const copyScene = useMemo(() => new THREE.Scene(), [])
  const copyCamera = useMemo(() => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    camera.position.z = 1
    return camera
  }, [])

  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial)
    copyScene.add(quad)
  }, [copyMaterial, copyScene])

  const fx = useMemo(() => new EffectComposer(gl), [gl])

  const { afterimageEnabled, afterimageAmount } = useControls('Afterimage', {
    afterimageEnabled: true,
    afterimageAmount: { value: 0.998, min: 0, max: 1, step: 0.001 }
  })

  const {
    dryWet,
    gain,
    refractAmount,
    enabled,
    redDelay,
    greenDelay,
    blueDelay,
    alphaDelay
  } = useControls('RGBA Delay', {
    enabled: true,
    delays: folder({
      redDelay: { value: 1, min: 0, max: maxFrames - 1, step: 1 },
      greenDelay: { value: 2, min: 0, max: maxFrames - 1, step: 1 },
      blueDelay: { value: 3, min: 0, max: maxFrames - 1, step: 1 },
      alphaDelay: { value: 0, min: 0, max: maxFrames - 1, step: 1 }
    }),
    accumulation: folder({
      gain: { value: 1.01, min: 0, max: 2, step: 0.01, label: 'Gain' }
    }),
    mixing: folder({
      dryWet: {
        value: 0.69,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Dry/Wet Mix'
      },
      refractAmount: { value: 0, min: 0, max: 0.01, step: 0.0001 }
    })
  })

  useEffect(() => {
    frameBuffer.current = Array.from(
      { length: maxFrames },
      () =>
        new THREE.WebGLRenderTarget(size.width, size.height, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.HalfFloatType
        })
    )

    fx.setSize(size.width, size.height)
    fx.addPass(new RenderPass(scene, camera))

    const rgbaDelayPass = new ShaderPass(RGBADelayShader)
    frameBuffer.current.forEach((buffer, i) => {
      rgbaDelayPass.uniforms[`frame${i}`].value = buffer.texture
    })

    fx.addPass(rgbaDelayPass)

    return () => {
      frameBuffer.current.forEach(b => b.dispose())
      afterimageTarget.dispose()
    }
  }, [fx, scene, camera, size, afterimageTarget])

  const afterimagePass = useMemo(
    () => (afterimageEnabled ? new AfterimagePass(afterimageAmount) : null),
    [afterimageAmount, afterimageEnabled]
  )

  useFrame(({ clock }) => {
    const rgbaPass = fx.passes.find(p => p instanceof ShaderPass) as ShaderPass

    if (enabled && rgbaPass) {
      rgbaPass.uniforms.time.value = clock.elapsedTime
      rgbaPass.uniforms.dryWet.value = dryWet
      rgbaPass.uniforms.gain.value = gain
      rgbaPass.uniforms.refractAmount.value = refractAmount
      rgbaPass.uniforms.redDelay.value = redDelay
      rgbaPass.uniforms.greenDelay.value = greenDelay
      rgbaPass.uniforms.blueDelay.value = blueDelay
      rgbaPass.uniforms.alphaDelay.value = alphaDelay

      // Render scene to fx.readBuffer
      gl.setRenderTarget(fx.readBuffer)
      gl.clear()
      gl.render(scene, camera)

      // Afterimage: fx.readBuffer -> afterimageTarget
      afterimagePass?.render(
        gl,
        afterimageTarget,
        fx.readBuffer,
        clock.elapsedTime,
        false
      )

      // Copy afterimageTarget to current delay frame
      gl.setRenderTarget(frameBuffer.current[frameIndex.current])
      copyMaterial.map = afterimageTarget.texture
      gl.render(copyScene, copyCamera)

      // Update delay frame pointers
      frameIndex.current = (frameIndex.current + 1) % maxFrames
      for (let i = 0; i < maxFrames; i++) {
        const bufferIdx = (frameIndex.current - i - 1 + maxFrames) % maxFrames
        rgbaPass.uniforms[`frame${i}`].value =
          frameBuffer.current[bufferIdx].texture
      }

      // Final render to screen
      gl.setRenderTarget(null)
      fx.render()
    }
  }, 1)

  return null
}
