'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Leva, useControls } from 'leva'
import { Azeret_Mono, Bigelow_Rules } from 'next/font/google'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const GRID_TOKEN = 'HA'
const BG = '#05020b'
const MAX_DPR = 1.5
const FPS_CAP = 30
const PARTICLE_COUNT = 7_200
const COLOR_CELLS_PER_SECOND = 22
const OPACITY_FADE_CELLS = 12
const ACTIVE_HA_TOKENS = 2
const STAR_ALPHA_FADE_CELLS = 8
const STAR_GOLD: [number, number, number] = [255, 218, 120]
const TITLE = 'HERMES AGENT'
const TARGET_TITLE = '150,000'
const GLITCH_CHARS = ' ·:;+=░▒▓█'
const GLITCH_DIGITS = '0123456789,'
const TITLE_FONT_FAMILY =
  '"HermesLogo", "Collapse", system-ui, -apple-system, "Segoe UI", sans-serif'

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
] as const

const PALETTE: [number, number, number][] = [
  [255, 55, 94],
  [255, 82, 153],
  [206, 91, 255],
  [123, 104, 255],
  [70, 142, 255],
  [64, 205, 255],
  [80, 238, 211],
  [105, 242, 148],
  [174, 242, 106],
  [244, 238, 98],
  [255, 204, 88],
  [255, 150, 76],
  [255, 102, 67],
  [220, 70, 82]
]

const techMono = Azeret_Mono({
  subsets: ['latin'],
  weight: '300'
})
const airdropCountFont = Bigelow_Rules({
  subsets: ['latin'],
  weight: '400'
})
const GRID_FONT_FAMILY =
  '"Azeret Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace'
const DASHBOARD_FONT_FAMILY =
  '"Bigelow Rules", "Azeret Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace'
const ASCII_HA = [
  '██░░░░██░░████░░',
  '██░░░░██░██░░██░',
  '██░░░░██░██░░██░',
  '████████░██████░',
  '██░░░░██░██░░██░',
  '██░░░░██░██░░██░',
  '██░░░░██░██░░██░'
] as const
const STAR_GLYPH = '★'
const ASCII_COLS = ASCII_HA[0].length
const ASCII_ROWS = ASCII_HA.length

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5
const mod = (n: number, m: number) => ((n % m) + m) % m
const popBezier = (t: number) =>
  3 * (1 - t) * (1 - t) * t + 3 * (1 - t) * t * t + t * t * t
const countEase = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

const mixColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
) =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as [
    number,
    number,
    number
  ]

const hueRotate = (rgb: [number, number, number], deg: number) => {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  const [r, g, b] = rgb

  return [
    clamp01(
      ((0.213 + c * 0.787 - s * 0.213) * r +
        (0.715 - c * 0.715 - s * 0.715) * g +
        (0.072 - c * 0.072 + s * 0.928) * b) /
        255
    ) * 255,
    clamp01(
      ((0.213 - c * 0.213 + s * 0.143) * r +
        (0.715 + c * 0.285 + s * 0.14) * g +
        (0.072 - c * 0.072 - s * 0.283) * b) /
        255
    ) * 255,
    clamp01(
      ((0.213 - c * 0.213 - s * 0.787) * r +
        (0.715 - c * 0.715 + s * 0.715) * g +
        (0.072 + c * 0.928 + s * 0.072) * b) /
        255
    ) * 255
  ] as [number, number, number]
}

const drawAsciiHa = (
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
  alpha: number,
  color: string
) => {
  const blockW = w / ASCII_COLS
  const blockH = h / ASCII_ROWS
  const padX = blockW * gap
  const padY = blockH * gap
  const fs = Math.min(blockH * 1.12, blockW * 1.72)

  ctx.font = `700 ${fs}px ${GRID_FONT_FAMILY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color

  for (let row = 0; row < ASCII_ROWS; row++) {
    const line = rows[row]

    for (let col = 0; col < ASCII_COLS; col++) {
      const char = line[col]

      if (char !== '░') {
        ctx.globalAlpha = alpha
        ctx.fillText(char, x + col * blockW + padX, y + row * blockH + padY)
      } else if (gap < 0.2) {
        ctx.globalAlpha = alpha * 0.18
        ctx.fillText(char, x + col * blockW + padX, y + row * blockH + padY)
      }
    }
  }
}

const drawStarGlyph = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  color: string
) => {
  const fs = Math.min(w * 0.9, h * 0.95)

  ctx.font = `700 ${fs}px ${GRID_FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fillText(STAR_GLYPH, x + w * 0.5, y + h * 0.54)
}

const rand = (seed: number) => {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123
  return n - Math.floor(n)
}

const CUBE_CORNERS: [number, number, number][] = []

for (const x of [-1, 1] as const) {
  for (const y of [-1, 1] as const) {
    for (const z of [-1, 1] as const) {
      CUBE_CORNERS.push([x, y, z])
    }
  }
}

const CUBE_EDGES: [number, number][] = []

for (let i = 0; i < CUBE_CORNERS.length; i++) {
  for (let j = i + 1; j < CUBE_CORNERS.length; j++) {
    const a = CUBE_CORNERS[i]
    const b = CUBE_CORNERS[j]
    let diff = 0

    if (a[0] !== b[0]) {
      diff++
    }

    if (a[1] !== b[1]) {
      diff++
    }

    if (a[2] !== b[2]) {
      diff++
    }

    if (diff === 1) {
      CUBE_EDGES.push([i, j])
    }
  }
}

const sampleCubeEdges = (count: number, radius = 1.3) => {
  const out = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const edge =
      CUBE_EDGES[Math.floor(rand(i * 0.37 + 3.1) * CUBE_EDGES.length)]
    const t = rand(i * 0.93 + 19.7)
    const a = CUBE_CORNERS[edge[0]]
    const b = CUBE_CORNERS[edge[1]]

    out[i * 3] = lerp(a[0], b[0], t) * radius
    out[i * 3 + 1] = lerp(a[1], b[1], t) * radius
    out[i * 3 + 2] = lerp(a[2], b[2], t) * radius
  }

  return out
}

