import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  cellRatio,
  DEFAULT_SETTINGS,
  effectiveLineHeight,
  frameHtml,
  pixelsToFrame,
  splitCharacters,
  normalizeSettings,
} from './ascii'
import { paintMask } from './mask'
import { copyFrame } from './clipboard'

afterEach(() => vi.unstubAllGlobals())
describe('Unicode rendering and export', () => {
  it('preserves graphemes, fullwidth Hangul cells and minimum line height', () => {
    expect(splitCharacters('가ㄱ🧑‍🎨é')).toEqual(['가', 'ㄱ', '🧑‍🎨', 'é'])
    expect(cellRatio({ ...DEFAULT_SETTINGS, charset: '한글 자모' })).toBe(1)
    expect(
      cellRatio({ ...DEFAULT_SETTINGS, charset: 'Custom', custom: '가a ' }),
    ).toBe(1)
    expect(cellRatio(DEFAULT_SETTINGS)).toBe(0.6)
    expect(cellRatio({ ...DEFAULT_SETTINGS, charset: 'Minimal' })).toBe(0.6)
    expect(
      effectiveLineHeight({
        ...DEFAULT_SETTINGS,
        charset: '한글 음절',
        lineHeight: 0.8,
      }),
    ).toBe(1)
  })
  it('retains exact lines, trailing spaces, excluded pixels and escaped HTML', () => {
    const frame = pixelsToFrame(
      new Uint8ClampedArray([
        255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255, 0, 0, 0, 0,
      ]),
      2,
      2,
      { ...DEFAULT_SETTINGS, charset: 'Custom', custom: '<가' },
    )
    expect(frame.text).toBe('< \n< ')
    const html = frameHtml(frame, DEFAULT_SETTINGS)
    expect(html).toContain('&lt;')
    expect(html).not.toContain('<가')
    expect(html.match(/\n/g)).toHaveLength(1)
    expect(html).toContain('display:inline-block')
  })
  it('normalizes older artwork without requiring AI masks', () => {
    const settings = normalizeSettings({ columns: 80, mask: { mode: 'lasso' } })
    expect(settings.mask.region).toBeNull()
    expect(settings.mask.automatic).toBeUndefined()
    expect(settings.columns).toBe(80)
  })
})
describe('Brush coverage', () => {
  it('adds and erases continuous strokes in source coordinates', () => {
    const mask = { width: 40, height: 20, data: new Uint8ClampedArray(800) }
    paintMask(mask, { x: 5, y: 10 }, { x: 35, y: 10 }, 3, true, 0)
    for (let x = 5; x < 35; x++) expect(mask.data[10 * 40 + x]).toBe(255)
    expect(mask.data[0]).toBe(0)
    const snapshot = mask.data.slice()
    paintMask(mask, { x: 20, y: 10 }, { x: 20, y: 10 }, 2, false, 0)
    expect(mask.data[10 * 40 + 20]).toBe(0)
    expect(snapshot[10 * 40 + 20]).toBe(255)
  })
  it('creates soft alpha edges and clamps painting outside the image', () => {
    const mask = { width: 20, height: 20, data: new Uint8ClampedArray(400) }
    paintMask(mask, { x: 0, y: 0 }, { x: 0, y: 0 }, 8, true, 1)
    expect(mask.data.some((v) => v > 0 && v < 255)).toBe(true)
    expect(mask.data[399]).toBe(0)
    expect(mask.data.length).toBe(400)
  })
})
describe('Clipboard MIME separation', () => {
  const frame = pixelsToFrame(
    new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]),
    2,
    1,
    { ...DEFAULT_SETTINGS, charset: 'Custom', custom: '가' },
  )
  it('writes only the exact TXT representation for plain copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyFrame('text', frame, DEFAULT_SETTINGS, null)
    expect(writeText).toHaveBeenCalledWith('가 ')
  })
  it('writes safe HTML and an independent plain text representation', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    class Item {
      constructor(public data: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', Item)
    vi.stubGlobal('navigator', { clipboard: { write } })
    await copyFrame('html', frame, DEFAULT_SETTINGS, null)
    const item = write.mock.calls[0][0][0] as Item
    expect(await item.data['text/plain'].text()).toBe('가 ')
    expect(await item.data['text/html'].text()).toContain('<pre')
  })
  it('reports unsupported clipboard environments', async () => {
    vi.stubGlobal('navigator', {})
    await expect(
      copyFrame('text', frame, DEFAULT_SETTINGS, null),
    ).rejects.toThrow('보안 연결')
  })
})
