uniform float uTime;

out vec4 fragColor;

void main() {
  vec2 st = gl_PointCoord;

  fragColor = vec4(1);
  fragColor.a = 1. - smoothstep(0.2, 0.5, length(gl_PointCoord - vec2(0.5)));
}
