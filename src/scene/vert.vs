uniform float uProgress;
uniform sampler2D uChannel0;
uniform int uSteps;
uniform float uStep;
uniform float uTime;
uniform float uPointSize;
uniform float uAlpha;
uniform float uDpr;

in float particleIndex;
in vec3 instanceOffset;
in float instanceScale;
in float instanceRotation;
in float instanceLayer;

out float vAlpha;
out vec3 vPosition;

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
  float uvX = floor(particleIndex * totalParticles) / totalParticles;

  vec3 prev = texture(uChannel0, vec2(uvX, float(prevIdx) * uStep)).xyz;
  vec3 next = texture(uChannel0, vec2(uvX, float(nextIdx) * uStep)).xyz;

  vec3 q = mix(prev, next, fract(idx));

  q.xy = rotate2d(q.xy, instanceRotation);
  q *= instanceScale;
  q += instanceOffset;

  gl_PointSize = uPointSize * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1);

  vAlpha = (1. - instanceLayer) * uAlpha * 2.;
  vPosition = q;
}
