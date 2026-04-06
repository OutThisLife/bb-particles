'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useDragSelect } from '../hooks/useDragSelect'
import { useGridKeys } from '../hooks/useGridKeys'
import { toast } from '../stores/toast'

import { GridImage } from './GridImage'
import { SelectionOverlay } from './SelectionOverlay'

const PAGE = 200
const POLL_MS = 3000

export default function FeedGrid({ apiPath }: { apiPath: string }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const [reversed, setReversed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const [paused, setPaused] = useState(false)

  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const oldestRef = useRef<string | null>(null)
  const newestRef = useRef<string | null>(null)
  const addingRef = useRef(new Set<string>())
  const gridRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    newestRef.current = items[0]?.id ?? null
    oldestRef.current = items.at(-1)?.id ?? null
  }, [items])

  const reversedRef = useRef(reversed)
  reversedRef.current = reversed

  useEffect(() => {
    setItems([])
    setSelected(new Set())
    hasMoreRef.current = true
    setHasMore(true)
    oldestRef.current = null
    newestRef.current = null
    loadingRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reversed])

  const display = items
  const keys = display.map(i => i.id)

  const { cellRefs, handleClick, handleMouseDown, selRect } = useDragSelect(
    keys,
    selected,
    setSelected
  )

  // ── Load older page ──

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return
    }

    loadingRef.current = true

    try {
      const edge = oldestRef.current
      const asc = reversedRef.current
      const sort = asc ? '&sort=asc' : ''
      const q = !edge
        ? `?limit=${PAGE}${sort}`
        : asc
          ? `?after=${edge}&limit=${PAGE}&sort=asc`
          : `?before=${edge}&limit=${PAGE}`
      const res = await fetch(`${apiPath}${q}`)

      if (!res.ok) {
        return
      }

      const data = (await res.json()) as FeedRes

      setItems(prev => {
        const ids = new Set(prev.map(i => i.id))
        const fresh = data.items.filter(i => !ids.has(i.id))

        return fresh.length ? [...prev, ...fresh] : prev
      })

      hasMoreRef.current = data.hasMore
      setHasMore(data.hasMore)
      setTotal(data.total)
    } finally {
      loadingRef.current = false
    }
  }, [apiPath])

  useEffect(() => {
    void loadMore()
  }, [loadMore, reversed])

  // ── Infinite scroll ──

  useEffect(() => {
    const el = sentinelRef.current

    if (!el) {
      return
    }

    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          void loadMore()
        }
      },
      { rootMargin: '800px' }
    )

    obs.observe(el)

    return () => obs.disconnect()
  }, [loadMore])

  // ── Poll for new items ──

  useEffect(() => {
    if (paused || reversed) {
      return
    }

    const poll = async () => {
      const newest = newestRef.current

      if (!newest) {
        return
      }

      const res = await fetch(`${apiPath}?after=${newest}&limit=${PAGE}`)

      if (!res.ok) {
        return
      }

      const { items: fresh, total: t } = (await res.json()) as FeedRes

      if (t) {
        setTotal(t)
      }

      if (!fresh.length) {
        return
      }

      setItems(prev => {
        const ids = new Set(prev.map(i => i.id))
        const novel = fresh.filter(i => !ids.has(i.id))

        return novel.length ? [...novel, ...prev] : prev
      })
    }

    const t = setInterval(() => void poll(), POLL_MS)

    return () => clearInterval(t)
  }, [apiPath, paused, reversed])

  // ── Add to refs ──

  const add = useCallback(
    async (id: string) => {
      if (addingRef.current.has(id)) {
        return
      }

      addingRef.current.add(id)
      setAdding(new Set(addingRef.current))
      toast(`adding ${id}...`)

      try {
        const res = await fetch(apiPath, {
          body: JSON.stringify({ id }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST'
        })

        const { duplicate, error } = (await res.json()) as {
          duplicate?: boolean
          error?: string
        }

        if (!res.ok) {
          return toast(error || `failed ${id}`)
        }

        toast(duplicate ? `already in refs ${id}` : `saved ${id}`)
        setItems(prev =>
          prev.map(i => (i.id === id ? { ...i, added: true } : i))
        )
      } catch {
        toast(`failed ${id}`)
      } finally {
        addingRef.current.delete(id)
        setAdding(new Set(addingRef.current))
      }
    },
    [apiPath]
  )

  const save = useCallback(
    async (ids: string[]) => {
      setSelected(new Set())

      for (const id of ids) {
        await add(id)
      }
    },
    [add]
  )

  const del = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return

      setItems(prev => prev.filter(i => !new Set(ids).has(i.id)))
      setSelected(prev => new Set([...prev].filter(k => !new Set(ids).has(k))))
      toast(`deleting ${ids.length}...`)

      try {
        const res = await fetch(apiPath, {
          body: JSON.stringify({ ids }),
          headers: { 'Content-Type': 'application/json' },
          method: 'DELETE'
        })

        if (!res.ok) toast('delete failed')
      } catch {
        toast('delete failed')
      }
    },
    [apiPath]
  )

  // ── Keys ──

  useGridKeys({
    gridRef,
    keys,
    onDelete: del,
    onOpen: id => {
      const item = display.find(i => i.id === id)

      if (item) {
        window.open(`/?raw=${encodeURIComponent(item.raw)}`, '_blank')
      }
    },
    onPause: () =>
      setPaused(p => {
        toast(!p ? '|| paused' : '>> polling')

        return !p
      }),
    onSave: save,
    selected,
    setSelected
  })

  const addable = display.filter(i => selected.has(i.id) && !i.added).length

  return (
    <div className="min-h-[calc(100vh-36px)] select-none bg-black p-1 text-white">
      <div className="fixed right-3 top-1.5 z-50 flex items-center gap-2">
        <span className="py-0.5 text-xs tabular-nums text-neutral-600">
          {items.length}/{total}
        </span>

        <button
          className="px-1.5 py-0.5 text-xs text-neutral-500 hover:text-white"
          onClick={() => setReversed(r => !r)}
          title={reversed ? 'oldest first' : 'newest first'}
        >
          {reversed ? '↑' : '↓'}
        </button>
      </div>

      <div
        className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
        onMouseDown={handleMouseDown}
        ref={gridRef}
      >
        {display.map(item => (
          <div
            className={`group relative cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_1px_auto_1px] ${
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
            <GridImage src={item.imageUrl} />

            <span className="absolute bottom-0 left-0 bg-black/65 px-1.5 py-0.5 font-mono text-xs">
              {item.id.includes('__') ? item.id.split('__')[1] : item.id}
              {item.score != null && (
                <span className={item.score > -0.3 ? 'text-green-400' : item.score > -0.5 ? 'text-yellow-400' : 'text-neutral-500'}>
                  {' '}{item.score > 0 ? '+' : ''}{item.score.toFixed(2)}
                </span>
              )}
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

            <button
              className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center bg-black/70 text-xs leading-none opacity-0 hover:bg-neutral-600 group-hover:opacity-100"
              data-no-drag
              onClick={e => {
                e.stopPropagation()
                void del([item.id])
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      {hasMore && <div className="h-px" ref={sentinelRef} />}

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {addable > 0 && (
            <button
              className="bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
              onClick={() => void save([...selected])}
            >
              add {addable} (s)
            </button>
          )}
          <button
            className="bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
            onClick={() => void del([...selected])}
          >
            del {selected.size} (d)
          </button>
        </div>
      )}

      <SelectionOverlay rect={selRect} />
    </div>
  )
}

interface FeedItem {
  added: boolean
  id: string
  imageUrl: string
  raw: string
  score?: number
}

interface FeedRes {
  hasMore: boolean
  items: FeedItem[]
  total: number
}
