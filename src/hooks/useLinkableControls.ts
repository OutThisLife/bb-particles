import { $layers } from '@/store'
import { levaStore } from 'leva'
import { useEffect } from 'react'

let hydrated = false

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const writeVarInt = (buffer: number[], value: number) => {
  while (value >= 128) {
    buffer.push((value & 127) | 128)
    value >>>= 7
  }
  buffer.push(value & 127)
}

const readVarInt = (buffer: number[], offset: number): [number, number] => {
  let result = 0,
    bytesRead = 0,
    shift = 0

  while (offset + bytesRead < buffer.length) {
    const byte = buffer[offset + bytesRead]
    result |= (byte & 127) << shift
    bytesRead++

    if ((byte & 128) === 0) break
    shift += 7
  }

  return [result, bytesRead]
}

const encode = (data: any): string => {
  const buffer: number[] = []

  Object.entries(data).forEach(([key, value]: [string, any]) => {
    if (!value?.value) return

    const keyBytes = Array.from(new TextEncoder().encode(key))
    buffer.push(keyBytes.length, ...keyBytes)

    const val = value.value
    if (typeof val === 'number') {
      buffer.push(0)
      writeVarInt(buffer, Math.round((Math.round(val * 1000) / 1000) * 1000))
    } else if (typeof val === 'boolean') {
      buffer.push(1, val ? 1 : 0)
    } else if (typeof val === 'string') {
      buffer.push(2)
      const strBytes = Array.from(new TextEncoder().encode(val))
      writeVarInt(buffer, strBytes.length)
      buffer.push(...strBytes)
    }
  })

  let result = ''
  for (let i = 0; i < buffer.length; i += 3) {
    const chunk = (buffer[i] << 16) | (buffer[i + 1] << 8) | buffer[i + 2]
    result += CHARS[(chunk >> 18) & 63] + CHARS[(chunk >> 12) & 63]
    if (i + 1 < buffer.length) result += CHARS[(chunk >> 6) & 63]
    if (i + 2 < buffer.length) result += CHARS[chunk & 63]
  }
  return result
}

const decode = (encoded: string): any => {
  try {
    const bytes: number[] = []

    for (let i = 0; i < encoded.length; i += 4) {
      const chunk =
        (CHARS.indexOf(encoded[i]) << 18) |
        (CHARS.indexOf(encoded[i + 1]) << 12) |
        (CHARS.indexOf(encoded[i + 2]) << 6) |
        CHARS.indexOf(encoded[i + 3])

      bytes.push((chunk >> 16) & 255)
      if (encoded[i + 2] && CHARS.indexOf(encoded[i + 2]) !== -1)
        bytes.push((chunk >> 8) & 255)
      if (encoded[i + 3] && CHARS.indexOf(encoded[i + 3]) !== -1)
        bytes.push(chunk & 255)
    }

    const result: Record<string, any> = {}
    let offset = 0

    while (offset < bytes.length) {
      const keyLength = bytes[offset++]
      if (!keyLength || offset + keyLength > bytes.length) break

      const key = new TextDecoder().decode(
        new Uint8Array(bytes.slice(offset, offset + keyLength))
      )
      offset += keyLength

      const type = bytes[offset++]
      if (type === undefined) break

      let value: any

      if (type === 0) {
        const [intValue, bytesRead] = readVarInt(bytes, offset)
        value = intValue / 1000
        offset += bytesRead
      } else if (type === 1) {
        value = bytes[offset++] === 1
      } else if (type === 2) {
        const [strLength, lengthBytes] = readVarInt(bytes, offset)
        offset += lengthBytes
        value = new TextDecoder().decode(
          new Uint8Array(bytes.slice(offset, offset + strLength))
        )
        offset += strLength
      }

      result[key] = { value }
    }

    return result
  } catch {
    return {}
  }
}

export default function useLinkableControls() {
  const store = levaStore.useStore()

  useEffect(() => {
    if (!Object.keys(store.data).length) return

    const u = new URL(window.location.href)

    const encodeData = (data: typeof store.data) => {
      const filtered = Object.fromEntries(
        Object.entries(data).filter(([k]) => {
          const matches = k.match(/g\d+/)
          return matches?.[0]
            ? $layers.get() >= +(matches[0].replace('g', '') + 1)
            : true
        })
      )

      const encoded = encode(filtered)

      encoded.length < 4
        ? u.searchParams.delete('c')
        : u.searchParams.set('c', encoded)
      window.history.replaceState({}, '', u.toString())
    }

    const decodeData = (encoded: string) => {
      const params = decode(encoded)

      const hasLayers = Object.keys(params).some(k => /g\d+/.test(k))
      const storeLayers = Object.keys(store.data).some(k => /g\d+/.test(k))

      if (hasLayers && !storeLayers) {
        $layers.set(
          Object.keys(params)
            .filter(k => /g\d+/.test(k))
            .map(k => k.split('-')[0])
            .filter((v, i, a) => a.indexOf(v) === i).length
        )
        return
      }

      Object.keys(params).length &&
        levaStore.set(
          Object.fromEntries(
            Object.entries(params).map(([k, v]: [string, any]) => [k, v.value])
          ),
          false
        )

      hydrated = true
    }

    !hydrated && u.searchParams.has('c')
      ? decodeData(u.searchParams.get('c')!)
      : encodeData(store.data)
  }, [store])
}
