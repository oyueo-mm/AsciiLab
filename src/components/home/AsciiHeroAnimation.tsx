import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { convertSource, DEFAULT_SETTINGS, drawFrame } from '../../utils/ascii'
import {
  advanceHeroAngle,
  heroFrameInterval,
  torusGeometry,
} from '../../utils/heroAnimation'

export default function AsciiHeroAnimation() {
  const canvas = useRef<HTMLCanvasElement>(null),
    angleRef = useRef(0.48)
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => {
      if (media.matches) setPaused(true)
    }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const source = document.createElement('canvas'),
      sampler = document.createElement('canvas')
    source.width = 220
    source.height = 112
    const ctx = source.getContext('2d')!,
      geometry = torusGeometry()
    const settings = {
      ...DEFAULT_SETTINGS,
      columns: 180,
      fontSize: 9,
      lineHeight: 1.08,
    }
    const depths = new Float32Array(220 * 112),
      pixels = ctx.createImageData(220, 112)
    let id = 0,
      lastPaint: number | null = null,
      cost = 0
    const render = (time: number) => {
      if (document.hidden) return
      if (
        lastPaint === null ||
        time - lastPaint >= heroFrameInterval(cost) - 0.5
      ) {
        const start = performance.now()
        if (!paused && lastPaint !== null)
          angleRef.current = advanceHeroAngle(
            angleRef.current,
            (time - lastPaint) / 1000,
          )
        lastPaint = time
        const a = 0.64 + Math.sin(angleRef.current * 0.7) * 0.18,
          b = angleRef.current * 0.42
        const ca = Math.cos(a),
          sa = Math.sin(a),
          cb = Math.cos(b),
          sb = Math.sin(b)
        depths.fill(-100)
        pixels.data.fill(0)
        for (let i = 0; i < geometry.length; i += 6) {
          const x = geometry[i],
            y = geometry[i + 1],
            z = geometry[i + 2]
          const ry = y * ca - z * sa,
            rz = y * sa + z * ca
          const px = Math.round(110 + (x * cb - ry * sb) * 34),
            py = Math.round(56 + (x * sb + ry * cb) * 18)
          if (px < 0 || px >= 220 || py < 0 || py >= 112) continue
          const index = py * 220 + px
          if (rz < depths[index]) continue
          depths[index] = rz
          const nx = geometry[i + 3],
            ny = geometry[i + 4] * ca - geometry[i + 5] * sa,
            nz = geometry[i + 4] * sa + geometry[i + 5] * ca
          const color = Math.round(
            35 + Math.max(0, 0.25 + nz * 0.55 - ny * 0.38 - nx * 0.24) * 220,
          )
          pixels.data.set([color, color, color, 255], index * 4)
        }
        ctx.putImageData(pixels, 0, 0)
        if (canvas.current)
          drawFrame(
            canvas.current,
            convertSource(source, 220, 112, settings, sampler),
            settings,
          )
        cost = cost * 0.8 + (performance.now() - start) * 0.2
      }
      if (!paused) id = requestAnimationFrame(render)
    }
    const visibility = () => {
      cancelAnimationFrame(id)
      lastPaint = null
      if (!document.hidden) id = requestAnimationFrame(render)
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [paused])
  const label = paused ? '애니메이션 재생' : '애니메이션 일시정지'
  return (
    <div className="hero-art">
      <canvas ref={canvas} aria-label="회전하는 ASCII 도넛" role="img" />
      <button
        className="icon-button hero-play"
        title={label}
        aria-label={label}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
  )
}
