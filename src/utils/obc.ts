import type { WebGLProgramParametersWithUniforms } from 'three'

export const obcAlpha = (shader: WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader.replace(
    'void main() {',
    `
    attribute float opacity;
    varying float vOpacity;
    void main() { vOpacity = opacity;
    `
  )

  shader.fragmentShader = shader.fragmentShader
    .replace(
      'void main() {',
      `
      varying float vOpacity;
      void main() {
      `
    )
    .replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      gl_FragColor = vec4(outgoingLight, vOpacity);
      `
    )
}
