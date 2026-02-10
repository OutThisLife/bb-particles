import { useStore } from '@nanostores/react'
import { levaStore } from 'leva'
import { useEffect } from 'react'

import { $layers } from '@/store'
import type { EncodedEntry } from '@/utils/codec'
import { decode, encode } from '@/utils/codec'

let hydrated = false

const countLayers = (keys: string[]) =>
  new Set(keys.map(k => k.match(/g(\d+)/)?.[1]).filter(Boolean)).size

const shouldEncode = (k: string, layers: number) =>
  !k.includes('transform') &&
  (k.match(/g(\d+)/) ? layers > +k.match(/g(\d+)/)![1] : true)

// Read URL params once at module load for initial control values
let _initParams: Record<string, EncodedEntry> | null = null

function getInitParams() {
  if (_initParams) {
    return _initParams
  }

  if (typeof window === 'undefined') {
    return {}
  }
  const c = new URLSearchParams(window.location.search).get('c')
  _initParams = c ? decode(c) : {}
  // Set initial layer count
  const n = countLayers(Object.keys(_initParams))

  if (n > 1) {
    $layers.set(n)
  }

  return _initParams
}

/** Get initial value from URL params, falling back to default */
export const initVal = <T>(key: string, def: T): T =>
  (getInitParams()[key]?.value as T) ?? def

/** Get initial disabled state from URL params */
export const initDisabled = (key: string, def = true): boolean =>
  getInitParams()[key]?.disabled ?? def

export default function useLinkableControls() {
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

    // First run: hydrate non-group values via levaStore.set
    // (Group optional controls already init'd via initVal/initDisabled)
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

    // Encode to URL
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
