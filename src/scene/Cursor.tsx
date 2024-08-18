import { MeshProps, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

export default function Cursor(props: MeshProps) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame(({ camera, pointer, viewport }) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const dir = new THREE.Vector3(pointer.x, pointer.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()

      ref.current?.position.copy(
        camera.position
          .clone()
          .add(dir.multiplyScalar(-camera.position.z / dir.z))
      )
    } else if (camera instanceof THREE.OrthographicCamera) {
      ref.current?.position.set(
        (pointer.x * viewport.width) / 2,
        (pointer.y * viewport.height) / 2,
        0
      )
    }

    ref.current.scale.setScalar(
      camera.position.distanceTo(ref.current.position) * 0.25
    )

    ref.current.rotation.x += 0.001
    ref.current.rotation.y += 0.001
  })

  return (
    <mesh {...{ ref, ...props }}>
      <boxGeometry args={[0.05, 0.05, 0.05]} />
      <meshBasicMaterial
        transparent
        opacity={0.05}
        depthWrite={false}
        wireframe
      />
    </mesh>
  )
}
