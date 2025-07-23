import { extend, useFrame, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  AfterimagePass,
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass
} from 'three/examples/jsm/Addons.js'
import RGBADelayShader from './rgba-delay'

extend({
  EffectComposer,
  RenderPass,
  ShaderPass,
  AfterimagePass,
  UnrealBloomPass
})

export default function Effects() {
  const { gl, scene, camera, size } = useThree()

  const bloomPassRef = useRef<UnrealBloomPass | null>(null)
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
    bloomEnabled,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    bloomScale
  } = useControls('Bloom', {
    bloomEnabled: true,
    bloomStrength: { value: 0.63, min: 0, max: 3, step: 0.01 },
    bloomRadius: { value: 0, min: 0, max: 1, step: 0.01 },
    bloomThreshold: { value: 0.88, min: 0, max: 1, step: 0.01 },
    bloomScale: {
      value: 0.5,
      min: 0.1,
      max: 1,
      step: 0.05,
      label: 'Resolution Scale'
    }
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
      redDelay: { value: 8, min: 0, max: maxFrames - 1, step: 1 },
      greenDelay: { value: 7, min: 0, max: maxFrames - 1, step: 1 },
      blueDelay: { value: 9, min: 0, max: maxFrames - 1, step: 1 },
      alphaDelay: { value: 0, min: 0, max: maxFrames - 1, step: 1 }
    }),
    gain: { value: 2, min: 0, max: 2, step: 0.01 },
    dryWet: {
      value: 0.09,
      min: 0,
      max: 1,
      step: 0.01
    },
    refractAmount: { value: 0.004, min: 0, max: 0.01, step: 0.0001 }
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

    // Bloom pass
    bloomPassRef.current = new UnrealBloomPass(
      new THREE.Vector2(size.width * bloomScale, size.height * bloomScale),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    )
    fx.addPass(bloomPassRef.current)

    return () => {
      frameBuffer.current.forEach(b => b.dispose())
      afterimageTarget.dispose()
      bloomPassRef.current = null
    }
  }, [fx, scene, camera, size, afterimageTarget])

  const afterimagePass = useMemo(
    () => (afterimageEnabled ? new AfterimagePass(afterimageAmount) : null),
    [afterimageAmount, afterimageEnabled]
  )

  useFrame(({ clock }) => {
    const rgbaPass = fx.passes.find(p => p instanceof ShaderPass) as ShaderPass

    // Ensure RGBA delay pass enabled state follows control before uniform updates
    if (rgbaPass) rgbaPass.enabled = enabled

    // Update bloom parameters each frame
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = bloomStrength
      bloomPassRef.current.radius = bloomRadius
      bloomPassRef.current.threshold = bloomThreshold
      bloomPassRef.current.enabled = bloomEnabled

      // Update internal render target dimensions according to scale
      const w = size.width * bloomScale
      const h = size.height * bloomScale
      bloomPassRef.current.setSize(w, h)
    }

    // RGBA Delay processing (only when pass enabled)
    if (rgbaPass?.enabled) {
      rgbaPass.uniforms.time.value = clock.elapsedTime
      rgbaPass.uniforms.dryWet.value = dryWet
      rgbaPass.uniforms.gain.value = gain
      rgbaPass.uniforms.refractAmount.value = refractAmount
      rgbaPass.uniforms.redDelay.value = redDelay
      rgbaPass.uniforms.greenDelay.value = greenDelay
      rgbaPass.uniforms.blueDelay.value = blueDelay
      rgbaPass.uniforms.alphaDelay.value = alphaDelay
    }

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

    rgbaPass.uniforms.motionFrame.value =
      frameBuffer.current[frameIndex.current].texture

    // Final render to screen
    gl.setRenderTarget(null)
    fx.render()
  }, 1)

  return null
}
