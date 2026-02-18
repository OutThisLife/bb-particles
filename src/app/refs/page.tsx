'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { decode } from '@/utils/codec'

import { SelectionOverlay } from './components/SelectionOverlay'
import { useDragSelect } from './hooks/useDragSelect'
import { useGridKeys } from './hooks/useGridKeys'
import { useToast } from './hooks/useToast'

type Ref = {
  line: number
  params: Record<string, unknown>
  encoded: string
  raw: string
  thumbUrl?: string
}

const rasterUrl = (p: Record<string, unknown>) =>
  `/api/raster?size=256&params=${encodeURIComponent(JSON.stringify(p))}`

const openUrl = (raw: string) =>
  window.open(`/?raw=${encodeURIComponent(raw)}`, '_blank')

export default function RefsPage() {
  const [refs, setRefs] = useState<Ref[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editOpen, setEditOpen] = useState(false)
  const [editLine, setEditLine] = useState<number | null>(null)
  const [editExpectedRaw, setEditExpectedRaw] = useState('')
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [hashInput, setHashInput] = useState('')
  const [thumbFails, setThumbFails] = useState<Set<string>>(new Set())

  const gridRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const keys = refs.map(r => r.raw)

  const { cellRefs, handleClick, handleMouseDown, selRect } = useDragSelect(
    keys,
    selected,
    setSelected
  )

  const busy = useRef(false)
  const pendingRaws = useRef<Set<string>>(new Set())
  const pendingLines = useRef<Map<string, number>>(new Map())

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

  // ── Delete queue ──

  async function flush() {
    if (busy.current) {
      return
    }

    busy.current = true

    try {
      while (pendingRaws.current.size > 0) {
        const raws = [...pendingRaws.current]
        pendingRaws.current.clear()

        const lines = raws
          .map(r => pendingLines.current.get(r) ?? -1)
          .filter(l => l > 0)

        const res = await fetch('/api/refs', {
          body: JSON.stringify({ lines }),
          headers: { 'Content-Type': 'application/json' },
          method: 'DELETE'
        })

        if (!res.ok) {
          throw new Error()
        }

        raws.forEach(r => pendingLines.current.delete(r))
      }
    } catch {
      pendingLines.current.clear()
    } finally {
      busy.current = false
      refetch()

      if (pendingRaws.current.size > 0) {
        void flush()
      }
    }
  }

  function enqueueDelete(raws: string[]) {
    if (!raws.length) {
      return
    }

    const lineByRaw = new Map(refs.map((r, i) => [r.raw, i + 1]))

    for (const raw of raws) {
      if (!pendingLines.current.has(raw)) {
        pendingLines.current.set(raw, lineByRaw.get(raw) ?? -1)
      }

      pendingRaws.current.add(raw)
    }

    setRefs(prev => prev.filter(r => !new Set(raws).has(r.raw)))
    setSelected(prev => new Set([...prev].filter(k => !new Set(raws).has(k))))
    toast(`deleting ${raws.length}...`)
    void flush()
  }

  // ── Keys ──

  useGridKeys({
    disabled: editOpen,
    gridRef,
    keys,
    onDelete: enqueueDelete,
    onOpen: openUrl,
    selected,
    setSelected
  })

  useEffect(() => {
    if (!editOpen) {
      return
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditOpen(false)
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen])

  // ── Editor ──

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
        toast((err as { error?: string }).error ?? 'save failed')

        return
      }

      await refetch()
      setEditOpen(false)
      toast(`saved line ${editLine}`)
    } catch {
      toast('invalid json')
    } finally {
      setSavingEdit(false)
    }
  }

  function applyHash() {
    let c = hashInput.trim()

    try {
      c = new URL(c).searchParams.get('c') || c
    } catch {
      /* url parse */
    }

    if (c.startsWith('c=')) {
      c = c.slice(2)
    }

    if (!c) {
      return toast('missing c hash')
    }

    try {
      const flat = Object.fromEntries(
        Object.entries(decode(c)).map(([k, v]) => [k, v.value])
      )

      setEditText(JSON.stringify(flat, null, 2))
      toast('loaded hash into editor')
    } catch {
      toast('invalid c hash')
    }
  }

  // ── Render ──

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
              toast(`copied hash ${i + 1}`)
            }}
            onDoubleClick={() => openUrl(r.raw)}
            ref={el => {
              el
                ? cellRefs.current.set(r.raw, el)
                : cellRefs.current.delete(r.raw)
            }}
          >
            <div className="aspect-square w-full bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
                loading="lazy"
                onError={() => setThumbFails(prev => new Set(prev).add(r.raw))}
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
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-xs leading-none opacity-0 hover:bg-neutral-600 group-hover:opacity-100"
              data-no-drag
              onClick={e => {
                e.stopPropagation()
                enqueueDelete([r.raw])
              }}
            >
              x
            </button>

            <button
              className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center bg-black/70 text-xs leading-none opacity-0 hover:bg-neutral-600 group-hover:opacity-100"
              data-no-drag
              onClick={e => {
                e.stopPropagation()

                try {
                  setEditText(JSON.stringify(JSON.parse(r.raw), null, 2))
                } catch {
                  setEditText(r.raw)
                }

                setEditLine(r.line)
                setEditExpectedRaw(r.raw)
                setEditOpen(true)
              }}
            >
              e
            </button>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <button
          className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
          onClick={() => enqueueDelete([...selected])}
        >
          del {selected.size} (d)
        </button>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4">
          <div className="mx-auto flex h-full max-w-2xl flex-col border border-neutral-700 bg-neutral-900 p-3">
            <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-xs text-neutral-300">
              <span className="font-['Courier_New',monospace]">
                edit line {editLine}
              </span>
              <button
                className="bg-neutral-700 px-2 py-1 hover:bg-neutral-600"
                onClick={() => setEditOpen(false)}
              >
                close
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-neutral-700 p-2">
              <input
                className="bg-neutral-950 px-2 py-1 font-['Courier_New',monospace] text-xs text-neutral-100 outline-none"
                onChange={e => setHashInput(e.target.value)}
                placeholder="paste /?c=... or raw c hash"
                value={hashInput}
              />
              <button
                className="bg-neutral-700 px-3 py-1 text-xs hover:bg-neutral-600"
                onClick={applyHash}
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
                className="bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600"
                onClick={() => setEditOpen(false)}
              >
                cancel
              </button>
              <button
                className="bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700 disabled:opacity-50"
                disabled={savingEdit}
                onClick={saveEditor}
              >
                {savingEdit ? 'saving...' : 'save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SelectionOverlay rect={selRect} />
    </div>
  )
}
