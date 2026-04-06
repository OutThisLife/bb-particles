'use client'

import { useEffect, useState } from 'react'

import { decode } from '@/utils/codec'

import { toast } from '../stores/toast'

export function RefEditor({
  expectedRaw,
  initialText,
  line,
  onClose,
  onSaved
}: RefEditorProps) {
  const [text, setText] = useState(initialText)
  const [hashInput, setHashInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (saving) {
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/refs', {
        body: JSON.stringify({
          expectedRaw,
          line,
          raw: JSON.stringify(JSON.parse(text))
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH'
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))

        return toast((err as { error?: string }).error ?? 'save failed')
      }

      toast(`saved line ${line}`)
      onSaved()
    } catch {
      toast('invalid json')
    } finally {
      setSaving(false)
    }
  }

  function applyHash() {
    let c = hashInput.trim()

    try {
      c = new URL(c).searchParams.get('c') || c
    } catch {
      return toast('invalid c hash')
    }

    if (c.startsWith('c=')) {
      c = c.slice(2)
    }

    if (!c) {
      return toast('missing c hash')
    }

    try {
      setText(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(decode(c)).map(([k, v]) => [k, v.value])
          ),
          null,
          2
        )
      )
      toast('loaded hash into editor')
    } catch {
      toast('invalid c hash')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4">
      <div className="mx-auto flex h-full max-w-2xl flex-col border border-neutral-700 bg-neutral-900 p-3">
        <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-xs text-neutral-300">
          <span className="font-mono">edit line {line}</span>

          <button
            className="bg-neutral-700 px-2 py-1 hover:bg-neutral-600"
            onClick={onClose}
          >
            close
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-neutral-700 p-2">
          <input
            className="bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-100 outline-none"
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
          className="h-full flex-1 resize-none bg-neutral-950 p-3 font-mono text-xs text-neutral-100 outline-none"
          onChange={e => setText(e.target.value)}
          spellCheck={false}
          value={text}
        />

        <div className="flex justify-end gap-2 border-t border-neutral-700 px-3 py-2">
          <button
            className="bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600"
            onClick={onClose}
          >
            cancel
          </button>

          <button
            className="bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700 disabled:opacity-50"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'saving...' : 'save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RefEditorProps {
  expectedRaw: string
  initialText: string
  line: number
  onClose: () => void
  onSaved: () => void
}
