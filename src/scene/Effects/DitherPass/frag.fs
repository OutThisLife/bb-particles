uniform sampler2D tDiffuse;
uniform float strength;
uniform float colorDepth;
uniform float patternScale;
uniform float bias;
uniform int matrixSize;
uniform int ditherType;
uniform bool grayscale;
uniform vec2 resolution;

in vec2 vUv;

const float REF_RES = 1024.0;

// Bayer matrices
const float bayer2[4] = float[4](0.0, 2.0, 3.0, 1.0);

const float bayer4[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                                   3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

const float bayer8[64] = float[64](
    0.0, 32.0, 8.0, 40.0, 2.0, 34.0, 10.0, 42.0, 48.0, 16.0, 56.0, 24.0, 50.0,
    18.0, 58.0, 26.0, 12.0, 44.0, 4.0, 36.0, 14.0, 46.0, 6.0, 38.0, 60.0, 28.0,
    52.0, 20.0, 62.0, 30.0, 54.0, 22.0, 3.0, 35.0, 11.0, 43.0, 1.0, 33.0, 9.0,
    41.0, 51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0, 15.0, 47.0, 7.0, 39.0,
    13.0, 45.0, 5.0, 37.0, 63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0);


float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float getBayerValue(ivec2 pos) {
  if (matrixSize == 2) {
    int idx = (pos.y % 2) * 2 + (pos.x % 2);
    return bayer2[idx] / 4.0;
  } else if (matrixSize == 4) {
    int idx = (pos.y % 4) * 4 + (pos.x % 4);
    return bayer4[idx] / 16.0;
  } else {
    int idx = (pos.y % 8) * 8 + (pos.x % 8);
    return bayer8[idx] / 64.0;
  }
}

// Interleaved Gradient Noise (Jorge Jimenez, CoD: AW)
float interleavedGradientNoise(vec2 pos) {
  vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(m.z * fract(dot(pos, m.xy)));
}


float getDitherThreshold(vec2 uv) {
  vec2 pos = uv * resolution / (patternScale * resolution.x / REF_RES);

  if (ditherType == 0) {
    // Bayer ordered dithering
    return getBayerValue(ivec2(floor(pos)));
  } else if (ditherType == 1) {
    // IGN (blue-noise-like)
    return interleavedGradientNoise(floor(pos));
  } else {
    // Halftone — radial dot threshold pattern
    vec2 cellUv = fract(pos / 4.0) - 0.5;
    return clamp(length(cellUv) * 2.0, 0.0, 1.0);
  }
}

void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  vec3 color = tex.rgb;

  float levels = colorDepth - 1.0;
  float t = (getDitherThreshold(vUv) - 0.5 + bias) / levels;

  vec3 dithered = grayscale
    ? vec3(floor((luma(color) + t) * levels + 0.5) / levels)
    : floor((color + t) * levels + 0.5) / levels;

  gl_FragColor = vec4(mix(color, dithered, strength), tex.a);
}
