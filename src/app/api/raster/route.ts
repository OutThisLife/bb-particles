import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

import type { EncodedEntry, SceneParams } from '@/utils/codec'
import { decode, encode, fromSceneParams, toEntries } from '@/utils/codec'

const POOL = 4
const PAGE_LIMIT = 50
const RENDER_LIMIT = 200
const FAIL_LIMIT = 3
const BASE = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

const ARGS = [
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

const toEncoded = (raw: Record<string, unknown>) => {
  const isEntry = (v: unknown): v is EncodedEntry =>
    !!v && typeof v === 'object' && 'value' in v &&
    Object.keys(v as Record<string, unknown>).every(k => k === 'value' || k === 'disabled')

  if (Object.values(raw).every(isEntry)) return encode(raw as Record<string, EncodedEntry>)
  if ('Element.geometry' in raw || 'Scalars.repetitions' in raw) return encode(toEntries(raw))
  return encode(fromSceneParams(raw as SceneParams))
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status
  })

// ── Pool ──

let browser: Browser | null = null
let pages = 0
let creating = 0
let renders = 0
let fails = 0
let recycling = false

const pool: Page[] = []
const waiters: ((p: Page) => void)[] = []
const usage = new WeakMap<Page, number>()

async function launch() {
  if (!browser?.isConnected())
    browser = await chromium.launch({ args: ARGS, headless: true })
  return browser
}

async function createPage() {
  creating++
  try {
    const page = await (await launch()).newPage({ viewport: { width: 1024, height: 1024 } })

    await page.goto(`${BASE}/render`, { timeout: 30_000, waitUntil: 'load' })
    await page.waitForFunction(() => window.__RENDER_READY__ === true, { timeout: 60_000 })

    pages++
    return page
  } finally {
    creating--
    pump()
  }
}

function give(page: Page) {
  const next = waiters.shift()
  next ? next(page) : pool.push(page)
  pump()
}

function pump() {
  if (waiters.length && pages + creating < POOL && creating < 1)
    createPage().then(give).catch(() => pump())
}

async function acquire(): Promise<Page> {
  const cached = pool.pop()

  if (cached) {
    try {
      await cached.evaluate(() => true)
      return cached
    } catch {
      try { await cached.close() } catch {}
      pages = Math.max(0, pages - 1)
    }
  }

  if (pages + creating < POOL && creating < 1)
    return createPage()

  return new Promise<Page>((resolve, reject) => {
    const timer = setTimeout(() => {
      const i = waiters.indexOf(entry)
      if (i >= 0) waiters.splice(i, 1)
      reject(new Error('pool timeout'))
    }, 30_000)

    const entry = (p: Page) => { clearTimeout(timer); resolve(p) }
    waiters.push(entry)
    pump()
  })
}

function release(page: Page) {
  const n = (usage.get(page) || 0) + 1
  usage.set(page, n)
  n >= PAGE_LIMIT ? discard(page) : give(page)
}

async function discard(page: Page) {
  try { await page.close() } catch {}
  pages = Math.max(0, pages - 1)
  pump()
}

async function recycle() {
  if (recycling) return
  recycling = true
  console.log(`[raster] recycling (${renders} renders, ${fails} fails)`)

  try {
    const old = browser
    browser = null

    for (const p of pool.splice(0))
      try { await p.close() } catch {}

    waiters.splice(0)

    pages = 0
    creating = 0
    renders = 0
    fails = 0

    try { await old?.close() } catch {}
    await launch()
  } finally {
    recycling = false
    pump()
  }
}

// ── Render ──

async function render(raw: Record<string, unknown>, size: number) {
  if (recycling) return new Response('Recycling', { status: 503 })

  const page = await acquire()
  const thumb = size > 0 && size < 1024

  try {
    const enc = toEncoded(raw)

    await page.goto(`${BASE}/render?c=${encodeURIComponent(enc)}`, {
      timeout: 30_000,
      waitUntil: 'load'
    })
    await page.waitForFunction(() => window.__RENDER_READY__ === true, { timeout: 30_000 })

    const buf = await page.screenshot({
      ...(thumb && { clip: { width: 1024, height: 1024, x: 0, y: 0, scale: size / 1024 } as any }),
      omitBackground: !thumb,
      quality: thumb ? 80 : undefined,
      type: thumb ? 'jpeg' : 'png'
    })

    await page.evaluate(() => typeof gc === 'function' && gc()).catch(() => {})

    renders++
    fails = 0
    release(page)

    if (renders >= RENDER_LIMIT) recycle()

    return new Response(new Uint8Array(buf), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': thumb ? 'image/jpeg' : 'image/png',
        'X-Encoded-Params': enc
      }
    })
  } catch {
    await discard(page)
    renders++
    fails++

    if (fails >= FAIL_LIMIT) recycle()

    return new Response('Render failed', { status: 500 })
  }
}

// ── Routes ──

export async function POST(req: Request) {
  return render(await req.json(), Number(new URL(req.url).searchParams.get('size')) || 0)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  if (searchParams.has('health'))
    return json({ ok: !!browser?.isConnected() && fails < FAIL_LIMIT, pool: pool.length, renders, fails, recycling })

  const params = searchParams.get('params')
  if (params)
    return render(JSON.parse(params), Number(searchParams.get('size')) || 0)

  const encoded = searchParams.get('parse')
  if (!encoded) return json({ error: 'Missing ?params= or ?parse=' }, 400)

  return json(decode(encoded))
}
