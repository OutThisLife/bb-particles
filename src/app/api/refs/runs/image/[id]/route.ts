import { resolve } from 'path'

import { resolveRoot, serveImage } from '../../../_feed'

const RUNS = resolveRoot('rl_runs')

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const [run, step] = params.id.split('__')

  if (!run || !step) {
    return new Response('Bad id', { status: 400 })
  }

  return serveImage(resolve(RUNS, run, 'images'), step)
}
