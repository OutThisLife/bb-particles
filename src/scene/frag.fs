in float vAlpha;
in vec3 vPosition;

out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  float alpha = vAlpha * step(d, 0.45);

  if (alpha < 0.001) discard;

  fragColor = vec4(vec3(1), alpha);
}