const sampleBurstPositions = (count: number, minR = 1.4, maxR = 3.8) => {
  const out = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const u = rand(i * 1.7 + 2.3)
    const v = rand(i * 2.1 + 7.1)
    const w = rand(i * 2.9 + 11.3)
    const theta = u * Math.PI * 2
    const phi = Math.acos(2 * v - 1)
    const lane = (Math.floor(w * 7) / 7) * Math.PI * 2
    const radius = lerp(minR, maxR, w * w)
    const wobble = 0.35 * Math.sin(theta * 3 + lane)
    const r = radius + wobble

    out[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    out[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    out[i * 3 + 2] = r * Math.cos(phi)
  }

  return out
}

const cubeVertexShader = `
attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aSeed;
uniform float uTime;
uniform float uMorph;
uniform float uPulse;
varying float vSeed;
varying float vPulse;

void main() {
  float morph = smoothstep(0.0, 1.0, uMorph);
  vec3 p = mix(aFrom, aTo, morph);

  float swirl = (1.0 - morph) * 0.35 + morph * 0.12;
  p.x += sin(uTime * 2.2 + aSeed * 39.0) * swirl;
  p.y += cos(uTime * 1.8 + aSeed * 57.0) * swirl;
  p.z += sin(uTime * 2.9 + aSeed * 41.0) * swirl;

  float spin = uTime * (0.6 + morph * 0.8) + aSeed * 6.2831853;
  float cs = cos(spin);
  float sn = sin(spin);
  mat2 rot = mat2(cs, -sn, sn, cs);
  p.xy = rot * p.xy;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float dist = max(1.0, -mv.z);
  gl_PointSize = (3.0 + uPulse * 2.4 + morph * 2.0) * (220.0 / dist);

  vSeed = aSeed;
  vPulse = uPulse;
}
`

const cubeFragmentShader = `
precision highp float;
uniform float uTime;
varying float vSeed;
varying float vPulse;

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.03, 0.37, 0.67) + t));
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.52, 0.03, d);

  if (alpha <= 0.0) {
    discard;
  }

  float hue = fract(vSeed + uTime * 0.1 + vPulse * 0.2);
  vec3 col = palette(hue);
  col = mix(col, vec3(1.0, 0.95, 0.84), vPulse * 0.28);

  gl_FragColor = vec4(col, alpha * 0.94);
}
`

function CubeVideo({ startedAt }: { startedAt: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const cageRef = useRef<THREE.Mesh>(null)
  const diamondRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uMorph: new THREE.Uniform(0),
      uPulse: new THREE.Uniform(0),
      uTime: new THREE.Uniform(0)
    }),
    []
  )

  const geometry = useMemo(() => {
    const from = sampleCubeEdges(PARTICLE_COUNT)
    const to = sampleBurstPositions(PARTICLE_COUNT)
    const seed = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      rand(i * 5.173 + 1.7)
    )
    const geo = new THREE.BufferGeometry()

    geo.setAttribute('position', new THREE.BufferAttribute(from.slice(), 3))
    geo.setAttribute('aFrom', new THREE.BufferAttribute(from, 3))
    geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))

    return geo
  }, [])

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime()
    const elapsed = Math.max(0, performance.now() - startedAt)
    const entry = easeOutQuint(clamp01(elapsed / 1_900))
    const morph = easeOutQuint(clamp01((elapsed - 450) / 3_000))
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.8)

    uniforms.uTime.value = t
    uniforms.uMorph.value = morph
    uniforms.uPulse.value = pulse

    camera.position.z = lerp(6.0, 3.8, entry) + Math.sin(t * 0.8) * 0.08
    camera.position.x = Math.sin(t * 0.27) * 0.18
    camera.position.y = Math.cos(t * 0.23) * 0.16
    camera.lookAt(0, 0, 0)

    if (pointsRef.current) {
      pointsRef.current.rotation.x = t * 0.18 + Math.sin(t * 0.7) * 0.12
      pointsRef.current.rotation.y = t * 0.52
      pointsRef.current.rotation.z = Math.sin(t * 0.5) * 0.2
    }

    if (cageRef.current) {
      cageRef.current.rotation.x = -t * 0.16
      cageRef.current.rotation.y = t * 0.24
      cageRef.current.rotation.z = t * 0.08
      cageRef.current.scale.setScalar(1 + pulse * 0.06 + morph * 0.18)
    }

    if (diamondRef.current) {
      diamondRef.current.rotation.x = t * 0.41
      diamondRef.current.rotation.y = -t * 0.26
      diamondRef.current.rotation.z = t * 0.18
      diamondRef.current.scale.setScalar(1 + (1 - morph) * 0.2 + pulse * 0.05)
    }
  })

  return (
    <group>
      <points geometry={geometry} ref={pointsRef}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={cubeFragmentShader}
          transparent
          uniforms={uniforms}
          vertexShader={cubeVertexShader}
        />
      </points>

      <mesh ref={cageRef}>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        <meshBasicMaterial
          color="#9ab8ff"
          opacity={0.16}
          transparent
          wireframe
        />
      </mesh>

      <mesh ref={diamondRef}>
        <octahedronGeometry args={[1.65, 0]} />
        <meshBasicMaterial
          color="#ff9ecf"
          opacity={0.14}
          transparent
          wireframe
        />
      </mesh>
    </group>
  )
}

