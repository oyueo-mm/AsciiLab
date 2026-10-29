import { describe, expect, it } from 'vitest'
import { clampZoom, fitScale, zoomAround } from './preview'
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  DENSITY_PRESETS,
  normalizeSettings,
} from './ascii'

describe('Editor defaults and stored artwork', () => {
  it('uses 80/70 columns for new work and retains saved high resolution', () => {
    expect(DEFAULT_SETTINGS.columns).toBe(80)
    expect(DEFAULT_VIDEO_SETTINGS.columns).toBe(70)
    expect(DENSITY_PRESETS.map((preset) => preset.columns)).toEqual([
      50, 80, 120, 180,
    ])
    expect(normalizeSettings({ columns: 260 }).columns).toBe(260)
    expect(normalizeSettings({ columns: 120 }).columns).toBe(120)
  })
})
describe('Preview geometry', () => {
  it('fits portrait and landscape without changing their aspect ratios', () => {
    expect(fitScale(800, 400, 600, 500)).toBe(0.75)
    expect(fitScale(400, 800, 600, 500)).toBe(0.625)
    expect(fitScale(100, 50, 600, 500)).toBe(6)
  })
  it('bounds manual zoom and keeps the image point under the cursor stationary', () => {
    expect(clampZoom(0.01)).toBe(0.25)
    expect(clampZoom(8)).toBe(4)
    const pan = zoomAround(2, 1, { x: 10, y: -20 }, { x: 100, y: 40 })
    expect((100 - pan.x) / 2).toBe(100 - 10)
    expect((40 - pan.y) / 2).toBe(40 + 20)
  })
})
