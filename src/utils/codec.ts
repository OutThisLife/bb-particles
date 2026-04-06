// URL-safe binary encoding for scene params

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const zigzag = (n: number) => (n << 1) ^ (n >> 31)
const unzigzag = (n: number) => (n >>> 1) ^ -(n & 1)

const writeUVar = (buf: number[], v: number) => {
  while (v >= 128) {
    buf.push((v & 127) | 128)
    v >>>= 7
  }

  buf.push(v & 127)
}

const readUVar = (buf: number[], o: number): [number, number] => {
  let r = 0,
    n = 0,
    s = 0

  while (o + n < buf.length) {
    const b = buf[o + n]
    r |= (b & 127) << s
    n++

    if (!(b & 128)) {
      break
    }

    s += 7
  }

  return [r, n]
}

const writeSVar = (buf: number[], v: number) => writeUVar(buf, zigzag(v))

const readSVar = (buf: number[], o: number): [number, number] => {
  const [v, n] = readUVar(buf, o)

  return [unzigzag(v), n]
}

export type EncodedEntry = { value: any; disabled?: boolean }

export const toEntries = (flat: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { value: v }]))

export const encode = (data: Record<string, any>): string => {
  const buf: number[] = []

  for (const [key, entry] of Object.entries(data)) {
    if (entry?.value === undefined) {
      continue
    }

    const kb = Array.from(new TextEncoder().encode(key))
    buf.push(kb.length, ...kb)

    const isOptional = 'disabled' in entry
    const optBits = isOptional ? 8 | (entry.disabled ? 16 : 0) : 0

    const v = entry.value

    if (typeof v === 'number') {
      buf.push(0 | optBits)
      writeSVar(buf, Math.round(v * 1000))
    } else if (typeof v === 'boolean') {
      buf.push(1 | optBits, v ? 1 : 0)
    } else if (typeof v === 'string') {
      buf.push(2 | optBits)
      const sb = Array.from(new TextEncoder().encode(v))
      writeUVar(buf, sb.length)
      buf.push(...sb)
    } else if (typeof v === 'object' && v) {
      buf.push(3 | optBits)
      const ob = Array.from(new TextEncoder().encode(JSON.stringify(v)))
      writeUVar(buf, ob.length)
      buf.push(...ob)
    }
  }

  let out = ''

  for (let i = 0; i < buf.length; i += 3) {
    const c = (buf[i] << 16) | ((buf[i + 1] ?? 0) << 8) | (buf[i + 2] ?? 0)
    out += CHARS[(c >> 18) & 63] + CHARS[(c >> 12) & 63]

    if (i + 1 < buf.length) {
      out += CHARS[(c >> 6) & 63]
    }

    if (i + 2 < buf.length) {
      out += CHARS[c & 63]
    }
  }

  return out
}

export const decode = (str: string): Record<string, EncodedEntry> => {
  try {
    const buf: number[] = []

    for (let i = 0; i < str.length; i += 4) {
      const c0 = CHARS.indexOf(str[i])
      const c1 = CHARS.indexOf(str[i + 1])
      const c2 = i + 2 < str.length ? CHARS.indexOf(str[i + 2]) : 0
      const c3 = i + 3 < str.length ? CHARS.indexOf(str[i + 3]) : 0
      const c = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3

      buf.push((c >> 16) & 255)

      if (i + 2 < str.length) {
        buf.push((c >> 8) & 255)
      }

      if (i + 3 < str.length) {
        buf.push(c & 255)
      }
    }

    const result: Record<string, EncodedEntry> = {}
    let o = 0

    while (o < buf.length) {
      const kl = buf[o++]

      if (!kl || o + kl > buf.length) {
        break
      }

      const key = new TextDecoder().decode(new Uint8Array(buf.slice(o, o + kl)))
      o += kl

      const tb = buf[o++]

      if (tb === undefined) {
        break
      }

      const t = tb & 7
      const isOptional = (tb & 8) !== 0
      const disabled = (tb & 16) !== 0

      let value: any

      if (t === 0) {
        const [v, n] = readSVar(buf, o)
        value = v / 1000
        o += n
      } else if (t === 1) {
        value = buf[o++] === 1
      } else if (t === 2) {
        const [len, n] = readUVar(buf, o)
        o += n
        value = new TextDecoder().decode(new Uint8Array(buf.slice(o, o + len)))
        o += len
      } else if (t === 3) {
        const [len, n] = readUVar(buf, o)
        o += n
        value = JSON.parse(
          new TextDecoder().decode(new Uint8Array(buf.slice(o, o + len)))
        )
        o += len
      }

      result[key] = isOptional ? { disabled, value } : { value }
    }

    return result
  } catch {
    return {}
  }
}

