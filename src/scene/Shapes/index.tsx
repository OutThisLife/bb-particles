import * as THREE from 'three'

export function Ring() {
  return <ringGeometry args={[0.95, 1, 100, 1, 0, Math.PI * 2]} />
}

export function Disc() {
  return <ringGeometry args={[0.95, 1, 100, 1, Math.PI * 0.5, Math.PI]} />
}

export function Bar() {
  return <boxGeometry args={[0.015, 2]} />
}

export function Arch() {
  const d = 1.5

  return (
    <tubeGeometry
      args={[
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(d * -0.4, -0.2, -0.5), // bottom left
            new THREE.Vector3(-0.5, d * 0.4 * 2, 0), // top left
            new THREE.Vector3(0, d, 0), // top
            new THREE.Vector3(0.5, d * 0.4 * 2, 0), // top right
            new THREE.Vector3(d * 0.4, -0.2, -0.5) // bottom right
          ].map(i => i.multiplyScalar(0.5)),
          false
        ),
        64,
        0.008
      ]}
    />
  )
}

export const Default = Arch.bind(null)
