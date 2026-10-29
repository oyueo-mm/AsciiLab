/** A local, deterministic source image: a shaded moon with craters. No network or external image required. */
export function createSample(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 760
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, 1000, 760)
  const glow = ctx.createRadialGradient(420, 250, 20, 510, 390, 295)
  glow.addColorStop(0, '#f4f1e8')
  glow.addColorStop(0.6, '#a6a49c')
  glow.addColorStop(1, '#181c20')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(500, 380, 280, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(500, 380, 278, 0, Math.PI * 2)
  ctx.clip()
  let seed = 42
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 650; i++) {
    const x = 210 + random() * 580,
      y = 90 + random() * 580,
      r = 2 + random() ** 3 * 36
    ctx.fillStyle = `rgba(15,18,23,${random() * 0.23})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.8, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.12)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.restore()
  return canvas
}
