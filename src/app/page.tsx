'use client'

import Scene, { Controls, Effects } from '@/scene'
import { Environment, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'

export default function Index() {
  return (
    <main>
      <Canvas orthographic className="cursor-crosshair !w-svw !h-svh">
        <Environment preset="studio" />

        <Suspense>
          <Scene />
          <Effects />
          <Controls />
        </Suspense>

        <Stats />
      </Canvas>

      <footer className="z-10 fixed inset-x-0 bottom-0 p-5 text-center text-xs text-white text-opacity-75">
        alt + (l|r)mb to (rotate|pan)
      </footer>
    </main>
  )
}
