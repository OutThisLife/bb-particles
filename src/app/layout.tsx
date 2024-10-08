import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

export const metadata: Metadata = {
  title: 'Particles'
}
