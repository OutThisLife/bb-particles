import gsap from 'gsap'
import { buttonGroup, useControls } from 'leva'
import { useMemo, useState } from 'react'

export function useSmoothControls<T extends Record<string, any>>(
  label?: string,
  initialArgs?: T,
  options?: Parameters<typeof useControls>[2],
  duration = 0.35
) {
  type R = { [K in keyof T]: T[K] extends { value: infer V } ? V : never }

  const entries = useMemo(
    () => Object.entries(initialArgs ?? {}),
    [initialArgs]
  )

  const [args, update] = useState<R>(
    () => Object.fromEntries(entries.map(([k, v]) => [k, v.value])) as R
  )

  const [, set] = useControls(
    label ?? 'Group',
    () => ({
      ...Object.fromEntries(
        entries.map(([k, v]) => [
          k,
          {
            ...v,
            onChange: e => {
              if (typeof e !== 'object' && args[k] !== e) {
                gsap.to(args, {
                  [k]: e,
                  duration,
                  ease: 'circ.out',
                  onUpdate: () => update(st => ({ ...st, [k]: args[k] }))
                })
              } else {
                update(st => ({ ...st, [k]: e }))
              }
            }
          }
        ])
      ),
      ' ': buttonGroup({
        randomize: () =>
          set(
            Object.fromEntries(
              entries.map(([k, v]) => [
                k,
                typeof v === 'object' && 'step' in v
                  ? gsap.utils.random(v.min, v.max, v.step)
                  : gsap.utils.random(v.min ?? 0, v.max ?? 1)
              ])
            )
          ),
        reset: () =>
          set(Object.fromEntries(entries.map(([k, { value: v }]) => [k, v])))
      })
    }),
    options,
    []
  )

  return args
}
