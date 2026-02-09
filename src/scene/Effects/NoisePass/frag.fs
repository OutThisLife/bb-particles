uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float size;
uniform float density;
uniform float opacity;

in vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
  return min(base / max(1.0 - blend, 0.001), 1.0);
}

void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  float s = size * (resolution.x / 1024.0);
  float n = hash(floor(vUv * resolution / s));
  float mask = step(1.0 - density, n) * opacity;
  vec3 blended = blendColorDodge(tex.rgb, vec3(n));
  gl_FragColor = vec4(mix(tex.rgb, blended, mask), tex.a);
}
