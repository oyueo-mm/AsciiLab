import { describe, expect, it } from 'vitest'
import {
  characterFor,
  DEFAULT_SETTINGS,
  escapeHtml,
  pixelsToFrame,
} from './ascii'

describe('ASCII luminance conversion', () => {
  it('maps black to empty space and white to the densest character', () => {
    expect(characterFor(0, DEFAULT_SETTINGS)).toBe(' ')
    expect(characterFor(255, DEFAULT_SETTINGS)).toBe('@')
  })
  it('inverts the mapping and clamps extreme tone changes', () => {
    expect(characterFor(255, { ...DEFAULT_SETTINGS, invert: true })).toBe(' ')
    expect(
      characterFor(0, { ...DEFAULT_SETTINGS, brightness: -100, contrast: 2.5 }),
    ).toBe(' ')
    expect(
      characterFor(255, {
        ...DEFAULT_SETTINGS,
        brightness: 100,
        contrast: 2.5,
      }),
    ).toBe('@')
  })
  it('uses custom characters without splitting Unicode code points', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      charset: 'Custom' as const,
      custom: '🟢· ',
    }
    expect(characterFor(255, settings)).toBe('🟢')
    expect(characterFor(100, { ...settings, custom: '' })).toBe(' ')
  })
  it('preserves row structure, source colors and transparent background', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 0, 0, 255,
    ])
    const frame = pixelsToFrame(data, 2, 2, {
      ...DEFAULT_SETTINGS,
      color: 'original',
    })
    expect(frame.text.split('\n')).toHaveLength(2)
    expect(frame.characters).toHaveLength(4)
    expect(frame.characters[1]).toBe(' ')
    expect(frame.colors[3]).toBe('rgb(255,0,0)')
  })
  it('escapes user-controlled HTML export content', () => {
    expect(escapeHtml('<script>"&\'</script>')).toBe(
      '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;',
    )
  })
})
