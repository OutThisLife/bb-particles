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
export type DitherParams = {
  enabled: boolean
  type: string
  matrix: number
  colors: number
  strength: number
  scale: number
  bias: number
  grayscale: boolean
}

export type SceneParams = {
  geometry: string
  color: string
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
  dither: DitherParams
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
  geometry?: string
}

export const DEFAULT_DITHER: DitherParams = {
  bias: 0.57,
  colors: 6,
  enabled: false,
  grayscale: false,
  matrix: 4,
  scale: 8,
  strength: 0.78,
  type: 'bayer'
}

export const DEFAULT_PARAMS: SceneParams = {
  alphaFactor: 0.65,
  alphaProgression: 'exponential',
  color: '#FFFDDD',
  debug: false,
  dither: DEFAULT_DITHER,
  geometry: 'ring',
  layers: [{ position: { x: 0, y: 0 }, rotation: 0, scale: { x: -1, y: 1 } }],
  origin: 'top-center',
  position: { x: 0, y: -0.5 },
  positionCoupled: true,
  positionProgression: 'index',
  repetitions: 65,
  rotation: 0,
  rotationFactor: 0,
  rotationProgression: 'linear',
  scale: 0.85,
  scaleFactor: 1.05,
  scaleProgression: 'exponential',
  stepFactor: 0.02,
  xStep: -1.5,
  yStep: 0
}

// Convert flat SceneParams back to leva format for encoding
export const fromSceneParams = (
  params: Partial<SceneParams>
): Record<string, EncodedEntry> => {
  const result: Record<string, EncodedEntry> = {}

  const set = (key: string, value: any) => {
    if (value !== undefined) {
      result[key] = { value }
    }
  }

  set('Element.geometry', params.geometry)
  set('Element.color', params.color)
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

  // Dither params
  if (params.dither) {
    set('Dither.enabled', params.dither.enabled)
    set('Dither.type', params.dither.type)
    set('Dither.matrix', params.dither.matrix)
    set('Dither.colors', params.dither.colors)
    set('Dither.strength', params.dither.strength)
    set('Dither.scale', params.dither.scale)
    set('Dither.bias', params.dither.bias)
    set('Dither.grayscale', params.dither.grayscale)
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

    if (layer.geometry !== undefined) {
      result[`${pre}geometry`] = { disabled: false, value: layer.geometry }
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

    if (data[`${pre}geometry`] && !data[`${pre}geometry`].disabled) {
      layer.geometry = data[`${pre}geometry`].value
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
    debug: get('Scene.debug', DEFAULT_PARAMS.debug),
    dither: {
      bias: get('Dither.bias', DEFAULT_DITHER.bias),
      colors: get('Dither.colors', DEFAULT_DITHER.colors),
      enabled: get('Dither.enabled', DEFAULT_DITHER.enabled),
      grayscale: get('Dither.grayscale', DEFAULT_DITHER.grayscale),
      matrix: get('Dither.matrix', DEFAULT_DITHER.matrix),
      scale: get('Dither.scale', DEFAULT_DITHER.scale),
      strength: get('Dither.strength', DEFAULT_DITHER.strength),
      type: get('Dither.type', DEFAULT_DITHER.type)
    },
    geometry: get('Element.geometry', DEFAULT_PARAMS.geometry),
    layers,
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
    stepFactor: get('Scalars.stepFactor', DEFAULT_PARAMS.stepFactor),
    xStep: get('Spatial.xStep', DEFAULT_PARAMS.xStep),
    yStep: get('Spatial.yStep', DEFAULT_PARAMS.yStep)
  }
}
