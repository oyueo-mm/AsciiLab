import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { convertSource, DEFAULT_SETTINGS, drawFrame } from '../../utils/ascii'

export default function AsciiHeroAnimation() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0.48)
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const source = document.createElement('canvas'),
      sampler = document.createElement('canvas')
    source.width = 220
    source.height = 112
    const ctx = source.getContext('2d')!,
      settings = {
        ...DEFAULT_SETTINGS,
        columns: 180,
        fontSize: 9,
        lineHeight: 1.08,
      }
    let id = 0,
      last = -100,
      rendered = false
    const render = (time: number) => {
      if (time - last > 66 && (!paused || !rendered)) {
        last = time
        rendered = true
        if (!paused && !document.hidden) angleRef.current += 0.009
        const angle = angleRef.current
        const depths = new Float32Array(220 * 112).fill(-100)
        const pixels = ctx.createImageData(220, 112)
        const a = 0.64 + Math.sin(angle * 0.7) * 0.18,
          b = angle * 0.42
        for (let theta = 0; theta < Math.PI * 2; theta += 0.025)
          for (let phi = 0; phi < Math.PI * 2; phi += 0.035) {
            const ct = Math.cos(theta),
              st = Math.sin(theta),
              cp = Math.cos(phi),
              sp = Math.sin(phi)
            const ring = 1.85 + 0.76 * ct,
              x = ring * cp,
              y = ring * sp,
              z = 0.76 * st
            const ry = y * Math.cos(a) - z * Math.sin(a),
              rz = y * Math.sin(a) + z * Math.cos(a)
            const rx = x * Math.cos(b) - ry * Math.sin(b),
              yy = x * Math.sin(b) + ry * Math.cos(b)
            const px = Math.round(110 + rx * 34),
              py = Math.round(56 + yy * 18)
            if (px < 0 || px >= 220 || py < 0 || py >= 112) continue
            const index = py * 220 + px
            if (rz < depths[index]) continue
            depths[index] = rz
            const ny = ct * sp * Math.cos(a) - st * Math.sin(a),
              nz = ct * sp * Math.sin(a) + st * Math.cos(a)
            const light = Math.max(
              0,
              0.25 + nz * 0.55 - ny * 0.38 - ct * cp * 0.24,
            )
            const color = Math.round(35 + light * 220)
            pixels.data.set([color, color, color, 255], index * 4)
          }
        ctx.putImageData(pixels, 0, 0)
        if (canvas.current)
          drawFrame(
            canvas.current,
            convertSource(source, 220, 112, settings, sampler),
            settings,
          )
      }
      id = requestAnimationFrame(render)
    }
    id = requestAnimationFrame(render)
    return () => cancelAnimationFrame(id)
  }, [paused])
  return (
    <div className="hero-art">
      <div className="art-topline">
        <span>
          <i className="status-dot" /> LIVE ASCII RENDER
        </span>
        <span>EXPERIMENT 001 — TORUS</span>
      </div>
      <canvas
        ref={canvas}
        aria-label="실제 ASCII 문자로 실시간 렌더링되는 회전 도넛 조형물"
        role="img"
      />
      <div className="art-bottomline">
        <span>
          180 COLUMNS <b>×</b> REAL-TIME <b>×</b> CANVAS
        </span>
        <button
          className="icon-button"
          aria-label={paused ? '애니메이션 재생' : '애니메이션 일시정지'}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <span>FORM, REIMAGINED IN CHARACTERS.</span>
      </div>
    </div>
  )
}
