export type Point = { x: number; y: number }
const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 ** 2)
export type Region = { width: number; height: number; points: Point[] }
export type MaskSettings = {
  mode: 'none' | 'color' | 'lasso'
  keyColor: string
  tolerance: number
  feather: number
  region: Region | null
}
export const DEFAULT_MASK: MaskSettings = {
  mode: 'none',
  keyColor: '#ffffff',
  tolerance: 18,
  feather: 1,
  region: null,
}

export function rgbFromHex(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ]
}

/** Color distance changes only coverage; subject RGB and tone are preserved. */
export function colorCoverage(
  distance: number,
  tolerance: number,
  feather: number,
): number {
  const edge = (tolerance / 100) * MAX_COLOR_DISTANCE
  const soft = (feather / 100) * MAX_COLOR_DISTANCE
  if (distance <= edge) return 0
  if (!soft || distance >= edge + soft) return 1
  const t = (distance - edge) / soft
  return t * t * (3 - 2 * t)
}

export function applyColorMask(data: Uint8ClampedArray, mask: MaskSettings) {
  if (mask.mode !== 'color') return
  const [r, g, b] = rgbFromHex(mask.keyColor)
  const edge = (mask.tolerance / 100) * MAX_COLOR_DISTANCE
  const soft = (mask.feather / 100) * MAX_COLOR_DISTANCE
  const innerSquared = edge ** 2,
    outerSquared = (edge + soft) ** 2
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const distanceSquared =
      (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2
    if (distanceSquared <= innerSquared) data[i + 3] = 0
    else if (soft && distanceSquared < outerSquared) {
      const t = (Math.sqrt(distanceSquared) - edge) / soft
      data[i + 3] = Math.round(data[i + 3] * t * t * (3 - 2 * t))
    }
  }
}

export function createRegionMask(
  width: number,
  height: number,
  region: Region,
  feather: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.scale(width / region.width, height / region.height)
  ctx.fillStyle = 'white'
  ctx.beginPath()
  region.points.forEach((p, i) =>
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
  )
  ctx.closePath()
  ctx.fill('evenodd')
  if (!feather) return canvas
  const soft = document.createElement('canvas')
  soft.width = width
  soft.height = height
  const softCtx = soft.getContext('2d')!
  softCtx.filter = `blur(${(feather / 100) * Math.min(width, height)}px)`
  softCtx.drawImage(canvas, 0, 0)
  return soft
}

/** Images cache this full-resolution result; video applies color masks to its small sampling buffer. */
export function maskImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  mask: MaskSettings,
): CanvasImageSource {
  if (mask.mode === 'none' || (mask.mode === 'lasso' && !mask.region))
    return source
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', {
    willReadFrequently: mask.mode === 'color',
  })!
  ctx.drawImage(source, 0, 0, width, height)
  if (mask.mode === 'color') {
    const pixels = ctx.getImageData(0, 0, width, height)
    applyColorMask(pixels.data, mask)
    ctx.putImageData(pixels, 0, 0)
  } else if (mask.region) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(
      createRegionMask(width, height, mask.region, mask.feather),
      0,
      0,
    )
  }
  return canvas
}