// Flat params for headless rendering (no leva structure)
export type NoiseParams = {
  enabled: boolean
  density: number
  opacity: number
  size: number
}

export type CrtMask = 'none' | 'shadow' | 'grille' | 'stretched' | 'vga'

export type CrtParams = {
  enabled: boolean
  bleed: number
  bloom: number
  brightness: number
  mask: CrtMask
  maskStrength: number
  scale: number
  scanlines: number
  warp: number
}

export type SceneParams = {
  geometry: string
  geoWidth: number
  startAngle: number
  color: string
  gradientAngle: number
  gradientRange: [number, number]
  repetitions: number
  alphaFactor: number
  scaleFactor: number
  rotationFactor: number
  stepFactor: number
  scaleProgression: string
  rotationProgression: string
  alphaProgression: string
  positionProgression: string
  positionCoupled: boolean
  origin: string
  xStep: number
  yStep: number
  debug: boolean
  position: { x: number; y: number }
  rotation: number
  scale: number
  layers: LayerParams[]
  noise: NoiseParams
  crt: CrtParams
}

export type LayerParams = {
  position?: { x: number; y: number }
  rotation?: number
  scale?: { x: number; y: number }
  stepFactor?: number
  alphaFactor?: number
  scaleFactor?: number
  rotationFactor?: number
  color?: string
  geoWidth?: number
  geometry?: string
  startAngle?: number
}

export const DEFAULT_NOISE: NoiseParams = {
  enabled: false,
  density: 0.11,
  opacity: 0.11,
  size: 0.3
}

export const DEFAULT_CRT: CrtParams = {
  bleed: 0.4,
  bloom: 0.15,
  brightness: 1,
  enabled: false,
  mask: 'grille',
  maskStrength: 0.5,
  scale: 1.5,
  scanlines: 0.3,
  warp: 0
}

export const DEFAULT_PARAMS: SceneParams = {
  alphaFactor: 0.68,
  alphaProgression: 'exponential',
  color: '#efeddb',
  crt: DEFAULT_CRT,
  debug: false,
  geometry: 'ring',
  geoWidth: 0.041,
  gradientAngle: 0,
  gradientRange: [0.2, 1.0] as [number, number],
  layers: [
    {
      position: { x: -0.002669900489082666, y: -0.46229475798772235 },
      rotation: 0,
      scale: { x: -1, y: 1 }
    }
  ],
  noise: DEFAULT_NOISE,
  origin: 'top-center',
  position: { x: 0, y: -0.5 },
  positionCoupled: true,
  positionProgression: 'index',
  repetitions: 75,
  rotation: 0,
  rotationFactor: -0.48,
  rotationProgression: 'linear',
  scale: 0.4,
  scaleFactor: 1.03,
  scaleProgression: 'exponential',
  startAngle: 0,
  stepFactor: 0.02,
  xStep: -1.5,
  yStep: 0
}

const CRT_MASKS = new Set<string>([
  'none',
  'shadow',
  'grille',
  'stretched',
  'vga'
])

