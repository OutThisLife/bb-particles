'use client'

import Scene from '@/scene'
import clsx from 'clsx'

export default function Index() {
  return (
    <main
    // onDragOver={e => e.preventDefault()}
    // onDrop={async e => {
    //   e.preventDefault()
    //   e.stopPropagation()

    //   const file = e.dataTransfer.files[0]

    //   if (file) {
    //     const body = new FormData()
    //     body.append('file', file)

    //     try {
    //       const res = await fetch('/api/upload', { method: 'POST', body })

    //       if (!res.ok) {
    //         throw new Error('Upload failed')
    //       }

    //       const { url } = await res.json()
    //       $object.set(url)
    //     } catch (error) {
    //       console.error('Error uploading file:', error)
    //     }
    //   }
    // }}
    >
      <Scene />

      <footer
        className={clsx(
          'z-10 fixed inset-x-0 bottom-0 p-5',
          'text-center text-xs text-white text-opacity-75'
        )}>
        alt + (l|r)mb to (rotate|pan) &mdash; drag/drop to upload geometry
      </footer>
    </main>
  )
}
