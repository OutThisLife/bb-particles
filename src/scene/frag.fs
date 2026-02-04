uniform vec3 uColor;

#ifndef saturate
#define saturate(x) clamp(x, 0., 1.)
#endif

varying float vOpacity;
varying vec3 vPosition;

void main() {
  if (vOpacity < 0.01) discard;

  vec3 col = uColor * (1. - length(vPosition - .5) * 3.);

  gl_FragColor = saturate(vec4(col, vOpacity));
}
