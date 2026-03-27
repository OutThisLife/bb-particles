import { feedGET, feedPOST, resolveRoot } from '../_feed'

const PARAMS = resolveRoot('output/params')

export async function GET(req: Request) {
  return feedGET(PARAMS, '/api/refs/output/image', req)
}

export async function POST(req: Request) {
  return feedPOST(PARAMS, req)
}
