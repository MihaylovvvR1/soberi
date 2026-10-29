import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.tools/playwright')
const { chromium, expect } = await import('@playwright/test')
const rehearsal = process.argv.includes('--rehearsal')
const factor = rehearsal ? .12 : 1
const durationTarget = 44.5
const directory = rehearsal ? 'output/rehearsal' : 'output/raw'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow', colorScheme: 'light' })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = [], scenes = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const pause = ms => page.waitForTimeout(Math.max(rehearsal ? 50 : 0, ms * factor))

// Prepare only this isolated browser context. The user's browser storage is never opened.
await page.goto('http://localhost:5173/')
await page.getByRole('button', { name: 'Начать работу', exact: true }).click()
await page.getByLabel('Тема оформления', { exact: true }).selectOption('light')
const date = await page.evaluate(async () => {
  const { dateKey, addDays } = await import('/src/data.ts')
  const today = dateKey(new Date())
  return { event: addDays(today, 10), control: addDays(today, -7) }
})
await page.getByRole('button', { name: 'Помещение не подтверждено: Подтвердить помещение', exact: true }).click()
await page.getByLabel('Контрольный срок брони').fill(date.control)
await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click()
await page.goto('http://localhost:5173/#budget')
await page.getByRole('button', { name: 'Изменить расход: Вода и кофе для участников', exact: true }).click()
await page.getByLabel('План, ₽', { exact: true }).fill('3500')
await page.getByRole('button', { name: 'Сохранить расходы', exact: true }).click()
await page.goto('http://localhost:5173/#tasks')
await page.getByRole('button', { name: 'Сохранить как шаблон', exact: true }).click()
await page.getByLabel('Название шаблона').fill('Мастер-класс студии')
await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
await page.goto('http://localhost:5173/')
await page.waitForTimeout(600)
const original = await page.evaluate(() => JSON.parse(localStorage.getItem('soberi-demo-v1')).events[0])

async function reveal(locator, force = false) {
  const box = await locator.boundingBox()
  if (force || !box || box.y < 80 || box.y + box.height > 970) {
    await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }))
    await page.waitForTimeout(550)
  }
}
async function click(locator) {
  await reveal(locator)
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: rehearsal ? 2 : 14 })
  await pause(90)
  await locator.click()
}
async function select(locator, value) {
  await reveal(locator)
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: rehearsal ? 2 : 10 })
  await locator.focus()
  await locator.selectOption(value)
  await pause(380)
}
async function overview() {
  await click(page.getByRole('button', { name: 'Обзор мероприятия', exact: true }))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await page.waitForTimeout(500)
}
let started
async function at(seconds) {
  const remaining = seconds * 1000 * factor - (performance.now() - started)
  if (remaining > 0) await page.waitForTimeout(remaining)
}
async function scene(name) {
  const time = +((performance.now() - started) / 1000).toFixed(2)
  scenes.push({ name, time })
  console.log(`${time}s ${name}`)
  if (rehearsal) await page.screenshot({ path: `${directory}/${scenes.length}-${name}.png` })
}