/** Training JSON / refs use noiseEnabled, crtBleed, … — lift into nested noise/crt for encode. */
export function withLegacyFlatNoiseCrt(
  params: Partial<SceneParams> & Record<string, unknown>
): Partial<SceneParams> {
  const p = params
  const out: Partial<SceneParams> = { ...p }

  if (
    !p.noise &&
    ('noiseEnabled' in p ||
      'noiseDensity' in p ||
      'noiseOpacity' in p ||
      'noiseSize' in p)
  ) {
    out.noise = {
      enabled: Boolean(p.noiseEnabled),
      density:
        typeof p.noiseDensity === 'number'
          ? p.noiseDensity
          : DEFAULT_NOISE.density,
      opacity:
        typeof p.noiseOpacity === 'number'
          ? p.noiseOpacity
          : DEFAULT_NOISE.opacity,
      size:
        typeof p.noiseSize === 'number' ? p.noiseSize : DEFAULT_NOISE.size
    }
  }

  if (
    !p.crt &&
    ('crtEnabled' in p ||
      'crtBleed' in p ||
      'crtBloom' in p ||
      'crtBrightness' in p ||
      'crtMask' in p ||
      'crtMaskStrength' in p ||
      'crtScale' in p ||
      'crtScanlines' in p ||
      'crtWarp' in p)
  ) {
    const rawMask = p.crtMask
    const mask =
      typeof rawMask === 'string' && CRT_MASKS.has(rawMask)
        ? (rawMask as CrtMask)
        : DEFAULT_CRT.mask

    out.crt = {
      enabled: Boolean(p.crtEnabled),
      bleed:
        typeof p.crtBleed === 'number' ? p.crtBleed : DEFAULT_CRT.bleed,
      bloom:
        typeof p.crtBloom === 'number' ? p.crtBloom : DEFAULT_CRT.bloom,
      brightness:
        typeof p.crtBrightness === 'number'
          ? p.crtBrightness
          : DEFAULT_CRT.brightness,
      mask,
      maskStrength:
        typeof p.crtMaskStrength === 'number'
          ? p.crtMaskStrength
          : DEFAULT_CRT.maskStrength,
      scale: typeof p.crtScale === 'number' ? p.crtScale : DEFAULT_CRT.scale,
      scanlines:
        typeof p.crtScanlines === 'number'
          ? p.crtScanlines
          : DEFAULT_CRT.scanlines,
      warp: typeof p.crtWarp === 'number' ? p.crtWarp : DEFAULT_CRT.warp
    }
  }

  return out
}

