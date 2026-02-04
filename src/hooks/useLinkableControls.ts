import { useStore } from '@nanostores/react'
import { levaStore } from 'leva'
import { useEffect } from 'react'

import { $layers } from '@/store'
import { decode, encode } from '@/utils/codec'

let hydrated = false

const countLayers = (keys: string[]) =>
  new Set(keys.map(k => k.match(/g(\d+)/)?.[1]).filter(Boolean)).size

const shouldEncode = (k: string, layers: number) =>
  !k.includes('transform') &&
  (k.match(/g(\d+)/) ? layers > +k.match(/g(\d+)/)![1] : true)

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

    const url = new URL(window.location.href)

    // Hydrate from URL on first load
    if (!hydrated && url.searchParams.has('c')) {
      const params = decode(url.searchParams.get('c')!)

      if (!Object.keys(params).length) {
        return
      }

      // Ensure enough layers exist before hydrating
      if (countLayers(Object.keys(params)) > countLayers(Object.keys(data))) {
        $layers.set(countLayers(Object.keys(params)))

        return
      }

      // Set control values
      levaStore.set(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, v.value])
        ),
        false
      )

      // Sync disabled states for optional controls
      const disabledUpdates = Object.fromEntries(
        Object.entries(params)
          .filter(
            ([k, v]) =>
              'disabled' in v && data[k] && 'disabled' in (data[k] as any)
          )
          .map(([k, v]) => [k, (v as any).disabled])
      )

      if (Object.keys(disabledUpdates).length) {
        levaStore.useStore.setState(state => ({
          data: Object.fromEntries(
            Object.entries(state.data).map(([k, v]) => [
              k,
              k in disabledUpdates ? { ...v, disabled: disabledUpdates[k] } : v
            ])
          )
        }))
      }

      hydrated = true

      return
    }

    // Encode to URL
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
