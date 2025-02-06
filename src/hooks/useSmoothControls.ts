import gsap from 'gsap'
import { buttonGroup, useControls } from 'leva'
import { useState } from 'react'

export function useSmoothControls<T extends Record<string, any>>(
  label?: string,
  initialArgs?: T,
  options?: Parameters<typeof useControls>[2],
  duration = 0.35
) {
  type R = { [K in keyof T]: T[K] extends { value: infer V } ? V : never }

  const [currentValues, update] = useState<R>(
    () =>
      Object.fromEntries(
        Object.entries(initialArgs ?? {}).map(([k, v]) => [k, v.value])
      ) as R
  )

  const [, set] = useControls(
    label ?? 'Group',
    () => ({
      ...Object.fromEntries(
        Object.entries(initialArgs ?? {}).map(([k, v]) => [
          k,
          {
            ...v,
            onChange: e => {
              if (typeof e !== 'object' && currentValues[k] !== e) {
                gsap.to(currentValues, {
                  [k]: e,
                  duration,
                  ease: 'circ.out',
                  onUpdate: () =>
                    update(st => ({ ...st, [k]: currentValues[k] }))
                })
              }
            }
          }
        ])
      ),
      ' ': buttonGroup({
        randomize: () =>
          set(
            Object.fromEntries(
              Object.entries(initialArgs ?? {}).map(([k, v]) => [
                k,
                typeof v === 'object' && 'step' in v
                  ? gsap.utils.random(v.min, v.max, v.step)
                  : gsap.utils.random(v.min ?? 0, v.max ?? 1)
              ])
            )
          ),
        reset: () =>
          set(
            Object.fromEntries(
              Object.entries(initialArgs ?? {}).map(([k, { value: v }]) => [
                k,
                v
              ])
            )
          )
      })
    }),
    options,
    []
  )

  return currentValues
}