// Convert flat SceneParams back to leva format for encoding
export const fromSceneParams = (
  raw: Partial<SceneParams> & Record<string, unknown>
): Record<string, EncodedEntry> => {
  const params = withLegacyFlatNoiseCrt(raw)
  const result: Record<string, EncodedEntry> = {}

  const set = (key: string, value: any) => {
    if (value !== undefined) {
      result[key] = { value }
    }
  }

  set('Element.geometry', params.geometry)
  set('Element.geoWidth', params.geoWidth)
  set('Element.startAngle', params.startAngle)
  set('Element.color', params.color)
  set('Element.gradientAngle', params.gradientAngle)
  set('Element.gradientRange', params.gradientRange)
  set('Scalars.repetitions', params.repetitions)
  set('Scalars.alphaFactor', params.alphaFactor)
  set('Scalars.scaleFactor', params.scaleFactor)
  set('Scalars.rotationFactor', params.rotationFactor)
  set('Scalars.stepFactor', params.stepFactor)
  set('Scalars.scaleProgression', params.scaleProgression)
  set('Scalars.rotationProgression', params.rotationProgression)
  set('Scalars.alphaProgression', params.alphaProgression)
  set('Scalars.positionProgression', params.positionProgression)
  set('Scalars.positionCoupled', params.positionCoupled)
  set('Spatial.origin', params.origin)
  set('Spatial.xStep', params.xStep)
  set('Spatial.yStep', params.yStep)
  set('Scene.debug', params.debug)
  set('Scene.position', params.position)
  set('Scene.rotation', params.rotation)
  set('Scene.scale', params.scale)

  if (params.noise) {
    set('Noise.enabled', params.noise.enabled)
    set('Noise.density', params.noise.density)
    set('Noise.opacity', params.noise.opacity)
    set('Noise.size', params.noise.size)
  }

  if (params.crt) {
    set('CRT.enabled', params.crt.enabled)
    set('CRT.bleed', params.crt.bleed)
    set('CRT.bloom', params.crt.bloom)
    set('CRT.brightness', params.crt.brightness)
    set('CRT.mask', params.crt.mask)
    set('CRT.maskStrength', params.crt.maskStrength)
    set('CRT.scale', params.crt.scale)
    set('CRT.scanlines', params.crt.scanlines)
    set('CRT.warp', params.crt.warp)
  }

  params.layers?.forEach((layer, i) => {
    const pre = `Groups.g${i}.g${i}-`
    set(`${pre}position`, layer.position)
    set(`${pre}rotation`, layer.rotation)
    set(`${pre}scale`, layer.scale)

    if (layer.stepFactor !== undefined) {
      result[`${pre}stepFactor`] = { disabled: false, value: layer.stepFactor }
    }

    if (layer.alphaFactor !== undefined) {
      result[`${pre}alphaFactor`] = {
        disabled: false,
        value: layer.alphaFactor
      }
    }

    if (layer.scaleFactor !== undefined) {
      result[`${pre}scaleFactor`] = {
        disabled: false,
        value: layer.scaleFactor
      }
    }

    if (layer.rotationFactor !== undefined) {
      result[`${pre}rotationFactor`] = {
        disabled: false,
        value: layer.rotationFactor
      }
    }

    if (layer.color !== undefined) {
      result[`${pre}color`] = { disabled: false, value: layer.color }
    }

    if (layer.geoWidth !== undefined) {
      result[`${pre}geoWidth`] = { disabled: false, value: layer.geoWidth }
    }

    if (layer.geometry !== undefined) {
      result[`${pre}geometry`] = { disabled: false, value: layer.geometry }
    }

    if (layer.startAngle !== undefined) {
      result[`${pre}startAngle`] = { disabled: false, value: layer.startAngle }
    }
  })

  return result
}

