'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { decode } from '@/utils/codec'

type Ref = {
  line: number
  params: Record<string, unknown>
  encoded: string
  raw: string
  thumbUrl?: string
}

const rasterUrl = (params: Record<string, unknown>) =>
  `/api/raster?size=256&params=${encodeURIComponent(JSON.stringify(params))}`

const fmtDeleting = (n: number) => `deleting ${n > 0 ? n : '?'}...`

const extractC = (s: string) => {
  const text = s.trim()

  if (!text) {
    return ''
  }

  try {
    const u = new URL(text)

    return u.searchParams.get('c') || ''
  } catch {
    if (text.startsWith('c=')) {
      return text.slice(2)
    }

    return text
  }
}

const toRect = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  height: Math.abs(a.y - b.y),
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x)
})

const intersects = (
  a: { left: number; top: number; width: number; height: number },
  b: DOMRect
) =>
  !(
    a.left > b.right ||
    a.left + a.width < b.left ||
    a.top > b.bottom ||
    a.top + a.height < b.top
  )

export default function RefsPage() {
  const [refs, setRefs] = useState<Ref[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteFeed, setDeleteFeed] = useState<string[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editLine, setEditLine] = useState<number | null>(null)
  const [editExpectedRaw, setEditExpectedRaw] = useState('')
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [hashInput, setHashInput] = useState('')
  const [dragging, setDragging] = useState(false)

  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(
    null
  )

  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [thumbFails, setThumbFails] = useState<Set<string>>(new Set())

  const preDragSelected = useRef<Set<string>>(new Set())
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const deleting = useRef(false)
  const pendingRaws = useRef<Set<string>>(new Set())
  const pendingLines = useRef<Map<string, number>>(new Map())
  const feedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleFade = useCallback(() => {
    if (feedTimer.current) {
      clearTimeout(feedTimer.current)
    }

    feedTimer.current = setTimeout(() => {
      if (pendingRaws.current.size === 0) {
        setDeleteFeed([])
      }

      feedTimer.current = null
    }, 900)
  }, [])

  const refetch = useCallback(() => {
    fetch('/api/refs')
      .then(r => r.json())
      .then(d => {
        setRefs(d.refs)
        setSelected(new Set())
        setThumbFails(new Set())
      })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(
    () => () => {
      if (feedTimer.current) {
        clearTimeout(feedTimer.current)
      }
    },
    []
  )

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editOpen) {
          setEditOpen(false)
        } else {
          setSelected(new Set())
        }

        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
        e.preventDefault()
        enqueueDelete(Array.from(selected))
      }

      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSelected(new Set(refs.map(r => r.raw)))
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen, refs, selected])
  /* eslint-enable react-hooks/exhaustive-deps */

  function enqueueDelete(raws: string[]) {
    if (!raws.length) {
      return
    }

    const lineByRaw = new Map(refs.map((r, i) => [r.raw, i + 1]))
    raws.forEach(raw => {
      if (!pendingLines.current.has(raw)) {
        pendingLines.current.set(raw, lineByRaw.get(raw) ?? -1)
      }
    })

    const rawSet = new Set(raws)
    setRefs(prev => prev.filter(r => !rawSet.has(r.raw)))
    setSelected(prev => {
      const next = new Set(prev)
      raws.forEach(r => next.delete(r))

      return next
    })
    raws.forEach(r => pendingRaws.current.add(r))

    setDeleteFeed(
      Array.from(pendingLines.current.values()).map(fmtDeleting).slice(0, 8)
    )

    if (feedTimer.current) {
      clearTimeout(feedTimer.current)
      feedTimer.current = null
    }

    void flushDeleteQueue()
  }

  async function flushDeleteQueue() {
    if (deleting.current) {
      return
    }

    deleting.current = true

    try {
      while (pendingRaws.current.size > 0) {
        const raws = Array.from(pendingRaws.current)

        const lines = raws
          .map(r => pendingLines.current.get(r) ?? -1)
          .filter(line => line > 0)

        pendingRaws.current.clear()

        setDeleteFeed(lines.map(fmtDeleting).slice(0, 8))

        const res = await fetch('/api/refs', {
          body: JSON.stringify({ lines }),
          headers: { 'Content-Type': 'application/json' },
          method: 'DELETE'
        })

        if (!res.ok) {
          throw new Error('delete failed')
        }

        raws.forEach(r => pendingLines.current.delete(r))
      }

      const res = await fetch('/api/refs')

      if (!res.ok) {
        throw new Error('reload failed')
      }

      const d = await res.json()
      setRefs(d.refs)
      setSelected(new Set())
    } catch {
      const res = await fetch('/api/refs')

      if (res.ok) {
        const d = await res.json()
        setRefs(d.refs)
        setSelected(new Set())
      }

      pendingLines.current.clear()
    } finally {
      deleting.current = false

      if (pendingRaws.current.size > 0) {
        void flushDeleteQueue()
      } else {
        scheduleFade()
      }
    }
  }

  function openEditor(r: Ref) {
    try {
      setEditText(JSON.stringify(JSON.parse(r.raw), null, 2))
    } catch {
      setEditText(r.raw)
    }

    setEditLine(r.line)
    setEditExpectedRaw(r.raw)
    setEditOpen(true)
  }

  async function saveEditor() {
    if (!editLine || savingEdit) {
      return
    }

    setSavingEdit(true)

    try {
      const raw = JSON.stringify(JSON.parse(editText))

      const res = await fetch('/api/refs', {
        body: JSON.stringify({
          expectedRaw: editExpectedRaw,
          line: editLine,
          raw
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH'
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setDeleteFeed(prev => [
          ...prev,
          (err as { error?: string }).error ?? 'save failed'
        ])
        scheduleFade()

        return
      }

      await refetch()
      setEditOpen(false)
      setDeleteFeed(prev => [...prev, `saved line ${editLine}`])
      scheduleFade()
    } catch {
      setDeleteFeed(prev => [...prev, 'invalid json'])
      scheduleFade()
    } finally {
      setSavingEdit(false)
    }
  }

  function applyHashToEditor() {
    const c = extractC(hashInput)

    if (!c) {
      setDeleteFeed(prev => [...prev, 'missing c hash'])
      scheduleFade()

      return
    }

    try {
      const flat = Object.fromEntries(
        Object.entries(decode(c)).map(([k, v]) => [k, v.value])
      )

      setEditText(JSON.stringify(flat, null, 2))
      setDeleteFeed(prev => [...prev, 'loaded hash into editor'])
      scheduleFade()
    } catch {
      setDeleteFeed(prev => [...prev, 'invalid c hash'])
      scheduleFade()
    }
  }

  function handleClick(raw: string, e: React.MouseEvent) {
    if (dragging) {
      return
    }

    if (e.shiftKey && lastClicked !== null) {
      const raws = refs.map(r => r.raw)

      const [lo, hi] = [
        Math.min(raws.indexOf(lastClicked), raws.indexOf(raw)),
        Math.max(raws.indexOf(lastClicked), raws.indexOf(raw))
      ]

      const range = raws.slice(lo, hi + 1)
      setSelected(prev => new Set([...prev, ...range]))
    } else if (e.metaKey || e.ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev)
        next.has(raw) ? next.delete(raw) : next.add(raw)

        return next
      })
    } else {
      setSelected(new Set([raw]))
    }

    setLastClicked(raw)
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) {
      return
    }

    if ((e.target as HTMLElement).closest('[data-delete], [data-edit]')) {
      return
    }

    const pt = { x: e.clientX, y: e.clientY }
    setDragOrigin(pt)
    setDragEnd(pt)
    setDragging(false)
    preDragSelected.current =
      e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selected) : new Set()
  }

  useEffect(() => {
    if (!dragOrigin) {
      return
    }

    const onMove = (e: MouseEvent) => {
      const pt = { x: e.clientX, y: e.clientY }

      if (
        Math.abs(pt.x - dragOrigin.x) > 5 ||
        Math.abs(pt.y - dragOrigin.y) > 5
      ) {
        setDragging(true)
      }

      setDragEnd(pt)
    }

    const onUp = () => {
      setDragOrigin(null)
      setDragEnd(null)
      setTimeout(() => setDragging(false), 0)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragOrigin])

  useLayoutEffect(() => {
    if (!dragOrigin || !dragEnd || !dragging) {
      return
    }

    const rect = toRect(dragOrigin, dragEnd)
    const hits = new Set(preDragSelected.current)
    cellRefs.current.forEach((el, raw) => {
      if (intersects(rect, el.getBoundingClientRect())) {
        hits.add(raw)
      }
    })
    setSelected(hits)
  }, [dragEnd, dragging, dragOrigin])

  const selRect =
    dragging && dragOrigin && dragEnd ? toRect(dragOrigin, dragEnd) : null

  const editPreview = useMemo(() => {
    if (!editOpen) {
      return null
    }

    try {
      return JSON.parse(editText) as Record<string, unknown>
    } catch {
      return null
    }
  }, [editOpen, editText])

  return (
    <div className="min-h-[calc(100vh-36px)] select-none bg-black text-white">
      <div
        className="relative grid grid-cols-4 gap-1 p-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
        onMouseDown={handleMouseDown}
        ref={gridRef}
      >
        {refs.map((r, i) => (
          <div
            className={`group relative cursor-pointer ${
              selected.has(r.raw)
                ? 'ring-2 ring-blue-500'
                : 'ring-1 ring-neutral-800'
            }`}
            key={r.raw}
            onClick={e => handleClick(r.raw, e)}
            onContextMenu={e => {
              e.preventDefault()
              navigator.clipboard.writeText(r.encoded)
              setDeleteFeed(prev => [...prev, `copied hash ${i + 1}`])
              scheduleFade()
            }}
            onDoubleClick={() =>
              window.open(`/?raw=${encodeURIComponent(r.raw)}`, '_blank')
            }
            ref={el => {
              if (el) {
                cellRefs.current.set(r.raw, el)
              } else {
                cellRefs.current.delete(r.raw)
              }
            }}
          >
            <div className="aspect-square w-full bg-neutral-900">
              <img
                alt=""
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
                loading="lazy"
                onError={() =>
                  setThumbFails(prev => {
                    const next = new Set(prev)

                    next.add(r.raw)

                    return next
                  })
                }
                src={
                  r.thumbUrl && !thumbFails.has(r.raw)
                    ? r.thumbUrl
                    : rasterUrl(r.params)
                }
              />
            </div>

            <span className="absolute bottom-0 left-0 bg-black/60 px-1.5 py-0.5 text-xs tabular-nums">
              {i + 1}
            </span>

            <button
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-xs leading-none opacity-0 hover:bg-red-600 group-hover:opacity-100"
              data-delete
              onClick={e => {
                e.stopPropagation()
                enqueueDelete([r.raw])
              }}
            >
              x
            </button>

            <button
              className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-xs leading-none opacity-0 hover:bg-blue-600 group-hover:opacity-100"
              data-edit
              onClick={e => {
                e.stopPropagation()
                openEditor(r)
              }}
            >
              e
            </button>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <button
          className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1.5 text-sm hover:bg-red-500"
          onClick={() => enqueueDelete(Array.from(selected))}
        >
          delete {selected.size}
        </button>
      )}

      {deleteFeed.length > 0 && (
        <div className="fixed right-4 top-4 z-40 rounded bg-black/80 px-3 py-2 text-xs text-white shadow">
          <div className="space-y-0.5 font-['Courier_New',monospace]">
            {deleteFeed.map((line, i) => (
              <div key={`${line}-${i}`}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4">
          <div className="mx-auto flex h-full max-w-6xl gap-3 rounded border border-neutral-700 bg-neutral-900 p-3">
            <div className="flex min-w-0 flex-1 flex-col rounded border border-neutral-700">
              <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-xs text-neutral-300">
                <span className="font-['Courier_New',monospace]">
                  edit line {editLine}
                </span>
                <button
                  className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600"
                  onClick={() => setEditOpen(false)}
                >
                  close
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-neutral-700 p-2">
                <input
                  className="rounded bg-neutral-950 px-2 py-1 font-['Courier_New',monospace] text-xs text-neutral-100 outline-none"
                  onChange={e => setHashInput(e.target.value)}
                  placeholder="paste /?c=... or raw c hash"
                  value={hashInput}
                />
                <button
                  className="rounded bg-neutral-700 px-3 py-1 text-xs hover:bg-neutral-600"
                  onClick={applyHashToEditor}
                  type="button"
                >
                  from c
                </button>
              </div>

              <textarea
                className="h-full flex-1 resize-none bg-neutral-950 p-3 font-['Courier_New',monospace] text-xs text-neutral-100 outline-none"
                onChange={e => setEditText(e.target.value)}
                spellCheck={false}
                value={editText}
              />

              <div className="flex justify-end gap-2 border-t border-neutral-700 px-3 py-2">
                <button
                  className="rounded bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600"
                  onClick={() => setEditOpen(false)}
                >
                  cancel
                </button>
                <button
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs hover:bg-blue-500 disabled:opacity-50"
                  disabled={savingEdit}
                  onClick={saveEditor}
                >
                  {savingEdit ? 'saving...' : 'save'}
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-xs text-neutral-300">
                <span>preview</span>
              </div>
              <div className="w-80 overflow-hidden rounded border border-neutral-700 bg-neutral-950">
                {editPreview ? (
                  <img
                    alt=""
                    className="h-auto w-full object-contain"
                    src={rasterUrl(editPreview)}
                  />
                ) : (
                  <div className="p-3 font-['Courier_New',monospace] text-xs text-neutral-400">
                    invalid json
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selRect && selRect.width > 4 && selRect.height > 4 && (
        <div
          className="pointer-events-none fixed z-30 border border-blue-500/60 bg-blue-500/10"
          style={{
            height: selRect.height,
            left: selRect.left,
            top: selRect.top,
            width: selRect.width
          }}
        />
      )}
    </div>
  )
}
