import { test, expect } from '@playwright/test'

test('повреждённый шаблон, прежняя схема и дубликаты не теряют пользовательские мероприятия', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await page.evaluate(() => {
    const source = JSON.parse(localStorage.getItem('soberi-demo-v1')!)
    const custom = structuredClone(source.events[0]); custom.id = 'custom'; custom.title = 'Сохранённое событие'
    delete custom.stages
    custom.tasks.forEach((task: { stageId?: string }) => delete task.stageId)
    source.version = 1; source.events.push(custom); source.activeId = 'custom'
    source.templates = [{ id: 'broken', name: 'Ошибка', stages: [null], team: [], tasks: [null], expenses: [] }]
    localStorage.setItem('soberi-demo-v1', JSON.stringify(source))
    localStorage.setItem('soberi-workspace-v1', JSON.stringify({ widgets: [null, { id: 'risks', visible: false, width: 99 }] }))
    localStorage.setItem('soberi-theme', 'unknown')
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Сохранённое событие', exact: true })).toBeVisible()
  await expect(page.getByTestId('progress')).toContainText('8 из 10')
  await expect(page.getByLabel('Тема оформления', { exact: true })).toHaveValue('system')
  const data = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem('soberi-demo-v1')!), recovery: JSON.parse(localStorage.getItem('soberi-demo-recovery-v1')!) }))
  expect(data.store.events).toHaveLength(2)
  expect(data.store.templates).toHaveLength(0)
  expect(JSON.parse(data.recovery.raw).activeId).toBe('custom')
  await page.goto('/#tasks')
  await expect(page.getByTestId('task-row')).toHaveCount(10)
  expect(errors).toEqual([])
})

test('нечитаемый JSON открывает исходный пример и сохраняет резервную строку', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('soberi-demo-v1', '{unreadable')
    localStorage.setItem('soberi-workspace-v1', '{bad-layout')
    localStorage.setItem('soberi-onboarding-v1', '{bad-tour')
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Открытый мастер-класс', exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soberi-demo-recovery-v1')!).raw)).toBe('{unreadable')
  await page.reload()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soberi-demo-recovery-v1')!).raw)).toBe('{unreadable')
  await expect(page.getByTestId('progress')).toContainText('8 из 10')
})
