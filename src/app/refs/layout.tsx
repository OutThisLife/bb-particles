'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RefsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const tabClass = (href: string) =>
    `px-2 py-1 text-xs font-bold font-mono ${
      pathname === href
        ? 'text-white'
        : 'text-neutral-500 hover:text-neutral-300'
    }`

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-9 items-center justify-center gap-3">
          <Link className={tabClass('/refs')} href="/refs">
            refs
          </Link>
          <Link className={tabClass('/refs/live')} href="/refs/live">
            live
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
