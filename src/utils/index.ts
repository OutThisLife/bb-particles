import * as THREE from 'three'

export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value))

export const saturate = (value: number) => clamp(value)

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
