'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { GridImage } from './components/GridImage'
import { RefEditor } from './components/RefEditor'
import { SelectionOverlay } from './components/SelectionOverlay'
import { useDragSelect } from './hooks/useDragSelect'
import { useGridKeys } from './hooks/useGridKeys'
import { toast } from './stores/toast'

const openRaw = (raw: string) =>
  window.open(`/?raw=${encodeURIComponent(raw)}`, '_blank')

export default function RefsPage() {
  const [refs, setRefs] = useState<Ref[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [thumbFails, setThumbFails] = useState<Set<string>>(new Set())

  const [editing, setEditing] = useState<RefEditSession | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const pendingRaws = useRef<Set<string>>(new Set())
  const pendingLines = useRef<Map<string, number>>(new Map())

  const keys = refs.map(r => r.raw)

  const { cellRefs, handleClick, handleMouseDown, selRect } = useDragSelect(
    keys,
    selected,
    setSelected
  )

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

        const res = await fetch('/api/refs', {
          body: JSON.stringify({
            lines: raws
              .map(r => pendingLines.current.get(r) ?? -1)
              .filter(l => l > 0)
          }),
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

  useGridKeys({
    disabled: !!editing,
    gridRef,
    keys,
    onDelete: enqueueDelete,
    onOpen: openRaw,
    selected,
    setSelected
  })

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
            onDoubleClick={() => openRaw(r.raw)}
            ref={el => {
              el
                ? cellRefs.current.set(r.raw, el)
                : cellRefs.current.delete(r.raw)
            }}
          >
            <GridImage
              onError={() => setThumbFails(prev => new Set(prev).add(r.raw))}
              src={
                r.thumbUrl && !thumbFails.has(r.raw)
                  ? r.thumbUrl
                  : `/api/raster?size=256&params=${encodeURIComponent(JSON.stringify(r.params))}`
              }
            />

            <span className="absolute bottom-0 left-0 bg-black/60 px-1.5 py-0.5 text-xs tabular-nums">
              {r.line}
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
                  setEditing({
                    line: r.line,
                    raw: r.raw,
                    text: JSON.stringify(JSON.parse(r.raw), null, 2)
                  })
                } catch {
                  setEditing({ line: r.line, raw: r.raw, text: r.raw })
                }
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

      {editing && (
        <RefEditor
          expectedRaw={editing.raw}
          initialText={editing.text}
          line={editing.line}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refetch()
          }}
        />
      )}

      <SelectionOverlay rect={selRect} />
    </div>
  )
}

interface Ref {
  encoded: string
  line: number
  params: Record<string, unknown>
  raw: string
  thumbUrl?: string
}

interface RefEditSession {
  line: number
  raw: string
  text: string
}
