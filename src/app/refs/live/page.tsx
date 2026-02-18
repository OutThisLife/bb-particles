'use client'

import { useCallback, useEffect, useState } from 'react'

type LiveItem = {
  id: string
  imageUrl: string
  added: boolean
}

const POLL_MS = 2500

export default function LiveRefsPage() {
  const [items, setItems] = useState<LiveItem[]>([])
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [feed, setFeed] = useState<string[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/refs/live?limit=180')

    if (!res.ok) {
      return
    }

    const data = (await res.json()) as { items: LiveItem[] }
    setItems(data.items)
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), POLL_MS)

    return () => clearInterval(t)
  }, [load])

  const pushFeed = useCallback((line: string) => {
    setFeed(prev => [...prev.slice(-5), line])
  }, [])

  const add = useCallback(
    async (id: string) => {
      if (adding.has(id)) {
        return
      }

      setAdding(prev => new Set(prev).add(id))
      pushFeed(`adding ${id}...`)

      try {
        const res = await fetch('/api/refs/live', {
          body: JSON.stringify({ id }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST'
        })

        const out = (await res.json()) as {
          duplicate?: boolean
          error?: string
        }

        if (!res.ok) {
          pushFeed(out.error || `failed ${id}`)

          return
        }

        pushFeed(out.duplicate ? `already in refs ${id}` : `saved ${id}`)
        setItems(prev =>
          prev.map(item => (item.id === id ? { ...item, added: true } : item))
        )
      } catch {
        pushFeed(`failed ${id}`)
      } finally {
        setAdding(prev => {
          const next = new Set(prev)
          next.delete(id)

          return next
        })
      }
    },
    [adding, pushFeed]
  )

  return (
    <div className="min-h-[calc(100vh-36px)] bg-black p-1 text-white">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-neutral-400">
        <span>live {items.filter(x => !x.added).length}</span>
        <span>poll {POLL_MS}ms</span>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {items.map(item => {
          const busy = adding.has(item.id)

          return (
            <div
              className={`group relative ring-1 ${
                item.added ? 'ring-emerald-700/70' : 'ring-neutral-800'
              }`}
              key={item.id}
            >
              <div className="aspect-square w-full bg-neutral-900">
                <img
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                  src={item.imageUrl}
                />
              </div>

              <span className="absolute bottom-0 left-0 bg-black/65 px-1.5 py-0.5 font-['Courier_New',monospace] text-xs">
                {item.id}
              </span>

              <button
                className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-xs hover:bg-emerald-600 disabled:opacity-50"
                disabled={item.added || busy}
                onClick={() => void add(item.id)}
                type="button"
              >
                {item.added ? 'added' : busy ? '...' : 'add'}
              </button>
            </div>
          )
        })}
      </div>

      {feed.length > 0 && (
        <div className="fixed right-4 top-4 z-40 rounded bg-black/80 px-3 py-2 text-xs text-white shadow">
          <div className="space-y-0.5 font-['Courier_New',monospace]">
            {feed.map((line, i) => (
              <div key={`${line}-${i}`}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
