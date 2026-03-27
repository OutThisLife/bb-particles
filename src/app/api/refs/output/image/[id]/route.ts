import { resolveRoot, serveImage } from '../../../_feed'

const IMAGES = resolveRoot('output/images')

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return serveImage(IMAGES, params.id)
}
