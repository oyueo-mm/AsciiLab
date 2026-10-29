import { useMemo } from 'react'
import { frameHtml } from '../../utils/ascii'
import type { AsciiFrame, AsciiSettings } from '../../utils/ascii'

export default function FrameText({
  frame,
  settings,
}: {
  frame: AsciiFrame
  settings: AsciiSettings
}) {
  // The same escaped, inline-styled representation is sent to the HTML clipboard.
  const html = useMemo(
    () => frameHtml(frame, settings, 'ASCII 텍스트'),
    [frame, settings],
  )
  return (
    <div className="text-viewport" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
