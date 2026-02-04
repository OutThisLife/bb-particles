import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

export function Ring() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []

    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(t) * 0.9, Math.sin(t) * 0.9, 0))
    }

    return new THREE.CatmullRomCurve3(pts, true)
  }, [])

  return <tubeGeometry args={[curve, 128, 0.008, 4, false]} />
}

export function Disc() {
  return <ringGeometry args={[0, 1, 64, 8]} />
}

export function Bar() {
  const curve = useMemo(
    () =>
      new THREE.LineCurve3(
        new THREE.Vector3(0, -0.9, 0),
        new THREE.Vector3(0, 0.9, 0)
      ),
    []
  )

  return <tubeGeometry args={[curve, 16, 0.006, 4, false]} />
}

export function Arch() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 64

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI
      pts.push(new THREE.Vector3(Math.cos(t) * 0.8, Math.sin(t) * 0.8, 0))
    }

    return new THREE.CatmullRomCurve3(pts, false)
  }, [])

  return <tubeGeometry args={[curve, 64, 0.008, 4, false]} />
}

export function Spiral() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const turns = 3
    const segments = 128

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = t * Math.PI * 2 * turns
      const r = 0.2 + t * 0.6
      pts.push(
        new THREE.Vector3(
          Math.cos(angle) * r,
          Math.sin(angle) * r,
          t * 0.5 - 0.25
        )
      )
    }

    return new THREE.CatmullRomCurve3(pts, false)
  }, [])

  return <tubeGeometry args={[curve, 128, 0.008, 4, false]} />
}

export function Wave() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 96

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * 2 - 1
      pts.push(new THREE.Vector3(t * 0.9, Math.sin(t * Math.PI * 2) * 0.3, 0))
    }

    return new THREE.CatmullRomCurve3(pts, false)
  }, [])

  return <tubeGeometry args={[curve, 96, 0.008, 4, false]} />
}

export function InfinityShape() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 128

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      const scale = 0.6
      pts.push(
        new THREE.Vector3(
          Math.sin(t) * scale,
          Math.sin(t) * Math.cos(t) * scale,
          0
        )
      )
    }

    return new THREE.CatmullRomCurve3(pts, true)
  }, [])

  return <tubeGeometry args={[curve, 128, 0.008, 4, false]} />
}

export function Square() {
  const curve = useMemo(() => {
    const s = 0.7

    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-s, -s, 0),
        new THREE.Vector3(s, -s, 0),
        new THREE.Vector3(s, s, 0),
        new THREE.Vector3(-s, s, 0),
        new THREE.Vector3(-s, -s, 0)
      ],
      false,
      'catmullrom',
      0
    )
  }, [])

  return <tubeGeometry args={[curve, 64, 0.008, 4, false]} />
}

export function RoundedRect() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []

    const s = 0.65,
      r = 0.35,
      seg = 24

    const corner = (cx: number, cy: number, start: number) => {
      for (let i = 0; i <= seg; i++) {
        const a = start + (i / seg) * (Math.PI / 2)
        pts.push(
          new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0)
        )
      }
    }

    corner(-s + r, -s + r, Math.PI) // bottom-left
    corner(s - r, -s + r, Math.PI * 1.5) // bottom-right
    corner(s - r, s - r, 0) // top-right
    corner(-s + r, s - r, Math.PI / 2) // top-left
    pts.push(pts[0].clone())

    return new THREE.CatmullRomCurve3(pts, false)
  }, [])

  return <tubeGeometry args={[curve, 96, 0.008, 4, false]} />
}

export function U() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []

    const w = 0.4,
      h = 0.9

    // left leg
    for (let i = 0; i <= 16; i++) {
      pts.push(new THREE.Vector3(-w, h - (i * (h + 0.4)) / 16, 0))
    }

    // bottom curve
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI + (i / 32) * Math.PI
      pts.push(new THREE.Vector3(Math.cos(a) * w, Math.sin(a) * w - 0.4, 0))
    }

    // right leg
    for (let i = 0; i <= 16; i++) {
      pts.push(new THREE.Vector3(w, -0.4 + (i * (h + 0.4)) / 16, 0))
    }

    return new THREE.CatmullRomCurve3(pts, false)
  }, [])

  return <tubeGeometry args={[curve, 96, 0.008, 4, false]} />
}

export function Line() {
  const curve = useMemo(
    () =>
      new THREE.LineCurve3(
        new THREE.Vector3(0, -0.6, 0),
        new THREE.Vector3(0, 0.6, 0)
      ),
    []
  )

  return <tubeGeometry args={[curve, 16, 0.006, 4, false]} />
}

export function Q() {
  const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    new SVGLoader().load(
      '/q.svg',
      data => {
        const path = data.paths[0]

        if (!path?.subPaths?.length) {
          return setLoading(false)
        }

        const geos = path.subPaths
          .map(sub => sub.getPoints(100))
          .filter(pts => pts.length > 2)
          .map(pts => {
            const xs = pts.map(p => p.x),
              ys = pts.map(p => p.y)

            const cx = (Math.min(...xs) + Math.max(...xs)) / 2
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2

            const curve = new THREE.CatmullRomCurve3(
              pts.map(
                p =>
                  new THREE.Vector3((p.x - cx) * 0.002, -(p.y - cy) * 0.002, 0)
              ),
              false
            )

            return new THREE.TubeGeometry(curve, 64, 0.008, 4, false)
          })

        setGeometries(geos)
        setLoading(false)
      },
      undefined,
      () => setLoading(false)
    )
  }, [])

  if (loading) {
    return <ringGeometry args={[0.9, 1, 32, 1, 0, Math.PI * 1.5]} />
  }

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

export const Default = Ring.bind(null)

export const SHAPES = [
  'ring',
  'bar',
  'line',
  'arch',
  'u',
  'spiral',
  'wave',
  'infinity',
  'square',
  'roundedRect'
] as const

const MAP: Record<string, () => JSX.Element> = {
  arch: Arch,
  bar: Bar,
  infinity: InfinityShape,
  line: Line,
  ring: Ring,
  roundedRect: RoundedRect,
  spiral: Spiral,
  square: Square,
  u: U,
  wave: Wave
}

export const Geo = ({
  gltf,
  shape
}: {
  shape: string
  gltf?: THREE.BufferGeometry[]
}) =>
  gltf ? (
    <>
      {gltf.map(g => (
        <bufferGeometry key={g.uuid} {...g} />
      ))}
    </>
  ) : (
    (MAP[shape]?.() ?? <Ring />)
  )
