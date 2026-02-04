import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

import fragmentShader from './frag.fs'
import vertexShader from './vert.vs'

const AfterImageShader = {
  fragmentShader,

  uniforms: {
    damp: { value: 0.96 },
    tNew: { value: new THREE.Texture() },
    tOld: { value: new THREE.Texture() }
  },
  vertexShader
}

export class CustomAfterPass extends Pass {
  private uniforms: typeof AfterImageShader.uniforms
  private textureComp: THREE.WebGLRenderTarget
  private textureOld: THREE.WebGLRenderTarget
  private compFsMaterial: THREE.ShaderMaterial
  private compFsQuad: FullScreenQuad
  private copyFsMaterial: THREE.ShaderMaterial
  private copyFsQuad: FullScreenQuad

  constructor(damp = 0.96) {
    super()

    this.uniforms = THREE.UniformsUtils.clone(AfterImageShader.uniforms)
    this.uniforms.damp.value = damp

    this.textureComp = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        format: THREE.RGBAFormat,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType
      }
    )

    this.textureOld = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        format: THREE.RGBAFormat,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType
      }
    )

    this.compFsMaterial = new THREE.ShaderMaterial({
      fragmentShader,
      uniforms: this.uniforms,
      vertexShader
    })

    this.compFsQuad = new FullScreenQuad(this.compFsMaterial)

    this.copyFsMaterial = new THREE.ShaderMaterial({
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      uniforms: { tDiffuse: { value: new THREE.Texture() } },
      vertexShader
    })

    this.copyFsQuad = new FullScreenQuad(this.copyFsMaterial)
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    this.uniforms.tOld.value = this.textureOld.texture
    this.uniforms.tNew.value = readBuffer.texture

    renderer.setRenderTarget(this.textureComp)
    this.compFsQuad.render(renderer)
    ;(
      this.copyFsQuad.material as THREE.ShaderMaterial
    ).uniforms.tDiffuse.value = this.textureComp.texture

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
      this.copyFsQuad.render(renderer)
    } else {
      renderer.setRenderTarget(writeBuffer)

      if (this.clear) {
        renderer.clear()
      }

      this.copyFsQuad.render(renderer)
    }

    const tmp = this.textureOld
    this.textureOld = this.textureComp
    this.textureComp = tmp
  }

  setSize(width: number, height: number) {
    this.textureComp.setSize(width, height)
    this.textureOld.setSize(width, height)
  }

  dispose() {
    this.textureComp.dispose()
    this.textureOld.dispose()
    this.compFsQuad.dispose()
    this.copyFsQuad.dispose()
  }
}
