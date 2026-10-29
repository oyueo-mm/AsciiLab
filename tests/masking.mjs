import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'

const base = process.env.TEST_URL || 'http://127.0.0.1:5173/AsciiLab/'
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER || 'msedge',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
})
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await mkdir('.qa/v02', { recursive: true })
const check = async (label, action) => {
  await action()
  console.log(`PASS ${label}`)
}
const forbidden = [
  'WORKSPACE',
  'YOUR CREATIVE WORKSPACE',
  'LOCAL. PRIVATE. YOURS.',
  'BROWSER-BASED STUDIO',
  'ASCII LAB / V.1.0',
  'A NEW WAY TO SEE',
  'ASCII ART STUDIO',
  'NO INSTALLATION',
  'NO UPLOAD TO SERVER',
  'JUST CREATE',
  'LIVE ASCII RENDER',
  'EXPERIMENT 001',
  'REAL-TIME',
  'FORM, REIMAGINED',
  'YOUR NEXT EXPERIMENT',
  'MADE OF CHARACTERS',
  'SOURCE CODE',
  'STILL IMAGE',
  'MOVING IMAGE',
  'ASCII OUTPUT',
  'ORIGINAL',
  'CHARACTERS',
  'STUDIO /',
  'WAITING FOR YOUR FOOTAGE',
  'YOUR LOCAL COLLECTION',
  'THIS BROWSER ONLY',
  'PARAMETERS',
  '01 / 해상도',
  '모든 변환은 이 브라우저에서 처리됩니다.',
]
const output = () => page.locator('.preview-piece canvas')
const stats = (canvas) =>
  canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    let left = 0,
      center = 0,
      total = 0
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const a = data[(y * c.width + x) * 4 + 3]
        if (a) {
          total++
          if (x < c.width * 0.2) left++
          if (
            x > c.width * 0.35 &&
            x < c.width * 0.65 &&
            y > c.height * 0.35 &&
            y < c.height * 0.65
          )
            center++
        }
      }
    return {
      left,
      center,
      total,
      corner: Array.from(data.slice(0, 4)),
      width: c.width,
      height: c.height,
    }
  })
