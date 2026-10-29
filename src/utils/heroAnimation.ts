// v0.1 advanced 0.009 rad every 66ms. Integrate the same angular rate at 3× speed.
export const HERO_ANGULAR_SPEED = (3 * 0.009) / 0.066
export function advanceHeroAngle(angle: number, seconds: number) {
  return angle + HERO_ANGULAR_SPEED * Math.max(0, Math.min(seconds, 0.1))
}
export function heroFrameInterval(renderCost: number) {
  return 1000 / (renderCost > 27 ? 20 : renderCost > 19 ? 24 : 30)
}
export function torusGeometry() {
  const points: number[] = []
  for (let theta = 0; theta < Math.PI * 2; theta += 0.025) {
    const ct = Math.cos(theta),
      st = Math.sin(theta)
    for (let phi = 0; phi < Math.PI * 2; phi += 0.035) {
      const cp = Math.cos(phi),
        sp = Math.sin(phi),
        ring = 1.85 + 0.76 * ct
      points.push(ring * cp, ring * sp, 0.76 * st, ct * cp, ct * sp, st)
    }
  }
  return new Float32Array(points)
}
