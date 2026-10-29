import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('artifacts/themes', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const errors = []
const contrasts = []
function readContrasts(selectors) {
  const luminance = value => {
    const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 })
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  return selectors.flatMap(selector => {
    const element = [...document.querySelectorAll(selector)].find(item => item.getClientRects().length)
    if (!element) return []
    let current = element
    let background
    do { background = getComputedStyle(current).backgroundColor; current = current.parentElement } while (background === 'rgba(0, 0, 0, 0)' && current)
    const color = getComputedStyle(element).color
    const l1 = luminance(color), l2 = luminance(background)
    return [{ selector, ratio: +((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)).toFixed(2) }]
  })
}
for (const [device, width, height] of [['desktop', 1440, 1080], ['laptop', 1366, 768], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  for (const theme of ['light', 'dark']) {
    await page.goto('http://localhost:5173/')
    await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
    for (const section of ['overview', 'tasks', 'budget']) {
      await page.goto(`http://localhost:5173/#${section}`)
      await page.locator('h1').waitFor()
      await page.waitForTimeout(220)
      await page.screenshot({ path: `artifacts/themes/${device}-${theme}-${section}.png`, fullPage: device !== 'laptop' })
      const result = await page.evaluate(() => {
        const watermark = document.querySelector('.workspace-watermark')
        const expense = document.querySelector('.expense-table-wrap')
        return { overflow: document.documentElement.scrollWidth > innerWidth, tableOverflow: expense ? expense.scrollWidth > expense.clientWidth : false, watermarkInteractive: getComputedStyle(watermark).pointerEvents !== 'none' }
      })
      if (Object.values(result).some(Boolean)) errors.push(`${device}/${theme}/${section}: ${JSON.stringify(result)}`)
      const samples = await page.evaluate(readContrasts, ['h1', '.stat-label', '.risk-description', '.risk-assignment', '.risk-heading .pill', '.risk-footer', '.upcoming-meta', '.text-button', '.task-date', '.task-owner.unassigned', '.status-pill.green', '.status-pill.amber', '.expense-table th', '.expense-table td[data-label]', '.warning-banner strong', '.warning-banner p', '.budget-explainer p', '.demo-label', '.nav-item.active', '.mobile-navigation button.active', '.theme-control select'])
      for (const sample of samples) {
        contrasts.push({ device, theme, section, ...sample })
        if (sample.ratio < 4.5) errors.push(`${device}/${theme}/${section}: low contrast ${JSON.stringify(sample)}`)
      }
    }
    for (const form of ['expense', 'task', 'create', 'payment', 'team', 'restore']) {
      if (form === 'expense') {
        await page.getByRole('button', { name: 'Добавить расход' }).click()
      } else if (form === 'task') {
        await page.goto('http://localhost:5173/#tasks')
        await page.getByRole('button', { name: 'Проверить оборудование', exact: true }).click()
      } else if (form === 'create') {
        await page.getByRole('button', { name: 'Создать мероприятие', exact: true }).click()
      } else if (form === 'payment') {
        await page.goto('http://localhost:5173/#budget')
        await page.getByRole('button', { name: 'Отметить оплату: Аренда помещения', exact: true }).click()
      } else if (form === 'team') {
        await page.goto('http://localhost:5173/')
        await page.getByRole('button', { name: 'Команда мероприятия', exact: true }).click()
      } else {
        await page.goto('http://localhost:5173/')
        await page.getByRole('button', { name: 'Восстановить пример', exact: true }).click()
      }
      await page.waitForTimeout(220)
      await page.screenshot({ path: `artifacts/themes/${device}-${theme}-${form}.png` })
      const samples = await page.evaluate(readContrasts, ['.modal-form input', '.modal .form-description', '.modal label', '.modal .button.primary', '.modal .button.secondary'])
      for (const sample of samples) {
        contrasts.push({ device, theme, form, ...sample })
        if (sample.ratio < 4.5) errors.push(`${device}/${theme}/${form}: low contrast ${JSON.stringify(sample)}`)
      }
      await page.keyboard.press('Escape')
    }
  }
  await page.close()
}
await browser.close()
await writeFile('artifacts/themes/contrast.json', JSON.stringify(contrasts, null, 2))
console.log(JSON.stringify({ screenshots: 54, contrastSamples: contrasts.length, minimumContrast: Math.min(...contrasts.map(item => item.ratio)), errors }, null, 2))
if (errors.length) process.exitCode = 1
