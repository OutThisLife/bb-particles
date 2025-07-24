import { atom } from 'nanostores'
import type { BufferGeometry } from 'three'

export const $object = atom<BufferGeometry[] | undefined>(undefined)
export const $layers = atom(1)
