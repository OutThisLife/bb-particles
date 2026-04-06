import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
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
  crtBleed: 'CRT.bleed',
  crtBloom: 'CRT.bloom',
  crtBrightness: 'CRT.brightness',
  crtEnabled: 'CRT.enabled',
  crtMask: 'CRT.mask',
  crtMaskStrength: 'CRT.maskStrength',
  crtScale: 'CRT.scale',
  crtScanlines: 'CRT.scanlines',
  crtWarp: 'CRT.warp',
  debug: 'Scene.debug',
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

  const layers = Array.isArray(flat.layers) ? flat.layers : []
  layers.forEach((layer, i) => {
    if (!layer || typeof layer !== 'object') {
      return
    }

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

    if (!text) {
      return new Set<string>()
    }

    const out = new Set<string>()

    for (const line of text.split('\n').filter(Boolean)) {
      try {
        out.add(norm(line))
      } catch {
        continue
      }
    }

    return out
  } catch {
    return new Set<string>()
  }
}

export const resolveRoot = (...parts: string[]) => resolve(ROOT, ...parts)

const stripExt = (n: string) => n.replace(/\.json$/, '')

export const feedGET = (
  paramsDir: string,
  imagePrefix: string,
  req: Request
) => {
  const url = new URL(req.url)

  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get('limit')) || 200)
  )

  const after = url.searchParams.get('after')
  const before = url.searchParams.get('before')
  const asc = url.searchParams.get('sort') === 'asc'

  const refNorms = readRefNormSet()

  let allFiles: string[]

  try {
    allFiles = readdirSync(paramsDir)
      .filter(name => /^\d+\.json$/.test(name))
      .sort()
  } catch {
    allFiles = []
  }

  let slice: string[]
  let hasMore = false

  if (asc) {
    if (after) {
      const newer = allFiles.filter(f => stripExt(f) > after)
      hasMore = newer.length > limit
      slice = newer.slice(0, limit)
    } else if (before) {
      slice = allFiles.filter(f => stripExt(f) < before).slice(-limit)
    } else {
      hasMore = allFiles.length > limit
      slice = allFiles.slice(0, limit)
    }
  } else {
    if (after) {
      slice = allFiles.filter(f => stripExt(f) > after)
    } else if (before) {
      const older = allFiles.filter(f => stripExt(f) < before)
      hasMore = older.length > limit
      slice = older.slice(-limit)
    } else {
      hasMore = allFiles.length > limit
      slice = allFiles.slice(-limit)
    }

    slice.reverse()
  }

  const items = slice.map(name => {
    const id = stripExt(name)
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

  return Response.json({ hasMore, items, total: allFiles.length })
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

export const feedDELETE = async (
  paramsDir: string,
  imagesDir: string,
  req: Request
) => {
  const { ids } = (await req.json()) as { ids?: string[] }

  if (!ids?.length) {
    return Response.json({ error: 'No ids' }, { status: 400 })
  }

  let removed = 0

  for (const id of ids) {
    const safeId = (id || '').replace(/[^0-9]/g, '')

    if (!safeId) {continue}

    const padded = safeId.padStart(6, '0')

    for (const file of [
      resolve(paramsDir, `${padded}.json`),
      resolve(imagesDir, `${padded}.png`)
    ]) {
      try {
        unlinkSync(file)
      } catch {}
    }

    removed++
  }

  return Response.json({ removed })
}

export const serveImage = (imagesDir: string, id: string) => {
  const safeId = (id || '').replace(/[^0-9]/g, '')

  if (!safeId) {
    return new Response('Bad id', { status: 400 })
  }

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
