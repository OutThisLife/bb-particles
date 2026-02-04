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
    if (!(b & 128)) break
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
    if (entry?.value === undefined) continue

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
    if (i + 1 < buf.length) out += CHARS[(c >> 6) & 63]
    if (i + 2 < buf.length) out += CHARS[c & 63]
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
      if (i + 2 < str.length) buf.push((c >> 8) & 255)
      if (i + 3 < str.length) buf.push(c & 255)
    }

    const result: Record<string, EncodedEntry> = {}
    let o = 0

    while (o < buf.length) {
      const kl = buf[o++]
      if (!kl || o + kl > buf.length) break

      const key = new TextDecoder().decode(new Uint8Array(buf.slice(o, o + kl)))
      o += kl

      const tb = buf[o++]
      if (tb === undefined) break

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

      result[key] = isOptional ? { value, disabled } : { value }
    }

    return result
  } catch {
    return {}
  }
}

// Flat params for headless rendering (no leva structure)
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

// Convert decoded leva data to flat SceneParams
export const toSceneParams = (
  data: Record<string, EncodedEntry>
): SceneParams => {
  const get = <T>(key: string, def: T): T => (data[key]?.value as T) ?? def

  // Extract layers from g0, g1, etc.
  const layers: LayerParams[] = []
  let i = 0
  while (data[`g${i}-position`] || data[`g${i}-scale`]) {
    const layer: LayerParams = {
      position: get(`g${i}-position`, { x: 0, y: 0 }),
      rotation: get(`g${i}-rotation`, 0),
      scale: get(`g${i}-scale`, { x: -1, y: 1 })
    }
    if (data[`g${i}-stepFactor`] && !data[`g${i}-stepFactor`].disabled)
      layer.stepFactor = data[`g${i}-stepFactor`].value
    if (data[`g${i}-alphaFactor`] && !data[`g${i}-alphaFactor`].disabled)
      layer.alphaFactor = data[`g${i}-alphaFactor`].value
    if (data[`g${i}-scaleFactor`] && !data[`g${i}-scaleFactor`].disabled)
      layer.scaleFactor = data[`g${i}-scaleFactor`].value
    if (data[`g${i}-rotationFactor`] && !data[`g${i}-rotationFactor`].disabled)
      layer.rotationFactor = data[`g${i}-rotationFactor`].value
    if (data[`g${i}-color`] && !data[`g${i}-color`].disabled)
      layer.color = data[`g${i}-color`].value
    if (data[`g${i}-geometry`] && !data[`g${i}-geometry`].disabled)
      layer.geometry = data[`g${i}-geometry`].value
    layers.push(layer)
    i++
  }

  return {
    geometry: get('Element.geometry', 'ring'),
    color: get('Element.color', '#FFFDDD'),
    repetitions: get('Scalars.repetitions', 65),
    alphaFactor: get('Scalars.alphaFactor', 0.65),
    scaleFactor: get('Scalars.scaleFactor', 1.05),
    rotationFactor: get('Scalars.rotationFactor', 0),
    stepFactor: get('Scalars.stepFactor', 0.02),
    scaleProgression: get('Scalars.scaleProgression', 'exponential'),
    rotationProgression: get('Scalars.rotationProgression', 'linear'),
    alphaProgression: get('Scalars.alphaProgression', 'exponential'),
    positionProgression: get('Scalars.positionProgression', 'index'),
    positionCoupled: get('Scalars.positionCoupled', true),
    origin: get('Spatial.origin', 'top-center'),
    xStep: get('Spatial.xStep', -1.5),
    yStep: get('Spatial.yStep', 0),
    debug: get('Scene.debug', false),
    position: get('Scene.position', { x: 0, y: -0.5 }),
    rotation: get('Scene.rotation', 0),
    scale: get('Scene.scale', 0.85),
    layers
  }
}
