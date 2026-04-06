import './globals.css'

import type { Metadata } from 'next'
import NextTopLoader from 'nextjs-toploader'
import * as React from 'react'

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <NextTopLoader color="#666" height={2} showSpinner={false} />
        {children}
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  title: 'Particles'
}
