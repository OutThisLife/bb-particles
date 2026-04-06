'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react'

export function GridImage({ onError, src }: GridImageProps) {
  const [ok, setOk] = useState(false)
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setOk(false)
    setBad(false)
    if (ref.current?.complete && ref.current.naturalWidth > 0) setOk(true)
  }, [src])

  return (
    <div className="relative aspect-square w-full bg-neutral-900">
      {!ok && !bad && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-400" />
        </div>
      )}

      {!bad && (
        <img
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${ok ? 'opacity-100' : 'opacity-0'}`}
          decoding="async"
          draggable={false}
          loading="lazy"
          onError={() => {
            setBad(true)
            onError?.()
          }}
          onLoad={() => setOk(true)}
          ref={ref}
          src={src}
        />
      )}
    </div>
  )
}

interface GridImageProps {
  onError?: () => void
  src: string
}
