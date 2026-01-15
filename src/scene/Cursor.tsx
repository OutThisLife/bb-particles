import { Billboard, type BillboardProps, Edges } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

export function Cursor(props: BillboardProps) {
  const ref = useRef<THREE.Group>(null!)

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

      ref.current?.position?.copy(
        raycaster.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
          new THREE.Vector3()
        ) ?? new THREE.Vector3()
      )
    }
  })

  return (
    <Billboard {...{ ref, ...props }}>
      <mesh rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        <Edges linewidth={1} opacity={0.05} threshold={15} transparent />
      </mesh>
    </Billboard>
  )
}
