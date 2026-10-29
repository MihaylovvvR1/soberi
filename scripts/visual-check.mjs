import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1060 }, deviceScaleFactor: 1 })
const errors = []
const external = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('request', request => { if (!request.url().startsWith('http://localhost:5173') && !request.url().startsWith('data:')) external.push(request.url()) })
for (const [name, path] of [['overview', '/'], ['tasks', '/#tasks'], ['budget', '/#budget']]) {
  await page.goto(`http://localhost:5173${path}`)
  await page.locator('h1').waitFor()
  await page.waitForTimeout(350)
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true })
  console.log(name, await page.locator('main').evaluate(element => ({ width: element.clientWidth, height: element.clientHeight, overflow: document.documentElement.scrollWidth > innerWidth })))
}
await page.goto('http://localhost:5173')
await page.getByRole('button', { name: 'Создать мероприятие', exact: true }).click()
await page.screenshot({ path: 'artifacts/create-event.png', fullPage: true })
await page.getByRole('button', { name: 'Закрыть окно' }).click()
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(350)
await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true })
console.log(JSON.stringify({ errors, external }, null, 2))
await browser.close()
if (errors.length || external.length) process.exitCode = 1
