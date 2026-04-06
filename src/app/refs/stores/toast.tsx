'use client'

import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'

const $toasts = atom<Toast[]>([])

let n = 0

export function toast(text: string) {
  const id = n++
  $toasts.set([...$toasts.get().slice(-5), { id, text }])
  setTimeout(() => $toasts.set($toasts.get().filter(t => t.id !== id)), 2500)
}

export function Toasts() {
  const toasts = useStore($toasts)

  if (!toasts.length) {
    return null
  }

  return (
    <div className="fixed right-4 top-12 z-50 space-y-1">
      {toasts.map(t => (
        <div
          className="bg-black/80 px-3 py-1.5 font-mono text-xs text-white shadow"
          key={t.id}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

interface Toast {
  id: number
  text: string
}
