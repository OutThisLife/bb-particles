import { Billboard, Edges } from '@react-three/drei'
import { MeshProps, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

export default function Cursor(props: MeshProps) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame(({ camera, pointer, raycaster }) => {
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
      raycaster.setFromCamera(pointer, camera)

      ref.current?.position.copy(
        raycaster.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
          new THREE.Vector3()
        )
      )
    }
  })

  return (
    <Billboard {...{ ref, ...props }}>
      <mesh rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges linewidth={1} threshold={15} opacity={0.05} transparent />
      </mesh>
    </Billboard>
  )
}
