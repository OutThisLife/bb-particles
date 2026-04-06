import { feedDELETE, feedGET, feedPOST, resolveRoot } from '../_feed'

const PARAMS = resolveRoot('data/params')
const IMAGES = resolveRoot('data/images')

export async function GET(req: Request) {
  return feedGET(PARAMS, '/api/refs/live/image', req)
}

export async function POST(req: Request) {
  return feedPOST(PARAMS, req)
}

export async function DELETE(req: Request) {
  return feedDELETE(PARAMS, IMAGES, req)
}
