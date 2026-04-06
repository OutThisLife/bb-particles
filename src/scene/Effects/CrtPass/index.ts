import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

import vertexShader from '../AfterPass/vert.vs'

import fragmentShader from './frag.fs'

export type MaskType = 'none' | 'shadow' | 'grille' | 'stretched' | 'vga'

export interface CrtOptions {
  bleed?: number
  scanlines?: number
  mask?: MaskType
  maskStrength?: number
  bloom?: number
  warp?: number
  brightness?: number
  scale?: number
}

const MASK_MAP: Record<MaskType, number> = {
  none: 0,
  shadow: 1,
  grille: 2,
  stretched: 3,
  vga: 4
}

const UNIFORMS = {
  bleed: { value: 0.4 },
  bloomAmt: { value: 0.15 },
  bright: { value: 1.0 },
  maskStrength: { value: 0.5 },
  maskType: { value: 2 },
  resolution: { value: new THREE.Vector2(1, 1) },
  scale: { value: 1.5 },
  scanlines: { value: 0.3 },
  tDiffuse: { value: null as THREE.Texture | null },
  warpAmt: { value: 0.0 }
}

export class CrtPass extends Pass {
  uniforms: typeof UNIFORMS
  private material: THREE.ShaderMaterial
  private fsQuad: FullScreenQuad

  constructor(opts: CrtOptions = {}) {
    super()

    this.uniforms = THREE.UniformsUtils.clone(UNIFORMS)
    this.material = new THREE.ShaderMaterial({
      fragmentShader,
      uniforms: this.uniforms,
      vertexShader
    })
    this.fsQuad = new FullScreenQuad(this.material)

    ;(['bleed', 'scanlines', 'maskStrength', 'scale'] as const).forEach(
      k => opts[k] != null && (this.uniforms[k].value = opts[k])
    )

    if (opts.mask != null) this.uniforms.maskType.value = MASK_MAP[opts.mask]
    if (opts.bloom != null) this.uniforms.bloomAmt.value = opts.bloom
    if (opts.warp != null) this.uniforms.warpAmt.value = opts.warp
    if (opts.brightness != null) this.uniforms.bright.value = opts.brightness
  }

  set bleed(v: number) { this.uniforms.bleed.value = v }
  set scanlines(v: number) { this.uniforms.scanlines.value = v }
  set mask(v: MaskType) { this.uniforms.maskType.value = MASK_MAP[v] }
  set maskStrength(v: number) { this.uniforms.maskStrength.value = v }
  set bloom(v: number) { this.uniforms.bloomAmt.value = v }
  set warp(v: number) { this.uniforms.warpAmt.value = v }
  set brightness(v: number) { this.uniforms.bright.value = v }
  set scale(v: number) { this.uniforms.scale.value = v }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    this.uniforms.tDiffuse.value = readBuffer.texture
    this.uniforms.resolution.value.set(readBuffer.width, readBuffer.height)

    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    if (!this.renderToScreen && this.clear) renderer.clear()
    this.fsQuad.render(renderer)
  }

  setSize(width: number, height: number) {
    this.uniforms.resolution.value.set(width, height)
  }

  dispose() {
    this.material.dispose()
    this.fsQuad.dispose()
  }
}
