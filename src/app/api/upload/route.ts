import { writeFile } from 'fs/promises'
import path from 'path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filepath = path.join(process.cwd(), 'public', 'tmp', file.name)

    await writeFile(filepath, buffer)

    return NextResponse.json({ url: `/tmp/${file.name}` })
  } catch (error) {
    console.error('Error uploading file:', error)

    return NextResponse.json({ error: 'Error uploading file' }, { status: 500 })
  }
}