await writeFile(`${directory}/recording.json`, JSON.stringify({ inProgress: true, rehearsal, durationTarget }))
try {
  if (!rehearsal) {
    await page.screencast.showActions({ cursor: 'pointer', duration: 350, style: { title: 'display:none', point: 'width:14px;height:14px;border:2px solid #003afd;border-radius:50%;background:#003afd20' } })
    await page.screencast.start({ path: `${directory}/soberi-demo.webm`, size: { width: 1920, height: 1080 }, fps: 30, quality: 95 })
  }
  started = performance.now()
  await at(1)
  await scene('create')
  await click(page.getByRole('button', { name: 'Создать мероприятие', exact: true }))
  await page.getByLabel('Название мероприятия').pressSequentially('Осенний мастер-класс', { delay: rehearsal ? 1 : 35 })
  await select(page.getByLabel('Начальный план'), { label: 'Мастер-класс студии' })
  await page.getByLabel('Дата мероприятия').fill(date.event)
  await pause(600)
  await click(page.getByRole('dialog').getByRole('button', { name: 'Создать мероприятие', exact: true }))
  await expect(page.getByRole('heading', { name: 'Осенний мастер-класс', exact: true })).toBeVisible()
  await expect(page.locator('[data-risk-kind="venue"]')).toHaveCount(1)
  await expect(page.locator('[data-risk-kind="unassigned"]')).toHaveCount(1)

  await at(10)
  await scene('assign-and-complete')
  await click(page.getByRole('button', { name: 'За оборудование никто не отвечает: Назначить ответственного', exact: true }))
  await select(page.getByLabel('Ответственный', { exact: true }), { label: 'Помощник' })
  await select(page.getByLabel('Статус', { exact: true }), 'done')
  await pause(500)
  await click(page.getByRole('button', { name: 'Сохранить изменения', exact: true }))
  await overview()
  await expect(page.locator('[data-risk-kind="unassigned"]')).toHaveCount(0)
  await expect(page.getByTestId('progress')).toContainText('1 из 10')

  await at(18)
  await scene('resolve-risk')
  await click(page.getByRole('button', { name: 'Помещение не подтверждено: Подтвердить помещение', exact: true }))
  await select(page.getByLabel('Статус', { exact: true }), 'done')
  await pause(450)
  await click(page.getByRole('button', { name: 'Сохранить изменения', exact: true }))
  await overview()
  await expect(page.locator('[data-risk-kind="venue"]')).toHaveCount(0)

  await at(23.5)
  await scene('budget')
  await click(page.getByRole('button', { name: 'Бюджет', exact: true }))
  await expect(page.getByTestId('budget-total')).toContainText('22 000')
  await click(page.getByRole('button', { name: 'Изменить расход: Вода и кофе для участников', exact: true }))
  await reveal(page.getByLabel('Дополнительные ожидаемые расходы, ₽'))
  await page.getByLabel('Дополнительные ожидаемые расходы, ₽').fill('1500')
  await pause(550)
  await click(page.getByRole('button', { name: 'Сохранить расходы', exact: true }))
  await page.getByTestId('budget-total').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  await pause(500)
  await expect(page.getByTestId('budget-total')).toContainText('20 000')

  await at(30.5)
  await scene('workspace')
  await overview()
  await click(page.getByRole('button', { name: 'Настроить экран', exact: true }))
  const handle = page.getByRole('button', { name: 'Перетащить: Прогресс', exact: true })
  const target = page.locator('[data-widget-id="upcoming"]')
  await reveal(handle, true)
  const from = await handle.boundingBox(), to = await target.boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: rehearsal ? 2 : 14 })
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 14, from.y + from.height / 2, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + 24, { steps: rehearsal ? 4 : 24 })
  await expect(page.getByText('Место вставки', { exact: true })).toBeVisible()
  await pause(500)
  await page.mouse.up()
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem('soberi-workspace-v1')).widgets.map(widget => widget.id))
  if (order.indexOf('progress') >= order.indexOf('upcoming')) throw Error('Widget move was not saved')
  await click(page.getByRole('button', { name: 'Готово', exact: true }))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await pause(400)

  await at(37.5)
  await scene('dark-theme')
  const theme = page.getByLabel('Тема оформления', { exact: true })
  await click(theme)
  await pause(450)
  await click(theme.locator('option[value="dark"]'))
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await pause(500)
  await expect(page.getByTestId('progress')).toContainText('2 из 10')
  await expect(page.getByText('Известных рисков нет', { exact: true })).toBeVisible()
  await page.screenshot({ path: `${directory}/final.png` })
  const endedActions = (performance.now() - started) / 1000
  if (!rehearsal && endedActions > 43) throw Error(`Actions took ${endedActions.toFixed(2)}s; revise pacing before export`)
  await at(durationTarget)
  if (!rehearsal) await page.screencast.stop()
  const state = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem('soberi-demo-v1')), layout: JSON.parse(localStorage.getItem('soberi-workspace-v1')), theme: localStorage.getItem('soberi-theme') }))
  const source = state.store.events.find(event => event.id === original.id)
  if (JSON.stringify(source) !== JSON.stringify(original)) throw Error('Source event was changed during recording')
  if (errors.length) throw Error(errors.join('\n'))
  await writeFile(`${directory}/recording.json`, JSON.stringify({ durationTarget, viewport: { width: 1920, height: 1080 }, silent: true, rehearsal, scenes, endedActions, sourcePreserved: true, errors, finalState: state }, null, 2))
  console.log(JSON.stringify({ success: true, rehearsal, durationTarget, endedActions, scenes, errors }))
} finally {
  await context.close()
  await browser.close()
}
