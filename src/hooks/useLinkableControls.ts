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

const OPTIONAL_GROUP_SUFFIXES = [
  '-alphaFactor',
  '-color',
  '-geometry',
  '-geoWidth',
  '-rotationFactor',
  '-scaleFactor',
  '-startAngle',
  '-stepFactor'
]

const isOptionalKey = (k: string) =>
  k.startsWith('Groups.') &&
  OPTIONAL_GROUP_SUFFIXES.some(suffix => k.endsWith(suffix))

const isEntryLike = (v: unknown): v is { disabled?: boolean; value: unknown } =>
  !!v &&
  typeof v === 'object' &&
  'value' in v &&
  Object.keys(v as Record<string, unknown>).every(k => k === 'value' || k === 'disabled')

const normalizeEntry = (entry: EncodedEntry): EncodedEntry => {
  let value = entry.value
  let disabled = entry.disabled

  while (isEntryLike(value)) {
    disabled ??= value.disabled
    value = value.value
  }

  return disabled === undefined ? { value } : { disabled, value }
}

const normalizeParams = (params: Record<string, EncodedEntry>) =>
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, normalizeEntry(v)])
  ) as Record<string, EncodedEntry>

const applyToLeva = (params: Record<string, EncodedEntry>) => {
  levaStore.set(
    Object.fromEntries(
      Object.entries(params)
        .map(([k, v]) => [k, normalizeEntry(v).value])
        .filter(([, v]) => v !== undefined)
    ),
    false
  )

  for (const [k, v] of Object.entries(params)) {
    if (isOptionalKey(k) && levaStore.getInput(k))
      levaStore.disableInputAtPath(k, normalizeEntry(v).disabled ?? false)
  }
}

const readyNextFrames = () => {
  const done = () => { window.__RENDER_READY__ = true }

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      requestAnimationFrame(done)
    })
  )

  setTimeout(done, 200)
}

export function resetInitParams(params: Record<string, EncodedEntry>) {
  _initParams = params
  hydrated = false
}

function getInitParams() {
  if (_initParams) return _initParams
  if (typeof window === 'undefined') return {}

  const sp = new URLSearchParams(window.location.search)
  const raw = sp.get('raw')
  const c = sp.get('c')

  try {
    _initParams = raw
      ? normalizeParams(
          Object.fromEntries(
            Object.entries(JSON.parse(decodeURIComponent(raw))).map(([k, v]) => [k, { value: v }])
          )
        )
      : c
        ? normalizeParams(decode(c))
        : {}
  } catch {
    _initParams = {}
  }

  const n = countLayers(Object.keys(_initParams))
  if (n > 1) $layers.set(n)

  return _initParams
}

export const initVal = <T>(key: string, def: T): T =>
  (getInitParams()[key]?.value as T) ?? def

export const initDisabled = (key: string, def = true): boolean =>
  getInitParams()[key] ? (getInitParams()[key]!.disabled ?? false) : def

function applyParams(enc: string) {
  window.__RENDER_READY__ = false

  const params = normalizeParams(decode(enc))

  if (!Object.keys(params).length) {
    readyNextFrames()
    return
  }

  _initParams = params
  hydrated = false

  const n = countLayers(Object.keys(params))
  if (n >= 1) $layers.set(n)

  applyToLeva(params)

  requestAnimationFrame(() => {
    applyToLeva(params)
    readyNextFrames()
  })
}

export default function useLinkableControls() {
  useEffect(() => { window.__updateParams = applyParams }, [])

  const data = levaStore.useStore(s => s.data)
  const layers = useStore($layers)

  const hash = levaStore.useStore(s =>
    Object.entries(s.data)
      .map(([k, v]: [string, any]) => `${k}:${JSON.stringify(v?.value)}:${v?.disabled}`)
      .join('')
  )

  useEffect(() => {
    if (!data || !Object.keys(data).length) return

    if (!hydrated) {
      const params = getInitParams()

      if (Object.keys(params).length) {
        applyToLeva(params)

        if (countLayers(Object.keys(data)) < countLayers(Object.keys(params)))
          return

        requestAnimationFrame(() => applyToLeva(params))
      }

      hydrated = true
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('raw')

    const enc = encode(
      Object.fromEntries(
        Object.entries(data)
          .filter(([k]) => shouldEncode(k, layers))
          .map(([k, v]) => [k, normalizeEntry(v as EncodedEntry)])
      )
    )

    enc.length < 4
      ? url.searchParams.delete('c')
      : url.searchParams.set('c', enc)

    history.replaceState(null, '', url.toString())
  }, [data, hash, layers])
}
