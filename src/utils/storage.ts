import type { AsciiSettings } from './ascii'
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
export const getArtwork = (id: string) =>
  query('readonly', (s) => s.get(id)) as Promise<Artwork | undefined>
export const saveArtwork = (artwork: Artwork) =>
  query('readwrite', (s) => s.put(artwork))
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
