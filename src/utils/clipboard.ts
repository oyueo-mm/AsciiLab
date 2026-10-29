import { frameHtml } from './ascii'
import type { AsciiFrame, AsciiSettings } from './ascii'
import { canvasBlob } from './storage'

export type CopyMode = 'text' | 'html' | 'image'
export async function copyFrame(
  mode: CopyMode,
  frame: AsciiFrame,
  settings: AsciiSettings,
  canvas: HTMLCanvasElement | null,
) {
  if (!navigator.clipboard)
    throw new Error('보안 연결에서 클립보드를 사용할 수 있습니다.')
  if (mode === 'text') {
    await navigator.clipboard.writeText(frame.text)
    return
  }
  if (!globalThis.ClipboardItem || !navigator.clipboard.write)
    throw new Error('이 브라우저는 이 복사 형식을 지원하지 않습니다.')
  if (mode === 'image') {
    if (!canvas) throw new Error('이미지가 준비되지 않았습니다.')
    // Start write in the click gesture, including Safari's user-activation window.
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': canvasBlob(canvas) }),
    ])
  } else
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([frame.text], { type: 'text/plain' }),
        'text/html': new Blob([frameHtml(frame, settings)], {
          type: 'text/html',
        }),
      }),
    ])
}
export function isEditingText(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  )
}
