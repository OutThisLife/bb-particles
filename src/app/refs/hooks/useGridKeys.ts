'use client'

import { useEffect, useRef, useState } from 'react'

type Opts = {
  keys: string[]
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  gridRef: React.RefObject<HTMLDivElement | null>
  onOpen?: (key: string) => void
  onSave?: (keys: string[]) => void
  onDelete?: (keys: string[]) => void
  disabled?: boolean
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max))

export function useGridKeys({
  disabled,
  gridRef,
  keys,
  onDelete,
  onOpen,
  onSave,
  selected,
  setSelected
}: Opts) {
  const [cursor, setCursor] = useState(-1)

  const cb = useRef({ onDelete, onOpen, onSave })
  cb.current = { onDelete, onOpen, onSave }

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
        const next = clamp(cursor < 0 ? 0 : cursor + delta[e.key], len - 1)
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
