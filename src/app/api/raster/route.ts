import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

import type { EncodedEntry, SceneParams } from '@/utils/codec'
import { decode, encode, fromSceneParams } from '@/utils/codec'

const POOL_SIZE = 4
const MAX_RENDERS_PER_PAGE = 50
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-gpu-sandbox',
  '--enable-features=WebGL',
  '--ignore-gpu-blocklist',
  '--disable-gpu-compositing',
  '--js-flags=--expose-gc'
]

const isPrefixed = (p: Record<string, unknown>) =>
  'Element.geometry' in p || 'Scalars.repetitions' in p

const toEntries = (flat: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { value: v }]))

const isEntry = (v: unknown): v is EncodedEntry =>
  !!v &&
  typeof v === 'object' &&
  'value' in v &&
  Object.keys(v as Record<string, unknown>).every(
    k => k === 'value' || k === 'disabled'
  )

const isEntryMap = (
  p: Record<string, unknown>
): p is Record<string, EncodedEntry> => Object.values(p).every(isEntry)

const toEncoded = (raw: Record<string, unknown>) => {
  if (isEntryMap(raw)) {
    return encode(raw)
  }

  if (isPrefixed(raw)) {
    return encode(toEntries(raw))
  }

  return encode(fromSceneParams(raw as SceneParams))
}

// ── Pool ──

let browser: Browser | null = null
const pool: Page[] = []
const queue: ((page: Page) => void)[] = []
const renderCount = new WeakMap<Page, number>()
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
  const n = (renderCount.get(page) || 0) + 1
  renderCount.set(page, n)

  if (n >= MAX_RENDERS_PER_PAGE) {
    discard(page)

    return
  }

  // Reload to clear Leva state so params don't bleed between renders
  page
    .goto(`${BASE_URL}/render`, { timeout: 30_000, waitUntil: 'load' })
    .then(() =>
      page.waitForFunction(() => window.__RENDER_READY__ === true, {
        timeout: 60_000
      })
    )
    .then(() => give(page))
    .catch(() => discard(page))
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

// ── Shared render ──

async function render(raw: Record<string, unknown>, size: number) {
  const page = await acquire()
  const isThumb = size > 0 && size < 1024

  try {
    const enc = toEncoded(raw)

    const clip = isThumb
      ? ({ height: 1024, scale: size / 1024, width: 1024, x: 0, y: 0 } as any)
      : undefined

    await page.evaluate(e => window.__updateParams?.(e), enc)
    await page.waitForFunction(() => window.__RENDER_READY__ === true, {
      timeout: 10_000
    })

    const buffer = await page.screenshot({
      clip,
      omitBackground: !isThumb,
      quality: isThumb ? 80 : undefined,
      type: isThumb ? 'jpeg' : 'png'
    })

    release(page)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': isThumb ? 'image/jpeg' : 'image/png',
        'X-Encoded-Params': enc
      }
    })
  } catch {
    await discard(page)

    return new Response('Render failed', { status: 500 })
  }
}

// ── Routes ──

export async function POST(req: Request) {
  const size = Number(new URL(req.url).searchParams.get('size')) || 0

  return render(await req.json(), size)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const params = url.searchParams.get('params')

  if (params) {
    const size = Number(url.searchParams.get('size')) || 0

    return render(JSON.parse(params), size)
  }

  const encoded = url.searchParams.get('parse')

  if (!encoded) {
    return new Response(
      JSON.stringify({ error: 'Missing ?params= or ?parse= param' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }

  // Canonical parse payload: same shape accepted by POST for exact replay.
  const entries = decode(encoded)

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' }
  })
}
