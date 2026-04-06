'use client'

import { useEffect, useRef, useState } from 'react'

export function useGridKeys({
  disabled,
  gridRef,
  keys,
  onDelete,
  onOpen,
  onPause,
  onSave,
  selected,
  setSelected
}: UseGridKeysOpts) {
  const [cursor, setCursor] = useState(-1)

  const cb = useRef({ onDelete, onOpen, onPause, onSave })
  cb.current = { onDelete, onOpen, onPause, onSave }

  useEffect(() => {
    setCursor(c => Math.min(c, keys.length - 1))
  }, [keys.length])

  useEffect(() => {
    if (disabled) {
      return
    }

    const cols = () =>
      gridRef.current
        ? getComputedStyle(gridRef.current).gridTemplateColumns.split(' ')
            .length
        : 4

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }

      if (e.key === 'Escape') {
        setSelected(new Set())
        setCursor(-1)

        return
      }

      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSelected(new Set(keys))

        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        cb.current.onPause?.()

        return
      }

      const len = keys.length

      if (!len) {
        return
      }

      const delta: Record<string, number> = {
        ArrowDown: cols(),
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -cols()
      }

      if (e.key in delta) {
        e.preventDefault()
        const d = delta[e.key]

        const anchor = (() => {
          if (cursor >= 0 && selected.has(keys[cursor])) {
            return cursor
          }

          if (!selected.size) {
            return -1
          }

          const idxs = [...selected]
            .map(k => keys.indexOf(k))
            .filter(i => i >= 0)

          if (!idxs.length) {
            return -1
          }

          return d > 0 ? Math.max(...idxs) : Math.min(...idxs)
        })()

        const next =
          anchor < 0
            ? d > 0
              ? 0
              : len - 1
            : Math.max(0, Math.min(anchor + d, len - 1))

        setCursor(next)
        e.shiftKey
          ? setSelected(prev => new Set([...prev, keys[next]]))
          : setSelected(new Set([keys[next]]))
        ;(gridRef.current?.children[next] as HTMLElement)?.scrollIntoView({
          block: 'nearest'
        })

        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()

        const key =
          cursor >= 0
            ? keys[cursor]
            : selected.size === 1
              ? [...selected][0]
              : null

        if (key) {
          cb.current.onOpen?.(key)
        }
      }

      if (e.key === 's' && selected.size > 0) {
        cb.current.onSave?.([...selected])
      }

      if (e.key === 'd' && selected.size > 0) {
        cb.current.onDelete?.([...selected])
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [keys, selected, cursor, disabled, setSelected, gridRef])
}

interface UseGridKeysOpts {
  disabled?: boolean
  gridRef: React.RefObject<HTMLDivElement | null>
  keys: string[]
  onDelete?: (keys: string[]) => void
  onOpen?: (key: string) => void
  onPause?: () => void
  onSave?: (keys: string[]) => void
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
}
