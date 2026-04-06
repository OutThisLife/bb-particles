'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { Toasts } from './stores/toast'

const tabs = [
  { href: '/refs', label: 'refs' },
  { href: '/refs/live', label: 'live' },
  { href: '/refs/output', label: 'output' },
  { href: '/refs/runs', label: 'runs' }
]

export default function RefsLayout({ children }: React.PropsWithChildren) {
  const path = usePathname()

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-9 items-center justify-center gap-3">
          {tabs.map(t => (
            <Link
              className={`px-2 py-1 font-mono text-xs font-bold ${
                path === t.href
                  ? 'text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              href={t.href}
              key={t.href}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </header>

      {children}
      <Toasts />
    </div>
  )
}
