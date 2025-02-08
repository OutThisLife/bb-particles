export const loadFileAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()

    reader.onabort = reject
    reader.onerror = reject

    reader.onload = () => {
      if (reader.result) {
        resolve(reader.result as ArrayBuffer)
      } else {
        reject(new Error('Could not convert string to array!'))
      }
    }

    reader.readAsArrayBuffer(file)
  })

export const stringToArrayBuffer = (text: string, encoding = 'UTF-8') =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const blob = new Blob([text], { type: `text/plain;charset=${encoding}` })
    const reader = new FileReader()
    reader.onload = evt => {
      if (evt.target) {
        resolve(evt.target.result as ArrayBuffer)
      } else {
        reject(new Error('Could not convert string to array!'))
      }
    }
    reader.readAsArrayBuffer(blob)
  })
