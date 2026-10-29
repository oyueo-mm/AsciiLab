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
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
await mkdir('.qa/v03', { recursive: true })
const check = async (name, run) => {
  await run()
  console.log(`PASS ${name}`)
}
const text = () =>
  page.getByLabel('ASCII 텍스트', { exact: true }).textContent()
const copy = () =>
  page.getByRole('button', { name: '복사', exact: true }).click()
// Windows exposes platform CRLF when reading the OS clipboard back.
const clipboard = async () =>
  (await page.evaluate(() => navigator.clipboard.readText())).replace(
    /\r\n/g,
    '\n',
  )
async function seed() {
  return page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 240
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 320, 240)
    const source = await new Promise((r) => c.toBlob(r))
    ctx.clearRect(0, 0, 320, 240)
    ctx.fillRect(60, 30, 180, 180)
    const mask = await new Promise((r) => c.toBlob(r))
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('asciilab', 1)
      r.onupgradeneeded = () =>
        r.result.createObjectStore('artworks', { keyPath: 'id' })
      r.onsuccess = () => resolve(r.result)
      r.onerror = reject
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('artworks', 'readwrite')
      tx.objectStore('artworks').put({
        id: 'v03-mask',
        name: 'brush fixture',
        created: Date.now(),
        source,
        thumbnail: source,
        text: '',
        settings: { charset: 'Classic', mask: { mode: 'auto', feather: 0 } },
        automaticPng: mask,
        baselinePng: mask,
      })
      tx.oncomplete = resolve
      tx.onerror = reject
    })
    db.close()
  })
}
const brush = async (x, y, endX = x, endY = y) => {
  const rect = await page.getByLabel('선택 영역 브러시').boundingBox()
  await page.mouse.move(rect.x + rect.width * x, rect.y + rect.height * y)
  await page.mouse.down()
  await page.mouse.move(
    rect.x + rect.width * endX,
    rect.y + rect.height * endY,
    { steps: 8 },
  )
  await page.mouse.up()
}
try {
  await page.goto(`${base}#/image`)
  await check(
    'Hangul density mapping, cells, graphemes and TXT/plain copy agreement',
    async () => {
      const gradient = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 80
        const ctx = canvas.getContext('2d'),
          ramp = ctx.createLinearGradient(0, 0, 320, 0)
        ramp.addColorStop(0, 'black')
        ramp.addColorStop(1, 'white')
        ctx.fillStyle = ramp
        ctx.fillRect(0, 0, 320, 80)
        return canvas.toDataURL().split(',')[1]
      })
      await page.getByLabel('이미지 파일 선택').setInputFiles({
        name: 'gradient.png',
        mimeType: 'image/png',
        buffer: Buffer.from(gradient, 'base64'),
      })
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]').value ===
          'gradient',
      )
      for (const charset of ['한글 자모', '한글 음절']) {
        await page
          .getByLabel('문자 세트', { exact: true })
          .selectOption(charset)
        await page.getByRole('button', { name: '텍스트', exact: true }).click()
        const value = await text()
        const densities = await page.evaluate((line) => {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 40
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx.font = '32px NeoDunggeunmo, monospace'
          ctx.textBaseline = 'top'
          return Array.from(line).map((char) => {
            ctx.clearRect(0, 0, 40, 40)
            ctx.fillText(char, 0, 0)
            const data = ctx.getImageData(0, 0, 40, 40).data
            let density = 0
            for (let i = 3; i < data.length; i += 4) density += data[i]
            return density
          })
        }, value.split('\n')[0])
        assert.equal(densities[0], 0)
        assert.ok(densities.at(-1) > 0)
        assert.ok(
          densities.every(
            (density, i) => i === 0 || density >= densities[i - 1],
          ),
          'Measured glyph density increases with source luminance',
        )
        assert.match(
          value,
          charset === '한글 자모' ? /[ㄱ-ㅎㅏ-ㅣ]/ : /[가-힣]/,
        )
        const metrics = await page
          .getByLabel('ASCII 텍스트', { exact: true })
          .evaluate((pre) => {
            const cells = [...pre.querySelectorAll('span > span')]
            return cells
              .slice(0, 240)
              .map((span) => span.getBoundingClientRect().width)
          })
        assert.ok(metrics.every((w) => w === 12))
        await copy()
        assert.equal(await clipboard(), value)
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: /^TXT/ }).click()
        const file = await download
        assert.equal(await readFile(await file.path(), 'utf8'), value)
        await page
          .getByLabel('ASCII 텍스트', { exact: true })
          .evaluate((pre) => {
            const range = document.createRange()
            range.selectNodeContents(pre)
            const selection = getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
          })
        await page.keyboard.press('Control+c')
        assert.equal(
          await clipboard(),
          value,
          'Manual pre selection preserves the exact text',
        )
      }
      await page.getByLabel('문자 세트', { exact: true }).selectOption('Custom')
      await page.getByLabel('사용자 문자', { exact: true }).fill('🧑‍🎨가<& ')
      assert.ok(!(await text()).includes('\ufffd'))
      await copy()
      assert.equal(await clipboard(), await text())
    },
  )
  await check('Real formatted HTML and PNG clipboard writes', async () => {
    await page.getByLabel('복사 형식').selectOption('html')
    await copy()
    await page
      .getByRole('status')
      .filter({ hasText: '복사했습니다.' })
      .waitFor()
    const types = await page.evaluate(async () => {
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
    assert.equal(types.plain.replace(/\r\n/g, '\n'), await text())
    assert.ok(types.types.includes('text/html'))
    assert.ok(types.html.includes('&lt;') || types.html.includes('&amp;'))
    await page.getByLabel('복사 형식').selectOption('image')
    await copy()
    await page.waitForTimeout(200)
    assert.ok(
      await page.evaluate(async () =>
        (await navigator.clipboard.read())[0].types.includes('image/png'),
      ),
    )
  })
  await check(
    'Ctrl+V image paste, editable-field protection and denied-copy fallback',
    async () => {
      await page.locator('h1').click()
      await page.keyboard.press('Control+v')
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]').value ===
          'image',
      )
      const prevented = await page
        .getByLabel('사용자 문자', { exact: true })
        .evaluate((input) => {
          const transfer = new DataTransfer()
          transfer.items.add(new File(['x'], 'test.png', { type: 'image/png' }))
          const event = new ClipboardEvent('paste', {
            clipboardData: transfer,
            bubbles: true,
            cancelable: true,
          })
          input.dispatchEvent(event)
          return event.defaultPrevented
        })
      assert.equal(prevented, false)
      await page.evaluate(() => {
        window.originalClipboard = navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error('권한 거부')
            },
          },
        })
      })
      await page.getByLabel('복사 형식').selectOption('text')
      await copy()
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
    'AI failure keeps existing manual selectors available',
    async () => {
      await context.route('https://huggingface.co/**', (route) => route.abort())
      await page.getByLabel('변환 대상', { exact: true }).selectOption('auto')
      await page
        .getByRole('status')
        .filter({ hasText: '자동 선택을 완료하지 못했습니다' })
        .waitFor({ timeout: 30000 })
      await page.getByRole('button', { name: '영역 선택', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await page.getByRole('button', { name: '선택 취소', exact: true }).click()
      await page.getByLabel('변환 대상', { exact: true }).selectOption('color')
      await page.getByLabel('제거할 배경색').waitFor()
    },
  )
  await seed()
  await page.goto(`${base}#/image?id=v03-mask`)
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="작품 이름"]').value ===
      'brush fixture',
  )
  await check(
    'Add/erase brushes, undo/reset and lossless compressed gallery restoration',
    async () => {
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      const baseline = await text()
      await page
        .getByRole('button', { name: '선택 영역 보정', exact: true })
        .click()
      await page.getByLabel('브러시 크기', { exact: true }).fill('35')
      await page
        .getByRole('button', { name: '선택 영역 지우기', exact: true })
        .click()
      await brush(0.5, 0.5)
      await page.getByRole('button', { name: '영역 적용', exact: true }).click()
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      const erased = await text()
      assert.notEqual(erased, baseline)
      await page
        .getByRole('button', { name: '선택 영역 보정', exact: true })
        .click()
      await page.getByLabel('브러시 크기', { exact: true }).fill('35')
      await brush(0.07, 0.5, 0.12, 0.7)
      await page.getByRole('button', { name: '되돌리기', exact: true }).click()
      await page.getByRole('button', { name: '영역 적용', exact: true }).click()
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      assert.equal(await text(), erased)
      await page
        .getByRole('button', { name: '선택 영역 보정', exact: true })
        .click()
      await page.getByLabel('브러시 크기', { exact: true }).fill('35')
      await brush(0.07, 0.5, 0.12, 0.7)
      await page.getByRole('button', { name: '영역 적용', exact: true }).click()
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      const edited = await text()
      assert.notEqual(edited, erased)
      await page.getByLabel('작품 이름').fill('brush roundtrip')
      await page
        .getByRole('button', { name: '갤러리에 저장', exact: true })
        .click()
      await page
        .getByRole('status')
        .filter({ hasText: '갤러리에 저장했습니다' })
        .waitFor()
      const raw = await page.evaluate(async () => {
        const db = await new Promise((r) => {
          const req = indexedDB.open('asciilab', 1)
          req.onsuccess = () => r(req.result)
        })
        const list = await new Promise((r) => {
          const req = db
            .transaction('artworks')
            .objectStore('artworks')
            .getAll()
          req.onsuccess = () => r(req.result)
        })
        db.close()
        const art = list.find((a) => a.name === 'brush roundtrip')
        return {
          id: art.id,
          bytes: art.automaticPng.size,
          baseline: art.baselinePng.size,
          inline: !!art.settings.mask.automatic,
        }
      })
      assert.equal(raw.inline, false)
      assert.ok(raw.bytes < 320 * 240)
      assert.ok(raw.baseline < 320 * 240)
      await page.goto(`${base}#/image?id=${raw.id}`)
      await page.waitForFunction(
        () =>
          document.querySelector('input[aria-label="작품 이름"]').value ===
          'brush roundtrip',
      )
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      assert.equal(await text(), edited)
      await page
        .getByRole('button', { name: '선택 영역 보정', exact: true })
        .click()
      await page
        .getByRole('button', { name: '보정 초기화', exact: true })
        .click()
      await page.getByRole('button', { name: '영역 적용', exact: true }).click()
      await page.getByRole('button', { name: '텍스트', exact: true }).click()
      assert.equal(await text(), baseline)
      await page.getByLabel('문자 밀도 · 가로 문자 수').fill('200')
      assert.ok((await text()).split('\n')[0].length === 200)
    },
  )
  await check(
    '390/768/1440px text scroll, Hangul rendering, dialogs and touch brushes',
    async () => {
      await page
        .getByLabel('문자 세트', { exact: true })
        .selectOption('한글 음절')
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(350) // Existing sidebar width transition must settle after a viewport change.
        const layout = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('main *')]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 8)
            .map((e) => [
              e.tagName,
              e.className,
              e.getBoundingClientRect().width,
            ]),
        }))
        assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout))
        const overflow = await page
          .locator('.text-viewport')
          .evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth }))
        assert.ok(overflow.scroll > overflow.client)
        await page.screenshot({
          path: `.qa/v03/text-${width}.png`,
          fullPage: true,
        })
        await page
          .getByRole('button', { name: '선택 영역 보정', exact: true })
          .click()
        if (width === 390) {
          const rect = await page.getByLabel('선택 영역 브러시').boundingBox()
          const cdp = await context.newCDPSession(page)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
              { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            ],
          })
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              { x: rect.x + rect.width * 0.7, y: rect.y + rect.height / 2 },
            ],
          })
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          })
          assert.equal(
            await page
              .getByRole('button', { name: '되돌리기', exact: true })
              .isEnabled(),
            true,
          )
        }
        await page.screenshot({
          path: `.qa/v03/brush-${width}.png`,
          fullPage: true,
        })
        await page
          .getByRole('button', { name: '선택 취소', exact: true })
          .click()
      }
    },
  )
  await check('Current video frame text copy', async () => {
    await page.goto(`${base}#/video`)
    await page.getByLabel('영상 파일 선택').setInputFiles('.qa/sample.webm')
    await page
      .getByRole('button', { name: '프레임 텍스트 복사', exact: true })
      .waitFor()
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('button')].find(
          (b) => b.textContent === '프레임 텍스트 복사',
        ).disabled,
    )
    await page
      .getByRole('button', { name: '프레임 텍스트 복사', exact: true })
      .click()
    const first = await clipboard()
    assert.ok(first.includes('\n'))
    await page
      .getByLabel('문자 세트', { exact: true })
      .selectOption('한글 음절')
    await page
      .getByRole('button', { name: '프레임 텍스트 복사', exact: true })
      .click()
    assert.match(await clipboard(), /[가-힣]/)
  })
  assert.deepEqual(errors, [])
  console.log('PASS v0.3 browser checks without runtime errors')
} finally {
  await browser.close()
}
