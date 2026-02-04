import './globals.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

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
