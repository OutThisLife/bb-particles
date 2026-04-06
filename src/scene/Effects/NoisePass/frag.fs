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

void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  vec3 color = tex.rgb;

  float s = max(size * (resolution.x / 1024.0), 1.0);
  vec2 cell = floor(vUv * resolution / s);
  float select = hash(cell);
  float value = hash(cell + vec2(127.1, 311.7)) - 0.5;
  float amount = step(1.0 - density, select) * opacity;
  color = clamp(color + vec3(value * amount), 0.0, 1.0);

  gl_FragColor = vec4(color, tex.a);
}
