uniform float uProgress;
uniform sampler2D uChannel0;
uniform int uSteps;
uniform float uStep;
uniform float uTime;
uniform float uPointSize;
uniform float uAlpha;
uniform float uDpr;

uniform vec3 uLight1Pos;
uniform vec3 uLight1Color;
uniform float uLight1Intensity;
uniform vec3 uLight2Pos;
uniform vec3 uLight2Color;
uniform float uLight2Intensity;
uniform float uAmbient;

in float particleIndex;
in vec3 instanceOffset;
in float instanceScale;
in float instanceRotation;
in float instanceLayer;

out float vAlpha;
out vec3 vLighting;
out vec3 vWorldPos;

vec2 rotate2d(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void main() {
  float steps = max(float(uSteps - 1), 1.);
  float idx = uProgress * steps;

  int prevIdx = int(floor(idx));
  int nextIdx = min(prevIdx + 1, uSteps - 1);

  float totalParticles = float(textureSize(uChannel0, 0).x);
  float uvX = (floor(particleIndex * totalParticles) + 0.5) / totalParticles;
  float uvYPrev = (float(prevIdx) + 0.5) * uStep;
  float uvYNext = (float(nextIdx) + 0.5) * uStep;

  vec3 prev = texture(uChannel0, vec2(uvX, uvYPrev)).xyz;
  vec3 next = texture(uChannel0, vec2(uvX, uvYNext)).xyz;

  vec3 q = mix(prev, next, fract(idx));

  // subtle floating
  float offset = particleIndex * 100.0 + instanceLayer * 50.0;
  float floatAmt = particleIndex * 0.005;
  q.x += sin(uTime * 0.8 + offset) * floatAmt * 0.5;
  q.y += sin(uTime + offset) * floatAmt;
  q.z += cos(uTime * 1.2 + offset) * floatAmt * 0.5;

  q.xy = rotate2d(q.xy, instanceRotation);
  q *= instanceScale;
  q += instanceOffset;

  vec4 worldPos = modelMatrix * vec4(q, 1.0);
  vWorldPos = worldPos.xyz;

  // calculate lighting from spotlights
  vec3 toLight1 = normalize(uLight1Pos - vWorldPos);
  vec3 toLight2 = normalize(uLight2Pos - vWorldPos);

  float dist1 = length(uLight1Pos - vWorldPos);
  float dist2 = length(uLight2Pos - vWorldPos);

  float atten1 = uLight1Intensity / (1.0 + dist1 * 0.05 + dist1 * dist1 * 0.01);
  float atten2 = uLight2Intensity / (1.0 + dist2 * 0.05 + dist2 * dist2 * 0.01);

  // simple diffuse-like lighting using position as implicit normal
  vec3 pseudoNormal = normalize(q);
  float diff1 = max(dot(pseudoNormal, toLight1), 0.0);
  float diff2 = max(dot(pseudoNormal, toLight2), 0.0);

  vLighting = uAmbient * vec3(1.0)
    + uLight1Color * diff1 * atten1
    + uLight2Color * diff2 * atten2;

  gl_PointSize = uPointSize * uDpr;
  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vAlpha = (1. - instanceLayer) * uAlpha * 2.;
}
