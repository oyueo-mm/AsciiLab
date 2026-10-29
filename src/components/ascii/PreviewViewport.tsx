import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { clampZoom, fitScale, zoomAround } from '../../utils/preview'

export function usePreviewZoom() {
  const [transform, setTransform] = useState({
    mode: 'fit' as 'fit' | 'manual',
    scale: 1,
    x: 0,
    y: 0,
  })
  const [fit, setFit] = useState(1)
  const scale = transform.mode === 'fit' ? fit : transform.scale
  return {
    transform,
    scale,
    setFit,
    manual: (scale: number, pan = { x: 0, y: 0 }) =>
      setTransform({ mode: 'manual', scale: clampZoom(scale), ...pan }),
    pan: (x: number, y: number) =>
      setTransform((previous) => ({ ...previous, x, y })),
    fit: () => setTransform({ mode: 'fit', scale: 1, x: 0, y: 0 }),
  }
}
type Zoom = ReturnType<typeof usePreviewZoom>
export function PreviewZoomControls({
  zoom,
  disabled,
}: {
  zoom: Zoom
  disabled?: boolean
}) {
  return (
    <div className="preview-zoom" role="group" aria-label="미리보기 배율">
      <button
        className="icon-button"
        aria-label="미리보기 축소"
        title="축소"
        disabled={disabled || zoom.scale <= 0.25}
        onClick={() => zoom.manual(zoom.scale / 1.25)}
      >
        <Minus size={14} />
      </button>
      <output aria-label="현재 미리보기 배율">
        {Math.round(zoom.scale * 100)}%
      </output>
      <button
        className="icon-button"
        aria-label="미리보기 확대"
        title="확대"
        disabled={disabled || zoom.scale >= 4}
        onClick={() => zoom.manual(zoom.scale * 1.25)}
      >
        <Plus size={14} />
      </button>
      <button
        className="zoom-text-button"
        aria-label="미리보기 100%"
        disabled={disabled}
        onClick={() => zoom.manual(1)}
      >
        100%
      </button>
      <button
        className="icon-button"
        aria-label="미리보기 화면 맞춤"
        title="화면에 맞춤"
        aria-pressed={zoom.transform.mode === 'fit'}
        disabled={disabled}
        onClick={zoom.fit}
      >
        <Maximize size={14} />
      </button>
    </div>
  )
}
export default function PreviewViewport({
  width,
  height,
  zoom,
  children,
  className = '',
  active = true,
  reportFit = true,
}: {
  width: number
  height: number
  zoom: Zoom
  children: ReactNode
  className?: string
  active?: boolean
  reportFit?: boolean
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const { setFit: report } = zoom
  useEffect(() => {
    const element = viewport.current!
    const measure = () => {
      if (!active || !element.clientWidth || !element.clientHeight) return
      const scale = fitScale(
        width,
        height,
        element.clientWidth - 24,
        element.clientHeight - 24,
      )
      if (scale > 0) {
        setFit(scale)
        if (reportFit) report(scale)
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [width, height, active, reportFit, report])
  const scale = zoom.transform.mode === 'fit' ? fit : zoom.transform.scale
  const current = useRef({ zoom, scale })
  current.current = { zoom, scale }
  useEffect(() => {
    const element = viewport.current!
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const { zoom, scale } = current.current,
        rect = element.getBoundingClientRect()
      const next = clampZoom(scale * Math.exp(-event.deltaY * 0.005))
      zoom.manual(
        next,
        zoomAround(next, scale, zoom.transform, {
          x: event.clientX - rect.left - rect.width / 2,
          y: event.clientY - rect.top - rect.height / 2,
        }),
      )
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const old = pointers.current.get(event.pointerId)
    if (!old) return
    const next = { x: event.clientX, y: event.clientY }
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(
        ([id]) => id !== event.pointerId,
      )![1]
      const distance = Math.hypot(next.x - other.x, next.y - other.y)
      const previous = Math.hypot(old.x - other.x, old.y - other.y)
      if (previous > 0) {
        const rect = event.currentTarget.getBoundingClientRect(),
          nextScale = clampZoom((scale * distance) / previous)
        const anchor = {
          x: (old.x + other.x) / 2 - rect.left - rect.width / 2,
          y: (old.y + other.y) / 2 - rect.top - rect.height / 2,
        }
        const pan = zoomAround(nextScale, scale, zoom.transform, anchor)
        zoom.manual(nextScale, {
          x: pan.x + (next.x - old.x) / 2,
          y: pan.y + (next.y - old.y) / 2,
        })
      }
    } else if (zoom.transform.mode === 'manual')
      zoom.pan(
        zoom.transform.x + next.x - old.x,
        zoom.transform.y + next.y - old.y,
      )
    pointers.current.set(event.pointerId, next)
  }
  return (
    <div
      ref={viewport}
      className={`preview-viewport ${className} ${active ? '' : 'hidden-preview'}`}
      style={{ touchAction: zoom.transform.mode === 'fit' ? 'pan-y' : 'none' }}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          (event.target as Element).closest('button, input, video')
        )
          return
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={move}
      onPointerUp={(event) => pointers.current.delete(event.pointerId)}
      onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
      onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
    >
      <div
        className="preview-transform"
        data-scale={scale}
        data-pan-x={zoom.transform.x}
        data-pan-y={zoom.transform.y}
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
