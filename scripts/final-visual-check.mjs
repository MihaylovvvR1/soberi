import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('artifacts/final', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const errors = [], checks = []
for (const [device, width, height] of [['wide', 1920, 1080], ['laptop', 1366, 768], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => { if (!request.url().startsWith('http://localhost:5173') && !request.url().startsWith('data:')) errors.push(`External request: ${request.url()}`) })
  await page.goto('http://localhost:5173/')
  await page.getByRole('button', { name: 'Начать работу', exact: true }).click()
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
    for (const route of ['overview', 'tasks', 'budget']) {
      await page.goto(`http://localhost:5173/#${route}`)
      await page.waitForTimeout(200)
      const result = await page.evaluate(() => {
        const mark = document.querySelector('.workspace-watermark img'), layer = mark.parentElement
        const clipped = [...document.querySelectorAll('h1,h2,h3,.button,.text-button,.risk-action,.task-name')].filter(element => element.getClientRects().length && ['hidden', 'clip'].includes(getComputedStyle(element).overflowX) && element.scrollWidth > element.clientWidth + 1).map(element => element.textContent.trim())
        return { overflow: document.documentElement.scrollWidth > innerWidth, clipped, markOpacity: +getComputedStyle(mark).opacity, markInteractive: getComputedStyle(layer).pointerEvents !== 'none' }
      })
      checks.push({ device, theme, route, ...result })
      if (result.overflow || result.clipped.length || result.markInteractive || result.markOpacity > .05) errors.push({ device, theme, route, ...result })
      await page.screenshot({ path: `artifacts/final/${device}-${theme}-${route}.png`, fullPage: device === 'phone' })
    }
    if (device === 'wide') {
      await page.goto('http://localhost:5173/#tasks')
      while (await page.getByRole('button', { name: /^Свернуть этап:/ }).count()) await page.getByRole('button', { name: /^Свернуть этап:/ }).first().click()
      const source = page.getByRole('button', { name: 'Перетащить: Помещение', exact: true })
      const target = page.getByTestId('plan-stage').filter({ has: page.getByRole('heading', { name: 'Программа', exact: true }) })
      await source.scrollIntoViewIfNeeded()
      const from = (await source.boundingBox()), to = (await target.boundingBox())
      await page.mouse.move(from.x + 16, from.y + 16); await page.mouse.down()
      await page.mouse.move(from.x + 28, from.y + 16, { steps: 4 })
      await page.mouse.move(to.x + to.width / 2, to.y + to.height * .7, { steps: 15 })
      await expect(page.getByText('Место вставки', { exact: true })).toBeVisible()
      await page.screenshot({ path: `artifacts/final/${device}-${theme}-drag.png` })
      await page.keyboard.press('Escape'); await page.mouse.up()
      await page.goto('http://localhost:5173/#tasks')
      while (await page.getByRole('button', { name: /^Развернуть этап:/ }).count()) await page.getByRole('button', { name: /^Развернуть этап:/ }).first().click()
    }
  }
  await page.close()
}
await browser.close()
await writeFile('artifacts/final/visual-report.json', JSON.stringify({ checks, errors }, null, 2))
console.log(JSON.stringify({ views: checks.length, dragStates: 2, errors }, null, 2))
if (errors.length) process.exitCode = 1
