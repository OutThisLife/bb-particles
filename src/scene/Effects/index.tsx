import { extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { EffectComposer, RenderPass } from 'three/examples/jsm/Addons.js'

import { useSmoothControls } from '@/hooks/useSmoothControls'

import type { DitherType, MatrixSize } from './DitherPass'
import { DitherPass } from './DitherPass'
import { NoisePass } from './NoisePass'

extend({ DitherPass, EffectComposer, NoisePass, RenderPass })

const DITHER_TYPES: DitherType[] = [
  'bayer',
  'noise',
  'halftone',
  'crosshatch',
  'random'
]

const MATRIX_SIZES: MatrixSize[] = [2, 4, 8]

export default function Effects() {
  const { camera, gl, scene, size } = useThree()
  const ditherRef = useRef<DitherPass>(null!)
  const noiseRef = useRef<NoisePass>(null!)

  const dither = useSmoothControls(
    'Dither',
    {
      bias: { max: 1, min: 0, step: 0.01, value: 0.57 },
      colors: { max: 32, min: 2, step: 1, value: 6 },
      enabled: { value: false },
      grayscale: { value: false },
      matrix: { options: MATRIX_SIZES, value: 4 as MatrixSize },
      scale: { max: 8, min: 0.25, step: 0.25, value: 8 },
      strength: { max: 1, min: 0, step: 0.01, value: 0.78 },
      type: { options: DITHER_TYPES, value: 'bayer' as DitherType }
    },
    { collapsed: true }
  )

  const noise = useSmoothControls(
    'Noise',
    {
      density: { max: 1, min: 0, step: 0.01, value: 0.11 },
      enabled: { value: false },
      opacity: { max: 1, min: 0, step: 0.01, value: 0.55 },
      size: { max: 3, min: 0.1, step: 0.1, value: 1 }
    },
    { collapsed: true }
  )

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))

    const ditherPass = new DitherPass({
      bias: dither.bias,
      colorDepth: dither.colors,
      ditherType: dither.type,
      grayscale: dither.grayscale,
      matrixSize: dither.matrix,
      patternScale: dither.scale,
      strength: dither.strength
    })

    ditherPass.enabled = dither.enabled
    ditherRef.current = ditherPass
    composer.addPass(ditherPass)

    const noisePass = new NoisePass({
      density: noise.density,
      opacity: noise.opacity,
      size: noise.size
    })

    noisePass.enabled = noise.enabled
    noiseRef.current = noisePass
    composer.addPass(noisePass)

    return composer
  }, [gl, scene, camera])

  // Sync dither controls
  useEffect(() => {
    if (!ditherRef.current) {
      return
    }

    ditherRef.current.enabled = dither.enabled
    ditherRef.current.strength = dither.strength
    ditherRef.current.colorDepth = dither.colors
    ditherRef.current.patternScale = dither.scale
    ditherRef.current.bias = dither.bias
    ditherRef.current.matrixSize = dither.matrix
    ditherRef.current.ditherType = dither.type
    ditherRef.current.grayscale = dither.grayscale
  }, [dither])

  // Sync noise controls
  useEffect(() => {
    if (!noiseRef.current) {
      return
    }

    noiseRef.current.enabled = noise.enabled
    noiseRef.current.size = noise.size
    noiseRef.current.density = noise.density
    noiseRef.current.opacity = noise.opacity
  }, [noise])

  // Resize handling
  useEffect(() => {
    fx.setSize(size.width, size.height)
  }, [fx, size])

  useFrame(() => void fx?.render(), 1)

  return null
}
