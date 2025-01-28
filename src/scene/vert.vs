uniform float mixFactor;
uniform sampler2D positionsTexture;
uniform int numKeyframes;
uniform float keyframeStep;
uniform float pointSize;

in vec2 particleIndex;
out vec2 vUv;

void main() {
  float totalSteps = float(numKeyframes - 1);
  float floatIndex = mixFactor * totalSteps;

  int prevIndex = int(floor(floatIndex));
  int nextIndex = min(prevIndex + 1, numKeyframes - 1);

  float totalParticles = float(textureSize(positionsTexture, 0).x);
  float uvX = floor(particleIndex.x * totalParticles) / totalParticles;

  vec3 prev =
      texture(positionsTexture, vec2(uvX, float(prevIndex) * keyframeStep)).xyz;

  vec3 next =
      texture(positionsTexture, vec2(uvX, float(nextIndex) * keyframeStep)).xyz;

  vec3 morphedPosition = mix(prev, next, fract(floatIndex));

  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(morphedPosition, 1.0);
  vUv = particleIndex;
}
