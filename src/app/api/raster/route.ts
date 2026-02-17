import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

import type { SceneParams } from '@/utils/codec'
import { decode, encode, fromSceneParams } from '@/utils/codec'

const POOL_SIZE = 4
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-gpu-sandbox',
  '--enable-features=WebGL',
  '--ignore-gpu-blocklist'
]

const isPrefixed = (p: Record<string, unknown>) =>
  'Element.geometry' in p || 'Scalars.repetitions' in p

const toEntries = (flat: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { value: v }]))

// ── Pool ──

let browser: Browser | null = null
const pool: Page[] = []
const queue: ((page: Page) => void)[] = []
let totalPages = 0
let creating = 0

async function ensureBrowser() {
  if (!browser?.isConnected()) {
    browser = await chromium.launch({ args: BROWSER_ARGS, headless: true })
  }

  return browser
}

async function warmPage(): Promise<Page> {
  const page = await (
    await ensureBrowser()
  ).newPage({ viewport: { height: 1024, width: 1024 } })

  await page.goto(`${BASE_URL}/render`, {
    timeout: 30_000,
    waitUntil: 'load'
  })
  await page.waitForFunction(() => window.__RENDER_READY__ === true, {
    timeout: 60_000
  })

  return page
}

async function createPage(): Promise<Page> {
  creating++

  try {
    const page = await warmPage()
    totalPages++

    return page
  } finally {
    creating--
    pump()
  }
}

function give(page: Page) {
  const next = queue.shift()
  next ? next(page) : pool.push(page)
  pump()
}

function pump() {
  if (
    queue.length === 0 ||
    totalPages + creating >= POOL_SIZE ||
    creating >= 1
  ) {
    return
  }

  createPage()
    .then(give)
    .catch(() => pump())
}

async function acquire(): Promise<Page> {
  const page = pool.pop()

  if (page) {
    try {
      await page.evaluate(() => true)

      return page
    } catch {
      try {
        await page.close()
      } catch {
        // ignore
      }

      totalPages = Math.max(0, totalPages - 1)
    }
  }

  if (totalPages + creating < POOL_SIZE && creating < 1) {
    return createPage()
  }

  return new Promise<Page>(resolve => {
    queue.push(resolve)
    pump()
  })
}

function release(page: Page) {
  give(page)
}

async function discard(page: Page) {
  try {
    await page.close()
  } catch {
    // ignore
  }

  totalPages = Math.max(0, totalPages - 1)
  pump()
}

// ── Routes ──

export async function POST(req: Request) {
  const raw = await req.json()
  const page = await acquire()

  try {
    const enc = isPrefixed(raw)
      ? encode(toEntries(raw))
      : encode(fromSceneParams(raw as SceneParams))

    await page.evaluate(e => window.__updateParams?.(e), enc)
    await page.waitForFunction(() => window.__RENDER_READY__ === true, {
      timeout: 10_000
    })

    const buffer = await page.screenshot({
      omitBackground: true,
      type: 'png'
    })

    release(page)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'image/png',
        'X-Encoded-Params': enc
      }
    })
  } catch {
    await discard(page)

    return new Response('Render failed', { status: 500 })
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

  let flat: Record<string, unknown>

  try {
    flat = JSON.parse(encoded)
  } catch {
    flat = Object.fromEntries(
      Object.entries(decode(encoded)).map(([k, v]) => [k, v.value])
    )
  }

  return new Response(JSON.stringify(flat), {
    headers: { 'Content-Type': 'application/json' }
  })
}
