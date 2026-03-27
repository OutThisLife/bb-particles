'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ToastProvider } from './hooks/useToast'

export default function RefsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const path = usePathname()

  const tab = (href: string) =>
    `px-2 py-1 text-xs font-bold font-mono ${
      path === href ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
    }`

  return (
    <ToastProvider>
      <div className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/90 backdrop-blur">
          <div className="mx-auto flex h-9 items-center justify-center gap-3">
            <Link className={tab('/refs')} href="/refs">
              refs
            </Link>
            <Link className={tab('/refs/live')} href="/refs/live">
              live
            </Link>
            <Link className={tab('/refs/output')} href="/refs/output">
              output
            </Link>
          </div>
        </header>

        {children}
      </div>
    </ToastProvider>
  )
}