async function fixture(
  name = 'subject',
  type = 'green',
  width = 320,
  height = 240,
) {
  const png = await page.evaluate(
    ({ type, width, height }) => {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const ctx = c.getContext('2d')
      if (type !== 'transparent') {
        ctx.fillStyle = '#00ff00'
        ctx.fillRect(0, 0, width, height)
        if (type === 'complex')
          for (let i = 0; i < 60; i++) {
            ctx.fillStyle = `rgb(${(i * 41) % 256},${(i * 67) % 256},${(i * 13) % 256})`
            ctx.fillRect(
              ((i % 10) * width) / 10,
              (Math.floor(i / 10) * height) / 6,
              width / 12,
              height / 8,
            )
          }
      }
      ctx.fillStyle = '#ff7040'
      ctx.fillRect(width * 0.25, height * 0.25, width * 0.5, height * 0.5)
      return c.toDataURL().split(',')[1]
    },
    { type, width, height },
  )
  await page.getByLabel('이미지 파일 선택').setInputFiles({
    name: `${name}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await page.waitForFunction(
    (name) =>
      document.querySelector('input[aria-label="작품 이름"]')?.value === name,
    name,
  )
}
async function denseOutput() {
  await page.getByLabel('문자 세트', { exact: true }).selectOption('Custom')
  await page.getByLabel('사용자 문자').fill('@')
  await page.getByLabel('투명 배경', { exact: true }).check()
}
async function drawRegion() {
  const c = page.getByRole('dialog').locator('canvas'),
    rect = await c.boundingBox()
  const points = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.75, 0.75],
    [0.25, 0.75],
    [0.25, 0.25],
  ]
  await page.mouse.move(
    rect.x + rect.width * points[0][0],
    rect.y + rect.height * points[0][1],
  )
  await page.mouse.down()
  for (const [x, y] of points.slice(1))
    await page.mouse.move(rect.x + rect.width * x, rect.y + rect.height * y, {
      steps: 12,
    })
  await page.mouse.up()
}
async function download(format, stem) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: format, exact: true }).click()
  const file = await pending,
    path = `.qa/v02/${stem}.${format.toLowerCase()}`
  await file.saveAs(path)
  return readFile(path)
}
async function pngStats(buffer) {
  return page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const c = document.createElement('canvas')
    c.width = image.width
    c.height = image.height
    const ctx = c.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data
    let content = 0
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) content++
    return { corner: Array.from(pixels.slice(0, 4)), content }
  }, buffer.toString('base64'))
}
try {
  await page.goto(base)
  await check(
    'Decorative text and desktop topbar removed from the DOM on all pages',
    async () => {
      for (const route of ['', '#/image', '#/video', '#/gallery']) {
        await page.goto(base + route)
        await page.locator('main h1').waitFor()
        const content = await page.locator('body').textContent()
        for (const text of forbidden)
          assert.ok(!content.includes(text), `${route}: ${text}`)
        assert.equal(
          await page
            .locator(
              '.topbar,.breadcrumb,.sidebar-note,.nav-caption,.version,.art-topline,.art-bottomline,.footer',
            )
            .count(),
          0,
        )
        assert.equal(
          await page.getByRole('link', { name: /GitHub/ }).count(),
          0,
        )
      }
    },
  )
  await check(
    'Collapsed sidebar keeps icon navigation and expands again',
    async () => {
      await page
        .getByRole('button', { name: '사이드바 접기', exact: true })
        .click()
      await page.waitForTimeout(250)
      assert.ok((await page.locator('.sidebar').boundingBox()).width < 80)
      await page.getByRole('link', { name: 'Image', exact: true }).click()
      await page
        .getByRole('heading', { name: '이미지 변환', exact: true })
        .waitFor()
      await page
        .getByRole('button', { name: '사이드바 펼치기', exact: true })
        .click()
      await page.getByRole('link', { name: 'Home', exact: true }).click()
    },
  )
  await check(
    'Torus is above the fold; pause, hidden tab and reduced motion retain a full-size image',
    async () => {
      const c = page.locator('.hero-art canvas')
      await page.waitForTimeout(200)
      assert.ok(
        await c.evaluate(
          (el) => el.getBoundingClientRect().bottom < innerHeight,
        ),
      )
      assert.equal(await c.evaluate((el) => el.width), 972)
      const before = await c.evaluate((el) => el.toDataURL())
      await page.waitForTimeout(350)
      assert.notEqual(await c.evaluate((el) => el.toDataURL()), before)
      await page.getByRole('button', { name: '애니메이션 일시정지' }).click()
      await page.waitForTimeout(100)
      const paused = await c.evaluate((el) => el.toDataURL())
      await page.waitForTimeout(250)
      assert.equal(await c.evaluate((el) => el.toDataURL()), paused)
      await page.getByRole('button', { name: '애니메이션 재생' }).click()
      await page.waitForTimeout(100)
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      const hidden = await c.evaluate((el) => el.toDataURL())
      await page.waitForTimeout(300)
      assert.equal(await c.evaluate((el) => el.toDataURL()), hidden)
      await page.evaluate(() => {
        delete document.hidden
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForTimeout(300)
      assert.notEqual(await c.evaluate((el) => el.toDataURL()), hidden)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload()
      await page.getByRole('button', { name: '애니메이션 재생' }).waitFor()
      await page.waitForTimeout(120)
      const reduced = await c.evaluate((el) => el.toDataURL())
      await page.waitForTimeout(250)
      assert.equal(await c.evaluate((el) => el.toDataURL()), reduced)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.reload()
      await page.waitForTimeout(150)
      await page.screenshot({
        path: '.qa/v02/home-desktop.png',
        fullPage: true,
      })
    },
  )
  await page.getByRole('link', { name: 'Image', exact: true }).click()
  await check(
    'Eyedropper, tolerance, feather, inversion and reset affect actual subject coverage',
    async () => {
      await fixture()
      await denseOutput()
      assert.ok((await stats(output())).left > 0)
      await page.getByLabel('변환 대상', { exact: true }).selectOption('color')
      await page
        .getByRole('button', { name: '배경색 스포이트', exact: true })
        .click()
      const rect = await page
        .getByRole('dialog')
        .locator('canvas')
        .boundingBox()
      await page.mouse.click(
        rect.x + rect.width * 0.1,
        rect.y + rect.height * 0.1,
      )
      assert.equal(
        await page.getByLabel('제거할 배경색', { exact: true }).inputValue(),
        '#00ff00',
      )
      assert.equal((await stats(output())).left, 0)
      assert.ok((await stats(output())).center > 0)
      await page.getByRole('switch', { name: '명암 반전' }).check()
      await page.getByLabel('밝기', { exact: true }).fill('100')
      assert.equal((await stats(output())).left, 0)
      await page.getByLabel('색상 유사도 허용치').fill('100')
      assert.equal((await stats(output())).total, 0)
      await page.getByLabel('색상 유사도 허용치').fill('10')
      await page.getByLabel('경계 부드럽게', { exact: true }).fill('3')
      assert.ok((await stats(output())).center > 0)
      await page
        .getByRole('button', { name: '배경색 스포이트', exact: true })
        .click()
      await page.getByRole('button', { name: '편집 닫기', exact: true }).click()
      assert.equal(
        await page.getByLabel('제거할 배경색', { exact: true }).inputValue(),
        '#00ff00',
      )
      await page
        .getByRole('button', { name: '배경 제거 초기화', exact: true })
        .click()
      assert.equal(
        await page.getByLabel('변환 대상', { exact: true }).inputValue(),
        'none',
      )
      assert.ok((await stats(output())).left > 0)
    },
  )
  await check(
    'Lasso draft cancel, undo, redraw, reset and source coordinates after zoom and resize',
    async () => {
      await fixture('complex scene', 'complex', 2000, 1000)
      const unmasked = await output().evaluate((c) => c.toDataURL())
      await page.getByRole('button', { name: '영역 선택', exact: true }).click()
      await drawRegion()
      await page.getByRole('button', { name: '선택 취소', exact: true }).click()
      assert.equal(await output().evaluate((c) => c.toDataURL()), unmasked)
      await page.getByLabel('변환 대상', { exact: true }).selectOption('lasso')
      await drawRegion()
      await page.getByRole('button', { name: '마지막 작업 되돌리기' }).click()
      assert.equal(
        await page
          .getByRole('button', { name: '영역 적용', exact: true })
          .isDisabled(),
        true,
      )
      await drawRegion()
      await page.getByRole('button', { name: '선택 영역 다시 그리기' }).click()
      assert.equal(
        await page
          .getByRole('button', { name: '영역 적용', exact: true })
          .isDisabled(),
        true,
      )
      await page.getByRole('button', { name: '마지막 작업 되돌리기' }).click()
      await page.getByRole('button', { name: '선택 전체 초기화' }).click()
      assert.equal(
        await page
          .getByRole('button', { name: '영역 적용', exact: true })
          .isDisabled(),
        true,
      )
      await page.getByRole('button', { name: '마지막 작업 되돌리기' }).click()
      // Resizing/zooming the draft must never move its source-coordinate polygon.
      await page.setViewportSize({ width: 1000, height: 900 })
      await page.getByLabel('선택 화면 확대').fill('1.25')
      await page.getByLabel('선택 경계 부드럽게').fill('0')
      await page.screenshot({
        path: '.qa/v02/lasso-desktop.png',
        fullPage: true,
      })
      await page.getByRole('button', { name: '영역 적용', exact: true }).click()
      assert.equal(
        await page.getByLabel('변환 대상', { exact: true }).inputValue(),
        'lasso',
      )
      assert.equal((await stats(output())).left, 0)
      assert.ok((await stats(output())).center > 0)
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('180')
      await page.getByLabel('대비', { exact: true }).fill('1.5')
      assert.equal((await stats(output())).left, 0)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.waitForTimeout(250)
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        document.querySelector('.settings-rail').scrollTop = 0
      })
      await page.screenshot({
        path: '.qa/v02/image-desktop.png',
        fullPage: true,
      })
    },
  )
  await check(
    'Masked PNG alpha, solid background, TXT spaces and HTML coverage survive exports',
    async () => {
      const png = await pngStats(await download('PNG', 'transparent'))
      assert.equal(png.corner[3], 0)
      assert.ok(png.content > 0)
      const txt = (await download('TXT', 'lasso')).toString('utf8')
      assert.ok(txt.includes('@'))
      assert.ok(
        txt
          .split('\n')
          .every(
            (row) => row.slice(0, Math.floor(row.length * 0.2)).trim() === '',
          ),
      )
      const html = (await download('HTML', 'lasso')).toString('utf8')
      assert.ok(
        html.includes('background:transparent') &&
          html.includes('opacity:0.000') &&
          html.includes('opacity:1.000'),
      )
      await page.getByLabel('투명 배경', { exact: true }).uncheck()
      await page.getByLabel('배경색', { exact: true }).fill('#123456')
      const solid = await pngStats(await download('PNG', 'solid'))
      assert.deepEqual(solid.corner, [18, 52, 86, 255])
      await page.getByLabel('투명 배경', { exact: true }).check()
    },
  )
  await check(
    'Gallery restores lasso settings after 2000px→1600px source storage and loads legacy records',
    async () => {
      await page.getByLabel('작품 이름').fill('Masked artwork')
      await page
        .getByRole('button', { name: '갤러리에 저장', exact: true })
        .click()
      await page
        .getByRole('status')
        .filter({ hasText: '갤러리에 저장했습니다' })
        .waitFor()
      await page.getByRole('link', { name: 'Gallery', exact: true }).click()
      await page.reload()
      await page
        .getByRole('heading', { name: 'Masked artwork', exact: true })
        .click()
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]')?.value ===
          'Masked artwork',
      )
      assert.equal(
        await page.getByLabel('변환 대상', { exact: true }).inputValue(),
        'lasso',
      )
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '180',
      )
      assert.equal(
        await page.getByLabel('투명 배경', { exact: true }).isChecked(),
        true,
      )
      assert.equal((await stats(output())).left, 0)
      assert.ok((await stats(output())).center > 0)
      const region = await page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('asciilab', 1)
          request.onsuccess = () => resolve(request.result)
          request.onerror = reject
        })
        const tx = db.transaction('artworks', 'readwrite'),
          store = tx.objectStore('artworks')
        const items = await new Promise((resolve) => {
          const r = store.getAll()
          r.onsuccess = () => resolve(r.result)
        })
        const saved = items[0],
          legacy = {
            ...saved,
            id: 'legacy-record',
            name: 'Legacy artwork',
            settings: { ...saved.settings },
          }
        delete legacy.settings.mask
        delete legacy.settings.transparentBackground
        store.put(legacy)
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve
          tx.onerror = reject
        })
        db.close()
        return saved.settings.mask.region
      })
      assert.equal(region.width, 2000)
      assert.equal(region.height, 1000)
      assert.ok(Math.abs(region.points[0].x - 500) < 3)
      await page.getByRole('link', { name: 'Gallery', exact: true }).click()
      await page
        .getByRole('heading', { name: 'Legacy artwork', exact: true })
        .click()
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]')?.value ===
          'Legacy artwork',
      )
      assert.equal(
        await page.getByLabel('변환 대상', { exact: true }).inputValue(),
        'none',
      )
      assert.equal(
        await page.getByLabel('투명 배경', { exact: true }).isChecked(),
        false,
      )
      // A color key is stored/restored as well, independently of the polygon mode.
      await fixture('Color artwork')
      await denseOutput()
      await page.getByLabel('변환 대상', { exact: true }).selectOption('color')
      await page.getByLabel('제거할 배경색').fill('#00ff00')
      await page.getByLabel('색상 유사도 허용치').fill('12')
      await page
        .getByRole('button', { name: '갤러리에 저장', exact: true })
        .click()
      await page
        .getByRole('status')
        .filter({ hasText: '갤러리에 저장했습니다' })
        .waitFor()
      await page.getByRole('link', { name: 'Gallery', exact: true }).click()
      await page
        .getByRole('heading', { name: 'Color artwork', exact: true })
        .click()
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]')?.value ===
          'Color artwork',
      )
      assert.equal(
        await page.getByLabel('제거할 배경색').inputValue(),
        '#00ff00',
      )
      assert.equal(
        await page.getByLabel('색상 유사도 허용치').inputValue(),
        '12',
      )
      assert.equal((await stats(output())).left, 0)
    },
  )
  await check(
    'Transparent PNG input stays empty outside the subject even with inversion',
    async () => {
      await fixture('transparent input', 'transparent')
      await denseOutput()
      await page.getByRole('switch', { name: '명암 반전' }).check()
      assert.equal((await stats(output())).left, 0)
      assert.ok((await stats(output())).center > 0)
      assert.equal(
        (await pngStats(await download('PNG', 'transparent-input'))).corner[3],
        0,
      )
    },
  )
  await check('Animated GIF always uses its first frame', async () => {
    const header = [
      ...Buffer.from('GIF89a'),
      1,
      0,
      1,
      0,
      0x80,
      0,
      0,
      255,
      0,
      0,
      0,
      255,
      0,
    ]
    const frame = (pixel, delay) => [
      0x21,
      0xf9,
      4,
      0,
      delay,
      0,
      0,
      0,
      0x2c,
      0,
      0,
      0,
      0,
      1,
      0,
      1,
      0,
      0,
      2,
      2,
      pixel,
      1,
      0,
    ]
    const gif = Buffer.from([
      ...header,
      0x21,
      0xff,
      11,
      ...Buffer.from('NETSCAPE2.0'),
      3,
      1,
      0,
      0,
      0,
      ...frame(0x44, 1),
      ...frame(0x4c, 100),
      0x3b,
    ])
    await page.getByLabel('이미지 파일 선택').setInputFiles({
      name: 'animated.gif',
      mimeType: 'image/gif',
      buffer: gif,
    })
    await page.waitForFunction(
      () =>
        document.querySelector('input[aria-label="작품 이름"]')?.value ===
        'animated',
    )
    await page.waitForTimeout(400)
    const color = await page
      .locator('.preview-piece img')
      .evaluate(async (image) => {
        await image.decode()
        const c = document.createElement('canvas')
        c.width = 1
        c.height = 1
        const ctx = c.getContext('2d')
        ctx.drawImage(image, 0, 0, 1, 1)
        return Array.from(ctx.getImageData(0, 0, 1, 1).data)
      })
    assert.deepEqual(color, [255, 0, 0, 255])
  })
  await check(
    'Video color masks update live, keep audio/seek controls, and export a transparent frame',
    async () => {
      const bytes = await page.evaluate(async () => {
        const c = document.createElement('canvas')
        c.width = 320
        c.height = 240
        const ctx = c.getContext('2d'),
          stream = c.captureStream(20),
          chunks = [],
          recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
          })
        const done = new Promise((resolve) => {
          recorder.onstop = async () =>
            resolve(
              Array.from(
                new Uint8Array(
                  await new Blob(chunks, { type: 'video/webm' }).arrayBuffer(),
                ),
              ),
            )
        })
        recorder.ondataavailable = (e) => chunks.push(e.data)
        recorder.start()
        for (let i = 0; i < 50; i++) {
          ctx.fillStyle = '#00ff00'
          ctx.fillRect(0, 0, 320, 240)
          ctx.fillStyle = '#ff7040'
          ctx.fillRect(80 + i, 60, 100, 120)
          await new Promise((r) => setTimeout(r, 50))
        }
        recorder.stop()
        stream.getTracks().forEach((t) => t.stop())
        return done
      })
      await page.getByRole('link', { name: 'Video', exact: true }).click()
      await page.getByLabel('영상 파일 선택').setInputFiles({
        name: 'green-screen.webm',
        mimeType: 'video/webm',
        buffer: Buffer.from(bytes),
      })
      await page.waitForFunction(
        () => document.querySelector('.play-button')?.disabled === false,
      )
      await page.getByLabel('투명 배경', { exact: true }).check()
      await page.getByLabel('문자 세트', { exact: true }).selectOption('Custom')
      await page.getByLabel('사용자 문자').fill('@')
      const c = page.locator('.video-stage canvas')
      assert.ok((await stats(c)).left > 0)
      await page.getByLabel('변환 대상', { exact: true }).selectOption('color')
      await page
        .getByRole('button', { name: '배경색 스포이트', exact: true })
        .click()
      const rect = await page
        .getByRole('dialog')
        .locator('canvas')
        .boundingBox()
      await page.mouse.click(
        rect.x + rect.width * 0.1,
        rect.y + rect.height * 0.1,
      )
      assert.equal((await stats(c)).left, 0)
      assert.ok((await stats(c)).center > 0)
      await page.getByRole('button', { name: '영상 재생', exact: true }).click()
      const initial = await c.evaluate((el) => el.toDataURL())
      await page.waitForTimeout(500)
      assert.notEqual(await c.evaluate((el) => el.toDataURL()), initial)
      assert.equal((await stats(c)).left, 0)
      // Picking while playing pauses for an accurate frame and resumes when dismissed.
      await page
        .getByRole('button', { name: '배경색 스포이트', exact: true })
        .click()
      assert.equal(await page.locator('video').evaluate((v) => v.paused), true)
      await page.getByRole('button', { name: '편집 닫기', exact: true }).click()
      await page
        .getByRole('button', { name: '영상 일시정지', exact: true })
        .click()
      await page.getByLabel('영상 타임라인').fill('1.2')
      await page.waitForTimeout(150)
      assert.equal((await stats(c)).left, 0)
      await page.getByLabel('색상 유사도 허용치').fill('100')
      assert.equal((await stats(c)).total, 0)
      await page.getByLabel('색상 유사도 허용치').fill('10')
      await page
        .getByRole('button', { name: '음소거 해제', exact: true })
        .click()
      assert.equal(await page.locator('video').evaluate((v) => v.muted), false)
      const pending = page.waitForEvent('download')
      await page
        .getByRole('button', { name: '프레임 PNG 저장', exact: true })
        .click()
      const file = await pending
      await file.saveAs('.qa/v02/video-frame.png')
      const png = await pngStats(await readFile('.qa/v02/video-frame.png'))
      assert.equal(png.corner[3], 0)
      assert.ok(png.content > 0)
      assert.equal(
        await page
          .getByLabel('변환 대상', { exact: true })
          .locator('option[value="lasso"]')
          .count(),
        0,
      )
      await page.screenshot({
        path: '.qa/v02/video-desktop.png',
        fullPage: true,
      })
    },
  )
  await check(
    '390px touch lasso, mobile drawer, 768px and desktop layouts',
    async () => {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        for (const route of ['', '#/image', '#/video', '#/gallery']) {
          await page.goto(base + route)
          await page.locator('main h1').waitFor()
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${width} ${route} overflows`,
          )
        }
      }
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      })
      const touch = await mobile.newPage()
      touch.on('pageerror', (e) => errors.push(e.message))
      await touch.goto(base)
      await touch
        .getByRole('button', { name: '메뉴 열기', exact: true })
        .click()
      await touch.getByRole('link', { name: 'Image', exact: true }).click()
      await touch.waitForFunction(
        () => !document.querySelector('.sidebar.mobile-open'),
      )
      await touch
        .getByRole('button', { name: '영역 선택', exact: true })
        .click()
      const rect = await touch
        .getByRole('dialog')
        .locator('canvas')
        .boundingBox()
      const session = await mobile.newCDPSession(touch)
      const point = (x, y) => ({
        x: rect.x + rect.width * x,
        y: rect.y + rect.height * y,
        id: 1,
      })
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [point(0.25, 0.25)],
      })
      for (const [x, y] of [
        [0.4, 0.25],
        [0.6, 0.25],
        [0.75, 0.25],
        [0.75, 0.5],
        [0.75, 0.75],
        [0.5, 0.75],
        [0.25, 0.75],
        [0.25, 0.5],
        [0.25, 0.25],
      ])
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [point(x, y)],
        })
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await touch
        .getByRole('button', { name: '영역 적용', exact: true })
        .click()
      assert.equal(
        await touch.getByLabel('변환 대상', { exact: true }).inputValue(),
        'lasso',
      )
      await touch.screenshot({
        path: '.qa/v02/image-mobile.png',
        fullPage: true,
      })
      await touch
        .getByRole('button', { name: '메뉴 열기', exact: true })
        .click()
      await touch.getByRole('link', { name: 'Home', exact: true }).click()
      await touch.waitForTimeout(250)
      await touch.screenshot({
        path: '.qa/v02/home-mobile.png',
        fullPage: true,
      })
      await mobile.close()
    },
  )
  assert.deepEqual(errors, [], 'No console/runtime errors')
  console.log(
    'PASS no console/runtime errors in v0.2 masking and responsive flows',
  )
} finally {
  await browser.close()
}
