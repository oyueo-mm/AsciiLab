export const clampZoom = (scale: number) => Math.max(0.25, Math.min(4, scale))
export function fitScale(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
) {
  return Math.min(availableWidth / width, availableHeight / height)
}
export function zoomAround(
  scale: number,
  previous: number,
  pan: { x: number; y: number },
  anchor: { x: number; y: number },
) {
  return {
    x: anchor.x - ((anchor.x - pan.x) * scale) / previous,
    y: anchor.y - ((anchor.y - pan.y) * scale) / previous,
  }
}
