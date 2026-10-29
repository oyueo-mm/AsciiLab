import { describe, expect, it } from 'vitest'
import { applyColorMask, colorCoverage, DEFAULT_MASK } from './mask'
import { DEFAULT_SETTINGS, normalizeSettings, pixelsToFrame } from './ascii'

describe('coverage masks', () => {
  it('removes matching background pixels while preserving subject RGB and existing alpha', () => {
    const data = new Uint8ClampedArray([
      0, 255, 0, 255, 255, 64, 32, 128, 0, 0, 0, 0,
    ])
    applyColorMask(data, {
      ...DEFAULT_MASK,
      mode: 'color',
      keyColor: '#00ff00',
      tolerance: 10,
      feather: 0,
    })
    expect(Array.from(data)).toEqual([
      0, 255, 0, 0, 255, 64, 32, 128, 0, 0, 0, 0,
    ])
  })
  it('keeps whole-image conversion unchanged when the mask is disabled', () => {
    const data = new Uint8ClampedArray([0, 255, 0, 255, 255, 64, 32, 128])
    const before = data.slice()
    applyColorMask(data, DEFAULT_MASK)
    expect(data).toEqual(before)
  })
  it('supports exact color matching, tolerance and smooth edge coverage', () => {
    expect(colorCoverage(0, 0, 0)).toBe(0)
    expect(colorCoverage(1, 0, 0)).toBe(1)
    expect(colorCoverage(40, 10, 0)).toBe(0)
    expect(colorCoverage(60, 10, 10)).toBeGreaterThan(0)
    expect(colorCoverage(60, 10, 10)).toBeLessThan(1)
    expect(colorCoverage(100, 10, 10)).toBe(1)
    expect(colorCoverage(Math.sqrt(3 * 255 ** 2), 100, 0)).toBe(0)
  })
  it('never emits characters for zero coverage, including inverted custom sets without spaces', () => {
    const frame = pixelsToFrame(
      new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255]),
      2,
      1,
      {
        ...DEFAULT_SETTINGS,
        charset: 'Custom',
        custom: '@#',
        invert: true,
        brightness: 100,
      },
    )
    expect(frame.characters[0]).toBe(' ')
    expect(frame.opacities[0]).toBe(0)
    expect(frame.characters[1]).not.toBe(' ')
  })
  it('keeps subject tone and color separate from feathered coverage', () => {
    const frame = pixelsToFrame(
      new Uint8ClampedArray([255, 255, 255, 128]),
      1,
      1,
      { ...DEFAULT_SETTINGS, color: 'original' },
    )
    expect(frame.text).toBe('@')
    expect(frame.colors).toEqual(['rgb(255,255,255)'])
    expect(frame.opacities[0]).toBeCloseTo(128 / 255)
  })
  it('loads old gallery settings without new fields and preserves new regions', () => {
    const old = { columns: 160, invert: true }
    const settings = normalizeSettings(old)
    expect(settings.mask).toEqual(DEFAULT_MASK)
    expect(settings.transparentBackground).toBe(false)
    expect(settings.columns).toBe(160)
    const region = {
      width: 2000,
      height: 1000,
      points: [
        { x: 500, y: 250 },
        { x: 1500, y: 250 },
        { x: 1500, y: 750 },
      ],
    }
    expect(
      normalizeSettings({ mask: { mode: 'lasso', region } }).mask.region,
    ).toEqual(region)
    expect(DEFAULT_SETTINGS.mask).toEqual(DEFAULT_MASK)
  })
})
