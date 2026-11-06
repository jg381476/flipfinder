// Shrink a photo in the browser so it uploads fast and stays small in the database.
export async function resizeImage(file, maxSide, quality) {
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (bitmap.close) bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

async function loadBitmap(file) {
  if (globalThis.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}
