import * as THREE from 'three'

import { PARTICLE_COUNT } from '@/scene'

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

export const resample = (
  geometry: THREE.BufferGeometry,
  targetCount = PARTICLE_COUNT
) => {
  const attr = geometry.attributes.position
  const count = attr.count
  const r = new Float32Array(targetCount * 3)

  for (let i = 0; i < targetCount; i++) {
    const srcIndex = Math.floor((i / targetCount) * count)
    r[i * 3] = attr.getX(srcIndex)
    r[i * 3 + 1] = attr.getY(srcIndex)
    r[i * 3 + 2] = attr.getZ(srcIndex)
  }

  return new THREE.BufferGeometry()
    .setAttribute('position', new THREE.BufferAttribute(r, 3))
    .center()
}
