import { rand, rand2d, rand3d } from '@/utils'
import * as THREE from 'three'
import { mapLinear } from 'three/src/math/MathUtils.js'

const MAX_V = 0.001
const centerVec = new THREE.Vector3()
const radVec = new THREE.Vector3()

export default class Particle {
  position = new THREE.Vector3().set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
  velocity = rand3d()
  scale = new THREE.Vector3().setScalar(rand(0.0005, 0.0015))
  opacity = rand(0.5, 1)
  force = new THREE.Vector3()
  original?: THREE.Vector3

  constructor() {
    this.original = this.position.clone()
  }

  update(dt: number, objects: ParticleObj[], frame: number) {
    this.force.set(0, 0, 0)
    this.opacity = mapLinear(this.velocity.length() * 5, 0, MAX_V, 0.035, 1)

    if (!(frame % 2)) {
      for (const obj of objects) {
        if (!obj.boundingBox) {
          obj.boundingBox = new THREE.Box3()
          obj.boundingSphere = new THREE.Sphere()
        }

        if (!(frame % 10)) {
          obj.boundingBox.setFromObject(obj)
          obj.boundingBox.getBoundingSphere(obj.boundingSphere!)
        }

        const center = obj.boundingSphere!.center
        const r = obj.boundingSphere!.radius

        centerVec.subVectors(center, this.position)
        const dist3D = centerVec.length()

        if (dist3D <= r + 0.1) {
          if (!obj.boundingBox.containsPoint(this.position)) {
            if (dist3D < 0.2) {
              this.force.add(centerVec.normalize().multiplyScalar(0.001))
            }

            continue
          }

          radVec
            .set(
              this.position.x - center.x,
              this.position.y - center.y,
              this.position.z - center.z
            )
            .clampLength(0, r)

          const tanForce = new THREE.Vector3()
            .crossVectors(new THREE.Vector3(0, 1, 0), radVec)
            .normalize()
            .multiplyScalar(r * 0.0002)

          const radForce = centerVec
            .normalize()
            .multiplyScalar(
              mapLinear(
                radVec.length(),
                0,
                r,
                0.00005,
                (Math.random() < 0.5 ? 1 : -1) * 0.0001
              )
            )

          this.force
            .add(tanForce)
            .add(radForce)
            .multiplyScalar(dist3D * 0.000001)
            .lerp(rand2d().multiplyScalar(0.00003), 0.5)

          if (this.velocity.length() > MAX_V * 0.95) {
            centerVec
              .subVectors(this.original!, this.position)
              .normalize()
              .multiplyScalar(0.000001)
            this.velocity.add(centerVec)
          }
        }
      }
    }

    this.velocity
      .add(this.force.multiplyScalar(dt + 1))
      .add(rand2d().multiplyScalar(0.0000053))
      .multiplyScalar(0.99)
      .clampLength(0, MAX_V)

    this.position
      .add(this.velocity)
      .setX(((this.position.x + 1) % 2) - 1)
      .setY(((this.position.y + 1) % 2) - 1)
      .setZ(((this.position.z + 1) % 2) - 1)
  }
}

interface ParticleObj extends THREE.Object3D {
  boundingBox?: THREE.Box3
  boundingSphere?: THREE.Sphere
}
