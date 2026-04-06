import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { initVal } from '@/hooks/useLinkableControls'
import { useSmoothControls } from '@/hooks/useSmoothControls'

import type { MaskType } from './CrtPass'
import { CrtPass } from './CrtPass'
import { NoisePass } from './NoisePass'

const MASK_TYPES: MaskType[] = ['none', 'shadow', 'grille', 'stretched', 'vga']

const CRT_DEFAULTS = {
  bleed: 0.4,
  bloom: 0.15,
  brightness: 1.0,
  enabled: false,
  mask: 'grille' as MaskType,
  maskStrength: 0.5,
  scale: 1.5,
  scanlines: 0.3,
  warp: 0
}

const NOISE_DEFAULTS = {
  density: 0.11,
  enabled: false,
  opacity: 0.11,
  size: 0.3
}

const RT_OPTS = {
  depthBuffer: false,
  stencilBuffer: false,
  type: THREE.HalfFloatType
} as const

/** First pass reads this; later passes ping-pong WebGLRenderTargets. */
type ReadSource = {
  texture: THREE.Texture
  width: number
  height: number
}

export default function Effects() {
  const { camera, gl, scene, size } = useThree()

  const crt = useSmoothControls(
    'CRT',
    {
      bleed: { max: 1, min: 0, step: 0.01, value: initVal('CRT.bleed', CRT_DEFAULTS.bleed) },
      bloom: { max: 1, min: 0, step: 0.01, value: initVal('CRT.bloom', CRT_DEFAULTS.bloom) },
      brightness: {
        max: 2,
        min: 0.5,
        step: 0.01,
        value: initVal('CRT.brightness', CRT_DEFAULTS.brightness)
      },
      enabled: { value: initVal('CRT.enabled', CRT_DEFAULTS.enabled) },
      mask: { options: MASK_TYPES, value: initVal('CRT.mask', CRT_DEFAULTS.mask) },
      maskStrength: {
        max: 1,
        min: 0,
        step: 0.01,
        value: initVal('CRT.maskStrength', CRT_DEFAULTS.maskStrength)
      },
      scale: { max: 8, min: 1, step: 0.25, value: initVal('CRT.scale', CRT_DEFAULTS.scale) },
      scanlines: { max: 1, min: 0, step: 0.01, value: initVal('CRT.scanlines', CRT_DEFAULTS.scanlines) },
      warp: { max: 0.1, min: 0, step: 0.001, value: initVal('CRT.warp', CRT_DEFAULTS.warp) }
    },
    { collapsed: true }
  )

  const noise = useSmoothControls(
    'Noise',
    {
      density: { max: 1, min: 0, step: 0.01, value: initVal('Noise.density', NOISE_DEFAULTS.density) },
      enabled: { value: initVal('Noise.enabled', NOISE_DEFAULTS.enabled) },
      opacity: { max: 0.3, min: 0, step: 0.01, value: initVal('Noise.opacity', NOISE_DEFAULTS.opacity) },
      size: { max: 0.55, min: 0.1, step: 0.01, value: initVal('Noise.size', NOISE_DEFAULTS.size) }
    },
    { collapsed: true }
  )

  const fx = useMemo(() => {
    const capture = new THREE.FramebufferTexture(1, 1)
    capture.flipY = false

    const a = new THREE.WebGLRenderTarget(1, 1, RT_OPTS)
    const b = a.clone()

    const crt = new CrtPass({
      bleed: CRT_DEFAULTS.bleed,
      bloom: CRT_DEFAULTS.bloom,
      brightness: CRT_DEFAULTS.brightness,
      mask: CRT_DEFAULTS.mask,
      maskStrength: CRT_DEFAULTS.maskStrength,
      scale: CRT_DEFAULTS.scale,
      scanlines: CRT_DEFAULTS.scanlines,
      warp: CRT_DEFAULTS.warp
    })

    const noise = new NoisePass({
      density: NOISE_DEFAULTS.density,
      opacity: NOISE_DEFAULTS.opacity,
      size: NOISE_DEFAULTS.size
    })

    crt.enabled = CRT_DEFAULTS.enabled
    noise.enabled = NOISE_DEFAULTS.enabled

    return {
      capture,
      crt,
      input: { height: 1, texture: capture, width: 1 } as ReadSource,
      noise,
      targets: [a, b] as const
    }
  }, [])

  useEffect(
    () => () => {
      fx.capture.dispose()
      fx.targets.forEach(t => t.dispose())
      fx.crt.dispose()
      fx.noise.dispose()
    },
    [fx]
  )

  useEffect(() => {
    Object.assign(fx.crt, crt)
    Object.assign(fx.noise, noise)
  }, [crt, fx, noise])

  useEffect(() => {
    const pr = gl.getPixelRatio()
    const w = Math.max(1, Math.round(size.width * pr))
    const h = Math.max(1, Math.round(size.height * pr))

    fx.capture.image.width = w
    fx.capture.image.height = h
    fx.capture.needsUpdate = true
    fx.input.width = w
    fx.input.height = h
    fx.targets[0].setSize(w, h)
    fx.targets[1].setSize(w, h)
    fx.crt.setSize(w, h)
    fx.noise.setSize(w, h)
  }, [fx, gl, size])

  useFrame(() => {
    gl.setRenderTarget(null)
    gl.render(scene, camera)

    const chain = [fx.crt, fx.noise].filter(p => p.enabled)

    if (!chain.length) {
      return
    }

    gl.copyFramebufferToTexture(fx.capture)

    let read: ReadSource = fx.input
    let write = fx.targets[0]

    for (const [i, pass] of chain.entries()) {
      const last = i === chain.length - 1
      pass.renderToScreen = last
      pass.render(gl, write, read as THREE.WebGLRenderTarget)

      if (!last && pass.needsSwap) {
        read = write
        write = write === fx.targets[0] ? fx.targets[1] : fx.targets[0]
      }
    }
  }, 1)

  return null
}
