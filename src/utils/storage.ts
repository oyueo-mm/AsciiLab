import type { AsciiSettings } from './ascii'
import { alphaCanvas } from './mask'
import type { AlphaMask } from './mask'
export type Artwork = {
  id: string
  name: string
  created: number
  source: Blob
  thumbnail: Blob
  settings: AsciiSettings
  text: string
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('asciilab', 1)
    request.onupgradeneeded = () =>
      request.result.createObjectStore('artworks', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new Error(
          '브라우저 저장소를 열 수 없습니다. 일반 브라우징 모드에서 다시 시도해 주세요.',
        ),
      )
  })
}
async function query<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('artworks', mode),
      request = operation(tx.objectStore('artworks'))
    tx.oncomplete = () => {
      db.close()
      resolve(request.result)
    }
    tx.onabort = tx.onerror = () => {
      db.close()
      reject(new Error('저장 공간이 부족하거나 저장소 접근이 제한되었습니다.'))
    }
  })
}
export const listArtworks = () =>
  query('readonly', (s) => s.getAll()) as Promise<Artwork[]>
type StoredArtwork = Artwork & { automaticPng?: Blob; baselinePng?: Blob }
async function decodeMask(blob: Blob): Promise<AlphaMask> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const data = new Uint8ClampedArray(canvas.width * canvas.height)
    for (let i = 0; i < data.length; i++) data[i] = pixels[i * 4 + 3]
    return { width: canvas.width, height: canvas.height, data }
  } finally {
    bitmap.close()
  }
}
export async function getArtwork(id: string): Promise<Artwork | undefined> {
  const art = await query<StoredArtwork | undefined>('readonly', (s) =>
    s.get(id),
  )
  if (!art) return
  if (art.automaticPng) {
    art.settings.mask.automatic = await decodeMask(art.automaticPng)
    art.settings.mask.baseline = art.baselinePng
      ? await decodeMask(art.baselinePng)
      : art.settings.mask.automatic
  }
  return art
}
export async function saveArtwork(artwork: Artwork) {
  const mask = artwork.settings.mask
  const stored: StoredArtwork = { ...artwork }
  // PNG compresses the alpha plane losslessly; gallery listings never decode masks.
  if (mask?.automatic) {
    stored.automaticPng = await canvasBlob(alphaCanvas(mask.automatic))
    stored.baselinePng =
      mask.baseline && mask.baseline !== mask.automatic
        ? await canvasBlob(alphaCanvas(mask.baseline))
        : stored.automaticPng
    stored.settings = {
      ...artwork.settings,
      mask: { ...mask, automatic: undefined, baseline: undefined },
    }
  }
  return query('readwrite', (s) => s.put(stored))
}
export const deleteArtwork = (id: string) =>
  query('readwrite', (s) => s.delete(id))
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('이미지를 저장하지 못했습니다.')),
      'image/png',
    ),
  )
}
