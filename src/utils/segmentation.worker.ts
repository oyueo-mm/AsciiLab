import * as ort from 'onnxruntime-web/webgpu'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'

// Pinned upstream ONNX weights, Apache-2.0. No image leaves this worker.
const MODEL =
  'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/c491647/onnx/model_quantized.onnx'
const HASH = 'ffbcae62a7b675d616e64cb392ee028786c4cf74f83596590fba13733ef00171'
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl }
ort.env.wasm.numThreads = 1 // Pages cannot supply COOP/COEP headers.
ort.env.wasm.proxy = false
let session: ort.InferenceSession | undefined
let weights: Uint8Array | undefined
let device = 'WASM'
const status = (message: string) => self.postMessage({ status: message })

async function download() {
  let cache: Cache | undefined
  try {
    cache = await caches.open('asciilab-model-v1')
  } catch {
    /* storage may be restricted */
  }
  const cached = await cache?.match(MODEL)
  if (cached) return new Uint8Array(await cached.arrayBuffer())
  status('모델 다운로드 중… 0 MB / 약 44.3 MB')
  const response = await fetch(MODEL, { signal: AbortSignal.timeout(180_000) })
  if (!response.ok || !response.body) throw new Error('모델 다운로드 실패')
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let loaded = 0,
    last = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (Date.now() - last > 200) {
      status(`모델 다운로드 중… ${(loaded / 1e6).toFixed(1)} MB / 약 44.3 MB`)
      last = Date.now()
    }
  }
  const data = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  if (hash !== HASH) throw new Error('모델 파일 검증 실패')
  try {
    await cache?.put(MODEL, new Response(data))
  } catch {
    /* memory cache still works */
  }
  return data
}

self.onmessage = async (
  event: MessageEvent<{ bitmap: ImageBitmap; width: number; height: number }>,
) => {
  const { bitmap, width, height } = event.data
  let input: ort.Tensor | undefined
  try {
    if (!session) {
      weights ||= await download()
      status('모델 로딩 중…')
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter: () => Promise<unknown> }
        }
      ).gpu
      const adapter = await gpu?.requestAdapter().catch(() => null)
      if (adapter) {
        try {
          session = await ort.InferenceSession.create(weights, {
            executionProviders: ['webgpu', 'wasm'],
          })
          device = 'WebGPU / WASM'
        } catch {
          status('WASM으로 모델 로딩 중…')
        }
      }
      session ||= await ort.InferenceSession.create(weights, {
        executionProviders: ['wasm'],
      })
    }
    status(`피사체 분석 중… (${device})`)
    const size = 1024,
      pixels = size * size
    const canvas = new OffscreenCanvas(size, size),
      ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, size, size)
    const rgba = ctx.getImageData(0, 0, size, size).data
    const data = new Float32Array(3 * pixels)
    // Matches the pinned preprocessor_config: rescale 1/255, no normalization.
    for (let i = 0; i < pixels; i++)
      for (let c = 0; c < 3; c++) data[c * pixels + i] = rgba[i * 4 + c] / 255
    input = new ort.Tensor('float32', data, [1, 3, size, size])
    let outputs: ort.InferenceSession.ReturnType
    try {
      outputs = await session.run({ [session.inputNames[0]]: input })
    } catch (error) {
      if (device !== 'WebGPU / WASM') throw error
      await session.release()
      status('WASM으로 다시 분석 중…')
      device = 'WASM'
      session = await ort.InferenceSession.create(weights!, {
        executionProviders: ['wasm'],
      })
      outputs = await session.run({ [session.inputNames[0]]: input })
    }
    const output = outputs[session.outputNames[0]],
      values = (await output.getData()) as Float32Array
    const h = Number(output.dims.at(-2)),
      w = Number(output.dims.at(-1))
    const small = new OffscreenCanvas(w, h),
      sc = small.getContext('2d')!
    const image = sc.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255
      image.data[i * 4 + 3] = Math.round(
        Math.max(0, Math.min(1, values[i])) * 255,
      )
    }
    sc.putImageData(image, 0, 0)
    const full = new OffscreenCanvas(width, height),
      fc = full.getContext('2d')!
    fc.drawImage(small, 0, 0, width, height)
    const scaled = fc.getImageData(0, 0, width, height).data
    const alpha = new Uint8ClampedArray(width * height)
    for (let i = 0; i < alpha.length; i++) alpha[i] = scaled[i * 4 + 3]
    for (const tensor of Object.values(outputs)) tensor.dispose()
    self.postMessage(
      { mask: { width, height, data: alpha }, device },
      { transfer: [alpha.buffer] },
    )
  } catch (error) {
    if (session) await session.release().catch(() => {})
    session = undefined
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    bitmap.close()
    input?.dispose()
  }
}
