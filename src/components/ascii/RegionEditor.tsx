import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Trash2, Undo2, X } from 'lucide-react'
import type { Point, Region } from '../../utils/mask'

type Props = {
  source: CanvasImageSource
  width: number
  height: number
  mode: 'color' | 'lasso'
  region?: Region | null
  feather: number
  onCancel: () => void
  onPick: (color: string) => void
  onApply: (region: Region, feather: number) => void
}
export default function RegionEditor({
  source,
  width,
  height,
  mode,
  region,
  feather: initialFeather,
  onCancel,
  onPick,
  onApply,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null)
  const [points, setPoints] = useState<Point[]>(
    () =>
      region?.points.map((p) => ({
        x: (p.x / region.width) * width,
        y: (p.y / region.height) * height,
      })) || [],
  )
  const [history, setHistory] = useState<Point[][]>([]),
    [feather, setFeather] = useState(initialFeather),
    [zoom, setZoom] = useState(1),
    [fit, setFit] = useState(1),
    [drawing, setDrawing] = useState(false)
  const stroke = useRef<Point[]>([])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflow
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    const element = viewport.current!
    const observer = new ResizeObserver(() =>
      setFit(
        Math.min(
          (element.clientWidth - 32) / width,
          (element.clientHeight - 32) / height,
          1,
        ),
      ),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height])
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
    if (mode === 'lasso' && points.length) {
      ctx.beginPath()
      ctx.rect(0, 0, width, height)
      points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      )
      ctx.closePath()
      ctx.fillStyle = 'rgba(0,0,0,.62)'
      ctx.fill('evenodd')
      ctx.beginPath()
      points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      )
      if (!drawing) ctx.closePath()
      ctx.strokeStyle = '#b5f7ce'
      ctx.lineWidth = 2 / (fit * zoom)
      ctx.stroke()
    }
  }, [source, width, height, points, drawing, mode, fit, zoom])
  const position = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(width, ((event.clientX - rect.left) / rect.width) * width),
      ),
      y: Math.max(
        0,
        Math.min(height, ((event.clientY - rect.top) / rect.height) * height),
      ),
    }
  }
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    const point = position(event)
    if (mode === 'color') {
      const rgba = canvas
        .current!.getContext('2d')!
        .getImageData(
          Math.min(width - 1, Math.floor(point.x)),
          Math.min(height - 1, Math.floor(point.y)),
          1,
          1,
        ).data
      if (rgba[3])
        onPick(
          '#' +
            Array.from(rgba.slice(0, 3))
              .map((c) => c.toString(16).padStart(2, '0'))
              .join(''),
        )
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHistory((previous) => [...previous, points])
    stroke.current = [point]
    setPoints([point])
    setDrawing(true)
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !event.isPrimary) return
    const point = position(event),
      last = stroke.current.at(-1)!
    if (
      Math.hypot(point.x - last.x, point.y - last.y) <
        Math.min(width, height) / 1000 ||
      stroke.current.length > 5000
    )
      return
    stroke.current = [...stroke.current, point]
    setPoints(stroke.current)
  }
  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    setDrawing(false)
  }
  const clear = () => {
    setHistory((previous) => [...previous, points])
    setPoints([])
    stroke.current = []
  }
  const title = mode === 'color' ? '배경색 선택' : '영역 선택'
  return createPortal(
    <dialog
      ref={dialog}
      className="region-dialog"
      aria-labelledby="region-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="region-header">
        <h2 id="region-title">{title}</h2>
        <button
          className="icon-button"
          title="편집 닫기"
          aria-label="편집 닫기"
          onClick={onCancel}
        >
          <X size={20} />
        </button>
      </div>
      <div className="region-toolbar">
        {mode === 'lasso' && (
          <>
            <button
              className="icon-button"
              title="마지막 작업 되돌리기"
              aria-label="마지막 작업 되돌리기"
              disabled={!history.length || drawing}
              onClick={() => {
                setPoints(history.at(-1)!)
                setHistory((h) => h.slice(0, -1))
              }}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              title="선택 영역 다시 그리기"
              aria-label="선택 영역 다시 그리기"
              disabled={!points.length}
              onClick={clear}
            >
              <RotateCcw size={17} />
            </button>
            <button
              className="icon-button"
              title="선택 전체 초기화"
              aria-label="선택 전체 초기화"
              onClick={() => {
                clear()
                setFeather(0)
              }}
            >
              <Trash2 size={17} />
            </button>
          </>
        )}
        <label className="zoom-control">
          확대
          <input
            aria-label="선택 화면 확대"
            type="range"
            min={1}
            max={3}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <span>{Math.round(zoom * 100)}%</span>
        </label>
      </div>
      <div className="region-viewport checkerboard" ref={viewport}>
        <div className="region-canvas-wrap">
          <canvas
            ref={canvas}
            width={width}
            height={height}
            className={mode === 'color' ? 'eyedropper-canvas' : 'lasso-canvas'}
            style={{
              width: Math.max(1, width * fit * zoom),
              height: Math.max(1, height * fit * zoom),
            }}
            aria-label={
              mode === 'color'
                ? '제거할 배경색을 클릭하세요'
                : '피사체의 윤곽선을 그리세요'
            }
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          />
        </div>
      </div>
      <div className="region-footer">
        {mode === 'lasso' ? (
          <>
            <label className="feather-control">
              경계 부드럽게
              <input
                aria-label="선택 경계 부드럽게"
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
              />
              <span>{feather}</span>
            </label>
            <button className="button secondary small" onClick={onCancel}>
              선택 취소
            </button>
            <button
              className="button primary small"
              disabled={points.length < 3 || drawing}
              onClick={() => onApply({ width, height, points }, feather)}
            >
              영역 적용
            </button>
          </>
        ) : (
          <p>제거할 배경을 클릭하세요.</p>
        )}
      </div>
    </dialog>,
    document.body,
  )
}
