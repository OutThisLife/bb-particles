'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const toRect = (a: Point, b: Point): Rect => ({
  height: Math.abs(a.y - b.y),
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x)
})

const intersects = (a: Rect, b: DOMRect) =>
  a.left <= b.right &&
  a.left + a.width >= b.left &&
  a.top <= b.bottom &&
  a.top + a.height >= b.top

export function useDragSelect<K extends string>(
  keys: K[],
  selected: Set<K>,
  setSelected: React.Dispatch<React.SetStateAction<Set<K>>>
) {
  const [dragging, setDragging] = useState(false)
  const [origin, setOrigin] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)
  const [lastClicked, setLastClicked] = useState<K | null>(null)

  const baseline = useRef<Set<K>>(new Set())
  const draggingRef = useRef(false)
  const cellRefs = useRef<Map<K, HTMLDivElement>>(new Map())

  function handleClick(key: K, e: React.MouseEvent) {
    if (dragging) {
      return
    }

    if (e.shiftKey && lastClicked !== null) {
      const a = keys.indexOf(lastClicked)
      const b = keys.indexOf(key)
      setSelected(
        prev =>
          new Set([...prev, ...keys.slice(Math.min(a, b), Math.max(a, b) + 1)])
      )
    } else if (e.metaKey || e.ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev)
        next.has(key) ? next.delete(key) : next.add(key)

        return next
      })
    } else {
      setSelected(new Set([key]))
    }

    setLastClicked(key)
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest('button, [data-no-drag]')
    ) {
      return
    }

    const pt = { x: e.clientX, y: e.clientY }
    setOrigin(pt)
    setEnd(pt)
    setDragging(false)
    draggingRef.current = false

    baseline.current =
      e.shiftKey || e.metaKey || e.ctrlKey
        ? (new Set(selected) as Set<K>)
        : new Set()
  }

  useEffect(() => {
    if (!origin) {
      return
    }

    const onMove = (e: MouseEvent) => {
      const pt = { x: e.clientX, y: e.clientY }

      if (Math.abs(pt.x - origin.x) > 5 || Math.abs(pt.y - origin.y) > 5) {
        setDragging(true)
        draggingRef.current = true
      }

      setEnd(pt)
    }

    const onUp = () => {
      setOrigin(null)
      setEnd(null)

      if (!draggingRef.current && baseline.current.size === 0) {
        setSelected(new Set())
      }

      draggingRef.current = false
      setTimeout(() => setDragging(false), 0)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [origin])

  useLayoutEffect(() => {
    if (!origin || !end || !dragging) {
      return
    }

    const rect = toRect(origin, end)
    const hits = new Set(baseline.current)

    cellRefs.current.forEach((el, key) => {
      if (intersects(rect, el.getBoundingClientRect())) {
        hits.add(key)
      }
    })

    setSelected(hits)
  }, [end, dragging, origin, setSelected])

  return {
    cellRefs,
    handleClick,
    handleMouseDown,
    selRect: dragging && origin && end ? toRect(origin, end) : null
  }
}

interface Point {
  x: number
  y: number
}

interface Rect {
  height: number
  left: number
  top: number
  width: number
}
