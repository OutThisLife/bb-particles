import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { encode } from '@/utils/codec'

const REFS_PATH =
  process.env.REFS_JSONL_PATH ||
  resolve(process.cwd(), '../bb-llm/art-explorer/references/refs.jsonl')

const toEntries = (flat: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { value: v }]))

function readLines() {
  try {
    const text = readFileSync(REFS_PATH, 'utf-8').trim()

    return text ? text.split('\n') : []
  } catch {
    return []
  }
}

export async function GET() {
  const lines = readLines()

  const refs = lines.map((raw, i) => {
    const params = JSON.parse(raw)

    return { line: i + 1, params, raw }
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

const deepSort = (o: unknown): unknown =>
  o && typeof o === 'object' && !Array.isArray(o)
    ? Object.fromEntries(
        Object.entries(o)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, deepSort(v)])
      )
    : o

const norm = (s: string) => JSON.stringify(deepSort(JSON.parse(s)))

export async function DELETE(req: Request) {
  const { raws } = (await req.json()) as { raws: string[] }
  const removeSet = new Set(raws.map(norm))
  const all = readLines()
  const removed: number[] = []

  const kept = all.filter((line, i) => {
    const n = norm(line)

    if (removeSet.has(n)) {
      removed.push(i + 1)
      removeSet.delete(n)

      return false
    }

    return true
  })

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
