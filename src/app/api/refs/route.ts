import { createHash } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { encode, toEntries } from '@/utils/codec'
import { norm } from '@/utils/norm'

const REFS_PATH =
  process.env.REFS_JSONL_PATH ||
  resolve(process.cwd(), '../bb-llm/art-explorer/references/refs.jsonl')

const REFS_THUMBS_DIR =
  process.env.REFS_THUMBS_DIR ||
  resolve(process.cwd(), '../bb-llm/art-explorer/data/refs/images')

function readLines() {
  try {
    const text = readFileSync(REFS_PATH, 'utf-8').trim()

    return text ? text.split('\n') : []
  } catch {
    return []
  }
}

const thumbId = (raw: string) =>
  createHash('sha1').update(raw).digest('hex').slice(0, 16)

export async function GET() {
  const lines = readLines()

  const refs = lines.map((raw, i) => {
    const params = JSON.parse(raw)
    const tid = thumbId(raw)

    return {
      line: i + 1,
      params,
      raw,
      thumbUrl: existsSync(resolve(REFS_THUMBS_DIR, `${tid}.jpg`))
        ? `/api/refs/thumb/${tid}`
        : ''
    }
  })

  const encoded = new Map<string, string>()

  for (const r of refs) {
    try {
      encoded.set(r.raw, encode(toEntries(r.params)))
    } catch {
      encoded.set(r.raw, '')
    }
  }

  return Response.json({
    refs: refs.map(r => ({ ...r, encoded: encoded.get(r.raw) || '' }))
  })
}

export async function DELETE(req: Request) {
  const { lines } = (await req.json()) as { lines?: number[] }

  const all = readLines()

  const uniqDesc = Array.from(
    new Set(
      (lines || []).filter(
        line => Number.isInteger(line) && line >= 1 && line <= all.length
      )
    )
  ).sort((a, b) => b - a)

  const kept = [...all]

  for (const line of uniqDesc) {
    kept.splice(line - 1, 1)
  }

  const removed = [...uniqDesc].sort((a, b) => a - b)

  writeFileSync(REFS_PATH, kept.length ? kept.join('\n') + '\n' : '')
  console.log(
    `Removed line${removed.length > 1 ? 's' : ''} ${removed.join(', ')} (${kept.length} remaining)`
  )

  return Response.json({ remaining: kept.length, removed: removed.length })
}

export async function PATCH(req: Request) {
  const { expectedRaw, line, raw } = (await req.json()) as {
    expectedRaw?: string
    line: number
    raw: string
  }

  const all = readLines()

  if (!Number.isInteger(line) || line < 1 || line > all.length) {
    return new Response(JSON.stringify({ error: 'Invalid line' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }

  try {
    const next = JSON.stringify(JSON.parse(raw))

    if (expectedRaw && norm(all[line - 1]) !== norm(expectedRaw)) {
      return new Response(
        JSON.stringify({ error: 'Line changed, reload refs' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 409
        }
      )
    }

    all[line - 1] = next
    writeFileSync(REFS_PATH, all.length ? all.join('\n') + '\n' : '')
    console.log(`Edited line ${line} (${all.length} remaining)`)

    return Response.json({ line, remaining: all.length })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }
}
