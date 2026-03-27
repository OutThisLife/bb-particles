import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { norm } from '@/utils/norm'

const ROOT =
  process.env.ART_EXPLORER_ROOT ||
  resolve(process.cwd(), '../bb-llm/art-explorer')

const REFS_PATH =
  process.env.REFS_JSONL_PATH || resolve(ROOT, 'references/refs.jsonl')

const PREFIX_MAP: Record<string, string> = {
  alphaFactor: 'Scalars.alphaFactor',
  alphaProgression: 'Scalars.alphaProgression',
  color: 'Element.color',
  debug: 'Scene.debug',
  ditherBias: 'Dither.bias',
  ditherColors: 'Dither.colors',
  ditherEnabled: 'Dither.enabled',
  ditherGrayscale: 'Dither.grayscale',
  ditherMatrix: 'Dither.matrix',
  ditherScale: 'Dither.scale',
  ditherStrength: 'Dither.strength',
  ditherType: 'Dither.type',
  geometry: 'Element.geometry',
  geoWidth: 'Element.geoWidth',
  gradientAngle: 'Element.gradientAngle',
  gradientRange: 'Element.gradientRange',
  noiseDensity: 'Noise.density',
  noiseEnabled: 'Noise.enabled',
  noiseOpacity: 'Noise.opacity',
  noiseSize: 'Noise.size',
  origin: 'Spatial.origin',
  position: 'Scene.position',
  positionCoupled: 'Scalars.positionCoupled',
  positionProgression: 'Scalars.positionProgression',
  repetitions: 'Scalars.repetitions',
  rotation: 'Scene.rotation',
  rotationFactor: 'Scalars.rotationFactor',
  rotationProgression: 'Scalars.rotationProgression',
  scale: 'Scene.scale',
  scaleFactor: 'Scalars.scaleFactor',
  scaleProgression: 'Scalars.scaleProgression',
  startAngle: 'Element.startAngle',
  stepFactor: 'Scalars.stepFactor',
  xStep: 'Spatial.xStep',
  yStep: 'Spatial.yStep'
}

export const toPrefixed = (rawFlat: Record<string, unknown>) => {
  const flat = rawFlat
  const result: Record<string, unknown> = {}

  for (const [flatKey, prefixedKey] of Object.entries(PREFIX_MAP)) {
    if (flatKey in flat && flatKey !== 'layers') {
      result[prefixedKey] = flat[flatKey]
    }
  }

  const nestedDither = flat.dither

  if (nestedDither && typeof nestedDither === 'object') {
    const d = nestedDither as Record<string, unknown>
    const ditherKeys: [string, string][] = [
      ['enabled', 'Dither.enabled'],
      ['type', 'Dither.type'],
      ['matrix', 'Dither.matrix'],
      ['colors', 'Dither.colors'],
      ['strength', 'Dither.strength'],
      ['scale', 'Dither.scale'],
      ['bias', 'Dither.bias'],
      ['grayscale', 'Dither.grayscale']
    ]

    for (const [k, prefixed] of ditherKeys) {
      if (k in d) {
        result[prefixed] = d[k]
      }
    }
  }

  const layers = Array.isArray(flat.layers) ? flat.layers : []
  layers.forEach((layer, i) => {
    if (!layer || typeof layer !== 'object') return
    const pre = `Groups.g${i}.g${i}-`
    Object.entries(layer as Record<string, unknown>).forEach(([k, v]) => {
      result[`${pre}${k}`] = v
    })
  })

  return result
}

export const readRefNormSet = () => {
  try {
    const text = readFileSync(REFS_PATH, 'utf-8').trim()
    if (!text) return new Set<string>()
    const out = new Set<string>()
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        out.add(norm(line))
      } catch {}
    }
    return out
  } catch {
    return new Set<string>()
  }
}

export const resolveRoot = (...parts: string[]) => resolve(ROOT, ...parts)

export const feedGET = (
  paramsDir: string,
  imagePrefix: string,
  req: Request
) => {
  const limit = Math.max(
    1,
    Math.min(500, Number(new URL(req.url).searchParams.get('limit')) || 120)
  )

  const refNorms = readRefNormSet()

  let files: string[]
  try {
    files = readdirSync(paramsDir)
      .filter(name => /^\d+\.json$/.test(name))
      .sort()
      .slice(-limit)
  } catch {
    files = []
  }

  const items = files.map(name => {
    const id = name.replace(/\.json$/, '')
    const flat = JSON.parse(readFileSync(resolve(paramsDir, name), 'utf-8'))
    const params = toPrefixed(flat)
    const raw = JSON.stringify(params)
    return {
      added: refNorms.has(norm(raw)),
      id,
      imageUrl: `${imagePrefix}/${id}`,
      raw
    }
  })

  return Response.json({ items })
}

export const feedPOST = async (paramsDir: string, req: Request) => {
  const { id } = (await req.json()) as { id?: string }
  const safeId = (id || '').replace(/[^0-9]/g, '')

  if (!safeId) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  const path = resolve(paramsDir, `${safeId.padStart(6, '0')}.json`)
  let flat: Record<string, unknown>
  try {
    flat = JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return Response.json({ error: 'Sample not found' }, { status: 404 })
  }

  const prefixed = toPrefixed(flat)
  const raw = JSON.stringify(prefixed)
  const refNorms = readRefNormSet()

  if (refNorms.has(norm(raw))) {
    return Response.json({ duplicate: true, id: safeId })
  }

  const existing = (() => {
    try {
      return readFileSync(REFS_PATH, 'utf-8')
    } catch {
      return ''
    }
  })()

  const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
  writeFileSync(REFS_PATH, `${existing}${prefix}${raw}\n`)

  const total = readFileSync(REFS_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean).length

  return Response.json({ duplicate: false, id: safeId, total })
}

export const serveImage = (imagesDir: string, id: string) => {
  const safeId = (id || '').replace(/[^0-9]/g, '')
  if (!safeId) return new Response('Bad id', { status: 400 })

  const file = resolve(imagesDir, `${safeId.padStart(6, '0')}.png`)
  try {
    const buf = readFileSync(file)
    return new Response(new Uint8Array(buf), {
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'image/png' }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
