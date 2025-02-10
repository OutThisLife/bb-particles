import { $object } from '@/store'
import * as THREE from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadFileAsArrayBuffer } from './buffers'

export const upload = async (file: File) => {
  const acc: THREE.BufferGeometry[] = []
  const buf = await loadFileAsArrayBuffer(file)

  const dracoloader = new DRACOLoader().setDecoderPath(
    'https://www.gstatic.com/draco/v1/decoders/'
  )

  const gltfLoader = new GLTFLoader()
    .setDRACOLoader(dracoloader)
    .setMeshoptDecoder(MeshoptDecoder)

  const result = (await new Promise((resolve, reject) =>
    gltfLoader.parse(buf, '', resolve, reject)
  )) as GLTF

  result?.scene.traverse(node => {
    if (node instanceof THREE.Mesh && node.geometry) {
      acc.push(node.geometry)
    }
  })

  $object.set(acc)
}
