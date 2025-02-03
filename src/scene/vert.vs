uniform float uProgress;
uniform sampler2D uChannel0;
uniform int uSteps;
uniform float uStep;
uniform float uTime;
uniform float uPointSize;
uniform float uAlpha;

in vec2 particleIndex;
in float layerIndex;

out float vAlpha;
out vec2 vUv;
out vec3 vPosition;

void main() {
  float idx = uProgress * float(uSteps);

  float curIdx = floor(particleIndex.x * float(uSteps));
  int prevIdx = int(floor(idx));
  int nextIdx = min(prevIdx + 1, uSteps);

  float totalParticles = float(textureSize(uChannel0, 0).x);
  float uvX = floor(particleIndex.x * totalParticles) / totalParticles;

  vec3 prev = texture(uChannel0, vec2(uvX, float(prevIdx) * uStep)).xyz;
  vec3 next = texture(uChannel0, vec2(uvX, float(nextIdx) * uStep)).xyz;

  vec3 q = mix(prev, next, fract(idx));

  float speed = 1.;
  float strength = particleIndex.x * 0.005;
  float offset = particleIndex.x * 100.0 + particleIndex.y * 100.0;

  // q.x += sin(uTime * speed * 0.8 + offset) * strength * 0.5;
  // q.y += sin(uTime * speed + offset) * strength;
  // q.z += cos(uTime * speed * 1.2 + offset) * strength * 0.5;

  gl_PointSize = uPointSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1);

  vAlpha = (1. - curIdx / float(uSteps)) * (uAlpha * 2.);
  vPosition = q;
  vUv = uv;
}