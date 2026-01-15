import { Scene } from '@/scene'

export default function Index() {
  return (
    <main>
      <Scene />

      <footer className="z-10 fixed inset-x-0 bottom-0 p-5 text-center text-xs text-white text-opacity-75">
        alt + (l|r)mb to (rotate|pan)
      </footer>
    </main>
  )
}
