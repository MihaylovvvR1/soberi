import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// A new browser profile keeps recording actions separate from the user's browser data.
const profile = resolve(`artifacts/recording/profile-${Date.now()}`)
await mkdir(profile, { recursive: true })
const context = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, viewport: { width: 1920, height: 1080 }, ignoreDefaultArgs: ['--enable-automation'],
  args: ['--window-size=1936,1199'],
})
const page = context.pages()[0] ?? await context.newPage()
await page.goto('http://localhost:5173/')
await page.getByRole('button', { name: 'Начать работу', exact: true }).click()
await page.getByLabel('Тема оформления', { exact: true }).selectOption('light')
await expect(page.getByTestId('progress')).toContainText('8 из 10')
await expect(page.locator('[data-risk-kind="venue"]')).toHaveCount(1)
await expect(page.locator('[data-risk-kind="unassigned"]')).toHaveCount(1)
await page.evaluate(() => window.scrollTo({ top: 180, behavior: 'instant' }))
await page.screenshot({ path: 'artifacts/final/recording-ready.png' })
const status = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem('soberi-demo-v1')), event = store.events.find(event => event.id === store.activeId)
  return { viewport: { width: innerWidth, height: innerHeight }, event: event.title, tasksDone: event.tasks.filter(task => task.status === 'done').length, totalTasks: event.tasks.length, expectedTotal: event.expenses.reduce((sum, item) => sum + item.paid + item.agreed + item.expected, 0), overflow: document.documentElement.scrollWidth > innerWidth }
})
await writeFile('artifacts/final/recording.json', JSON.stringify({ profile, url: page.url(), ...status }, null, 2))
console.log(JSON.stringify({ ready: true, separateProfile: true, ...status }))
await page.bringToFront()
await new Promise(resolve => context.on('close', resolve))
