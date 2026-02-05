import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

import vertexShader from '../AfterPass/vert.vs'

import fragmentShader from './frag.fs'

export type DitherType =
  | 'bayer'
  | 'noise'
  | 'halftone'
  | 'crosshatch'
  | 'random'
export type MatrixSize = 2 | 4 | 8

export interface DitherOptions {
  strength?: number
  colorDepth?: number
  patternScale?: number
  bias?: number
  matrixSize?: MatrixSize
  ditherType?: DitherType
  grayscale?: boolean
}

const DITHER_TYPE_MAP: Record<DitherType, number> = {
  bayer: 0,
  crosshatch: 3,
  halftone: 2,
  noise: 1,
  random: 4
}

const DitherShader = {
  fragmentShader,
  uniforms: {
    bias: { value: 0.5 },
    colorDepth: { value: 4.0 },
    ditherType: { value: 0 },
    grayscale: { value: false },
    matrixSize: { value: 4 },
    patternScale: { value: 1.0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    strength: { value: 1.0 },
    tDiffuse: { value: null as THREE.Texture | null }
  },
  vertexShader
}

export class DitherPass extends Pass {
  uniforms: typeof DitherShader.uniforms
  private material: THREE.ShaderMaterial
  private fsQuad: FullScreenQuad

  constructor(options: DitherOptions = {}) {
    super()

    this.uniforms = THREE.UniformsUtils.clone(DitherShader.uniforms)

    if (options.strength !== undefined) {
      this.uniforms.strength.value = options.strength
    }

    if (options.colorDepth !== undefined) {
      this.uniforms.colorDepth.value = options.colorDepth
    }

    if (options.patternScale !== undefined) {
      this.uniforms.patternScale.value = options.patternScale
    }

    if (options.bias !== undefined) {
      this.uniforms.bias.value = options.bias
    }

    if (options.matrixSize !== undefined) {
      this.uniforms.matrixSize.value = options.matrixSize
    }

    if (options.ditherType !== undefined) {
      this.uniforms.ditherType.value = DITHER_TYPE_MAP[options.ditherType]
    }

    if (options.grayscale !== undefined) {
      this.uniforms.grayscale.value = options.grayscale
    }

    this.material = new THREE.ShaderMaterial({
      fragmentShader,
      uniforms: this.uniforms,
      vertexShader
    })

    this.fsQuad = new FullScreenQuad(this.material)
  }

  // Setters for live updates
  set strength(v: number) {
    this.uniforms.strength.value = v
  }
  get strength() {
    return this.uniforms.strength.value
  }

  set colorDepth(v: number) {
    this.uniforms.colorDepth.value = v
  }
  get colorDepth() {
    return this.uniforms.colorDepth.value
  }

  set patternScale(v: number) {
    this.uniforms.patternScale.value = v
  }
  get patternScale() {
    return this.uniforms.patternScale.value
  }

  set bias(v: number) {
    this.uniforms.bias.value = v
  }
  get bias() {
    return this.uniforms.bias.value
  }

  set matrixSize(v: MatrixSize) {
    this.uniforms.matrixSize.value = v
  }
  get matrixSize() {
    return this.uniforms.matrixSize.value as MatrixSize
  }

  set ditherType(v: DitherType) {
    this.uniforms.ditherType.value = DITHER_TYPE_MAP[v]
  }

  set grayscale(v: boolean) {
    this.uniforms.grayscale.value = v
  }
  get grayscale() {
    return this.uniforms.grayscale.value
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    this.uniforms.tDiffuse.value = readBuffer.texture
    this.uniforms.resolution.value.set(readBuffer.width, readBuffer.height)

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
      this.fsQuad.render(renderer)
    } else {
      renderer.setRenderTarget(writeBuffer)

      if (this.clear) {
        renderer.clear()
      }

      this.fsQuad.render(renderer)
    }
  }

  setSize(width: number, height: number) {
    this.uniforms.resolution.value.set(width, height)
  }

  dispose() {
    this.material.dispose()
    this.fsQuad.dispose()
  }
}
