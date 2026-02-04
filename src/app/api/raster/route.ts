import type { SceneParams } from '@/utils/codec'
import { Browser, chromium } from 'playwright'

let browser: Browser | null = null

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true })
  }

  return browser
}

export async function POST(req: Request) {
  const params = (await req.json()) as Partial<SceneParams> & {
    width?: number
    height?: number
  }

  const { width = 1024, height = 1024, ...sceneParams } = params
  const b = await getBrowser()
  const page = await b.newPage({ viewport: { width, height } })

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const encoded = encodeURIComponent(JSON.stringify(sceneParams))
    await page.goto(`${baseUrl}/render/headless?p=${encoded}`, {
      waitUntil: 'networkidle'
    })

    // Wait for canvas ready
    await page.waitForFunction(() => window.__RENDER_READY__ === true, {
      timeout: 5e3
    })

    const buffer = await page.screenshot({
      type: 'png',
      omitBackground: true
    })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      }
    })
  } finally {
    await page.close()
  }
}
