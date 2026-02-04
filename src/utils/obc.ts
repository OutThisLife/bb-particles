import type { WebGLProgramParametersWithUniforms } from 'three'

type OBC = (s: WebGLProgramParametersWithUniforms) => void

export const obcInstanced: OBC = s => {
  s.vertexShader = s.vertexShader.replace(
    'void main() {',
    `attribute float opacity;
attribute vec3 iColor;
varying float vOpacity;
varying vec3 vIColor;
void main() {
  vOpacity = opacity;
  vIColor = iColor;`
  )

  s.fragmentShader = s.fragmentShader
    .replace(
      'void main() {',
      `varying float vOpacity;
varying vec3 vIColor;
void main() {`
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
diffuseColor.a *= vOpacity;
diffuseColor.rgb *= vIColor;`
    )
}

export const obcGradient: OBC = s => {
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPosition;\nvarying vec2 vUv;'
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvPosition = position;\nvUv = uv;'
    )

  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPosition;\nvarying vec2 vUv;'
    )
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - smoothstep(.2, 1., abs(vPosition.y) * .5 + .5);'
    )
}

export const obcChain =
  (...fns: OBC[]): OBC =>
  s =>
    fns.forEach(f => f(s))
