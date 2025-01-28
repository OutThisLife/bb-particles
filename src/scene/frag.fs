uniform float uTime;
uniform sampler2D tDiffuse;
uniform sampler2D uShadowMap;

in float vTwinkle;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 st = gl_PointCoord;
  float dist = length(st - vec2(.5));
  float alpha = 1. - smoothstep(.2, .4, dist);

  // Discard fully transparent pixels so they don't cast shadows
  if (alpha < 0.01) {
    discard;
  }

#ifdef DEPTH_PASS
  // During shadow pass, just output depth
  fragColor = vec4(1.0);
#else
  // Normal render pass
  fragColor =
      vec4((vec3(.9, .95, 1) * vTwinkle) * texture(tDiffuse, vUv).r, alpha);
#endif
}
