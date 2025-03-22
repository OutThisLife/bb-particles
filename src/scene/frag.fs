precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uZoom;

in vec2 vUv;
out vec4 fragColor;

#define PI 3.14159265358979323846

#define t uTime
#define saturate(x) clamp(x, 0.0, 1.0)
#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))
#define aa max(length(1.0 / uResolution.xy * uZoom), 0.001)

const vec3 lin = vec3(.976, .969, .816);

vec3 getGradient(float x) {
  vec3 col = lin;

  if (x < 0.25) {
    col *= mix(0.5, 1.0, x * 4.0); // 0-25%
  } else if (x < 0.5) {
    col *= mix(1.0, 0.0, (x - 0.25) * 4.0); // 25-50%
  } else if (x < 0.75) {
    col *= mix(0.0, 1.0, (x - 0.5) * 4.0); // 50-75%
  } else {
    col *= mix(1.0, 0.5, (x - 0.75) * 4.0); // 75-100%
  }

  return lin * col;
}

float U(float d) { return saturate(smoothstep(aa, 0., abs(d) - aa)); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

float sdiff(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

void draw(vec2 p, inout vec4 col, float scale, float alpha) {
  float d = U(sdBox(p, vec2(scale)));

  // col = mix(col, vec4(lin, alpha), d);
  col = mix(col, vec4(lin * lin - getGradient(length(p)), alpha), d);
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = (vUv - 0.5) * 2.0;
  uv *= uResolution.xy / min(uResolution.x, uResolution.y);
  uv /= uZoom;

  float t = uTime;
  vec4 col;

  // Boxes
  {
    const int STEPS = 30;
    const int DRAW_COUNT = 3;

    for (int i = 0; i < STEPS; i++) {
      float n = float(i), s = float(STEPS);
      float idx = (n + 1.) / s;
      float alt = n * (i % 2 == 0 ? 1. : -1.);

      float scale = .1 + idx * .9;
      scale = .5;

      vec2 p = uv * .3 * rot(radians(n * 5.));

      draw(p * pow(.82, 2.), col, scale, idx * .05);
      draw(p * pow(.82, 3.), col, scale, idx * .01);
      draw(p * pow(.82, 4.), col, scale, idx * .02);
      draw(p, col, scale, idx * 3.);
      draw(p * 1.5, col, scale, idx * .1);
      draw(p * pow(1.5, 2.), col, scale, idx * .1);
      draw(p * pow(1.5, 3.), col, scale, idx * .05);
      draw(p * pow(1.5, 4.), col, scale, idx * .05);
    }
  }

  fragColor = saturate(col);
}