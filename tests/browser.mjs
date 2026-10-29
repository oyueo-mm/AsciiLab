import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

// Run against a running Vite dev/preview server. Edge is already installed on the development machine.
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/AsciiLab/'
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER || 'msedge',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await mkdir('.qa', { recursive: true })
const check = async (label, action) => {
  await action()
  console.log(`PASS ${label}`)
}
const canvasData = () =>
  page.locator('.preview-piece canvas').evaluate((c) => c.toDataURL())
try {
  await page.goto(base)
  await page.getByRole('heading', { name: /이미지와 영상을/ }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await check('Korean pixel font loaded', async () =>
    assert.equal(
      await page.evaluate(() => document.fonts.check('40px NeoDunggeunmo')),
      true,
    ),
  )
  await page.waitForTimeout(400)
  await check('Hero contains animated nonempty ASCII canvas', async () => {
    const hero = page.locator('.hero-art canvas')
    const first = await hero.evaluate((c) => c.toDataURL())
    assert.ok(first.length > 10000)
    await page.waitForTimeout(600)
    assert.notEqual(await hero.evaluate((c) => c.toDataURL()), first)
    await page.getByRole('button', { name: '애니메이션 일시정지' }).click()
    await page.waitForTimeout(180)
    const paused = await hero.evaluate((c) => c.toDataURL())
    await page.waitForTimeout(200)
    assert.equal(await hero.evaluate((c) => c.toDataURL()), paused)
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.qa/home-desktop.png', fullPage: true })
  await page.getByRole('link', { name: /이미지 변환 시작/ }).click()
  await page
    .getByRole('heading', { name: '이미지 변환', exact: true })
    .waitFor()
  await check(
    'Image source upload and settings update actual pixels',
    async () => {
      const png = await page.evaluate(() => {
        const c = document.createElement('canvas')
        c.width = 320
        c.height = 240
        const ctx = c.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 320, 240)
        g.addColorStop(0, '#ff7733')
        g.addColorStop(1, '#122255')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 320, 240)
        ctx.fillStyle = 'white'
        ctx.fillRect(80, 60, 90, 100)
        return c.toDataURL().split(',')[1]
      })
      await page.getByLabel('이미지 파일 선택').setInputFiles({
        name: 'QA image.png',
        mimeType: 'image/png',
        buffer: Buffer.from(png, 'base64'),
      })
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]')?.value ===
          'QA image',
      )
      const before = await canvasData()
      await page.getByLabel('밝기', { exact: true }).fill('60')
      await page.waitForTimeout(100)
      assert.notEqual(await canvasData(), before)
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('160')
      await page.getByLabel('색상 모드').selectOption('original')
      await page.getByRole('switch', { name: '명암 반전' }).check()
      await page
        .getByLabel('사용자 문자')
        .count()
        .then(async (count) => {
          assert.equal(count, 0)
        })
      await page.getByLabel('문자 세트', { exact: true }).selectOption('Custom')
      await page.getByLabel('사용자 문자').fill('@#<>. ')
      await page.getByRole('button', { name: '비교', exact: true }).click()
      assert.equal(await page.locator('.preview-piece:visible').count(), 2)
      await page.getByRole('button', { name: 'ASCII', exact: true }).click()
    },
  )
  await page.screenshot({ path: '.qa/image-desktop.png', fullPage: true })
  await check('PNG, TXT and HTML download contents', async () => {
    for (const format of ['PNG', 'TXT', 'HTML']) {
      const pending = page.waitForEvent('download')
      await page.getByRole('button', { name: format, exact: true }).click()
      const download = await pending
      assert.ok(
        download.suggestedFilename().endsWith(`.${format.toLowerCase()}`),
      )
      await download.saveAs(`.qa/export.${format.toLowerCase()}`)
      if (format === 'TXT' || format === 'HTML') {
        const { readFile } = await import('node:fs/promises')
        const content = await readFile(
          `.qa/export.${format.toLowerCase()}`,
          'utf8',
        )
        assert.ok(content.length > 200)
        if (format === 'HTML')
          assert.ok(
            content.includes('&lt;') &&
              !content.includes('color:rgb(0,0,0)"><'),
          )
      }
    }
  })
  await check('Gallery persist, reopen settings and delete', async () => {
    await page.getByLabel('작품 이름').fill('QA saved artwork')
    await page.getByRole('button', { name: '갤러리에 저장' }).click()
    await page
      .getByRole('status')
      .filter({ hasText: '갤러리에 저장했습니다' })
      .waitFor()
    await page.getByRole('link', { name: 'Gallery', exact: true }).click()
    await page
      .getByRole('heading', { name: 'QA saved artwork', exact: true })
      .waitFor()
    await page.reload()
    await page
      .getByRole('heading', { name: 'QA saved artwork', exact: true })
      .waitFor()
    await page
      .getByRole('heading', { name: 'QA saved artwork', exact: true })
      .click()
    await page.waitForFunction(
      () =>
        document.querySelector('input[aria-label="작품 이름"]')?.value ===
        'QA saved artwork',
    )
    assert.equal(
      await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
      '160',
    )
    assert.equal(await page.getByLabel('사용자 문자').inputValue(), '@#<>. ')
    await page.getByRole('link', { name: 'Gallery', exact: true }).click()
    await page.getByRole('button', { name: 'QA saved artwork 삭제' }).click()
    await page.getByRole('button', { name: '삭제', exact: true }).click()
    await page
      .getByRole('heading', { name: '저장된 작품이 없습니다.' })
      .waitFor()
  })
  await check(
    'Real video upload, playback, pause, seek, settings and PNG snapshot',
    async () => {
      // Generate a real WebM fixture through the browser MediaRecorder API.
      const bytes = await page.evaluate(async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d'),
          stream = canvas.captureStream(20)
        const chunks = [],
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
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = '#101010'
          ctx.fillRect(0, 0, 320, 180)
          ctx.fillStyle = '#f7af75'
          ctx.beginPath()
          ctx.arc(70 + i * 4, 90, 40, 0, Math.PI * 2)
          ctx.fill()
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        recorder.stop()
        stream.getTracks().forEach((t) => t.stop())
        return done
      })
      await writeFile('.qa/sample.webm', Buffer.from(bytes))
      await page.getByRole('link', { name: 'Video', exact: true }).click()
      await page.getByLabel('영상 파일 선택').setInputFiles('.qa/sample.webm')
      await page
        .getByRole('button', { name: '영상 재생', exact: true })
        .waitFor({ state: 'visible' })
      await page.waitForFunction(
        () => !document.querySelector('.play-button').disabled,
      )
      const first = await page
        .locator('.video-stage canvas')
        .evaluate((c) => c.toDataURL())
      await page.getByRole('button', { name: '영상 재생', exact: true }).click()
      await page.waitForTimeout(650)
      assert.notEqual(
        await page
          .locator('.video-stage canvas')
          .evaluate((c) => c.toDataURL()),
        first,
      )
      await page
        .getByRole('button', { name: '영상 일시정지', exact: true })
        .click()
      await page.getByLabel('영상 타임라인').fill('1.3')
      await page.waitForTimeout(150)
      assert.ok(
        await page
          .locator('video')
          .evaluate((v) => Math.abs(v.currentTime - 1.3) < 0.1),
      )
      await page.getByLabel('프리뷰 FPS').fill('12')
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('80')
      await page.getByLabel('색상 모드').selectOption('mint')
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: '프레임 PNG 저장' }).click()
      assert.ok((await download).suggestedFilename().endsWith('.png'))
    },
  )
  await page.screenshot({ path: '.qa/video-desktop.png', fullPage: true })
  await check('Responsive pages and drawer at 390px and 768px', async () => {
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 })
      for (const route of ['', '#/image', '#/video', '#/gallery']) {
        await page.goto(`${base}${route}`)
        await page.waitForTimeout(180)
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width} ${route} horizontal overflow`,
        )
      }
      if (width === 390) {
        await page.getByRole('button', { name: '메뉴 열기' }).click()
        await page.getByRole('link', { name: 'Home', exact: true }).click()
        await page.waitForFunction(
          () => !document.querySelector('.sidebar.mobile-open'),
        )
        await page.waitForTimeout(250)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: '.qa/home-mobile.png', fullPage: true })
      }
    }
  })
  assert.deepEqual(errors, [], 'No browser console or runtime errors')
  console.log('PASS no browser console/runtime errors')
} finally {
  await browser.close()
}
