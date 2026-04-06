import { readdirSync, readFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'

import { readRefNormSet, resolveRoot, toPrefixed } from '../_feed'
import { norm } from '@/utils/norm'

const RUNS = resolveRoot('rl_runs')

export async function DELETE(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] }
  let deleted = 0

  for (const id of ids) {
    const [run, step] = id.split('__')
    if (!run || !step) continue

    try { unlinkSync(resolve(RUNS, run, 'params', `${step}.json`)) } catch {}
    try { unlinkSync(resolve(RUNS, run, 'images', `${step}.png`)) } catch {}
    deleted++
  }

  return Response.json({ deleted })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 200))
  const after = url.searchParams.get('after')
  const before = url.searchParams.get('before')

  let dirs: string[]
  try {
    dirs = readdirSync(RUNS, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
  } catch {
    return Response.json({ hasMore: false, items: [], total: 0 })
  }

  const all: { id: string; run: string }[] = []

  for (const d of dirs) {
    try {
      for (const f of readdirSync(resolve(RUNS, d, 'params'))) {
        if (/^\d+\.json$/.test(f)) {
          all.push({ id: `${d}__${f.replace('.json', '')}`, run: d })
        }
      }
    } catch {}
  }

  all.sort((a, b) => a.id.localeCompare(b.id))

  let slice: typeof all
  let hasMore = false

  if (after) {
    slice = all.filter(x => x.id > after)
  } else if (before) {
    const older = all.filter(x => x.id < before)
    hasMore = older.length > limit
    slice = older.slice(-limit)
  } else {
    hasMore = all.length > limit
    slice = all.slice(-limit)
  }

  slice.reverse()

  const refNorms = readRefNormSet()

  const items = slice.map(({ id, run }) => {
    const step = id.split('__')[1]
    const flat = JSON.parse(readFileSync(resolve(RUNS, run, 'params', `${step}.json`), 'utf-8'))
    const score = flat._reward as number | undefined
    delete flat._reward
    const params = toPrefixed(flat)
    const raw = JSON.stringify(params)

    return {
      added: refNorms.has(norm(raw)),
      id,
      imageUrl: `/api/refs/runs/image/${id}`,
      raw,
      score,
    }
  })

  return Response.json({ hasMore, items, total: all.length })
}
