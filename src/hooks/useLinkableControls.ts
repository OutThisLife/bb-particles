import { $layers } from '@/store'
import { levaStore } from 'leva'
import { useEffect } from 'react'

let hydrated = false

export default function useLinkableControls() {
  const store = levaStore.useStore()

  useEffect(() => {
    if (!Object.keys(store.data).length) {
      return
    }

    const u = new URL(window.location.href)

    const encode = (data: typeof store.data) => {
      const params = Object.entries(data)
        .filter(([k]) => {
          const matches = k.match(/g\d+/)

          if (matches?.[0]) {
            return $layers.get() >= +(matches[0].replace('g', '') + 1)
          }

          return true
        })
        .reduce(
          (acc, [k, v]) => ({
            ...acc,
            [k]: JSON.stringify(v)
          }),
          {} as Record<string, string>
        )

      u.searchParams.set('st', btoa(JSON.stringify(params)))

      window.history.replaceState({}, '', u.toString())
    }

    const decode = (st: string) => {
      const next = Object.entries(
        JSON.parse(atob(st)) as Record<string, string>
      )
        .map(([k, v]) => [k, JSON.parse(v)])
        .filter(([, v]) => 'value' in v)
        .map(([k, v]) => [k, v.value])

      if (
        next.some(([k]) => /g\d+/.test(k)) &&
        !Object.keys(store.data).some(i => /g\d+/.test(i))
      ) {
        return $layers.set(
          next
            .filter(([k]) => /g\d+/.test(k))
            .map(([k]) => k.split('-')[0])
            .filter((v, i, a) => a.indexOf(v) === i).length
        )
      }

      levaStore.set(Object.fromEntries(next), false)
      hydrated = true
    }

    if (u.searchParams.has('st') && !hydrated) {
      decode(u.searchParams.get('st')!)
    } else {
      console.log('encoding')
      requestAnimationFrame(() => encode(store.data))
    }
  }, [store])
}
