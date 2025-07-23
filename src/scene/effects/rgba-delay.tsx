const RGBADelayShader = {
  uniforms: {
    tDiffuse: { value: null },
    frame0: { value: null },
    frame1: { value: null },
    frame2: { value: null },
    frame3: { value: null },
    frame4: { value: null },
    frame5: { value: null },
    frame6: { value: null },
    frame7: { value: null },
    frame8: { value: null },
    frame9: { value: null },
    dryWet: { value: 1.0 },
    gain: { value: 1.0 },
    refractAmount: { value: 0.001 },
    time: { value: 0 },
    redDelay: { value: 2 },
    greenDelay: { value: 5 },
    blueDelay: { value: 9 },
    alphaDelay: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #define MAX_FRAMES 10
    uniform sampler2D tDiffuse;
    uniform sampler2D frame0;
    uniform sampler2D frame1;
    uniform sampler2D frame2;
    uniform sampler2D frame3;
    uniform sampler2D frame4;
    uniform sampler2D frame5;
    uniform sampler2D frame6;
    uniform sampler2D frame7;
    uniform sampler2D frame8;
    uniform sampler2D frame9;
    uniform float dryWet;
    uniform float gain;
    uniform float refractAmount;
    uniform float time;
    uniform int redDelay;
    uniform int greenDelay;
    uniform int blueDelay;
    uniform int alphaDelay;
    varying vec2 vUv;

    vec4 getFrame(int i, vec2 uv) {
      if (i == 0) return texture2D(frame0, uv);
      else if (i == 1) return texture2D(frame1, uv);
      else if (i == 2) return texture2D(frame2, uv);
      else if (i == 3) return texture2D(frame3, uv);
      else if (i == 4) return texture2D(frame4, uv);
      else if (i == 5) return texture2D(frame5, uv);
      else if (i == 6) return texture2D(frame6, uv);
      else if (i == 7) return texture2D(frame7, uv);
      else if (i == 8) return texture2D(frame8, uv);
      else return texture2D(frame9, uv);
    }

    vec2 offsetUV(vec2 uv, int delay) {
        float offset =  0.004 * float(delay);
        offset /= texture2D(tDiffuse, uv).a * 1.;
        offset = saturate(offset);

        if (refractAmount > 0.0) {
            vec2 warp = vec2(
            sin(uv.y * 20.0 + time * 2.0),
            cos(uv.x * 20.0 + time * 1.5)
            );
            return uv + normalize(warp) * offset * refractAmount * 100.0;
        } else {
            return uv + vec2(offset, 0.0);
        }
    }

    void main() {
      vec2 uvR = offsetUV(vUv, redDelay);
      vec2 uvG = offsetUV(vUv, greenDelay);
      vec2 uvB = offsetUV(vUv, blueDelay);
      vec2 uvA = offsetUV(vUv, alphaDelay);

      float r = getFrame(redDelay, uvR).r;
      float g = getFrame(greenDelay, uvG).g;
      float b = getFrame(blueDelay, uvB).b;
      float a = getFrame(alphaDelay, uvA).a;

      vec4 delayed = vec4(r, g, b, a) * gain;

      vec4 base = texture2D(tDiffuse, vUv);
      gl_FragColor = saturate(mix(base, delayed, dryWet));

    }
  `
} as const

export default RGBADelayShader
