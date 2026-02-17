import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

import vertexShader from '../AfterPass/vert.vs'

import fragmentShader from './frag.fs'

export interface NoiseOptions {
  size?: number
  density?: number
  opacity?: number
}

const NoiseShader = {
  fragmentShader,
  uniforms: {
    density: { value: 0.11 },
    opacity: { value: 0.55 },
    resolution: { value: new THREE.Vector2(1, 1) },
    size: { value: 1.0 },
    tDiffuse: { value: null as THREE.Texture | null }
  },
  vertexShader
}

export class NoisePass extends Pass {
  uniforms: typeof NoiseShader.uniforms
  private material: THREE.ShaderMaterial
  private fsQuad: FullScreenQuad

  constructor(options: NoiseOptions = {}) {
    super()

    this.uniforms = THREE.UniformsUtils.clone(NoiseShader.uniforms)
    ;(['size', 'density', 'opacity'] as const).forEach(k => {
      if (options[k] !== undefined) {
        this.uniforms[k].value = options[k]
      }
    })

    this.material = new THREE.ShaderMaterial({
      fragmentShader,
      uniforms: this.uniforms,
      vertexShader
    })

    this.fsQuad = new FullScreenQuad(this.material)
  }

  set size(v: number) {
    this.uniforms.size.value = v
  }
  get size() {
    return this.uniforms.size.value
  }

  set density(v: number) {
    this.uniforms.density.value = v
  }
  get density() {
    return this.uniforms.density.value
  }

  set opacity(v: number) {
    this.uniforms.opacity.value = v
  }
  get opacity() {
    return this.uniforms.opacity.value
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
