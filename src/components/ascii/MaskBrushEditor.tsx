import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { alphaCanvas, paintMask } from '../../utils/mask'
import type { AlphaMask, Point } from '../../utils/mask'

type Props = {
  source: CanvasImageSource
  mask: AlphaMask
  baseline: AlphaMask
  feather: number
  onApply: (mask: AlphaMask, feather: number) => void
  onCancel: () => void
}
export default function MaskBrushEditor({
  source,
  mask,
  baseline,
  feather: initialFeather,
  onApply,
  onCancel,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null)
  const working = useRef<AlphaMask>({ ...mask, data: mask.data.slice() })
  const history = useRef<Uint8ClampedArray[]>([]),
    last = useRef<Point | null>(null)
  const [revision, setRevision] = useState(0),
    [add, setAdd] = useState(true)
  const [size, setSize] = useState(5),
    [feather, setFeather] = useState(initialFeather),
    [softness, setSoftness] = useState(0.3)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(source, 0, 0, c.width, c.height)
    const overlay = alphaCanvas(working.current, feather),
      oc = overlay.getContext('2d')!
    oc.globalCompositeOperation = 'source-in'
    oc.fillStyle = '#7cffb2'
    oc.fillRect(0, 0, c.width, c.height)
    ctx.globalAlpha = 0.45
    ctx.drawImage(overlay, 0, 0)
    ctx.globalAlpha = 1
  }, [source, revision, feather])
  const remember = () => {
    history.current.push(working.current.data.slice())
    if (history.current.length > 12) history.current.shift()
  }
  const position = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * mask.width,
      y: ((e.clientY - rect.top) / rect.height) * mask.height,
    }
  }
  const paint = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || !last.current) return
    const next = position(e)
    paintMask(
      working.current,
      last.current,
      next,
      (Math.min(mask.width, mask.height) * size) / 200,
      add,
      softness,
    )
    last.current = next
    setRevision((r) => r + 1)
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="region-dialog brush-dialog"
      aria-label="자동 선택 보정"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="region-header">
        <h2>자동 선택 보정</h2>
        <button
          className="icon-button"
          aria-label="편집 닫기"
          onClick={onCancel}
        >
          ×
        </button>
      </div>
      <div className="region-toolbar brush-toolbar">
        <button
          className={`button secondary small ${add ? 'brush-active' : ''}`}
          aria-pressed={add}
          onClick={() => setAdd(true)}
        >
          선택 영역 추가
        </button>
        <button
          className={`button secondary small ${!add ? 'brush-active' : ''}`}
          aria-pressed={!add}
          onClick={() => setAdd(false)}
        >
          선택 영역 지우기
        </button>
        <label>
          브러시 크기
          <input
            aria-label="브러시 크기"
            type="range"
            min="1"
            max="40"
            value={size}
            onChange={(e) => setSize(+e.target.value)}
          />
        </label>
        <label>
          브러시 부드럽게
          <input
            aria-label="브러시 부드럽게"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={softness}
            onChange={(e) => setSoftness(+e.target.value)}
          />
        </label>
        <button
          className="button secondary small"
          disabled={!history.current.length}
          onClick={() => {
            working.current.data = history.current.pop()!
            setRevision((r) => r + 1)
          }}
        >
          되돌리기
        </button>
        <button
          className="button secondary small"
          onClick={() => {
            remember()
            working.current.data = baseline.data.slice()
            setFeather(0)
            setRevision((r) => r + 1)
          }}
        >
          보정 초기화
        </button>
      </div>
      <div className="brush-viewport checkerboard">
        <canvas
          ref={canvas}
          width={mask.width}
          height={mask.height}
          aria-label="선택 영역 브러시"
          onPointerDown={(e) => {
            if (!e.isPrimary) return
            e.currentTarget.setPointerCapture(e.pointerId)
            remember()
            last.current = position(e)
            paint(e)
          }}
          onPointerMove={paint}
          onPointerUp={() => {
            last.current = null
          }}
          onPointerCancel={() => {
            last.current = null
          }}
        />
      </div>
      <div className="region-footer">
        <p>민트색이 선택 영역입니다.</p>
        <label className="feather-control">
          경계 부드럽게
          <input
            aria-label="자동 선택 경계 부드럽게"
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={feather}
            onChange={(e) => setFeather(+e.target.value)}
          />
        </label>
        <button className="button secondary small" onClick={onCancel}>
          선택 취소
        </button>
        <button
          className="button primary small"
          onClick={() => onApply(working.current, feather)}
        >
          영역 적용
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
