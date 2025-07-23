'use client'

import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface EdgeProps {
  uniforms: any
  particleCount: number
}

export default function Edges({ uniforms, particleCount }: EdgeProps) {
  const edgesMeshRef = useRef<THREE.LineSegments>(null!)
  const pointsMeshRef = useRef<THREE.Points>(null!)
  const edgePositionsRef = useRef<Float32Array>()
  const edgeColorsRef = useRef<Float32Array>()
  const pointPositionsRef = useRef<Float32Array>()
  const pointSizesRef = useRef<Float32Array>()

  const {
    edgesEnabled,
    maxDistance,
    edgeOpacity,
    maxEdges,
    sampleSize,
    showDots,
    dotSize
  } = useControls('Edges', {
    edgesEnabled: { value: true },
    showDots: { value: true },
    maxDistance: { value: 0.4, min: 0.1, max: 1.0, step: 0.05 },
    edgeOpacity: { value: 0.05, min: 0, max: 0.2, step: 0.01 },
    dotSize: { value: 0.02, min: 0.005, max: 0.1, step: 0.005 },
    maxEdges: { value: 1000, min: 100, max: 3000, step: 100 },
    sampleSize: { value: 200, min: 50, max: 500, step: 50 }
  })

  useEffect(() => {
    // Pre-allocate arrays
    edgePositionsRef.current = new Float32Array(maxEdges * 6) // 2 vertices * 3 coords
    edgeColorsRef.current = new Float32Array(maxEdges * 6) // 2 vertices * 3 color channels
    pointPositionsRef.current = new Float32Array(sampleSize * 3) // max points * 3 coords
    pointSizesRef.current = new Float32Array(sampleSize) // size per point

    if (edgesMeshRef.current) {
      edgesMeshRef.current.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(edgePositionsRef.current, 3)
      )
      edgesMeshRef.current.geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(edgeColorsRef.current, 3)
      )
    }

    if (pointsMeshRef.current) {
      pointsMeshRef.current.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(pointPositionsRef.current, 3)
      )
      pointsMeshRef.current.geometry.setAttribute(
        'size',
        new THREE.BufferAttribute(pointSizesRef.current, 1)
      )
    }
  }, [maxEdges, sampleSize])

  useFrame(() => {
    if (!edgesEnabled || !uniforms.positionsTexture.value) return
    if (
      !edgePositionsRef.current ||
      !edgeColorsRef.current ||
      !pointPositionsRef.current ||
      !pointSizesRef.current
    )
      return

    const texture = uniforms.positionsTexture.value as THREE.DataTexture
    if (!texture.image || !texture.image.data) return

    const mixFactor = uniforms.mixFactor.value
    const time = uniforms.uTime.value
    const numKeyframes = uniforms.numKeyframes.value

    // Calculate sample rate
    const sampleRate = Math.max(1, Math.floor(particleCount / sampleSize))
    const sampledPositions: THREE.Vector3[] = []

    // Calculate morphing indices
    const totalSteps = numKeyframes - 1
    const floatIndex = mixFactor * totalSteps
    const prevIndex = Math.floor(floatIndex)
    const nextIndex = Math.min(prevIndex + 1, numKeyframes - 1)
    const t = floatIndex - prevIndex

    // Get texture properties
    const data = texture.image.data
    const width = texture.image.width

    // Sample particle positions
    for (let i = 0; i < particleCount; i += sampleRate) {
      const normalizedIndex = i / particleCount
      const pixelX = Math.floor(normalizedIndex * width)

      // Get positions from texture
      const prevOffset = (prevIndex * width + pixelX) * 4
      const nextOffset = (nextIndex * width + pixelX) * 4

      if (prevOffset + 3 < data.length && nextOffset + 3 < data.length) {
        const prevPos = new THREE.Vector3(
          data[prevOffset] / 2,
          data[prevOffset + 1] / 2,
          data[prevOffset + 2] / 2
        )

        const nextPos = new THREE.Vector3(
          data[nextOffset] / 2,
          data[nextOffset + 1] / 2,
          data[nextOffset + 2] / 2
        )

        // Interpolate
        const morphedPos = new THREE.Vector3().lerpVectors(prevPos, nextPos, t)

        // Add floating animation (matching vertex shader)
        const offset = i * 100.0
        const floatAmount = normalizedIndex * 0.005
        morphedPos.x += Math.sin(time * 0.8 + offset) * floatAmount * 0.5
        morphedPos.y += Math.sin(time + offset) * floatAmount
        morphedPos.z += Math.cos(time * 1.2 + offset) * floatAmount * 0.5

        // Apply scale (matching the group scale)
        morphedPos.multiplyScalar(5.5)

        sampledPositions.push(morphedPos)
      }
    }

    // Update point positions
    if (showDots && pointsMeshRef.current) {
      sampledPositions.forEach((pos, i) => {
        const idx = i * 3
        pointPositionsRef.current![idx] = pos.x
        pointPositionsRef.current![idx + 1] = pos.y
        pointPositionsRef.current![idx + 2] = pos.z

        // Add twinkling effect to point sizes
        const offset = i * 100.0
        const twinkle = Math.sin(time * 2.0 + offset * 5) * 0.5 + 0.5
        pointSizesRef.current![i] = dotSize * (0.7 + twinkle * 0.3)
      })

      pointsMeshRef.current.geometry.setDrawRange(0, sampledPositions.length)
      ;(
        pointsMeshRef.current.geometry.attributes
          .position as THREE.BufferAttribute
      ).needsUpdate = true
      ;(
        pointsMeshRef.current.geometry.attributes.size as THREE.BufferAttribute
      ).needsUpdate = true
    }

    // Find edges
    let edgeCount = 0
    const maxDist2 = maxDistance * maxDistance

    for (let i = 0; i < sampledPositions.length && edgeCount < maxEdges; i++) {
      const p1 = sampledPositions[i]

      // Only check nearby particles to reduce computation
      for (
        let j = i + 1;
        j < Math.min(i + 20, sampledPositions.length) && edgeCount < maxEdges;
        j++
      ) {
        const p2 = sampledPositions[j]
        const dist2 = p1.distanceToSquared(p2)

        if (dist2 < maxDist2 && dist2 > 0.0001) {
          const idx = edgeCount * 6
          const dist = Math.sqrt(dist2)
          const opacity = (1 - dist / maxDistance) * edgeOpacity

          // First vertex
          edgePositionsRef.current[idx] = p1.x
          edgePositionsRef.current[idx + 1] = p1.y
          edgePositionsRef.current[idx + 2] = p1.z

          // Second vertex
          edgePositionsRef.current[idx + 3] = p2.x
          edgePositionsRef.current[idx + 4] = p2.y
          edgePositionsRef.current[idx + 5] = p2.z

          // Colors (matching particle colors with opacity falloff)
          const color = new THREE.Color(0.9, 0.95, 1).multiplyScalar(
            opacity / edgeOpacity
          )
          edgeColorsRef.current[idx] = color.r
          edgeColorsRef.current[idx + 1] = color.g
          edgeColorsRef.current[idx + 2] = color.b
          edgeColorsRef.current[idx + 3] = color.r
          edgeColorsRef.current[idx + 4] = color.g
          edgeColorsRef.current[idx + 5] = color.b

          edgeCount++
        }
      }
    }

    // Update edge geometry
    if (edgesMeshRef.current) {
      edgesMeshRef.current.geometry.setDrawRange(0, edgeCount * 2)
      ;(
        edgesMeshRef.current.geometry.attributes
          .position as THREE.BufferAttribute
      ).needsUpdate = true
      ;(
        edgesMeshRef.current.geometry.attributes.color as THREE.BufferAttribute
      ).needsUpdate = true
    }
  })

  if (!edgesEnabled) return null

  return (
    <>
      {showDots && (
        <points ref={pointsMeshRef}>
          <bufferGeometry />
          <shaderMaterial
            uniforms={{
              size: { value: dotSize },
              color: { value: new THREE.Color(0.9, 0.95, 1) },
              opacity: { value: 0.6 }
            }}
            vertexShader={`
              attribute float size;
              varying float vSize;
              
              void main() {
                vSize = size;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
              }
            `}
            fragmentShader={`
              varying float vSize;
              uniform vec3 color;
              uniform float opacity;
              
              void main() {
                vec2 st = gl_PointCoord.xy - vec2(0.5);
                float dist = length(st);
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                
                if (alpha < 0.01) discard;
                
                gl_FragColor = vec4(color, alpha * opacity);
              }
            `}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      <lineSegments ref={edgesMeshRef}>
        <bufferGeometry />
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={edgeOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  )
}
