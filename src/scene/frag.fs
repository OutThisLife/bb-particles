uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uPrevFrame;

in vec2 vUv;

#define NUM_OCTAVES 5

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);

  float res =
      mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
          mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
  return res * res;
}

float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100);
  // Rotate to reduce axial bias
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x = rot * x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution;
  vec2 uv = vUv;

  float t = uTime * .1;
  vec4 fbo = texture(uPrevFrame, uv);

  float scale = exp(sin(t));

  // Center and scale coordinates
  vec2 q = ((st - 0.5) * .2) + 0.5;

  float d = fbm((st - t) + fbm(q + fbm(q * q)));
  d = clamp(d, 0., 1.);
  d = max(d, fbm(q * q * q));

  vec3 col = vec3(d * 30., d, d * 10.) * .1;
  col *= .5 * mix(fbo.rgb, col, .01);
  // col = mix(fbo.rgb, vec3(d, 0, 0), col.r);

  gl_FragColor = vec4(col, 1);
}
