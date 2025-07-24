import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { useEffect, useState } from 'react'

export function Ring() {
  return <ringGeometry args={[0.95, 1, 100, 1, 0, Math.PI * 2]} />
}

export function Disc() {
  return (
    <ringGeometry args={[0.95, 1, 100, 1, Math.PI * 0.75, Math.PI * 0.5]} />
  )
}

export function Bar() {
  return <boxGeometry args={[0.02, 1]} />
}

export function Arch() {
  const d = 1.6

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
        0.01
      ]}
    />
  )
}

export function Q() {
  const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loader = new SVGLoader()

    loader.load(
      '/q.svg',
      data => {
        console.log('SVG loaded successfully!')
        const path = data.paths[0]

        if (path && path.subPaths && path.subPaths.length > 0) {
          const geos = []

          for (let i = 0; i < path.subPaths.length; i++) {
            const subPath = path.subPaths[i]
            const points = subPath.getPoints(100)

            console.log(`SubPath ${i}: ${points.length} points`)

            if (points.length > 2) {
              // Check coordinate range for debugging
              const xs = points.map(p => p.x)
              const ys = points.map(p => p.y)
              console.log(
                `SubPath ${i} X range: ${Math.min(...xs)} to ${Math.max(...xs)}`
              )
              console.log(
                `SubPath ${i} Y range: ${Math.min(...ys)} to ${Math.max(...ys)}`
              )

              const points3D = points.map(
                p =>
                  new THREE.Vector3(
                    (p.x - 571) * 0.002, // Bigger scale
                    -(p.y - 623) * 0.002,
                    0
                  )
              )

              const curve = new THREE.CatmullRomCurve3(
                points3D,
                subPath.autoClose
              )
              const tubeGeometry = new THREE.TubeGeometry(
                curve,
                64,
                0.02, // Thicker tubes
                8,
                false
              )
              geos.push(tubeGeometry)

              console.log(`Created geometry for subPath ${i}`)
            }
          }

          setGeometries(geos)
          console.log(`Created ${geos.length} separate geometries`)
        }
        setLoading(false)
      },
      undefined,
      error => {
        console.error('SVG loading error:', error)
        setLoading(false)
      }
    )
  }, [])

  if (loading) {
    return <ringGeometry args={[0.9, 1, 32, 1, 0, Math.PI * 1.5]} />
  }

  // Return multiple geometries as a group
  return geometries.length > 0 ? (
    <>
      {geometries.map((geo, i) => (
        <bufferGeometry key={i} {...geo} />
      ))}
    </>
  ) : (
    <ringGeometry args={[0.95, 1, 100, 1, 0, Math.PI * 1.7]} />
  )
}

export const Default = Arch.bind(null)
