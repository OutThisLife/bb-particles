import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

import type { EncodedEntry, SceneParams } from '@/utils/codec'
import { decode, encode, fromSceneParams, toEntries } from '@/utils/codec'

const POOL_SIZE = 4
const MAX_RENDERS_PER_PAGE = 50
const MAX_TOTAL_RENDERS = 200
const MAX_CONSECUTIVE_FAILS = 3
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-gpu-sandbox',
  '--enable-features=WebGL',
  '--ignore-gpu-blocklist',
  '--disable-gpu-compositing',
  '--js-flags=--expose-gc',
  '--disable-accelerated-2d-canvas'
]

const isPrefixed = (p: Record<string, unknown>) =>
  'Element.geometry' in p || 'Scalars.repetitions' in p

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
let totalRenders = 0
let consecutiveFails = 0
let recycling = false

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

  return new Promise<Page>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = queue.indexOf(entry)

      if (idx >= 0) queue.splice(idx, 1)

      reject(new Error('pool timeout'))
    }, 30_000)

    const entry = (page: Page) => {
      clearTimeout(timer)
      resolve(page)
    }

    queue.push(entry)
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

async function recycleBrowser() {
  if (recycling) return
  recycling = true

  console.log(`[raster] recycling browser (${totalRenders} renders, ${consecutiveFails} fails)`)

  try {
    const old = browser
    browser = null

    for (const p of pool.splice(0)) {
      try { await p.close() } catch { /* */ }
    }

    // drain waiters with errors so they retry on fresh browser
    for (const waiter of queue.splice(0)) {
      try { waiter(null as any) } catch { /* */ }
    }

    totalPages = 0
    creating = 0
    totalRenders = 0
    consecutiveFails = 0

    try { await old?.close() } catch { /* */ }

    await ensureBrowser()
  } finally {
    recycling = false
    pump()
  }
}

// ── Shared render ──

async function render(raw: Record<string, unknown>, size: number) {
  if (recycling) {
    return new Response('Recycling', { status: 503 })
  }

  const page = await acquire()
  const isThumb = size > 0 && size < 1024

  try {
    const enc = toEncoded(raw)

    const clip = isThumb
      ? ({ height: 1024, scale: size / 1024, width: 1024, x: 0, y: 0 } as any)
      : undefined

    await page.goto(`${BASE_URL}/render?c=${encodeURIComponent(enc)}`, {
      timeout: 30_000,
      waitUntil: 'load'
    })
    await page.waitForFunction(() => window.__RENDER_READY__ === true, {
      timeout: 30_000
    })

    const buffer = await page.screenshot({
      clip,
      omitBackground: !isThumb,
      quality: isThumb ? 80 : undefined,
      type: isThumb ? 'jpeg' : 'png'
    })

    await page.evaluate(() => typeof gc === 'function' && gc()).catch(() => {})

    totalRenders++
    consecutiveFails = 0
    release(page)

    if (totalRenders >= MAX_TOTAL_RENDERS) {
      recycleBrowser()
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': isThumb ? 'image/jpeg' : 'image/png',
        'X-Encoded-Params': enc
      }
    })
  } catch {
    await discard(page)
    totalRenders++
    consecutiveFails++

    if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
      recycleBrowser()
    }

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

  if (url.searchParams.has('health')) {
    return new Response(
      JSON.stringify({
        ok: !!browser?.isConnected() && consecutiveFails < MAX_CONSECUTIVE_FAILS,
        pool: pool.length,
        totalRenders,
        consecutiveFails,
        recycling
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

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

  const entries = decode(encoded)

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' }
  })
}
