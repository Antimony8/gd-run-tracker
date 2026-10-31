/** Shrinks an image file to fit within maxSize px and returns it as a JPEG data URL. */
export async function imageToDataUrl(file: File, maxSize = 480): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
