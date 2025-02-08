'use client'

import { upload } from '@/utils/upload'
import clsx from 'clsx'
import { useDropzone } from 'react-dropzone'

export default function FileDrop() {
  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({ onDrop: ([file]) => upload(file) })

  return (
    <div
      className={clsx(
        'z-[100] fixed inset-0 flex flex-col items-center justify-center',
        'text-2xl font-bold',
        isDragActive ? 'bg-black/90' : 'bg-black/25'
      )}
      {...getRootProps()}>
      <input {...getInputProps()} />

      {isDragActive ? (
        <p>Drop the files here...</p>
      ) : (
        <p>
          Drag {"'"}n{"'"} drop your GLTF file here
        </p>
      )}

      {!!fileRejections.length && <p>Only .gltf or .glb files are accepted</p>}
    </div>
  )
}
