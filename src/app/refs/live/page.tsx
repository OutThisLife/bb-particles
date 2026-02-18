'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { SelectionOverlay } from '../components/SelectionOverlay'
import { useDragSelect } from '../hooks/useDragSelect'
import { useGridKeys } from '../hooks/useGridKeys'
import { useToast } from '../hooks/useToast'

type LiveItem = { id: string; imageUrl: string; added: boolean; raw: string }

const POLL_MS = 2500

export default function LiveRefsPage() {
  const [items, setItems] = useState<LiveItem[]>([])
  const [reversed, setReversed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const display = reversed ? [...items].reverse() : items
  const keys = display.map(i => i.id)

  const { cellRefs, handleClick, handleMouseDown, selRect } = useDragSelect(
    keys,
    selected,
    setSelected
  )

  const load = useCallback(async () => {
    const res = await fetch('/api/refs/live?limit=180')

    if (!res.ok) {
      return
    }

    const { items: fresh } = (await res.json()) as { items: LiveItem[] }

    setItems(prev => {
      const byId = new Map(prev.map(i => [i.id, i]))

      for (const item of fresh) {
        const cur = byId.get(item.id)

        if (!cur) {
          byId.set(item.id, item)
        } else if (item.added && !cur.added) {
          byId.set(item.id, { ...cur, added: true })
        }
      }

      return [...byId.values()]
    })
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), POLL_MS)

    return () => clearInterval(t)
  }, [load])

  const add = useCallback(
    async (id: string) => {
      if (adding.has(id)) {
        return
      }

      setAdding(prev => new Set(prev).add(id))
      toast(`adding ${id}...`)

      try {
        const res = await fetch('/api/refs/live', {
          body: JSON.stringify({ id }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST'
        })

        const { duplicate, error } = (await res.json()) as {
          duplicate?: boolean
          error?: string
        }

        if (!res.ok) {
          toast(error || `failed ${id}`)

          return
        }

        toast(duplicate ? `already in refs ${id}` : `saved ${id}`)
        setItems(prev =>
          prev.map(i => (i.id === id ? { ...i, added: true } : i))
        )
      } catch {
        toast(`failed ${id}`)
      } finally {
        setAdding(prev => {
          const next = new Set(prev)
          next.delete(id)

          return next
        })
      }
    },
    [adding, toast]
  )

  const save = useCallback(
    async (ids: string[]) => {
      const pending = ids.filter(id =>
        display.find(i => i.id === id && !i.added)
      )

      if (!pending.length) {
        return
      }

      setSelected(new Set())

      for (const id of pending) {
        await add(id)
      }
    },
    [display, add]
  )

  useGridKeys({
    gridRef,
    keys,
    onOpen: id => {
      const item = display.find(i => i.id === id)

      if (item) {
        window.open(`/?raw=${encodeURIComponent(item.raw)}`, '_blank')
      }
    },
    onSave: save,
    selected,
    setSelected
  })

  const addable = display.filter(i => selected.has(i.id) && !i.added).length

  return (
    <div className="min-h-[calc(100vh-36px)] select-none bg-black p-1 text-white">
      <button
        className="fixed right-3 top-1.5 z-50 px-1.5 py-0.5 text-xs text-neutral-500 hover:text-white"
        onClick={() => setReversed(r => !r)}
        title={reversed ? 'newest last' : 'newest first'}
      >
        {reversed ? '↑' : '↓'}
      </button>

      <div
        className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
        onMouseDown={handleMouseDown}
        ref={gridRef}
      >
        {display.map(item => (
          <div
            className={`group relative cursor-pointer ${
              selected.has(item.id)
                ? 'ring-2 ring-blue-500'
                : 'ring-1 ring-neutral-800'
            }`}
            key={item.id}
            onClick={e => handleClick(item.id, e)}
            onDoubleClick={() =>
              window.open(`/?raw=${encodeURIComponent(item.raw)}`, '_blank')
            }
            ref={el => {
              el
                ? cellRefs.current.set(item.id, el)
                : cellRefs.current.delete(item.id)
            }}
          >
            <div className="aspect-square w-full bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
                loading="lazy"
                src={item.imageUrl}
              />
            </div>

            <span className="absolute bottom-0 left-0 bg-black/65 px-1.5 py-0.5 font-['Courier_New',monospace] text-xs">
              {item.id}
            </span>

            <button
              className="absolute right-1 top-1 bg-black/70 px-2 py-0.5 text-xs opacity-0 hover:bg-neutral-600 disabled:opacity-50 group-hover:opacity-100"
              disabled={item.added || adding.has(item.id)}
              onClick={e => {
                e.stopPropagation()
                void add(item.id)
              }}
              type="button"
            >
              {item.added ? 'added' : adding.has(item.id) ? '...' : 'add'}
            </button>
          </div>
        ))}
      </div>

      {addable > 0 && (
        <button
          className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
          onClick={() => void save([...selected])}
        >
          add {addable} (s)
        </button>
      )}

      <SelectionOverlay rect={selRect} />
    </div>
  )
}
