uniform vec2 uResolution;

out vec2 vUv;
out vec3 vNormal;
out vec3 vPos;
out vec3 vUvRes;
out vec3 vResolution;

void main() {
  vUv = uv;
  vPos = position;
  vNormal = normalMatrix * normal;
  vUvRes = vec3(normalize(uResolution.xy), uResolution.x / uResolution.y);
  vResolution = vec3(uResolution, uResolution.x / uResolution.y);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
}