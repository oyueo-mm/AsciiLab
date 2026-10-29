import { applyColorMask, createRegionMask, DEFAULT_MASK } from './mask'
import type { MaskSettings } from './mask'

export const CHARSETS = {
  Classic: '@#%*+=-:. ',
  '한글 자모': 'ㅎㅂㅁㅍㅊㅅㅇㄷㄴㄱㅣㅡ ',
  '한글 음절': '숲봄별빛꿈꽃밤물달가나다하 ',
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
  mask: MaskSettings
  transparentBackground: boolean
}
export const DEFAULT_SETTINGS: AsciiSettings = {
  columns: 80,
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
  mask: { ...DEFAULT_MASK },
  transparentBackground: false,
}
export const DEFAULT_VIDEO_SETTINGS: AsciiSettings = {
  ...DEFAULT_SETTINGS,
  columns: 70,
}
export const DENSITY_PRESETS = [
  { label: '단순', columns: 50 },
  { label: '보통', columns: 80 },
  { label: '정밀', columns: 120 },
  { label: '초정밀', columns: 180 },
] as const
export function normalizeSettings(
  value?: Omit<Partial<AsciiSettings>, 'mask'> & {
    mask?: Partial<MaskSettings>
  },
): AsciiSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    mask: { ...DEFAULT_MASK, ...value?.mask },
  }
}
export type AsciiFrame = {
  columns: number
  rows: number
  text: string
  characters: string[]
  colors: string[]
  opacities: Float32Array
}
export function characterFor(value: number, settings: AsciiSettings): string {
  return createCharacterMapper(settings)(value)
}
function createCharacterMapper(settings: AsciiSettings) {
  let chars = splitCharacters(
    settings.charset === 'Custom'
      ? settings.custom || ' '
      : CHARSETS[settings.charset],
  )
  if (!chars.length) chars = [' ']
  if (settings.charset === '한글 자모' || settings.charset === '한글 음절')
    chars = densityOrder(chars, settings)
  return (value: number) => {
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
  const opacities = new Float32Array(columns * rows)
  const mapCharacter = createCharacterMapper(settings)
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 4,
        alpha = data[i + 3] / 255
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2]
      // Excluded pixels must remain empty, even with inversion or a custom set without spaces.
      const char =
        alpha > 0 ? mapCharacter(0.2126 * r + 0.7152 * g + 0.0722 * b) : ' '
      opacities[y * columns + x] = alpha
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
  return {
    columns,
    rows,
    text: lines.join('\n'),
    characters,
    colors,
    opacities,
  }
}
export function convertSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  settings: AsciiSettings,
  sampler?: HTMLCanvasElement,
  options?: { maskApplied?: boolean },
): AsciiFrame {
  const columns = Math.max(24, Math.min(300, Math.round(settings.columns)))
  const rows = Math.max(
    1,
    Math.min(
      400,
      Math.round(
        (((columns * height) / width) * cellRatio(settings)) /
          effectiveLineHeight(settings),
      ),
    ),
  )
  const sample = sampler || document.createElement('canvas')
  if (sample.width !== columns) sample.width = columns
  if (sample.height !== rows) sample.height = rows
  const ctx = sample.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, columns, rows)
  ctx.drawImage(source, 0, 0, columns, rows)
  const mask = settings.mask || DEFAULT_MASK
  if (!options?.maskApplied && mask.mode === 'lasso' && mask.region) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(
      createRegionMask(columns, rows, mask.region, mask.feather),
      0,
      0,
    )
    ctx.globalCompositeOperation = 'source-over'
  }
  const pixels = ctx.getImageData(0, 0, columns, rows)
  if (!options?.maskApplied) applyColorMask(pixels.data, mask)
  return pixelsToFrame(pixels.data, columns, rows, settings)
}
export function drawFrame(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame,
  settings: AsciiSettings,
) {
  const cell = settings.fontSize * cellRatio(settings),
    line = settings.fontSize * effectiveLineHeight(settings)
  const width = Math.ceil(frame.columns * cell),
    height = Math.ceil(frame.rows * line)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, width, height)
  if (!settings.transparentBackground) {
    ctx.fillStyle = settings.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.font = `${settings.fontSize}px ${asciiFont(settings)}`
  ctx.textBaseline = 'top'
  for (let y = 0; y < frame.rows; y++)
    for (let x = 0; x < frame.columns; x++) {
      const i = y * frame.columns + x
      if (!frame.opacities[i] || frame.characters[i] === ' ') continue
      ctx.globalAlpha = frame.opacities[i]
      ctx.fillStyle = frame.colors[i]
      ctx.fillText(frame.characters[i], x * cell, y * line, cell)
    }
  ctx.globalAlpha = 1
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
export function frameHtml(
  frame: AsciiFrame,
  settings: AsciiSettings,
  label?: string,
) {
  const cell = settings.fontSize * cellRatio(settings)
  const content = frame.characters
    .map(
      (c, i) =>
        `<span style="display:inline-block;width:${cell}px;color:${frame.colors[i]};opacity:${frame.opacities[i].toFixed(3)}">${escapeHtml(c)}</span>${(i + 1) % frame.columns === 0 && i + 1 < frame.characters.length ? '\n' : ''}`,
    )
    .join('')
  const background = /^#[0-9a-f]{6}$/i.test(settings.background)
    ? settings.background
    : '#050505'
  return `<pre${label ? ` tabindex="0" aria-label="${escapeHtml(label)}"` : ''} style="margin:0;white-space:pre;overflow-wrap:normal;word-break:normal;letter-spacing:0;font-family:${asciiFont(settings)};font-size:${settings.fontSize}px;line-height:${settings.fontSize * effectiveLineHeight(settings)}px;font-variant-ligatures:none;font-kerning:none;text-size-adjust:none;background:${settings.transparentBackground ? 'transparent' : background}">${content}</pre>`
}
export function exportHtml(
  frame: AsciiFrame,
  settings: AsciiSettings,
  name: string,
) {
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${escapeHtml(name)}</title><body>${frameHtml(frame, settings)}</body></html>`
  downloadBlob(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${name}.html`,
  )
}

