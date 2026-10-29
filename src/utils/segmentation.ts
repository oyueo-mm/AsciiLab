import type { AlphaMask } from './mask'

export function segmentSubject(
  source: CanvasImageSource,
  width: number,
  height: number,
  progress: (status: string) => void,
  signal: AbortSignal,
): Promise<AlphaMask> {
  return new Promise((resolve, reject) => {
    if (!globalThis.Worker || !globalThis.OffscreenCanvas) {
      reject(new Error('이 브라우저는 자동 선택을 지원하지 않습니다.'))
      return
    }
    const worker = new Worker(
      new URL('./segmentation.worker.ts', import.meta.url),
      { type: 'module' },
    )
    const finish = () => {
      clearTimeout(timer)
      worker.terminate()
      signal.removeEventListener('abort', abort)
    }
    const abort = () => {
      finish()
      reject(new DOMException('취소됨', 'AbortError'))
    }
    const timer = setTimeout(() => {
      finish()
      reject(new Error('분석 시간이 초과되었습니다.'))
    }, 300_000)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }
    worker.onerror = () => {
      finish()
      reject(new Error('AI 실행에 실패했습니다.'))
    }
    worker.onmessage = ({ data }) => {
      if (data.status) progress(data.status)
      else if (data.error) {
        finish()
        reject(new Error(data.error))
      } else if (data.mask) {
        finish()
        resolve(data.mask)
      }
    }
    createImageBitmap(source as HTMLCanvasElement)
      .then((bitmap) => {
        if (signal.aborted) {
          bitmap.close()
          return
        }
        worker.postMessage({ bitmap, width, height }, [bitmap])
      })
      .catch((error) => {
        finish()
        reject(error)
      })
  })
}
