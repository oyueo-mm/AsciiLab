export const CHARSETS = {
  Classic: '@#%*+=-:. ',
  Dense:
    '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ',
  Minimal: '█▓▒░· ',
}
export type AsciiSettings = {
  columns: number
  charset: keyof typeof CHARSETS | 'Custom'
  custom: string
  brightness: number
  contrast: number
  invert: boolean
  color: 'white' | 'mint' | 'original'
  background: string
  fontSize: number
  lineHeight: number
  fps: number
}
export const DEFAULT_SETTINGS: AsciiSettings = {
  columns: 120,
  charset: 'Classic',
  custom: '@#*:. ',
  brightness: 0,
  contrast: 1,
  invert: false,
  color: 'white',
  background: '#050505',
  fontSize: 12,
  lineHeight: 1.1,
  fps: 20,
}
export type AsciiFrame = {
  columns: number
  rows: number
  text: string
  characters: string[]
  colors: string[]
}
export function characterFor(value: number, settings: AsciiSettings): string {
  const chars = Array.from(
    settings.charset === 'Custom'
      ? settings.custom || ' '
      : CHARSETS[settings.charset],
  )
  let light =
    Math.max(
      0,
      Math.min(
        255,
        (value - 127.5) * settings.contrast + 127.5 + settings.brightness,
      ),
    ) / 255
  if (settings.invert) light = 1 - light
  return chars[Math.round((1 - light) * (chars.length - 1))]
}
export function pixelsToFrame(
  data: Uint8ClampedArray,
  columns: number,
  rows: number,
  settings: AsciiSettings,
): AsciiFrame {
  const characters: string[] = [],
    colors: string[] = [],
    lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 4,
        alpha = data[i + 3] / 255
      const r = data[i] * alpha,
        g = data[i + 1] * alpha,
        b = data[i + 2] * alpha
      const char = characterFor(0.2126 * r + 0.7152 * g + 0.0722 * b, settings)
      characters.push(char)
      line += char
      colors.push(
        settings.color === 'original'
          ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
          : settings.color === 'mint'
            ? '#7cffb2'
            : '#f5f5f5',
      )
    }
    lines.push(line)
  }
  return { columns, rows, text: lines.join('\n'), characters, colors }
}
export function convertSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  settings: AsciiSettings,
  sampler?: HTMLCanvasElement,
): AsciiFrame {
  const columns = Math.max(24, Math.min(300, Math.round(settings.columns)))
  const rows = Math.max(
    1,
    Math.min(
      400,
      Math.round((((columns * height) / width) * 0.6) / settings.lineHeight),
    ),
  )
  const sample = sampler || document.createElement('canvas')
  sample.width = columns
  sample.height = rows
  const ctx = sample.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, columns, rows)
  return pixelsToFrame(
    ctx.getImageData(0, 0, columns, rows).data,
    columns,
    rows,
    settings,
  )
}
export function drawFrame(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame,
  settings: AsciiSettings,
) {
  const cell = settings.fontSize * 0.6,
    line = settings.fontSize * settings.lineHeight
  canvas.width = Math.ceil(frame.columns * cell)
  canvas.height = Math.ceil(frame.rows * line)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = settings.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${settings.fontSize}px "Courier New", monospace`
  ctx.textBaseline = 'top'
  for (let y = 0; y < frame.rows; y++)
    for (let x = 0; x < frame.columns; x++) {
      const i = y * frame.columns + x
      ctx.fillStyle = frame.colors[i]
      ctx.fillText(frame.characters[i], x * cell, y * line)
    }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function exportPng(canvas: HTMLCanvasElement, name = 'asciilab') {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${name}.png`)
  }, 'image/png')
}
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )
}
export function exportHtml(
  frame: AsciiFrame,
  settings: AsciiSettings,
  name: string,
) {
  const content = frame.characters
    .map(
      (c, i) =>
        `<span style="color:${frame.colors[i]}">${escapeHtml(c)}</span>${(i + 1) % frame.columns === 0 ? '\n' : ''}`,
    )
    .join('')
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>body{background:${settings.background};margin:24px}pre{font:${settings.fontSize}px/${settings.lineHeight} 'Courier New',monospace;letter-spacing:0}</style><pre>${content}</pre></html>`
  downloadBlob(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${name}.html`,
  )
}