export function splitCharacters(text: string): string[] {
  // Grapheme segmentation also preserves combining marks and joined emoji.
  return Array.from(
    new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(
      text.replace(/[\r\n\t]/g, ''),
    ),
    (part) => part.segment,
  )
}
export function cellRatio(settings: AsciiSettings): number {
  if (settings.charset === '한글 자모' || settings.charset === '한글 음절')
    return 1
  return settings.charset === 'Custom' &&
    /[^\u0000-\u00ff]/u.test(settings.custom)
    ? 1
    : 0.6
}
export function effectiveLineHeight(settings: AsciiSettings): number {
  return Math.max(cellRatio(settings) === 1 ? 1 : 0.8, settings.lineHeight)
}
export function asciiFont(settings: AsciiSettings) {
  return cellRatio(settings) === 1
    ? 'NeoDunggeunmo, monospace'
    : "'Courier New', monospace"
}
const densityCache = new Map<string, string[]>()
function densityOrder(chars: string[], settings: AsciiSettings): string[] {
  if (typeof document === 'undefined') return chars
  const key = chars.join('') + document.fonts?.check('32px NeoDunggeunmo')
  const cached = densityCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 40
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = `32px ${asciiFont(settings)}`
  ctx.textBaseline = 'top'
  const sorted = chars
    .map((char) => {
      ctx.clearRect(0, 0, 40, 40)
      ctx.fillText(char, 0, 0)
      const data = ctx.getImageData(0, 0, 40, 40).data
      let density = 0
      for (let i = 3; i < data.length; i += 4) density += data[i]
      return { char, density }
    })
    .sort((a, b) => b.density - a.density)
    .map((item) => item.char)
  densityCache.set(key, sorted)
  return sorted
}
