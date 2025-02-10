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

      gl_FragColor.a *= vOpacity;
      `
    )
}

export const obcGradient = (shader: WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vPosition;
      varying vec2 vUv;
      `
    )
    .replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>

      vPosition = position;
      vUv = uv;
      `
    )

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `
      #include <common>

      varying vec3 vPosition;
      varying vec2 vUv;
      `
    )
    .replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      float d = 1.0 - smoothstep(.2, 1., abs(vPosition.y) * .5 + .5);
      float taper = smoothstep(.95, 1., length(vPosition.xy - .5));

      diffuseColor.rgb *= d;
      // diffuseColor.a = taper * d * 1.;
      `
    )
}

export const obcChain =
  (...fns: Array<typeof obcAlpha>) =>
  (str: WebGLProgramParametersWithUniforms) =>
    fns.reduce((acc, fn) => (fn(acc), acc), str)
