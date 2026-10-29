import { describe, expect, it } from 'vitest'
import {
  advanceHeroAngle,
  HERO_ANGULAR_SPEED,
  heroFrameInterval,
  torusGeometry,
} from './heroAnimation'

describe('time-based ASCII animation', () => {
  it('rotates at three times the old angular speed', () => {
    expect(HERO_ANGULAR_SPEED).toBeCloseTo((3 * 0.009) / 0.066)
  })
  it('integrates the same rotation across 20, 30 and 60fps', () => {
    for (const fps of [20, 30, 60]) {
      let angle = 0.48
      for (let frame = 0; frame < fps; frame++)
        angle = advanceHeroAngle(angle, 1 / fps)
      expect(angle).toBeCloseTo(0.48 + HERO_ANGULAR_SPEED)
    }
  })
  it('bounds resumed/blocked frame deltas and lowers refresh frequency under load', () => {
    expect(advanceHeroAngle(1, 5)).toBeCloseTo(1 + HERO_ANGULAR_SPEED * 0.1)
    expect(advanceHeroAngle(1, -1)).toBe(1)
    expect(heroFrameInterval(8)).toBeCloseTo(1000 / 30)
    expect(heroFrameInterval(23)).toBeCloseTo(1000 / 24)
    expect(heroFrameInterval(35)).toBeCloseTo(1000 / 20)
  })
  it('retains the original mesh density for every refresh rate', () => {
    const mesh = torusGeometry()
    expect(mesh.length / 6).toBeGreaterThan(45000)
    expect(Array.from(mesh).every(Number.isFinite)).toBe(true)
  })
})
