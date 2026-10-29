import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const errors = []
await mkdir('artifacts/responsive', { recursive: true })
for (const [device, width, height] of [['wide', 1920, 1080], ['laptop', 1366, 768], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(`${device}: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.push(`${device}: ${message.text()}`) })
  for (const section of ['overview', 'tasks', 'budget']) {
    await page.goto(`http://localhost:5173/#${section}`)
    await page.locator('h1').waitFor()
    await page.waitForTimeout(220)
    await page.screenshot({ path: `artifacts/responsive/${device}-${section}.png`, fullPage: device === 'phone' })
    const layout = await page.evaluate(() => {
      const expense = document.querySelector('.expense-table-wrap')
      const risk = document.querySelector('[data-testid="risks"]')
      const rect = risk?.getBoundingClientRect()
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        tableOverflow: expense ? expense.scrollWidth > expense.clientWidth : false,
        risk: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : undefined,
      }
    })
    console.log(device, section, layout)
    if (layout.pageOverflow || layout.tableOverflow) errors.push(`${device}/${section}: overflow`)
  }
  await page.goto('http://localhost:5173/')
  await page.getByRole('button', { name: 'Создать мероприятие', exact: true }).click()
  await page.waitForTimeout(220)
  await page.screenshot({ path: `artifacts/responsive/${device}-modal.png` })
  await page.keyboard.press('Escape')
  if (await page.getByRole('dialog').isVisible()) errors.push(`${device}: Escape did not close dialog`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const animation = await page.locator('main').evaluate(element => getComputedStyle(element).animationName)
  if (animation !== 'none') errors.push(`${device}: reduced motion ignored`)
  await page.close()
}
await browser.close()
console.log(JSON.stringify({ errors }, null, 2))
if (errors.length) process.exitCode = 1
