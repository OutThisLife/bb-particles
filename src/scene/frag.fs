uniform float uTime;

in float vAlpha;
in vec3 vLighting;
in vec3 vWorldPos;

out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  float alpha = vAlpha * (1. - smoothstep(0.2, 0.9, d));

  if (alpha < 0.01) discard;

  vec3 baseColor = vec3(0.9, 0.95, 1.0);
  vec3 lit = baseColor * vLighting;

  float spec = pow(1.0 - d * 2.0, 3.0) * 0.3;
  lit += vec3(spec);

  fragColor = vec4(lit, alpha);
}
