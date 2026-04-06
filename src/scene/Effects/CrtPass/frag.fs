uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float bleed;
uniform float scanlines;
uniform float maskStrength;
uniform int maskType;
uniform float bloomAmt;
uniform float warpAmt;
uniform float bright;
uniform float scale;

in vec2 vUv;

// Lottes CRT — Gaussian beam kernels model phosphor bleed and scanline falloff.
// Operates on the captured display image so the base render stays untouched.

float hardPix, hardScan, mDark, mLight;
vec2 crtRes;

vec3 fetch(vec2 pos, vec2 off) {
  pos = (floor(pos * crtRes + off) + 0.5) / crtRes;
  return bright * texture2D(tDiffuse, clamp(pos, 0.0, 1.0)).rgb;
}

vec2 dist(vec2 pos) {
  return -((pos * crtRes - floor(pos * crtRes)) - 0.5);
}

float gaus(float pos, float s) {
  return exp2(s * pos * pos);
}

vec3 horz3(vec2 pos, float off) {
  vec3 b = fetch(pos, vec2(-1.0, off));
  vec3 c = fetch(pos, vec2( 0.0, off));
  vec3 d = fetch(pos, vec2( 1.0, off));
  float dst = dist(pos).x;
  float wb = gaus(dst - 1.0, hardPix);
  float wc = gaus(dst,       hardPix);
  float wd = gaus(dst + 1.0, hardPix);
  return (b * wb + c * wc + d * wd) / (wb + wc + wd);
}

vec3 horz5(vec2 pos, float off) {
  vec3 a = fetch(pos, vec2(-2.0, off));
  vec3 b = fetch(pos, vec2(-1.0, off));
  vec3 c = fetch(pos, vec2( 0.0, off));
  vec3 d = fetch(pos, vec2( 1.0, off));
  vec3 e = fetch(pos, vec2( 2.0, off));
  float dst = dist(pos).x;
  float wa = gaus(dst - 2.0, hardPix);
  float wb = gaus(dst - 1.0, hardPix);
  float wc = gaus(dst,       hardPix);
  float wd = gaus(dst + 1.0, hardPix);
  float we = gaus(dst + 2.0, hardPix);
  return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
}

vec3 horz7(vec2 pos, float off) {
  float bp = mix(-3.0, -0.5, bloomAmt);
  vec3 a = fetch(pos, vec2(-3.0, off));
  vec3 b = fetch(pos, vec2(-2.0, off));
  vec3 c = fetch(pos, vec2(-1.0, off));
  vec3 d = fetch(pos, vec2( 0.0, off));
  vec3 e = fetch(pos, vec2( 1.0, off));
  vec3 f = fetch(pos, vec2( 2.0, off));
  vec3 g = fetch(pos, vec2( 3.0, off));
  float dst = dist(pos).x;
  float wa = gaus(dst - 3.0, bp);
  float wb = gaus(dst - 2.0, bp);
  float wc = gaus(dst - 1.0, bp);
  float wd = gaus(dst,       bp);
  float we = gaus(dst + 1.0, bp);
  float wf = gaus(dst + 2.0, bp);
  float wg = gaus(dst + 3.0, bp);
  return (a*wa + b*wb + c*wc + d*wd + e*we + f*wf + g*wg) /
         (wa + wb + wc + wd + we + wf + wg);
}

float scan(vec2 pos, float off) {
  return gaus(dist(pos).y + off, hardScan);
}

float bloomScan(vec2 pos, float off) {
  return gaus(dist(pos).y + off, mix(-4.0, -1.0, bloomAmt));
}

vec3 tri(vec2 pos) {
  vec3 a = horz3(pos, -1.0);
  vec3 b = horz5(pos,  0.0);
  vec3 c = horz3(pos,  1.0);
  return a * scan(pos, -1.0) + b * scan(pos, 0.0) + c * scan(pos, 1.0);
}

vec3 bloom(vec2 pos) {
  vec3 a = horz5(pos, -2.0);
  vec3 b = horz7(pos, -1.0);
  vec3 c = horz7(pos,  0.0);
  vec3 d = horz7(pos,  1.0);
  vec3 e = horz5(pos,  2.0);
  return a * bloomScan(pos, -2.0) + b * bloomScan(pos, -1.0) +
         c * bloomScan(pos,  0.0) + d * bloomScan(pos,  1.0) +
         e * bloomScan(pos,  2.0);
}

vec2 warpUv(vec2 pos) {
  pos = pos * 2.0 - 1.0;
  pos *= vec2(1.0 + pos.y * pos.y * warpAmt, 1.0 + pos.x * pos.x * warpAmt);
  return pos * 0.5 + 0.5;
}

vec3 rgbStripe(float x) {
  vec3 m = vec3(mDark);
  x = fract(x);
  if      (x < 0.333) m.r = mLight;
  else if (x < 0.666) m.g = mLight;
  else                 m.b = mLight;
  return m;
}

vec3 mask(vec2 pos) {
  if (maskType == 1) {
    float odd = step(0.5, fract(pos.x / 6.0));
    float line = mix(mLight, mDark, step(0.5, fract((pos.y + odd) * 0.5)));
    return rgbStripe(pos.x / 3.0) * line;
  }

  if (maskType == 2) return rgbStripe(pos.x / 3.0);

  if (maskType == 3) return rgbStripe((pos.x + pos.y * 3.0) / 6.0);

  vec2 p = floor(pos * vec2(1.0, 0.5));
  return rgbStripe((p.x + p.y * 3.0) / 6.0);
}

void main() {
  hardPix  = mix(-20.0, -0.5, bleed);
  hardScan = mix(-20.0, -4.0, scanlines);
  mDark    = mix(1.0, 0.3, maskStrength);
  mLight   = mix(1.0, 1.8, maskStrength);
  crtRes   = resolution / scale;

  vec2 pos = warpAmt > 0.0 ? warpUv(vUv) : vUv;
  vec3 color = tri(pos);

  if (bloomAmt > 0.0) color += bloom(pos) * bloomAmt;
  if (maskType > 0)   color *= mask(gl_FragCoord.xy);

  gl_FragColor = vec4(color, 1.0);
}