// Convert decoded leva data to flat SceneParams
export const toSceneParams = (
  data: Record<string, EncodedEntry>
): SceneParams => {
  const get = <T>(key: string, def: T): T => (data[key]?.value as T) ?? def

  // Extract layers from Groups.g0.g0-*, Groups.g1.g1-*, etc.
  const layers: LayerParams[] = []
  let i = 0

  while (true) {
    const pre = `Groups.g${i}.g${i}-`

    if (!data[`${pre}position`] && !data[`${pre}scale`]) {
      break
    }

    const layer: LayerParams = {
      position: get(`${pre}position`, { x: 0, y: 0 }),
      rotation: get(`${pre}rotation`, 0),
      scale: get(`${pre}scale`, { x: -1, y: 1 })
    }

    if (data[`${pre}stepFactor`] && !data[`${pre}stepFactor`].disabled) {
      layer.stepFactor = data[`${pre}stepFactor`].value
    }

    if (data[`${pre}alphaFactor`] && !data[`${pre}alphaFactor`].disabled) {
      layer.alphaFactor = data[`${pre}alphaFactor`].value
    }

    if (data[`${pre}scaleFactor`] && !data[`${pre}scaleFactor`].disabled) {
      layer.scaleFactor = data[`${pre}scaleFactor`].value
    }

    if (
      data[`${pre}rotationFactor`] &&
      !data[`${pre}rotationFactor`].disabled
    ) {
      layer.rotationFactor = data[`${pre}rotationFactor`].value
    }

    if (data[`${pre}color`] && !data[`${pre}color`].disabled) {
      layer.color = data[`${pre}color`].value
    }

    if (data[`${pre}geoWidth`] && !data[`${pre}geoWidth`].disabled) {
      layer.geoWidth = data[`${pre}geoWidth`].value
    }

    if (data[`${pre}geometry`] && !data[`${pre}geometry`].disabled) {
      layer.geometry = data[`${pre}geometry`].value
    }

    if (data[`${pre}startAngle`] && !data[`${pre}startAngle`].disabled) {
      layer.startAngle = data[`${pre}startAngle`].value
    }

    layers.push(layer)
    i++
  }

  return {
    alphaFactor: get('Scalars.alphaFactor', DEFAULT_PARAMS.alphaFactor),
    alphaProgression: get(
      'Scalars.alphaProgression',
      DEFAULT_PARAMS.alphaProgression
    ),
    color: get('Element.color', DEFAULT_PARAMS.color),
    crt: {
      bleed: get('CRT.bleed', DEFAULT_CRT.bleed),
      bloom: get('CRT.bloom', DEFAULT_CRT.bloom),
      brightness: get('CRT.brightness', DEFAULT_CRT.brightness),
      enabled: get('CRT.enabled', DEFAULT_CRT.enabled),
      mask: get('CRT.mask', DEFAULT_CRT.mask),
      maskStrength: get('CRT.maskStrength', DEFAULT_CRT.maskStrength),
      scale: get('CRT.scale', DEFAULT_CRT.scale),
      scanlines: get('CRT.scanlines', DEFAULT_CRT.scanlines),
      warp: get('CRT.warp', DEFAULT_CRT.warp)
    },
    debug: get('Scene.debug', DEFAULT_PARAMS.debug),
    geometry: get('Element.geometry', DEFAULT_PARAMS.geometry),
    geoWidth: get('Element.geoWidth', DEFAULT_PARAMS.geoWidth),
    gradientAngle: get('Element.gradientAngle', DEFAULT_PARAMS.gradientAngle),
    gradientRange: get('Element.gradientRange', DEFAULT_PARAMS.gradientRange),
    layers,
    noise: {
      density: get('Noise.density', DEFAULT_NOISE.density),
      enabled: get('Noise.enabled', DEFAULT_NOISE.enabled),
      opacity: get('Noise.opacity', DEFAULT_NOISE.opacity),
      size: get('Noise.size', DEFAULT_NOISE.size)
    },
    origin: get('Spatial.origin', DEFAULT_PARAMS.origin),
    position: get('Scene.position', DEFAULT_PARAMS.position),
    positionCoupled: get(
      'Scalars.positionCoupled',
      DEFAULT_PARAMS.positionCoupled
    ),
    positionProgression: get(
      'Scalars.positionProgression',
      DEFAULT_PARAMS.positionProgression
    ),
    repetitions: get('Scalars.repetitions', DEFAULT_PARAMS.repetitions),
    rotation: get('Scene.rotation', DEFAULT_PARAMS.rotation),
    rotationFactor: get(
      'Scalars.rotationFactor',
      DEFAULT_PARAMS.rotationFactor
    ),
    rotationProgression: get(
      'Scalars.rotationProgression',
      DEFAULT_PARAMS.rotationProgression
    ),
    scale: get('Scene.scale', DEFAULT_PARAMS.scale),
    scaleFactor: get('Scalars.scaleFactor', DEFAULT_PARAMS.scaleFactor),
    scaleProgression: get(
      'Scalars.scaleProgression',
      DEFAULT_PARAMS.scaleProgression
    ),
    startAngle: get('Element.startAngle', DEFAULT_PARAMS.startAngle),
    stepFactor: get('Scalars.stepFactor', DEFAULT_PARAMS.stepFactor),
    xStep: get('Spatial.xStep', DEFAULT_PARAMS.xStep),
    yStep: get('Spatial.yStep', DEFAULT_PARAMS.yStep)
  }
}
