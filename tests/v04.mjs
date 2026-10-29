import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'

const base = process.env.TEST_URL || 'http://127.0.0.1:5173/AsciiLab/'
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER || 'msedge',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
})
const page = await context.newPage(),
  errors = [],
  aiRequests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
context.on('request', (request) => {
  if (/huggingface|\.wasm/.test(request.url())) aiRequests.push(request.url())
})
await mkdir('.qa/v04', { recursive: true })
const check = async (label, run) => {
  await run()
  console.log(`PASS ${label}`)
}
const output = () => page.locator('.preview-piece canvas')
const canvasData = () => output().evaluate((canvas) => canvas.toDataURL())
const text = () =>
  page.getByLabel('ASCII 텍스트', { exact: true }).textContent()
const clipboard = async () =>
  (await page.evaluate(() => navigator.clipboard.readText())).replace(
    /\r\n/g,
    '\n',
  )
async function copy(mode) {
  if (await page.locator('.toast').count())
    await page.getByRole('button', { name: '알림 닫기' }).click()
  await page.getByLabel('복사 형식').selectOption(mode)
  await page.getByRole('button', { name: '복사', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '복사했습니다' }).waitFor()
}
const fit = () =>
  page.getByRole('button', { name: '미리보기 화면 맞춤', exact: true }).click()
const scale = () =>
  page
    .locator('.preview-piece .preview-transform')
    .last()
    .getAttribute('data-scale')
    .then(Number)
