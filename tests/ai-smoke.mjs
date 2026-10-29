import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const base = process.env.TEST_URL || 'http://127.0.0.1:5173/AsciiLab/'
await mkdir('.qa', { recursive: true })
for (const [path, url] of [
  [
    '.qa/ormbg.onnx',
    'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/c491647/onnx/model_quantized.onnx',
  ],
  [
    '.qa/subject.jpg',
    'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg',
  ],
]) {
  try {
    await readFile(path)
  } catch {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Fixture download: ${response.status}`)
    await writeFile(path, new Uint8Array(await response.arrayBuffer()))
  }
}
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER || 'msedge',
  headless: true,
  args:
    process.env.AI_GPU === '1'
      ? ['--enable-unsafe-webgpu']
      : [
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-features=WebGPU,WebGPUService',
        ],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const requests = []
context.on('request', (request) =>
  requests.push({ url: request.url(), method: request.method() }),
)
const model = await readFile('.qa/ormbg.onnx')
if (process.env.AI_REMOTE !== '1')
  await context.route('https://huggingface.co/**', (route) =>
    route.fulfill({
      body: model,
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
const page = await context.newPage()
page.on('console', (msg) => console.log('BROWSER', msg.type(), msg.text()))
page.on('pageerror', (error) => console.log('ERROR', error.message))
try {
  await page.goto(`${base}#/image`)
  await page.getByLabel('이미지 파일 선택').setInputFiles('.qa/subject.jpg')
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="작품 이름"]').value ===
      'subject',
  )
  await page.getByLabel('작품 이름').fill('AI quality')
  assert.equal(
    requests.some((request) => /huggingface|\.wasm/.test(request.url)),
    false,
    'AI assets are lazy loaded',
  )
  await page.evaluate(() => {
    window.aiStates = []
    let last = ''
    new MutationObserver(() => {
      const text =
        document.querySelector('.ai-progress')?.textContent ||
        document.querySelector('.toast')?.textContent ||
        ''
      if (text && text !== last) {
        console.log('AI STATUS', text)
        window.aiStates.push(text)
        last = text
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })
  const started = Date.now()
  await page.getByLabel('변환 대상', { exact: true }).selectOption('auto')
  await page.getByRole('button', { name: '비교', exact: true }).click()
  assert.equal(
    await page
      .getByRole('button', { name: '비교', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
  await Promise.race([
    page
      .getByRole('dialog', { name: '자동 선택 보정' })
      .waitFor({ timeout: 240000 }),
    page
      .getByRole('status')
      .filter({ hasText: '자동 선택을 완료하지 못했습니다' })
      .waitFor({ timeout: 240000 })
      .then(async () => {
        throw new Error(await page.locator('.toast').textContent())
      }),
  ])
  console.log(
    `INFERENCE including local model transfer/load: ${Date.now() - started} ms`,
  )
  await page.screenshot({ path: '.qa/ai-overlay.png', fullPage: true })
  await page.getByRole('button', { name: '영역 적용', exact: true }).click()
  const downloaded = requests.filter((request) =>
    request.url.includes('huggingface.co'),
  ).length
  await page.getByLabel('문자 밀도 · 가로 문자 수').fill('180')
  await page
    .getByRole('button', { name: '선택 영역 보정', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '자동 선택 보정' })
    .waitFor({ timeout: 2000 })
  await page.getByRole('button', { name: '선택 취소', exact: true }).click()
  assert.equal(
    requests.filter((request) => request.url.includes('huggingface.co')).length,
    downloaded,
  )
  assert.ok(
    requests.every((request) => ['GET', 'HEAD'].includes(request.method)),
    'No image upload requests',
  )
  await page.getByLabel('투명 배경', { exact: true }).check()
  await page.getByRole('button', { name: '갤러리에 저장', exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: '갤러리에 저장했습니다' })
    .waitFor()
  const stats = await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open('asciilab', 1)
      request.onsuccess = () => resolve(request.result)
    })
    const arts = await new Promise((resolve) => {
      const request = db
        .transaction('artworks')
        .objectStore('artworks')
        .getAll()
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    const art = arts.find((a) => a.name === 'AI quality')
    const bitmap = await createImageBitmap(art.automaticPng)
    const { width, height } = bitmap
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const rgba = ctx.getImageData(0, 0, width, height).data
    const data = Array.from(
      { length: width * height },
      (_, i) => rgba[i * 4 + 3],
    )
    let excluded = 0,
      selected = 0,
      edges = 0
    for (const v of data) {
      if (v < 20) excluded++
      else if (v > 235) selected++
      else edges++
    }
    return {
      width,
      height,
      excluded,
      selected,
      edges,
      total: data.length,
      pngBytes: art.automaticPng.size,
      states: window.aiStates,
    }
  })
  console.log('MASK', stats)
  assert.ok(stats.excluded > stats.total * 0.05)
  assert.ok(stats.selected > stats.total * 0.05)
  assert.ok(
    stats.states.some((state) =>
      state.includes(process.env.AI_GPU === '1' ? '(WebGPU / WASM)' : '(WASM)'),
    ),
  )
  await writeFile('.qa/ai-stats.json', JSON.stringify(stats, null, 2))
  console.log('PASS actual ONNX subject segmentation')
} finally {
  await browser.close()
}
