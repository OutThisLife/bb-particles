'use client'

import { useDropzone } from 'react-dropzone'

import { cn } from '@/utils'
import { upload } from '@/utils/upload'

export const FileDrop = () => {
  const { fileRejections, getInputProps, getRootProps, isDragActive } =
    useDropzone({ onDrop: ([file]) => upload(file) })

  return (
    <div
      className={cn(
        'z-[100] fixed inset-0 flex flex-col items-center justify-center',
        'text-2xl font-bold',
        isDragActive ? 'bg-black/90' : 'bg-black/25'
      )}
      {...getRootProps()}
    >
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
