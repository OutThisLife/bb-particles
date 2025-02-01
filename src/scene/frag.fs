uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uChannel0;

in vec2 vUv;
in vec3 vPos;
in vec3 vNormal;
in vec3 vUvRes;
in vec3 vResolution;

// ------------------------------------------------------------

#define R vUvRes
#define Rpx vResolution
#define PI 3.14159265359
#define TWOPI 6.28318530718
#define PHI 2.61803398875
#define TAU 1.618033988749895

#ifndef saturate
#define saturate(a) clamp(a, 0., 1.)
#endif

#define S(a, b) step(a, b)
#define SM(a, b, v) smoothstep(a, b, v)
#define SME(v, r) SM(0., r / Rpx.x, v)
#define dot2(v) dot(v, v)
#define hue(v) (.6 + .6 * cos(6.3 * (v) + vec3(0, 23, 21)))
#define rot2d(a) mat2(cos(a), sin(a), -sin(a), cos(a))
#define rot3d(a) mat3(cos(a), sin(a), 0, -sin(a), cos(a), 0, 0, 0, 1)
#define mapLinear(x, a1, a2, b1, b2) b1 + (x - a1) * (b2 - b1) / (a2 - a1)

// ------------------------------------------------------------

#define NUM_OCTAVES 5

float rand(float n) { return fract(sin(n) * 43758.5453123); }

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(float p) {
  float fl = floor(p);
  float fc = fract(p);
  return mix(rand(fl), rand(fl + 1.0), fc);
}

float noise(vec2 n) {
  const vec2 d = vec2(0.0, 1.0);
  vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
  return mix(mix(rand(b), rand(b + d.yx), f.x),
             mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 perm(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

float noise(vec3 p) {
  vec3 a = floor(p);
  vec3 d = p - a;
  d = d * d * (3.0 - 2.0 * d);

  vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
  vec4 k1 = perm(b.xyxy);
  vec4 k2 = perm(k1.xyxy + b.zzww);

  vec4 c = k2 + a.zzzz;
  vec4 k3 = perm(c);
  vec4 k4 = perm(c + 1.0);

  vec4 o1 = fract(k3 * (1.0 / 41.0));
  vec4 o2 = fract(k4 * (1.0 / 41.0));

  vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
  vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

  return o4.y * d.y + o4.x * (1.0 - d.y);
}

float fbm(float x) {
  float v = 0.0;
  float a = 0.5;
  float shift = float(100);
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x = x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
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

float fbm(vec3 x) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100);
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x = x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// ------------------------------------------------------------

void main() {
  vec2 st = (vUv * 2. - 1.) / R.xy;
  vec2 uv = gl_FragCoord.xy / Rpx.xy;

  float t = uTime;
  vec2 uvt =
      vec2(fbm(vec2(t * 0.5, 23.4)), fbm(vec2(t * 0.5, 42.1))) * 2.0 - 1.0;

  vec4 fbo = saturate(texture(uChannel0, uv));
  vec4 col;

#if PASS == 0
  {
    vec2 q = (st * .8);
    q.x *= R.z;

    float d = max(fbm(st * 20. - vec2(0, t)), fbm(st * 20. + vec2(0, t)));
    d = mix(1. - d, .1 / length(q - uvt), 1.);
    d = pow(d, 1.2);

    col = mix(col, vec4(1, 0, 0, 1), d);
    col = mix(col, fbo, .99);
  }
#endif

#if PASS == 1
  {
    float dd = max(fbo.r, max(fbo.g, max(fbo.b, fbo.a))) * .23;

    // generate verticle noisy stripes
    float d = dd / fbm((st + (st * rot2d(fbo.a))).x * 30.);
    d = 1. - atan(d, SM(0., 1. - fbo.r, d));
    d = saturate(d);
    d *= rand(uv * 100.);

    col = mix(col, vec4(1, 0, .8, 1. - abs((st * rot2d(t * fbo.a)).y * 3.)), d);
    col = mix(col, vec4(.5, .5, .2, 1), d);
  }
#endif

  // col = mix(col, vec4(0, 0, 1, .1), 1. - rand(uv * 100.));
  col.rgb = mix(col.rgb, hue(uvt.x + fbo.a), fbo.a * .3);
  col.rgb = pow(col.rgb, vec3(1. / 2.2));

  gl_FragColor = saturate(col);
}