function CubeStage({ startedAt }: { startedAt: number }) {
  return (
    <Canvas
      camera={{ fov: 42, position: [0, 0, 6] }}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance'
      }}
      style={{ height: '100%', width: '100%' }}>
      <color args={['#06020d']} attach="background" />
      <fog args={['#06020d', 4, 11]} attach="fog" />

      <ambientLight intensity={0.1} />
      <pointLight color="#ff5fb0" intensity={2.2} position={[3, 3, 2]} />
      <pointLight color="#60b8ff" intensity={2} position={[-3, -2, 3]} />
      <pointLight color="#ffe989" intensity={1.2} position={[0, 2, -3]} />

      <CubeVideo startedAt={startedAt} />
    </Canvas>
  )
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controls = useControls('HA Grid', {
    speed: { value: COLOR_CELLS_PER_SECOND, min: 4, max: 60, step: 1 },
    hue: { value: 0, min: -180, max: 180, step: 1 },
    hueDrift: { value: 0, min: -120, max: 120, step: 1 },
    inactiveOpacity: { value: 0.1, min: 0, max: 0.5, step: 0.01 },
    activeTokens: { value: ACTIVE_HA_TOKENS, min: 1, max: 8, step: 1 },
    fadeCells: { value: OPACITY_FADE_CELLS, min: 0, max: 40, step: 1 },
    brightness: { value: 0.82, min: 0.2, max: 1.6, step: 0.01 },
    shimmer: { value: 0.1, min: 0, max: 0.35, step: 0.01 },
    beat: { value: 0.08, min: 0, max: 0.25, step: 0.01 },
    haSize: { value: 1, min: 0.45, max: 2, step: 0.01 },
    haBlockGap: { value: 0.08, min: 0, max: 0.35, step: 0.01 },
    haCellGap: { value: 0.04, min: 0, max: 0.18, step: 0.005 },
    titleSize: { value: 1.38, min: 0.45, max: 2, step: 0.01 },
    titleBackdrop: { value: 0.62, min: 0, max: 1, step: 0.01 },
    titleBackdropBlur: { value: 0.55, min: 0, max: 1.2, step: 0.01 },
    titleShadowBlur: { value: 0.18, min: 0, max: 1.5, step: 0.01 },
    titleShadowOpacity: { value: 0.22, min: 0, max: 1, step: 0.01 },
    titleLens: { value: 0.84, min: 0, max: 1.5, step: 0.01 },
    titlePrism: { value: 0.96, min: 0, max: 1.5, step: 0.01 },
    titleBeam: { value: 1.08, min: 0, max: 1.5, step: 0.01 },
    titleBeamWidth: { value: 0.7, min: 0.04, max: 1.4, step: 0.01 },
    sparkSeconds: { value: 0.21, min: 0.08, max: 2.5, step: 0.01 },
    sparkSize: { value: 0.56, min: 0.5, max: 3, step: 0.01 },
    verticalAt: { value: 0.6, min: 0, max: 1.4, step: 0.01 },
    diagonalAt: { value: 1.1, min: 0.2, max: 2, step: 0.01 }
  })
  const controlsRef = useRef(controls)

  controlsRef.current = controls

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return
    }

    let startedAt = 0
    let morphStartedAt = -1
    let countStartedAt = -1
    let reelStartedAt = -1
    let countValue = 0
    const countDuration = 980
    let raf = 0
    let lastFrame = 0
    let viewW = 0
    let viewH = 0
    let dpr = 1
    let cellW = 0
    let cellH = 0
    let cols = 0
    let rows = 0
    let visibleCount = 0
    let gridFont = ''
    let titleFont = ''
    let targetTitleFont = ''
    let titleX = 0
    let titleY = 0
    let titleShadow = 0
    let titleBackdropX = 0
    let titleBackdropY = 0
    let titleBackdropW = 0
    let titleBackdropH = 0
    let haScale = 0
    let titleScale = 0
    let rowOrder = new Int32Array(0)
    let colOrder = new Int32Array(0)
    let diagOrder = new Int32Array(0)
    let colX = new Float32Array(0)
    let rowY = new Float32Array(0)
    let rowSparkX = new Float32Array(0)
    let rowSparkY = new Float32Array(0)
    let colSparkX = new Float32Array(0)
    let colSparkY = new Float32Array(0)
    let diagSparkX = new Float32Array(0)
    let diagSparkY = new Float32Array(0)
    const blurCanvas = document.createElement('canvas')
    const blurCtx = blurCanvas.getContext('2d')
    const lensCanvas = document.createElement('canvas')
    const lensCtx = lensCanvas.getContext('2d')
    let lastSparkAt = -Infinity
    let sparkQueue: {
      angle: number
      id: number
      seed: number
      size: number
      x: number
      y: number
    }[] = []
    let sparks: {
      angle: number
      born: number
      id: number
      seed: number
      size: number
      x: number
      y: number
    }[] = []
    let lastColSpark = -1
    let lastDiagSpark = -1
    let lastRowSpark = -1
    let lastTitleSparkAt = -Infinity
    let titleSparkIndex = 0
    let lastTitleSparkSlot = -1

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const nextHaScale = controlsRef.current.haSize
      const nextTitleScale = controlsRef.current.titleSize

      if (
        w === viewW &&
        h === viewH &&
        nextDpr === dpr &&
        nextHaScale === haScale &&
        nextTitleScale === titleScale
      ) {
        return
      }

      viewW = w
      viewH = h
      dpr = nextDpr
      haScale = nextHaScale
      titleScale = nextTitleScale
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const targetFontSize =
        Math.max(56, Math.min(150, Math.floor(Math.min(w, h) / 6.2))) * haScale

      ctx.font = `300 ${targetFontSize}px ${GRID_FONT_FAMILY}`

      const tokenW = ctx.measureText(GRID_TOKEN).width * 0.94
      const targetCellH = targetFontSize * 0.78

      const innerCols = Math.max(2, Math.round(w / tokenW))
      const innerRows = Math.max(2, Math.round(h / targetCellH))

      cols = innerCols
      rows = innerRows + 1
      cellW = w / innerCols
      cellH = h / innerRows

      ctx.font = `300 100px ${GRID_FONT_FAMILY}`

      const tokenRatio = ctx.measureText(GRID_TOKEN).width / 100
      const fontSize = Math.max(1, Math.min(cellH / 0.78, cellW / tokenRatio))

      gridFont = `300 ${fontSize}px ${GRID_FONT_FAMILY}`
      ctx.font = gridFont
      ctx.textBaseline = 'top'

      colX = Float32Array.from({ length: cols }, (_, i) => i * cellW)
      rowY = Float32Array.from({ length: rows }, (_, i) => (i - 0.5) * cellH)

      const titleSize = Math.max(22, Math.min(w / 11, h / 7)) * titleScale

      titleFont = `400 ${titleSize}px ${TITLE_FONT_FAMILY}`
      targetTitleFont = `400 ${titleSize * 1.08 * 1.7}px ${DASHBOARD_FONT_FAMILY}`
      ctx.font = titleFont

      titleX = w / 2
      titleY = h / 2
      titleShadow = titleSize
      titleBackdropW = ctx.measureText(TITLE).width + titleSize * 0.9
      titleBackdropH = titleSize * 1.45
      titleBackdropX = titleX - titleBackdropW / 2
      titleBackdropY = titleY - titleBackdropH / 2
      rowOrder = new Int32Array(cols * rows).fill(-1)
      colOrder = new Int32Array(cols * rows).fill(-1)
      diagOrder = new Int32Array(cols * rows).fill(-1)
      visibleCount = 0

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          rowOrder[y * cols + x] = visibleCount++
        }
      }

      let colIdx = 0

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const cell = y * cols + x

          if (rowOrder[cell] >= 0) {
            colOrder[cell] = colIdx++
          }
        }
      }

      let diagIdx = 0

      for (let d = 0; d < cols + rows - 1; d++) {
        const y0 = Math.max(0, d - cols + 1)
        const y1 = Math.min(rows - 1, d)

        for (let y = y0; y <= y1; y++) {
          const x = d - y
          const cell = y * cols + x

          if (rowOrder[cell] >= 0) {
            diagOrder[cell] = diagIdx++
          }
        }
      }

      rowSparkX = new Float32Array(visibleCount)
      rowSparkY = new Float32Array(visibleCount)
      colSparkX = new Float32Array(visibleCount)
      colSparkY = new Float32Array(visibleCount)
      diagSparkX = new Float32Array(visibleCount)
      diagSparkY = new Float32Array(visibleCount)

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = y * cols + x
          const rowIdx = rowOrder[cell]

          if (rowIdx < 0) {
            continue
          }

          const cx = (x + 0.5) * cellW
          const cy = y * cellH
          const colIdx = colOrder[cell]
          const diagIdx = diagOrder[cell]

          rowSparkX[rowIdx] = cx
          rowSparkY[rowIdx] = cy
          colSparkX[colIdx] = cx
          colSparkY[colIdx] = cy
          diagSparkX[diagIdx] = cx
          diagSparkY[diagIdx] = cy
        }
      }
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)

      if (now - lastFrame < 1e3 / FPS_CAP) {
        return
      }

      lastFrame = now

      if (!cols || !rows || !visibleCount) {
        return
      }

      ctx.font = gridFont
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      if (!startedAt) {
        startedAt = now
      }

      const t = (now - startedAt) * 0.001
      const settings = controlsRef.current

      if (settings.haSize !== haScale || settings.titleSize !== titleScale) {
        resize()
      }

      const beat = 0.5 + 0.5 * Math.sin(t * 0.8)
      const travel = t * settings.speed
      const cursor = Math.floor(travel)
      const colorTween = popBezier(travel - cursor)
      const rowColorOffset = mod(3 - mod(cols, PALETTE.length), PALETTE.length)
      const colColorOffset = mod(3 - mod(rows, PALETTE.length), PALETTE.length)
      const cellsPerSweep = visibleCount
      const rowStart = 0
      const colStart = Math.floor(cellsPerSweep * settings.verticalAt)
      const diagStart = Math.floor(
        cellsPerSweep * Math.max(settings.verticalAt, settings.diagonalAt)
      )
      const cycleLength = diagStart + cellsPerSweep
      const starField = cursor >= cycleLength
      const cycleCursor = Math.min(cursor, cycleLength)
      const diagRevealRaw = cursor - diagStart
      const activeTokens = Math.max(1, Math.round(settings.activeTokens))
      const fadeCells = Math.max(0, Math.round(settings.fadeCells))
      const starRevealDelay =
        Math.floor(cellsPerSweep * 0.16) + (activeTokens - 1)
      const starReveal = diagRevealRaw - starRevealDelay
      const starResolve = clamp01(starReveal / cellsPerSweep)
      const reelPrimed = countStartedAt >= 0 && starResolve >= 0.97

      if (reelPrimed && reelStartedAt < 0) {
        reelStartedAt = now
      }

      const reelProgress =
        reelStartedAt < 0
          ? 0
          : easeOutQuint(clamp01((now - reelStartedAt) / 780))
      const reelTime = reelStartedAt < 0 ? 0 : (now - reelStartedAt) * 0.001
      const reelActive = reelProgress > 0.001

      const scanPower = (start: number, index: number) => {
        if (starField) {
          return 0
        }

        const local = cycleCursor - start

        if (local < 0 || local >= cellsPerSweep) {
          return 0
        }

        const distance = Math.floor(local) - index

        if (distance < 0) {
          return 0
        }

        if (distance < activeTokens) {
          return 1
        }

        if (fadeCells && distance < activeTokens + fadeCells) {
          return 1 - (distance - activeTokens + 1) / fadeCells
        }

        return 0
      }

      const addSpark = (
        id: number,
        x: number,
        y: number,
        angle: number,
        size = 1
      ) => {
        const nx = (x - titleX) / (titleBackdropW * 0.5)
        const ny = (y - titleY) / (titleBackdropH * 0.5)

        if (Math.hypot(nx, ny) > 1) {
          return
        }

        if (
          sparks.some(spark => spark.id === id) ||
          sparkQueue.some(spark => spark.id === id)
        ) {
          return
        }

        sparkQueue.push({
          angle,
          id,
          seed: rand(id + x * 0.07 + y * 0.13),
          size,
          x,
          y
        })

        if (sparkQueue.length > 18) {
          sparkQueue = sparkQueue.slice(-18)
        }
      }

      const drawSpark = (
        x: number,
        y: number,
        angle: number,
        seed: number,
        alpha = 1,
        sizeMul = 1
      ) => {
        if (alpha <= 0 || settings.titleBeam <= 0) {
          return
        }

        const power = alpha * settings.titleBeam * settings.titleLens

        if (power <= 0) {
          return
        }

        const size = Math.max(
          16,
          titleShadow *
            (0.24 + settings.titleBeamWidth * 0.62) *
            settings.sparkSize *
            lerp(0.78, 1.35, rand(seed + 1)) *
            sizeMul
        )
        const strokeScale = Math.max(0.72, Math.sqrt(sizeMul))
        const core = Math.max(2.2, size * 0.1)
        const long = size * lerp(1.55, 2.22, rand(seed + 2))
        const short = size * lerp(0.52, 0.92, rand(seed + 3))
        const prongA = lerp(0.4, 0.78, rand(seed + 5))
        const prongB = lerp(0.34, 0.72, rand(seed + 6))
        const shardSpin = rand(seed + 7) * Math.PI

        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = power
        ctx.translate(x, y)
        ctx.rotate(angle)

        ctx.lineCap = 'round'
        ctx.lineWidth = Math.max(1.2, titleShadow * 0.018 * strokeScale)
        ctx.strokeStyle = '#fffbe4'
        ctx.beginPath()
        ctx.moveTo(-long, 0)
        ctx.lineTo(long, 0)
        ctx.moveTo(0, -short)
        ctx.lineTo(0, short)
        ctx.moveTo(-short * prongA, -short * prongB)
        ctx.lineTo(short * prongA, short * prongB)
        ctx.moveTo(-short * prongB, short * prongA)
        ctx.lineTo(short * prongB, -short * prongA)
        ctx.stroke()

        ctx.globalAlpha = power * settings.titlePrism
        ctx.lineWidth = Math.max(0.9, titleShadow * 0.01 * strokeScale)
        ctx.strokeStyle = '#ff4f9b'
        ctx.beginPath()
        ctx.moveTo(-long * lerp(0.58, 0.9, rand(seed + 8)), -core * 1.2)
        ctx.lineTo(long * lerp(0.24, 0.58, rand(seed + 9)), -core * 1.2)
        ctx.moveTo(-short * lerp(0.22, 0.52, rand(seed + 10)), -short * prongA)
        ctx.lineTo(short * lerp(0.1, 0.34, rand(seed + 11)), -short * prongB)
        ctx.stroke()

        ctx.strokeStyle = '#56e8ff'
        ctx.beginPath()
        ctx.moveTo(-long * lerp(0.24, 0.54, rand(seed + 12)), core * 1.2)
        ctx.lineTo(long * lerp(0.56, 0.92, rand(seed + 13)), core * 1.2)
        ctx.moveTo(-short * lerp(0.06, 0.22, rand(seed + 14)), short * prongB)
        ctx.lineTo(short * lerp(0.28, 0.6, rand(seed + 15)), short * prongA)
        ctx.stroke()

        ctx.globalAlpha = power
        ctx.fillStyle = '#fffdf0'
        ctx.beginPath()
        ctx.moveTo(0, -core * 3.2)
        ctx.lineTo(core * 2.15, -core * 0.38)
        ctx.lineTo(core * 3.2, 0)
        ctx.lineTo(core * 2.15, core * 0.38)
        ctx.lineTo(0, core * 3.2)
        ctx.lineTo(-core * 2.15, core * 0.38)
        ctx.lineTo(-core * 3.2, 0)
        ctx.lineTo(-core * 2.15, -core * 0.38)
        ctx.closePath()
        ctx.fill()

        ctx.globalAlpha = power * 0.78
        ctx.fillStyle = '#ffe37b'
        for (let i = 0; i < 3; i++) {
          const a =
            shardSpin + (i / 3) * Math.PI * 2 + rand(seed + 20 + i) * 0.8
          const d = size * lerp(0.38, 0.88, rand(seed + 30 + i))
          const sx = Math.cos(a) * d
          const sy = Math.sin(a) * d
          const m = lerp(0.08, 0.18, rand(seed + 40 + i))

          ctx.beginPath()
          ctx.moveTo(sx, sy - size * m)
          ctx.lineTo(sx + size * m, sy)
          ctx.lineTo(sx, sy + size * m)
          ctx.lineTo(sx - size * m, sy)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, viewW, viewH)

      for (let y = 0; y < rows; y++) {
        const py = rowY[y]

        for (let x = 0; x < cols; x++) {
          const dither = BAYER_4X4[y & 3][x & 3] / 16
          const cellIndex = y * cols + x
          const rowIndex = rowOrder[cellIndex]

          if (rowIndex < 0) {
            continue
          }

          const colIndex = colOrder[cellIndex]
          const diagIndex = diagOrder[cellIndex]
          const rowPower = scanPower(rowStart, rowIndex)
          const colPower = scanPower(colStart, colIndex)
          const diagPower = scanPower(diagStart, diagIndex)
          const useCol = colPower > rowPower && colPower >= diagPower
          const useDiag = diagPower > rowPower && diagPower > colPower
          const scanIndex = useDiag ? diagIndex : useCol ? colIndex : rowIndex
          const scanCursor = Math.floor(
            cycleCursor - (useDiag ? diagStart : useCol ? colStart : rowStart)
          )
          const crossOffset = useDiag
            ? (x + y) * 2
            : useCol
              ? x * colColorOffset
              : y * rowColorOffset
          const paletteIndex = mod(
            scanIndex + crossOffset - (starField ? cursor : scanCursor),
            PALETTE.length
          )
          const nextPaletteIndex = mod(paletteIndex - 1, PALETTE.length)
          let base = mixColor(
            PALETTE[paletteIndex],
            PALETTE[nextPaletteIndex],
            colorTween
          )
          base = hueRotate(base, settings.hue + t * settings.hueDrift)
          const sayPower = Math.max(rowPower, colPower, diagPower)

          const shimmer = 0.5 + 0.5 * Math.sin(t * 2.1 + x * 0.08 + y * 0.06)
          const cellGapX = cellW * settings.haCellGap
          const cellGapY = cellH * settings.haCellGap
          let drawX = colX[x] + cellGapX
          let drawY = py + cellGapY
          let intensity =
            settings.brightness +
            shimmer * settings.shimmer +
            beat * settings.beat

          const lit = clamp01(intensity + (dither - 0.5) * 0.22)
          const r = Math.floor(base[0] * lit)
          const g = Math.floor(base[1] * lit)
          const b = Math.floor(base[2] * lit)
          const color = `rgb(${r}, ${g}, ${b})`
          const starCell = starReveal >= diagIndex
          const starGoldMix = starCell ? easeOutQuint(clamp01(reelProgress)) : 0
          const starR = Math.floor(lerp(r, STAR_GOLD[0], starGoldMix))
          const starG = Math.floor(lerp(g, STAR_GOLD[1], starGoldMix))
          const starB = Math.floor(lerp(b, STAR_GOLD[2], starGoldMix))
          const drawColor = starCell
            ? `rgb(${starR}, ${starG}, ${starB})`
            : color
          const dimStar = mod(x + y, 2) === 1
          const starTargetAlpha = dimStar ? 0.1 : 1
          const starFade = starCell
            ? easeOutQuint(
                clamp01((starReveal - diagIndex) / STAR_ALPHA_FADE_CELLS)
              )
            : 0
          const alpha = starCell
            ? starTargetAlpha * starFade
            : settings.inactiveOpacity +
              sayPower * (1 - settings.inactiveOpacity)

          let reelSpan = 0

          if (starCell && reelActive) {
            const columnDir = x % 2 === 0 ? 1 : -1
            const reelMin = -0.5 * cellH + cellGapY
            reelSpan = rows * cellH
            const reelSpeed = cellH * (0.58 + starResolve * 0.28) * reelProgress
            const reelOffset = reelTime * reelSpeed * columnDir
            drawY = reelMin + mod(drawY - reelMin + reelOffset, reelSpan)
          }

          if (starCell) {
            const starW = cellW - cellGapX * 2
            const starH = cellH - cellGapY * 2
            const wrapBuffer = cellH * 1.08
            const drawWrappedStar = (
              sx: number,
              sy: number,
              sw: number,
              sh: number,
              sa: number
            ) => {
              drawStarGlyph(ctx, sx, sy, sw, sh, sa, drawColor)

              if (!reelActive || reelSpan <= 0) {
                return
              }

              if (sy < wrapBuffer) {
                drawStarGlyph(ctx, sx, sy + reelSpan, sw, sh, sa, drawColor)
              }

              if (sy > viewH - wrapBuffer) {
                drawStarGlyph(ctx, sx, sy - reelSpan, sw, sh, sa, drawColor)
              }
            }

            drawWrappedStar(drawX, drawY, starW, starH, alpha)
          } else {
            drawAsciiHa(
              ctx,
              ASCII_HA,
              drawX,
              drawY,
              cellW - cellGapX * 2,
              cellH - cellGapY * 2,
              settings.haBlockGap,
              alpha,
              drawColor
            )
          }
          ctx.globalAlpha = 1
        }
      }

      ctx.globalAlpha = 1
      ctx.font = titleFont
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (blurCtx && lensCtx) {
        const pad = titleBackdropH * 0.9
        const sx = Math.max(0, Math.floor((titleBackdropX - pad) * dpr))
        const sy = Math.max(0, Math.floor((titleBackdropY - pad) * dpr))
        const ex = Math.min(
          canvas.width,
          Math.ceil((titleBackdropX + titleBackdropW + pad) * dpr)
        )
        const ey = Math.min(
          canvas.height,
          Math.ceil((titleBackdropY + titleBackdropH + pad) * dpr)
        )
        const sw = ex - sx
        const sh = ey - sy

        if (sw > 0 && sh > 0) {
          const cx = titleX * dpr - sx
          const cy = titleY * dpr - sy
          const rx = (titleBackdropW * dpr) / 2
          const ry = (titleBackdropH * dpr) / 2

          blurCanvas.width = sw
          blurCanvas.height = sh
          lensCanvas.width = sw
          lensCanvas.height = sh
          blurCtx.clearRect(0, 0, sw, sh)
          lensCtx.clearRect(0, 0, sw, sh)
          blurCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)

          lensCtx.filter = `blur(${titleShadow * settings.titleBackdropBlur * dpr}px)`
          lensCtx.drawImage(blurCanvas, 0, 0)
          lensCtx.filter = 'none'

          lensCtx.globalAlpha = settings.titleBackdrop
          lensCtx.save()
          lensCtx.translate(cx, cy)
          lensCtx.scale(rx, ry)

          const shadow = lensCtx.createRadialGradient(0, 0, 0, 0, 0, 1)

          shadow.addColorStop(0, 'rgba(5, 2, 11, 0.82)')
          shadow.addColorStop(0.55, 'rgba(5, 2, 11, 0.42)')
          shadow.addColorStop(1, 'rgba(5, 2, 11, 0)')
          lensCtx.fillStyle = shadow
          lensCtx.fillRect(-1.25, -1.25, 2.5, 2.5)
          lensCtx.restore()

          lensCtx.globalAlpha = 1
          lensCtx.globalCompositeOperation = 'destination-in'
          lensCtx.save()
          lensCtx.translate(cx, cy)
          lensCtx.scale(rx + pad * dpr * 0.8, ry + pad * dpr * 0.65)

          const mask = lensCtx.createRadialGradient(0, 0, 0, 0, 0, 1)

          mask.addColorStop(0, 'rgba(0, 0, 0, 1)')
          mask.addColorStop(0.58, 'rgba(0, 0, 0, 0.86)')
          mask.addColorStop(1, 'rgba(0, 0, 0, 0)')
          lensCtx.fillStyle = mask
          lensCtx.fillRect(-1, -1, 2, 2)
          lensCtx.restore()
          lensCtx.globalCompositeOperation = 'source-over'
          lensCtx.globalAlpha = 1

          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.drawImage(lensCanvas, sx, sy)
          ctx.restore()
        }
      }

      const rowLocal = cycleCursor - rowStart
      const colLocal = cycleCursor - colStart
      const diagLocal = cycleCursor - diagStart

      if (rowLocal >= 0 && rowLocal < cellsPerSweep) {
        const i = Math.floor(rowLocal)

        if (i !== lastRowSpark) {
          lastRowSpark = i
          addSpark(i, rowSparkX[i], rowSparkY[i], 0)
        }
      }

      if (colLocal >= 0 && colLocal < cellsPerSweep) {
        const i = Math.floor(colLocal)

        if (i !== lastColSpark) {
          lastColSpark = i
          addSpark(cellsPerSweep + i, colSparkX[i], colSparkY[i], Math.PI / 2)
        }
      }

      if (diagLocal >= 0 && diagLocal < cellsPerSweep) {
        const i = Math.floor(diagLocal)

        if (i !== lastDiagSpark) {
          lastDiagSpark = i
          addSpark(
            cellsPerSweep * 2 + i,
            diagSparkX[i],
            diagSparkY[i],
            Math.PI / 4
          )
        }
      }

      const sparkLife = settings.sparkSeconds * 1000
      const sparkInterval = Math.max(45, sparkLife * 0.45)
      const maxSparks = Math.max(2, Math.ceil(sparkLife / sparkInterval) + 1)

      sparks = sparks.filter(spark => now - spark.born <= sparkLife)

      if (
        sparkQueue.length &&
        now - lastSparkAt >= sparkInterval &&
        sparks.length < maxSparks
      ) {
        const spark = sparkQueue.shift()

        if (spark) {
          lastSparkAt = now
          sparks.push({ ...spark, born: now })
        }
      }

      if (starResolve >= 0.9 && morphStartedAt < 0) {
        morphStartedAt = now
        countStartedAt = now
        countValue = 0
      }

      const titleMorph =
        morphStartedAt < 0 ? 0 : clamp01((now - morphStartedAt) / 950)
      const classicAlpha = 1 - easeOutQuint(clamp01(titleMorph * 2.8))

      if (countStartedAt >= 0) {
        const counterT = clamp01((now - countStartedAt) / countDuration)
        countValue = Math.round(150_000 * countEase(counterT))
      }

      const drawTitleStack = (
        text: string,
        alpha: number,
        font: string,
        tracking = 0,
        stabilizeDigits = false
      ) => {
        if (alpha <= 0.001) {
          return
        }

        const drawText = (dx: number, dy: number) => {
          if (tracking <= 0.001 || text.length < 2) {
            ctx.fillText(text, dx, dy)

            return
          }

          const chars = [...text]
          const widths = chars.map(ch => ctx.measureText(ch).width)
          const slotWidth = stabilizeDigits
            ? Math.max(
                ...[...GLITCH_DIGITS, ' '].map(ch => ctx.measureText(ch).width)
              )
            : 0
          const total =
            (stabilizeDigits
              ? slotWidth * chars.length
              : widths.reduce((sum, w) => sum + w, 0)) +
            tracking * Math.max(0, chars.length - 1)
          let x = dx - total / 2

          ctx.textAlign = 'left'

          for (let i = 0; i < chars.length; i++) {
            if (stabilizeDigits) {
              ctx.fillText(chars[i], x + (slotWidth - widths[i]) * 0.5, dy)
              x += slotWidth + tracking
            } else {
              ctx.fillText(chars[i], x, dy)
              x += widths[i] + tracking
            }
          }

          ctx.textAlign = 'center'
        }

        ctx.font = font
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = 0.38 * alpha
        ctx.fillStyle = '#8d2f6c'
        drawText(titleX - titleShadow * 0.16, titleY + titleShadow * 0.15)
        ctx.globalAlpha = 0.5 * alpha
        ctx.fillStyle = '#d65a32'
        drawText(titleX - titleShadow * 0.09, titleY + titleShadow * 0.09)
        ctx.globalAlpha = 0.62 * alpha
        ctx.fillStyle = '#f0a13a'
        drawText(titleX - titleShadow * 0.04, titleY + titleShadow * 0.04)
        ctx.globalAlpha = alpha
        ctx.shadowBlur = titleShadow * settings.titleShadowBlur
        ctx.shadowColor = `rgba(5, 2, 11, ${settings.titleShadowOpacity})`
        ctx.fillStyle = 'rgba(5, 2, 11, 0.82)'
        drawText(titleX + 2, titleY + 2)
        ctx.shadowBlur = 0
        ctx.fillStyle = '#fff4da'
        drawText(titleX, titleY)
      }

      drawTitleStack(TITLE, classicAlpha, titleFont)

      if (titleMorph > 0) {
        if (titleMorph < 1) {
          const glitchCount = Math.floor(10 + (1 - titleMorph) * 24)
          const glitchSize = Math.max(12, titleShadow * 0.13)

          ctx.save()
          ctx.beginPath()
          ctx.roundRect(
            titleBackdropX,
            titleBackdropY,
            titleBackdropW,
            titleBackdropH,
            titleBackdropH * 0.15
          )
          ctx.clip()
          ctx.font = `400 ${glitchSize}px ${DASHBOARD_FONT_FAMILY}`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.globalCompositeOperation = 'screen'

          for (let i = 0; i < glitchCount; i++) {
            const seed = i * 47 + Math.floor(now * 0.085) * 17
            const gx = titleBackdropX + rand(seed + 1) * titleBackdropW
            const gy = titleY + (rand(seed + 2) - 0.5) * titleBackdropH * 0.64
            const ch =
              GLITCH_CHARS[
                mod(Math.floor(rand(seed + 3) * 1e3), GLITCH_CHARS.length)
              ]

            ctx.globalAlpha =
              (1 - titleMorph) * lerp(0.18, 0.42, rand(seed + 4))
            ctx.fillStyle = rand(seed + 5) > 0.45 ? '#7fd9ff' : '#ff5ea8'
            ctx.fillText(ch, gx, gy)
          }

          ctx.restore()
        }

        const countLabel = Math.max(0, Math.min(150_000, countValue))
          .toLocaleString('en-US')
          .padStart(TARGET_TITLE.length, ' ')

        drawTitleStack(
          countLabel,
          clamp01(titleMorph * 1.14),
          targetTitleFont,
          3.2,
          true
        )

        const titleSparkPhase = clamp01((titleMorph - 0.86) / 0.14)

        if (titleSparkPhase > 0) {
          const titleSparkInterval = lerp(120, 62, titleSparkPhase)
          const countChars = [...countLabel]
          const sparkSlots: number[] = []

          for (let i = 0; i < countChars.length; i++) {
            if (/\d/.test(countChars[i])) {
              sparkSlots.push(i)
            }
          }

          if (
            sparkSlots.length &&
            now - lastTitleSparkAt >= titleSparkInterval
          ) {
            lastTitleSparkAt = now
            const idx = titleSparkIndex++
            const seed = idx * 61.7 + now * 0.043
            const tracking = 3.2

            ctx.font = targetTitleFont
            const slotW = Math.max(
              ...[...GLITCH_DIGITS, ' '].map(ch => ctx.measureText(ch).width)
            )
            const totalW =
              slotW * countChars.length +
              tracking * Math.max(0, countChars.length - 1)
            const startX = titleX - totalW / 2
            let slot =
              sparkSlots[
                Math.floor(rand(seed + 1) * sparkSlots.length) %
                  sparkSlots.length
              ]

            if (sparkSlots.length > 1 && slot === lastTitleSparkSlot) {
              const altOffset =
                1 +
                (Math.floor(rand(seed + 2) * (sparkSlots.length - 1)) %
                  (sparkSlots.length - 1))

              slot =
                sparkSlots[
                  (sparkSlots.indexOf(slot) + altOffset) % sparkSlots.length
                ]
            }

            lastTitleSparkSlot = slot
            const baseX = startX + slot * (slotW + tracking) + slotW * 0.5
            const baseY = titleY + (rand(seed + 3) - 0.5) * titleShadow * 0.26
            const sparkX = baseX + (rand(seed + 4) - 0.5) * slotW * 0.62
            const sparkY = baseY + (rand(seed + 5) - 0.5) * titleShadow * 0.28
            const sparkAngle = rand(seed + 6) * Math.PI * 2
            const sparkSize = lerp(0.42, 0.74, rand(seed + 7))

            addSpark(9_000_000 + idx, sparkX, sparkY, sparkAngle, sparkSize)
          }
        }
      }

      for (const spark of sparks) {
        const age = (now - spark.born) / sparkLife
        const alpha = age < 0.82 ? 1 : 1 - (age - 0.82) / 0.18

        drawSpark(
          spark.x,
          spark.y,
          spark.angle,
          spark.seed,
          clamp01(alpha),
          spark.size
        )
      }
    }

    const onResize = () => resize()

    resize()
    void document.fonts.ready.then(() => resize())
    addEventListener('resize', onResize)
    raf = requestAnimationFrame(draw)

    return () => {
      removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main
      className={`relative h-dvh w-dvw overflow-hidden bg-black ${techMono.className} ${airdropCountFont.className}`}>
      <canvas className="absolute inset-0 opacity-100" ref={canvasRef} />
      <Leva hidden />

      <div className="color-bloom pointer-events-none absolute inset-0" />
      <div className="scan-overlay pointer-events-none absolute inset-0" />
      <div className="grain-overlay pointer-events-none absolute inset-0" />

      <style jsx>{`
        @font-face {
          font-family: 'HermesLogo';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url('https://hermes-agent.nousresearch.com/_next/static/media/Collapse_Regular-s.ba95faf0.woff2')
            format('woff2');
        }

        .color-bloom {
          background: radial-gradient(
              circle at 20% 20%,
              rgba(255, 110, 170, 0.24),
              transparent 48%
            ),
            radial-gradient(
              circle at 80% 24%,
              rgba(119, 144, 255, 0.22),
              transparent 45%
            ),
            radial-gradient(
              circle at 50% 85%,
              rgba(255, 220, 120, 0.2),
              transparent 46%
            );
          filter: blur(22px);
          mix-blend-mode: screen;
          opacity: 0.82;
          animation: bloomSpin 14s linear infinite;
        }

        .scan-overlay {
          background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.04),
              transparent 35%,
              rgba(255, 255, 255, 0.07) 50%,
              transparent 65%,
              rgba(255, 255, 255, 0.04)
            ),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.06) 0px,
              rgba(255, 255, 255, 0.06) 1px,
              transparent 1px,
              transparent 3px
            );
          mix-blend-mode: soft-light;
          opacity: 0.28;
          animation: scanMove 6s linear infinite;
        }

        .grain-overlay {
          background-image: radial-gradient(
            rgba(255, 255, 255, 0.12) 0.6px,
            transparent 0.6px
          );
          background-size: 3px 3px;
          mix-blend-mode: overlay;
          opacity: 0.1;
          animation: grainShift 800ms steps(2, end) infinite;
        }

        .climax-tag {
          margin-bottom: 0.6rem;
          color: rgba(255, 255, 255, 0.82);
          font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
          font-size: clamp(0.9rem, 1.9vw, 1.5rem);
          letter-spacing: 0.46em;
          text-transform: uppercase;
        }

        .climax-value {
          font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', system-ui,
            sans-serif;
          font-size: clamp(3.8rem, 14vw, 10rem);
          font-weight: 900;
          letter-spacing: 0.06em;
          line-height: 0.92;
          color: #fff6ee;
          text-shadow:
            -4px 0 rgba(255, 100, 173, 0.4),
            4px 0 rgba(92, 179, 255, 0.4),
            0 0 24px rgba(255, 211, 117, 0.35);
          animation:
            valuePulse 1.8s ease-in-out infinite,
            valueChroma 4.8s linear infinite;
        }

        .star {
          color: #fff1a7;
          text-shadow: 0 0 22px rgba(255, 241, 167, 0.68);
        }

        @keyframes bloomSpin {
          0% {
            transform: rotate(0deg) scale(1.03);
          }
          50% {
            transform: rotate(180deg) scale(1.1);
          }
          100% {
            transform: rotate(360deg) scale(1.03);
          }
        }

        @keyframes scanMove {
          0% {
            transform: translateY(-2%);
          }
          100% {
            transform: translateY(2%);
          }
        }

        @keyframes grainShift {
          0% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(-1px, 1px);
          }
          100% {
            transform: translate(1px, -1px);
          }
        }

        @keyframes valuePulse {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.02);
          }
        }

        @keyframes valueChroma {
          0% {
            text-shadow:
              -4px 0 rgba(255, 100, 173, 0.4),
              4px 0 rgba(92, 179, 255, 0.4),
              0 0 24px rgba(255, 211, 117, 0.35);
          }
          33% {
            text-shadow:
              -4px 0 rgba(255, 190, 120, 0.4),
              4px 0 rgba(153, 255, 180, 0.35),
              0 0 26px rgba(107, 164, 255, 0.38);
          }
          66% {
            text-shadow:
              -4px 0 rgba(109, 194, 255, 0.4),
              4px 0 rgba(255, 130, 213, 0.35),
              0 0 25px rgba(255, 226, 146, 0.38);
          }
          100% {
            text-shadow:
              -4px 0 rgba(255, 100, 173, 0.4),
              4px 0 rgba(92, 179, 255, 0.4),
              0 0 24px rgba(255, 211, 117, 0.35);
          }
        }
      `}</style>
    </main>
  )
}
