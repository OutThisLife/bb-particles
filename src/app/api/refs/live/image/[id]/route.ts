import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT =
  process.env.ART_EXPLORER_ROOT ||
  resolve(process.cwd(), '../bb-llm/art-explorer')

const IMAGES_DIR = resolve(ROOT, 'data/images')

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const safeId = (params.id || '').replace(/[^0-9]/g, '')

  if (!safeId) {
    return new Response('Bad id', { status: 400 })
  }

  const file = resolve(IMAGES_DIR, `${safeId.padStart(6, '0')}.png`)

  try {
    const buf = readFileSync(file)

    return new Response(new Uint8Array(buf), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'image/png'
      }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
