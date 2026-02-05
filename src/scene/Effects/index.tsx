import { extend, useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useRef } from 'react'
import { EffectComposer, RenderPass } from 'three/examples/jsm/Addons.js'

import type { DitherType, MatrixSize } from './DitherPass'
import { DitherPass } from './DitherPass'

extend({ DitherPass, EffectComposer, RenderPass })

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

  const dither = useControls(
    'Dither',
    {
      bias: { label: 'Bias', max: 1, min: 0, step: 0.01, value: 0.57 },
      colors: { label: 'Colors', max: 32, min: 2, step: 1, value: 6 },
      enabled: { label: 'Enabled', value: false },
      grayscale: { label: 'Grayscale', value: false },
      matrix: {
        label: 'Matrix',
        options: MATRIX_SIZES,
        value: 4 as MatrixSize
      },
      scale: { label: 'Scale', max: 8, min: 0.25, step: 0.25, value: 8 },
      strength: { label: 'Strength', max: 1, min: 0, step: 0.01, value: 0.78 },
      type: {
        label: 'Type',
        options: DITHER_TYPES,
        value: 'bayer' as DitherType
      }
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

  // Resize handling
  useEffect(() => {
    fx.setSize(size.width, size.height)
  }, [fx, size])

  useFrame(() => void fx?.render(), 1)

  return null
}