const settle = () => page.waitForTimeout(300)
async function seedLegacyMask() {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 160
    const ctx = canvas.getContext('2d'),
      gradient = ctx.createLinearGradient(0, 0, 320, 0)
    gradient.addColorStop(0, 'black')
    gradient.addColorStop(1, 'white')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 320, 160)
    const source = await new Promise((resolve) => canvas.toBlob(resolve))
    ctx.clearRect(0, 0, 320, 160)
    ctx.fillStyle = 'white'
    ctx.fillRect(80, 20, 220, 120)
    const mask = await new Promise((resolve) => canvas.toBlob(resolve))
    const db = await new Promise((resolve) => {
      const request = indexedDB.open('asciilab', 1)
      request.onupgradeneeded = () =>
        request.result.createObjectStore('artworks', { keyPath: 'id' })
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise((resolve) => {
      const tx = db.transaction('artworks', 'readwrite')
      tx.objectStore('artworks').put({
        id: 'v04-legacy',
        name: 'Legacy 120',
        created: Date.now(),
        source,
        thumbnail: source,
        text: '',
        settings: {
          columns: 120,
          charset: 'Custom',
          custom: '가<& ',
          brightness: 5,
          mask: { mode: 'auto', feather: 0 },
        },
        automaticPng: mask,
        baselinePng: mask,
      })
      tx.oncomplete = resolve
    })
    db.close()
  })
}
try {
  await page.goto(`${base}#/image`)
  await check(
    '80/70 defaults, all density presets, slider synchronization and saved 120-column art',
    async () => {
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '80',
      )
      assert.equal(await page.getByLabel('복사 형식').inputValue(), 'image')
      for (const width of [50, 80, 120, 180]) {
        await page.getByLabel('밀도 프리셋').selectOption(String(width))
        assert.equal(
          await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
          String(width),
        )
      }
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('96')
      assert.equal(await page.getByLabel('밀도 프리셋').inputValue(), 'custom')
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('120')
      assert.equal(await page.getByLabel('밀도 프리셋').inputValue(), '120')
      await page
        .getByRole('button', { name: '설정 초기화', exact: true })
        .click()
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '80',
      )
      await page.goto(`${base}#/video`)
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '70',
      )
      await page.getByLabel('밀도 프리셋').selectOption('180')
      await page
        .getByRole('button', { name: '영상 설정 초기화', exact: true })
        .click()
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '70',
      )
      await seedLegacyMask()
      await page.goto(`${base}#/image?id=v04-legacy`)
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]').value ===
          'Legacy 120',
      )
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '120',
      )
      assert.equal(
        await page.getByLabel('변환 대상', { exact: true }).inputValue(),
        'auto',
      )
      assert.equal(
        await page.getByLabel('밝기', { exact: true }).inputValue(),
        '5',
      )
    },
  )
  await check(
    'Panel reclaims width, persists across routes/reload and preserves all work',
    async () => {
      const before = await page.locator('.preview-stage').boundingBox(),
        original = await canvasData()
      await page
        .getByRole('button', { name: '변환 설정 접기', exact: true })
        .click()
      await settle()
      const after = await page.locator('.preview-stage').boundingBox()
      assert.ok(after.width > before.width + 200)
      assert.equal(
        await page.locator('.settings-rail').getAttribute('aria-hidden'),
        'true',
      )
      assert.ok((await page.locator('.settings-rail').boundingBox()).width < 1)
      assert.equal(await canvasData(), original)
      await page.goto(`${base}#/video`)
      await page
        .getByRole('button', { name: '변환 설정 펼치기', exact: true })
        .waitFor()
      await page.reload()
      await page
        .getByRole('button', { name: '변환 설정 펼치기', exact: true })
        .waitFor()
      await page.goto(`${base}#/image?id=v04-legacy`)
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]').value ===
          'Legacy 120',
      )
      await page
        .getByRole('button', { name: '변환 설정 펼치기', exact: true })
        .click()
      await settle()
      assert.equal(
        await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
        '120',
      )
      assert.equal(await canvasData(), original)
    },
  )
  await check(
    'Independent groups support Enter/Space and retain hidden settings',
    async () => {
      const button = page.getByRole('button', { name: '문자', exact: true })
      await button.focus()
      await page.keyboard.press('Enter')
      assert.equal(await button.getAttribute('aria-expanded'), 'false')
      assert.equal(
        await page.getByLabel('사용자 문자', { exact: true }).isVisible(),
        false,
      )
      await page.getByRole('button', { name: '톤과 색상', exact: true }).click()
      await button.focus()
      await page.keyboard.press('Space')
      assert.equal(await button.getAttribute('aria-expanded'), 'true')
      assert.equal(
        await page.getByLabel('사용자 문자', { exact: true }).inputValue(),
        '가<& ',
      )
      assert.equal(
        await page
          .getByRole('button', { name: '톤과 색상', exact: true })
          .getAttribute('aria-expanded'),
        'false',
      )
      await page.getByRole('button', { name: '톤과 색상', exact: true }).click()
    },
  )
  await check(
    'Zoom, 100%, Ctrl+wheel, dragging and fit preserve actual output',
    async () => {
      const original = await canvasData(),
        dimensions = await output().evaluate((c) => [c.width, c.height])
      await page
        .getByRole('button', { name: '미리보기 100%', exact: true })
        .click()
      assert.equal(await scale(), 1)
      await page
        .getByRole('button', { name: '미리보기 확대', exact: true })
        .click()
      assert.equal(await scale(), 1.25)
      await page
        .getByRole('button', { name: '미리보기 축소', exact: true })
        .click()
      assert.equal(await scale(), 1)
      const viewport = await page.locator('.preview-piece').last().boundingBox()
      await page.mouse.move(
        viewport.x + viewport.width / 2,
        viewport.y + viewport.height / 2,
      )
      await page.mouse.down()
      await page.mouse.move(
        viewport.x + viewport.width / 2 + 50,
        viewport.y + viewport.height / 2 + 30,
        { steps: 5 },
      )
      await page.mouse.up()
      assert.ok(
        +(await page
          .locator('.preview-piece .preview-transform')
          .last()
          .getAttribute('data-pan-x')) >= 49,
      )
      await page.keyboard.down('Control')
      await page.mouse.wheel(0, -100)
      await page.keyboard.up('Control')
      await settle()
      assert.ok((await scale()) > 1)
      await fit()
      await settle()
      const rect = await output().boundingBox()
      assert.ok(rect.width <= viewport.width && rect.height <= viewport.height)
      assert.ok(
        Math.abs(rect.width / rect.height - dimensions[0] / dimensions[1]) <
          0.001,
      )
      assert.equal(await canvasData(), original)
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: /^PNG/ }).click()
      const png = await readFile(await (await download).path())
      assert.equal(png.readUInt32BE(16), dimensions[0])
      assert.equal(png.readUInt32BE(20), dimensions[1])
      for (const view of ['원본', '비교', 'ASCII']) {
        await page.getByRole('button', { name: view, exact: true }).click()
        await settle()
        assert.ok((await scale()) > 0)
      }
    },
  )
  await check(
    'Copy width re-converts the masked source, keeps PNG independent and matches TXT/HTML',
    async () => {
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('180')
      const original = await canvasData()
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      assert.equal(
        await page.getByLabel('복사용 가로 문자 수').inputValue(),
        '80',
      )
      let previousRows = 0
      for (const width of [40, 60, 80, 100, 120]) {
        await page.getByLabel('복사용 가로 문자 수').selectOption(String(width))
        const value = await text(),
          lines = value.split('\n')
        assert.ok(lines.every((line) => Array.from(line).length === width))
        assert.ok(lines.length > previousRows)
        previousRows = lines.length
        assert.ok(
          lines.every(
            (line) => line.slice(0, Math.floor(width * 0.2)).trim() === '',
          ),
        )
        await copy('text')
        assert.equal(await clipboard(), value)
        assert.equal(
          await page.getByLabel('문자 밀도 · 가로 문자 수').inputValue(),
          '180',
        )
        assert.equal(await canvasData(), original)
      }
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: /^TXT/ }).click()
      assert.equal(
        await readFile(await (await download).path(), 'utf8'),
        await text(),
      )
      await copy('html')
      const html = await page.evaluate(async () => {
        const [item] = await navigator.clipboard.read()
        const [plain, html] = await Promise.all([
          item.getType('text/plain'),
          item.getType('text/html'),
        ])
        return {
          types: item.types,
          plain: await plain.text(),
          html: await html.text(),
        }
      })
      assert.equal(html.plain.replace(/\r\n/g, '\n'), await text())
      assert.ok(html.html.includes('&lt;') && html.html.includes('&amp;'))
      assert.ok(
        html.types.includes('text/html') && html.types.includes('text/plain'),
      )
      assert.ok(
        html.html.includes('white-space: pre') ||
          html.html.includes('white-space:pre'),
      )
      assert.ok(
        await page.evaluate((markup) => {
          const pasted = new DOMParser()
            .parseFromString(markup, 'text/html')
            .querySelector('pre')
          const preview = document.querySelector(
            'pre[aria-label="ASCII 텍스트"]',
          )
          return (
            ['fontFamily', 'fontSize', 'lineHeight', 'whiteSpace'].every(
              (key) => pasted.style[key] === preview.style[key],
            ) &&
            pasted.querySelector('span').style.width ===
              preview.querySelector('span').style.width
          )
        }, html.html),
        'Preview and HTML clipboard use the same typography and cell width',
      )
      await page.getByLabel('투명 배경', { exact: true }).check()
      await copy('image')
      const pixelsEqual = await page.evaluate(async () => {
        const [item] = await navigator.clipboard.read(),
          bitmap = await createImageBitmap(await item.getType('image/png'))
        const original = document.querySelector('.preview-piece canvas'),
          c = document.createElement('canvas')
        c.width = bitmap.width
        c.height = bitmap.height
        const ctx = c.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const actual = ctx.getImageData(0, 0, c.width, c.height).data,
          expected = original
            .getContext('2d')
            .getImageData(0, 0, original.width, original.height).data
        return (
          c.width === original.width &&
          c.height === original.height &&
          actual.every((value, i) => value === expected[i])
        )
      })
      assert.ok(pixelsEqual)
      assert.equal(
        aiRequests.length,
        0,
        'Cached mask requires no AI re-inference',
      )
      await page.evaluate(() => {
        window.originalClipboard = navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: undefined,
        })
      })
      await page.getByRole('button', { name: '복사', exact: true }).click()
      await page.getByLabel('ASCII 텍스트', { exact: true }).waitFor()
      assert.match(await page.locator('.toast').textContent(), /직접 선택/)
      await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: window.originalClipboard,
        }),
      )
    },
  )
  await check(
    'Responsive fit, panel scroll and pinch zoom at 390/768/1440px',
    async () => {
      await page.getByRole('button', { name: 'ASCII', exact: true }).click()
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await settle()
        await fit()
        await settle()
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        if (width >= 768)
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollHeight <= innerHeight + 1,
            ),
            'Desktop/tablet editor fits the window while settings scroll independently',
          )
        let viewport = await page
            .locator('.preview-piece')
            .last()
            .boundingBox(),
          rect = await output().boundingBox()
        assert.ok(
          rect.width <= viewport.width + 1 &&
            rect.height <= viewport.height + 1,
        )
        await page
          .getByRole('button', { name: '변환 설정 접기', exact: true })
          .click()
        await settle()
        viewport = await page.locator('.preview-piece').last().boundingBox()
        rect = await output().boundingBox()
        assert.ok(
          rect.width <= viewport.width + 1 &&
            rect.height <= viewport.height + 1,
        )
        await page.screenshot({
          path: `.qa/v04/workspace-${width}.png`,
          fullPage: false,
          animations: 'disabled',
        })
        await page
          .getByRole('button', { name: '변환 설정 펼치기', exact: true })
          .click()
        await settle()
        if (width === 390) {
          await page
            .getByRole('button', { name: '미리보기 100%', exact: true })
            .click()
          const rect = await page
              .locator('.preview-piece')
              .last()
              .boundingBox(),
            cdp = await context.newCDPSession(page)
          const points = (distance) => [
            {
              x: rect.x + rect.width / 2 - distance,
              y: rect.y + rect.height / 2,
              id: 1,
            },
            {
              x: rect.x + rect.width / 2 + distance,
              y: rect.y + rect.height / 2,
              id: 2,
            },
          ]
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: points(30),
          })
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: points(60),
          })
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          })
          assert.ok((await scale()) > 1)
        }
      }
    },
  )
  await check(
    'Video zoom and panel changes preserve playback and 70-column output',
    async () => {
      await page.goto(`${base}#/video`)
      await page.getByLabel('영상 파일 선택').setInputFiles('.qa/sample.webm')
      await page.waitForFunction(
        () => !document.querySelector('.play-button').disabled,
      )
      const canvas = page.locator('.video-stage canvas'),
        original = await canvas.evaluate((c) => c.toDataURL())
      await page
        .getByRole('button', { name: '미리보기 100%', exact: true })
        .click()
      await page
        .getByRole('button', { name: '미리보기 확대', exact: true })
        .click()
      await fit()
      assert.equal(await canvas.evaluate((c) => c.toDataURL()), original)
      await page.getByRole('button', { name: '영상 재생', exact: true }).click()
      await page
        .getByRole('button', { name: '변환 설정 접기', exact: true })
        .click()
      await settle()
      assert.equal(await page.locator('video').evaluate((v) => v.paused), false)
      await page
        .getByRole('button', { name: '영상 일시정지', exact: true })
        .click()
      await page
        .getByRole('button', { name: '프레임 텍스트 복사', exact: true })
        .click()
      await page
        .getByRole('alert')
        .filter({ hasText: '복사했습니다' })
        .waitFor()
      assert.ok(
        (await clipboard()).split('\n').every((line) => line.length === 70),
      )
      await page
        .getByRole('button', { name: '변환 설정 펼치기', exact: true })
        .click()
    },
  )
  assert.deepEqual(errors, [])
  console.log('PASS v0.4 editor checks without console/runtime errors')
} finally {
  await browser.close()
}
