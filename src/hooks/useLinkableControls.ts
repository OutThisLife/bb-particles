import { useStore } from '@nanostores/react'
import { levaStore } from 'leva'
import { useEffect } from 'react'

import { $layers } from '@/store'
import type { EncodedEntry } from '@/utils/codec'
import { decode, encode } from '@/utils/codec'

let hydrated = false
let _initParams: Record<string, EncodedEntry> | null = null

declare global {
  interface Window {
    __RENDER_READY__?: boolean
    __updateParams?: (enc: string) => void
  }
}

export const countLayers = (keys: string[]) =>
  new Set(keys.map(k => k.match(/g(\d+)/)?.[1]).filter(Boolean)).size

const shouldEncode = (k: string, layers: number) =>
  !k.includes('transform') &&
  (k.match(/g(\d+)/) ? layers > +k.match(/g(\d+)/)![1] : true)

export function resetInitParams(params: Record<string, EncodedEntry>) {
  _initParams = params
  hydrated = false
}

function getInitParams() {
  if (_initParams) {
    return _initParams
  }

  if (typeof window === 'undefined') {
    return {}
  }
  const c = new URLSearchParams(window.location.search).get('c')
  _initParams = c ? decode(c) : {}
  const n = countLayers(Object.keys(_initParams))

  if (n > 1) {
    $layers.set(n)
  }

  return _initParams
}

export const initVal = <T>(key: string, def: T): T =>
  (getInitParams()[key]?.value as T) ?? def

export const initDisabled = (key: string, def = true): boolean =>
  getInitParams()[key]?.disabled ?? def

function applyParams(enc: string) {
  window.__RENDER_READY__ = false
  const params = decode(enc)

  if (Object.keys(params).length) {
    const n = countLayers(Object.keys(params))

    if (n >= 1) {
      $layers.set(n)
    }
    const set: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(params)) {
      if (v?.value !== undefined) {
        set[k] =
          v.disabled !== undefined
            ? { disabled: v.disabled, value: v.value }
            : v.value
      }
    }

    levaStore.set(set, false)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__RENDER_READY__ = true
    })
  })
}

export default function useLinkableControls() {
  useEffect(() => {
    window.__updateParams = applyParams
  }, [])

  const data = levaStore.useStore(s => s.data)
  const layers = useStore($layers)

  const hash = levaStore.useStore(s =>
    Object.entries(s.data)
      .map(
        ([k, v]: [string, any]) =>
          `${k}:${JSON.stringify(v?.value)}:${v?.disabled}`
      )
      .join('')
  )

  useEffect(() => {
    if (!data || !Object.keys(data).length) {
      return
    }

    if (!hydrated) {
      const params = getInitParams()

      if (Object.keys(params).length) {
        levaStore.set(
          Object.fromEntries(
            Object.entries(params)
              .filter(([k]) => !k.startsWith('Groups.'))
              .map(([k, v]) => [k, v.value])
          ),
          false
        )
      }

      hydrated = true

      return
    }

    const url = new URL(window.location.href)

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => shouldEncode(k, layers))
    )

    const enc = encode(filtered)
    enc.length < 4
      ? url.searchParams.delete('c')
      : url.searchParams.set('c', enc)
    history.replaceState(null, '', url.toString())
  }, [data, hash, layers])
}
