import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT =
  process.env.ART_EXPLORER_ROOT ||
  resolve(process.cwd(), '../bb-llm/art-explorer')

const REFS_THUMBS_DIR =
  process.env.REFS_THUMBS_DIR || resolve(ROOT, 'data/refs/images')

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = (params.id || '').toLowerCase()

  if (!/^[a-f0-9]{8,40}$/.test(id)) {
    return new Response('Bad id', { status: 400 })
  }

  const path = resolve(REFS_THUMBS_DIR, `${id}.jpg`)

  try {
    const buf = readFileSync(path)

    return new Response(new Uint8Array(buf), {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': 'image/jpeg'
      }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
