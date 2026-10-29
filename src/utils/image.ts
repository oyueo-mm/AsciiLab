/** createImageBitmap decodes the first frame of an animated GIF, avoiding timing-dependent frame capture. */
export async function decodeRaster(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || bitmap.width * bitmap.height > 80_000_000)
      throw new Error(
        '이미지가 너무 큽니다. 8천만 픽셀 이하의 이미지를 선택해 주세요.',
      )
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas
      .getContext('2d')!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    bitmap.close()
  }
}
