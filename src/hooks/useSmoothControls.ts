import gsap from 'gsap'
import { buttonGroup, levaStore, useControls } from 'leva'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Options = Parameters<typeof useControls>[2] & {
  duration?: number
  onReset?: () => void
  onRandomize?: () => void
}

export function useSmoothControls<T extends Record<string, any>>(
  label: string,
  schema: T,
  options?: Options,
  deps?: any[]
) {
  type R = { [K in keyof T]: T[K] extends { value: infer V } ? V : never }

  const entries = useMemo(() => Object.entries(schema ?? {}), [schema])
  const values = entries.filter(([, v]) => !/button|folder/i.test(v?.type))

  const hydrate = useCallback(
    () =>
      Object.fromEntries(
        entries.map(([k, v]) =>
          v?.schema
            ? Object.entries(v.schema).map(([k0, v0]: [string, any]) => [
                k0,
                'value' in v0 ? v0.value : v0
              ])
            : [k, 'value' in v ? v.value : v]
        )
      ) as R,
    [entries]
  )

  const [args, update] = useState<R>(hydrate)

  useEffect(() => {
    if (Object.keys(args).length !== Object.keys(schema).length) {
      update(hydrate)
    }
  }, [schema, args, hydrate])

  const storeData = levaStore.useStore(s => s.data)
  useEffect(() => {
    const synced: Partial<R> = {}

    for (const [k] of entries) {
      const key = `${label}.${k}`
      const storeVal = (storeData[key] as any)?.value

      if (storeVal !== undefined && storeVal !== args[k as keyof R]) {
        if (gsap.getTweensOf(args).some(tw => tw.vars && Object.hasOwn(tw.vars, k))) {
          continue
        }

        synced[k as keyof R] = storeVal
      }
    }

    if (Object.keys(synced).length) {
      update(s => ({ ...s, ...synced }))
    }
  }, [storeData, label, entries])

  const [, set] = useControls(
    label,
    () => ({
      ...Object.fromEntries(
        entries.map(([k, v]) => {
          const onChange = (e: any, path?: string) => {
            const key = path?.split('.')?.pop() ?? k

            typeof e === 'number' && args[key] !== e
              ? gsap.to(args, {
                  duration: options?.duration ?? 0.35,
                  ease: 'circ.out',
                  [key]: e,
                  onUpdate: () => update(s => ({ ...s, [key]: args[key] }))
                })
              : update(s => ({ ...s, [key]: e }))
          }

          return v?.schema
            ? [
                k,
                {
                  ...v,
                  schema: Object.fromEntries(
                    Object.entries(v.schema).map(([k, v]) => [
                      k,
                      { ...v!, onChange }
                    ])
                  )
                }
              ]
            : [k, { ...v, onChange }]
        })
      ),

      ' ': buttonGroup({
        flatten: () => set(Object.fromEntries(values.map(([k]) => [k, 0]))),
        randomize: () => {
          set(
            Object.fromEntries(
              values.map(([k, v]) => [
                k,
                typeof v === 'object' && ('min' in v || 'max' in v)
                  ? gsap.utils.random(v.min ?? 0, v.max ?? 1, v.step ?? 0.01)
                  : gsap.utils.random(0, 1)
              ])
            )
          )
          options?.onRandomize?.()
        },
        reset: () => {
          set(Object.fromEntries(values.map(([k, { value: v }]) => [k, v])))
          options?.onReset?.()
        }
      })
    }),
    options,
    deps ?? []
  )

  return args
}
