import * as THREE from 'three'

export const random2D = () => {
  const a = Math.random() * Math.PI * 2
  return new THREE.Vector3(Math.cos(a), Math.sin(a), 0).normalize()
}

export const rand = (min = 0, max = 1) => Math.random() * (max - min) + min
