import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('artifacts/learning', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const errors = [], checks = []
let screenshots = 0
for (const [device, width, height] of [['desktop', 1366, 900], ['laptop', 1024, 768], ['phone', 390, 844], ['small', 320, 640]]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
  page.on('pageerror', error => errors.push(error.message))
  const check = async label => {
    await page.waitForTimeout(100)
    const result = await page.evaluate(() => {
      const tip = document.querySelector('.tour-tip'), box = tip.getBoundingClientRect()
      const form = document.querySelector('[data-tour="task-dialog"]')?.getBoundingClientRect()
      const overlappingForm = form && Math.min(box.right, form.right) > Math.max(box.left, form.left) && Math.min(box.bottom, form.bottom) > Math.max(box.top, form.top)
      return { overflow: document.documentElement.scrollWidth > innerWidth, tipOutside: box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight, overlappingForm: !!overlappingForm }
    })
    checks.push({ device, label, ...result })
    if (Object.values(result).some(Boolean)) errors.push({ device, label, ...result })
    await page.screenshot({ path: `artifacts/learning/${device}-${label}.png` }); screenshots++
  }
  for (const theme of ['light', 'dark']) {
    await page.goto('http://localhost:5173/')
    await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
    await page.getByRole('button', { name: 'Обучение', exact: true }).click()
    const next = () => page.locator('.tour-tip').getByRole('button', { name: 'Далее', exact: true }).click()
    await check(`${theme}-1-event`); await next()
    await check(`${theme}-2-risks`); await next()
    await check(`${theme}-3-problem`)
    await page.locator('[data-tour="assign-problem"]').click()
    await check(`${theme}-3-form`)
    await page.getByLabel('Ответственный', { exact: true }).selectOption({ label: 'Помощник' })
    await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click()
    await check(`${theme}-4-task`)
    await page.getByRole('button', { name: 'Проверить оборудование', exact: true }).click()
    await check(`${theme}-4-form`)
    await page.getByLabel('Статус', { exact: true }).selectOption('done')
    await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click()
    await check(`${theme}-5-budget`); await next()
    await check(`${theme}-6-settings`)
    await page.getByRole('button', { name: 'Настроить экран', exact: true }).click()
    await check(`${theme}-6-move`)
    await page.getByRole('button', { name: 'Выше блок: Прогресс', exact: true }).click()
    await check(`${theme}-7-theme`)
    await page.locator('.tour-tip').getByRole('button', { name: 'Завершить обучение', exact: true }).click()
  }
  await page.close()
}
await browser.close()
await writeFile('artifacts/learning/report.json', JSON.stringify({ screenshots, checks, errors }, null, 2))
console.log(JSON.stringify({ screenshots, checks: checks.length, errors }, null, 2))
if (errors.length) process.exitCode = 1
