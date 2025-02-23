import gsap from 'gsap'
import { buttonGroup, useControls } from 'leva'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function useSmoothControls<T extends Record<string, any>>(
  label: string,
  initialArgs: T,
  options?: UseSmoothControlsOptions,
  dependencies?: Parameters<typeof useControls>[3]
) {
  type R = { [K in keyof T]: T[K] extends { value: infer V } ? V : never }

  const entries = useMemo(
    () => Object.entries(initialArgs ?? {}),
    [initialArgs]
  )

  const hydrate = useCallback(
    () =>
      Object.fromEntries(
        entries.map(([k, v]) => {
          if (v?.schema) {
            return Object.entries(v.schema).map(([k0, v0]: [string, any]) => [
              k0,
              'value' in v0 ? v0.value : v0
            ])
          }

          return [k, 'value' in v ? v.value : v]
        })
      ) as R,
    [entries]
  )

  const [args, update] = useState<R>(hydrate)
  const values = entries.filter(([, v]) => !/button|folder/i.test(v?.type))

  useEffect(() => {
    const curKeys = Object.keys(args)
    const nextKeys = Object.keys(initialArgs)

    if (curKeys.length !== nextKeys.length) {
      update(hydrate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArgs, args])

  const [, set] = useControls(
    label ?? 'Group',
    () => ({
      ...Object.fromEntries(
        entries.map(([k, v]) => {
          const onChange = (e: any, k0?: string) => {
            const key = k0?.split('.')?.pop() ?? k

            if (typeof e === 'number' && args[key] !== e) {
              gsap.to(args, {
                [key]: e,
                duration: options?.duration ?? 0.35,
                ease: 'circ.out',
                onUpdate: () => update(st => ({ ...st, [key]: args[key] }))
              })
            } else {
              update(st => ({ ...st, [key]: e }))
            }
          }

          if (v?.schema) {
            return [
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
          }

          return [
            k,
            {
              ...v,
              onChange
            }
          ]
        })
      ),
      ' ': buttonGroup({
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
        },
        flatten: () => set(Object.fromEntries(values.map(([k]) => [k, 0])))
      })
    }),
    options,
    dependencies ?? []
  )

  return args
}

type UseSmoothControlsOptions = Parameters<typeof useControls>[2] & {
  duration?: number
  onReset?: () => void
  onRandomize?: () => void
}
