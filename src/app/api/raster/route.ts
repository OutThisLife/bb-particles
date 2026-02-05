import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

import type { SceneParams } from '@/utils/codec'
import { decode, encode, fromSceneParams } from '@/utils/codec'

// Detect if params are in prefixed/leva format (vs SceneParams)
const isPrefixed = (p: Record<string, unknown>) =>
  'Element.geometry' in p || 'Scalars.repetitions' in p

// Convert flat object to EncodedEntry format for binary encoding
const toEntries = (flat: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { value: v }]))

let browser: Browser | null = null
const PAGE_POOL_SIZE = 8 // match client MAX_WORKERS
const pagePool: Page[] = []
const pageQueue: ((page: Page) => void)[] = []

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true })

    // Pre-warm pages
    for (let i = 0; i < PAGE_POOL_SIZE; i++) {
      const page = await browser.newPage({
        viewport: { height: 1024, width: 1024 }
      })

      pagePool.push(page)
    }
  }

  return browser
}

async function acquirePage(): Promise<Page> {
  await getBrowser()
  const page = pagePool.pop()

  if (page) {
    return page
  }

  // Wait for a page to be released
  return new Promise(resolve => pageQueue.push(resolve))
}

function releasePage(page: Page) {
  const waiting = pageQueue.shift()

  if (waiting) {
    waiting(page)
  } else {
    pagePool.push(page)
  }
}

export async function POST(req: Request) {
  const raw = await req.json()

  const page = await acquirePage()

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

    // Binary encode params for /render?c= (same path as frontend)
    const encodedParams = isPrefixed(raw)
      ? encode(toEntries(raw))
      : encode(fromSceneParams(raw as SceneParams))

    await page.goto(`${baseUrl}/render?c=${encodedParams}`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    })

    // Wait for canvas ready
    await page.waitForFunction(() => window.__RENDER_READY__ === true, {
      timeout: 10000
    })

    const buffer = await page.screenshot({
      omitBackground: true,
      type: 'png'
    })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'image/png',
        'X-Encoded-Params': encodedParams
      }
    })
  } finally {
    releasePage(page)
  }
}

export async function GET(req: Request) {
  const encoded = new URL(req.url).searchParams.get('parse')

  if (!encoded) {
    return new Response(JSON.stringify({ error: 'Missing ?parse= param' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }

  // Try JSON first, fall back to binary decode
  let flat: Record<string, unknown>

  try {
    flat = JSON.parse(encoded)
  } catch {
    const decoded = decode(encoded)
    flat = Object.fromEntries(
      Object.entries(decoded).map(([k, v]) => [k, v.value])
    )
  }

  return new Response(JSON.stringify(flat), {
    headers: { 'Content-Type': 'application/json' }
  })
}
