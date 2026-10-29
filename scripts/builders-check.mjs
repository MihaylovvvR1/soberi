import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('artifacts/builders', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const errors = [], checks = []
let screenshots = 0
for (const width of [320, 390, 768, 1024, 1366, 1920]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const check = async label => {
    const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, modalOverflow: [...document.querySelectorAll('dialog[open]')].some(item => item.scrollWidth > item.clientWidth) }))
    checks.push({ width, label, ...result })
    if (Object.values(result).some(Boolean)) errors.push({ width, label, ...result })
  }
  const shot = async label => { await page.waitForTimeout(220); await page.screenshot({ path: `artifacts/builders/${width}-${label}.png`, fullPage: label.includes('editing') && width > 1000 }); screenshots++ }
  for (const theme of ['light', 'dark']) {
    await page.goto('http://localhost:5173/')
    await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
    await page.getByRole('button', { name: 'Настроить экран', exact: true }).click()
    for (const size of ['1', '2']) {
      for (const control of await page.getByLabel(/^Ширина блока:/).all()) await control.selectOption(size)
      await check(`${theme}-editing-width-${size}`)
      if ([320, 1366].includes(width)) await shot(`${theme}-editing-width-${size}`)
    }
    await page.getByRole('button', { name: 'Сбросить расположение', exact: true }).click()
    await check(`${theme}-reset`)
    await page.keyboard.press('Escape')
    await page.goto('http://localhost:5173/#tasks')
    await check(`${theme}-stages`)
    for (const form of ['stage', 'template', 'delete']) {
      if (form === 'stage') await page.getByRole('button', { name: 'Добавить этап', exact: true }).click()
      if (form === 'template') await page.getByRole('button', { name: 'Сохранить как шаблон', exact: true }).click()
      if (form === 'delete') await page.getByRole('button', { name: 'Удалить этап: Помещение', exact: true }).click()
      await check(`${theme}-${form}`)
      if ([320, 1366].includes(width)) await shot(`${theme}-${form}`)
      await page.keyboard.press('Escape')
    }
  }
  await page.close()
}
await browser.close()
await writeFile('artifacts/builders/report.json', JSON.stringify({ screenshots, checks, errors }, null, 2))
console.log(JSON.stringify({ screenshots, checks: checks.length, errors }, null, 2))
if (errors.length) process.exitCode = 1
