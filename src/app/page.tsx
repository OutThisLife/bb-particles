'use client'

import { Suspense } from 'react'
import { Leva } from 'leva'
import { usePathname, useSearchParams } from 'next/navigation'

import { Footer } from '@/components'
import { Scene } from '@/scene'

function IndexContent() {
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

export default function Index() {
  return (
    <Suspense fallback={<main />}>
      <IndexContent />
    </Suspense>
  )
}
