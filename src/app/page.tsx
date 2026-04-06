'use client'

import { Leva } from 'leva'
import { usePathname, useSearchParams } from 'next/navigation'

import { Footer } from '@/components'
import { Scene } from '@/scene'

export default function Index() {
  const headless = usePathname() === '/render'
  const params = useSearchParams()
  const dpr = Number(params.get('dpr')) || undefined

  return (
    <main>
      <Leva hidden={headless} />
      <Scene headless={headless} dpr={dpr} />
      {!headless && <Footer />}
    </main>
  )
}
