import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as THREE from 'three'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const rand = (min = 0, max = 1) => Math.random() * (max - min) + min

export const rand2d = () => {
  const a = Math.random() * Math.PI * 2

  return new THREE.Vector3(Math.cos(a), Math.sin(a), 0).normalize()
}

export const rand3d = () => {
  const a = Math.random() * Math.PI * 2
  const b = Math.acos(2 * Math.random() - 1)

  return new THREE.Vector3(
    Math.sin(b) * Math.cos(a),
    Math.sin(b) * Math.sin(a),
    Math.cos(b)
  ).normalize()
}

export * from './codec'
export * from './obc'

// Progression functions - pure, reusable across Core and interactive scene

export const calcScale = (i: number, sf: number, progression: string) => {
  switch (progression) {
    case 'linear':
      return Math.max(0.01, 1 - i * (1 - sf) * 0.1)

    case 'additive':
      return 1 + i * (sf - 1)

    case 'fibonacci':
      return Math.pow(sf, i * Math.abs(Math.sin(i * 1.618 * 0.1)))

    case 'golden':
      return Math.pow(sf, i * 0.382)

    case 'sine':
      return Math.pow(sf, i * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.2))))

    default:
      return Math.pow(sf, i)
  }
}

export const calcAlpha = (
  i: number,
  total: number,
  af: number,
  progression: string
) => {
  switch (progression) {
    case 'linear':
      return Math.max(0.02, 1 - (i * (1 - af)) / total)

    case 'inverse':
      return Math.max(0.02, af + (1 - af) * (i / total))

    default:
      return Math.max(0.02, Math.exp(-i * (1 - af) * 0.3))
  }
}

const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2))

export const calcRotation = (i: number, rf: number, progression: string) => {
  switch (progression) {
    case 'golden-angle':
      return 137.5 * rf * i

    case 'fibonacci':
      return fib(i % 12) * rf * 15

    case 'sine':
      return Math.sin(i * 0.2) * rf * 180

    default:
      return 360 * rf * i
  }
}

export const calcPosition = (
  i: number,
  scale: number,
  xStep: number,
  yStep: number,
  stepFactor: number,
  origin: string,
  progression: string,
  coupled: boolean,
  isGltf: boolean
): [number, number, number] => {
  const m = isGltf ? 15 : 1

  const applyOrigin = (x: number, y: number) => {
    if (/top/i.test(origin)) {
      y = 1 - y
    } else if (/bottom/i.test(origin)) {
      y = -1 + y
    }

    if (/left/i.test(origin)) {
      x = -1 + x
    } else if (/right/i.test(origin)) {
      x = 1 - x
    }

    return [x * stepFactor, y * stepFactor, 0] as [number, number, number]
  }

  if (progression === 'scale') {
    const d = Math.abs(1 - scale)

    return applyOrigin(d * xStep * m * 1.5, d * yStep * m * 1.5)
  }

  const mult = coupled ? scale : 1

  return applyOrigin(i * xStep * m * mult * 1.5, i * yStep * m * mult * 1.5)
}
