'use client'

import { Leva } from 'leva'
import { usePathname } from 'next/navigation'

import { Footer } from '@/components'
import { Scene } from '@/scene'

export default function Index() {
  const headless = usePathname() === '/render'

  return (
    <main>
      <Leva hidden={headless} />
      <Scene headless={headless} />
      {!headless && <Footer />}
    </main>
  )
}
