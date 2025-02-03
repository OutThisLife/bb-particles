uniform float uTime;
uniform sampler2D tDiffuse;
uniform sampler2D uShadowMap;
uniform vec2 uResolution;

#ifndef saturate
#define saturate(x) clamp(x, 0., 1.)
#endif

in float vAlpha;
in vec2 vUv;
in vec3 vPosition;

out vec4 fragColor;

void main() {
  vec2 st = gl_FragCoord.xy / uResolution;
  float alpha = 1. - smoothstep(.1, .5, length(st - .5));
  alpha = vAlpha;

  vec4 col = vec4(1);
  col.a = alpha;

  // col.rgb *= 1. - length(vPosition - .5) * 3.;

  if (alpha < 0.01) {
    // discard;
  }

#ifndef DEPTH_PASS
  // col.rgb *= texture(tDiffuse, st).r;
#endif

  fragColor = saturate(col);
}
