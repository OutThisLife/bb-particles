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

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

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

// Interleaved Gradient Noise - Jorge Jimenez (CoD: AW)
// Better than white noise, approximates blue noise properties
float interleavedGradientNoise(vec2 pos) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(pos, magic.xy)));
}

// Proper halftone - circular dots sized by luminance
float halftone(vec2 uv, float lum) {
  float cellSize = patternScale * 4.0;
  vec2 cellUv = fract(uv * resolution / cellSize) - 0.5;
  float dist = length(cellUv);
  float radius = (1.0 - lum) * 0.5;
  return smoothstep(radius + 0.05, radius - 0.05, dist);
}

// Crosshatch - multiple line layers based on luminance
float crosshatch(vec2 uv, float lum) {
  float scale = patternScale * 6.0;
  vec2 p = uv * resolution / scale;

  float line1 = abs(sin((p.x + p.y) * 3.14159));
  float line2 = abs(sin((p.x - p.y) * 3.14159));
  float line3 = abs(sin(p.x * 3.14159 * 2.0));
  float line4 = abs(sin(p.y * 3.14159 * 2.0));

  float result = 1.0;
  float lineWidth = 0.4;

  // Add more lines as luminance decreases
  if (lum < 0.8)
    result *= smoothstep(lineWidth, lineWidth + 0.1, line1);
  if (lum < 0.6)
    result *= smoothstep(lineWidth, lineWidth + 0.1, line2);
  if (lum < 0.4)
    result *= smoothstep(lineWidth, lineWidth + 0.1, line3);
  if (lum < 0.2)
    result *= smoothstep(lineWidth, lineWidth + 0.1, line4);

  return result;
}

// Noise-based dithering (white noise)
float whiteNoise(vec2 pos) {
  return fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
}

float getDitherThreshold(vec2 uv) {
  vec2 pos = uv * resolution / patternScale;
  ivec2 ipos = ivec2(floor(pos));

  if (ditherType == 0) {
    return getBayerValue(ipos);
  } else if (ditherType == 1) {
    return interleavedGradientNoise(floor(uv * resolution / patternScale));
  } else if (ditherType == 4) {
    return whiteNoise(pos);
  }
  return 0.5;
}

// Standard ordered dithering: add threshold noise, then quantize
vec3 orderedDither(vec3 color, float threshold) {
  float levels = colorDepth - 1.0;
  // Threshold in range [0,1], center at 0.5 and apply bias
  float t = (threshold - 0.5 + bias) / levels;
  // Add dither noise before quantizing
  vec3 dithered = color + t;
  // Quantize
  return floor(dithered * levels + 0.5) / levels;
}

void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  vec3 color = tex.rgb;
  float lum = luma(color);

  vec3 dithered;

  if (ditherType == 2) {
    // Halftone
    float h = halftone(vUv, lum);
    dithered = grayscale ? vec3(lum * h) : color * h;
  } else if (ditherType == 3) {
    // Crosshatch
    float c = crosshatch(vUv, lum);
    dithered = grayscale ? vec3(lum * c) : color * c;
  } else {
    // Ordered dithering (bayer, noise, random)
    float threshold = getDitherThreshold(vUv);

    if (grayscale) {
      float levels = colorDepth - 1.0;
      float t = (threshold - 0.5 + bias) / levels;
      float d = floor((lum + t) * levels + 0.5) / levels;
      dithered = vec3(d);
    } else {
      dithered = orderedDither(color, threshold);
    }
  }

  gl_FragColor = vec4(mix(color, dithered, strength), tex.a);
}
