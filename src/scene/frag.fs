precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uZoom;
uniform int uSteps;
uniform float uRotate;
uniform float uScale;

in vec2 vUv;
out vec4 fragColor;

#define PI 3.14159265358979323846
#define PHI 1.61803398874989484820
#define TAU 6.28318530717958647692

#define t uTime
#define saturate(x) clamp(x, 0.0, 1.0)
#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))
#define dot2(x) dot(x, x)
// #define aa max(length(1.0 / uResolution.xy * uZoom), 0.001)
#define aa (2.0 / min(uResolution.x, uResolution.y)) * uZoom
#define U(d) saturate(smoothstep(aa, 0., abs(d) - aa))

const vec3 bgColor = vec3(0.00024, 0.00024, 0.00024);
const vec3 baseColor = vec3(0.947, 0.934, 0.634); // #F9F7D0 in linear space
const vec3 accentColor = baseColor * .5;

float ndot(vec2 a, vec2 b) { return a.x * b.x - a.y * b.y; }

float smin(float a, float b, float k) {
  k *= 16.0 / 3.0;
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * (4.0 - h) * k * (1.0 / 16.0);
}

float smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

float opRound(in float d, in float r) { return d - r; }
float opOnion(in float d, in float r) { return abs(d) - r; }
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtraction(float d1, float d2) { return max(-d1, d2); }
float opIntersection(float d1, float d2) { return max(d1, d2); }
float opXor(float d1, float d2) { return max(min(d1, d2), -max(d1, d2)); }

float sdiff(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRoundedBox(in vec2 p, in vec2 b, in vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

float sdRhombus(in vec2 p, in vec2 b) {
  p = abs(p);
  float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}

float sdEquilateralTriangle(in vec2 p, in float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0)
    p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdPentagon(in vec2 p, in float r) {
  const vec3 k = vec3(0.809016994, 0.587785252, 0.726542528);
  p.x = abs(p.x);
  p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
  p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
  p -= vec2(clamp(p.x, -r * k.z, r * k.z), r);
  return length(p) * sign(p.y);
}

float sdOctogon(in vec2 p, in float r) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p);
  p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
  p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float sdHexagram(in vec2 p, in float r) {
  const vec4 k = vec4(-0.5, 0.8660254038, 0.5773502692, 1.7320508076);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= 2.0 * min(dot(k.yx, p), 0.0) * k.yx;
  p -= vec2(clamp(p.x, r * k.z, r * k.w), r);
  return length(p) * sign(p.y);
}

float sdStar5(in vec2 p, in float r, in float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

float sdArc(in vec2 p, in vec2 sc, in float ra, float rb) {
  // sc is the sin/cos of the arc's aperture
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra)
                                    : abs(length(p) - ra)) -
         rb;
}

float sdHeart(in vec2 p) {
  p.x = abs(p.x);

  if (p.y + p.x > 1.0)
    return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(p - vec2(0.00, 1.00)),
                  dot2(p - 0.5 * max(p.x + p.y, 0.0)))) *
         sign(p.x - p.y);
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdSegment(in vec2 p, in vec2 a, in vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = saturate(dot(pa, ba) / dot(ba, ba));

  return length(pa - ba * h);
}

vec3 getGradient(vec2 p) {
  vec3 col = mix(baseColor, accentColor, length(p) - .1);

  float d = atan(p.y, p.x) / (2.0 * PI) + 0.5;
  col *= 1.0 + 0.2 * sin(d * 6.0);

  return col;
}

void draw(vec2 p, inout vec4 col, float alpha) {
  float d = sdRoundedBox(p, vec2(.2), vec4(1. / TAU));
  d = opUnion(d, sdHeart(p - vec2(0, .1)));
  d = opUnion(d, sdHeart((p + vec2(0, .1)) * rot(PI)));
  d = U(d);

  col = mix(col, vec4(getGradient(vUv.xy), alpha), d);
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = (vUv - 0.5) * 2.0;
  uv *= uResolution.xy / min(uResolution.x, uResolution.y);
  uv /= uZoom;

  float t = uTime;
  vec4 col = vec4(bgColor, 1.);

  for (int i = 0; i < uSteps; i++) {
    float n = float(i), s = float(uSteps);
    float idx = (n + 1.) / s;
    float alt = n * (i % 2 == 0 ? 1. : -1.);

    float scale = 2. * pow(1. - (uScale / 10.), n);
    vec2 p = uv;
    p *= rot(radians(n * (uRotate * 10.)));

    draw(p * scale, col, idx);
    draw(p / scale, col, idx);
  }

  fragColor = saturate(col);
}