import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { drawFrame } from '../../utils/ascii'
import type { AsciiFrame, AsciiSettings } from '../../utils/ascii'
type Props = {
  frame: AsciiFrame | null
  settings: AsciiSettings
  label?: string
}
export const AsciiCanvas = forwardRef<HTMLCanvasElement, Props>(
  function AsciiCanvas({ frame, settings, label = 'ASCII 변환 결과' }, ref) {
    const local = useRef<HTMLCanvasElement>(null)
    useImperativeHandle(ref, () => local.current!, [])
    useEffect(() => {
      if (local.current && frame) drawFrame(local.current, frame, settings)
    }, [frame, settings])
    return (
      <canvas
        ref={local}
        className="ascii-canvas"
        role="img"
        aria-label={label}
      />
    )
  },
)
