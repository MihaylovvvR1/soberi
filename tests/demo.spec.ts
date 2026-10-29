import { test, expect } from '@playwright/test'

test('обзор отделяет выполненные задачи от критических проблем', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Открытый мастер-класс', exact: true })).toBeVisible()
  await expect(page.getByTestId('progress')).toContainText('8 из 10')
  await expect(page.getByTestId('risks')).toContainText('Помещение не подтверждено')
  await expect(page.getByTestId('risks')).toContainText('За оборудование никто не отвечает')
  await expect(page.getByTestId('risks')).toContainText('2 критические проблемы')
})

test('навигация, фильтры, назначение ответственного и сохранение задач', async ({ page }) => {
  await page.goto('/#tasks')
  await page.getByRole('button', { name: 'Открытые 2', exact: true }).click()
  await expect(page.getByTestId('task-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Проверить оборудование', exact: true }).click()
  await page.getByLabel('Ответственный', { exact: true }).selectOption({ label: 'Помощник' })
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Проверить оборудование', exact: true }).click()
  await expect(page.getByLabel('Ответственный', { exact: true }).locator('option:checked')).toHaveText('Помощник')
  await page.getByRole('button', { name: 'Закрыть окно' }).click()
  await page.getByRole('button', { name: 'Бюджет', exact: true }).click()
  await expect(page.getByTestId('budget-total')).toContainText('22 000')
  await expect(page.getByTestId('budget-overrun')).toContainText('2 000')
})

test('создание мероприятия работает и сохраняется', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Создать мероприятие', exact: true }).click()
  await page.getByLabel('Название мероприятия').fill('День открытых дверей')
  await page.getByLabel('Дата мероприятия').fill('2026-11-15')
  await page.getByRole('dialog').getByRole('button', { name: 'Создать мероприятие', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'День открытых дверей', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'День открытых дверей', exact: true })).toBeVisible()
  await expect(page.getByTestId('progress')).toContainText('0 из 10')
})

test('на узком экране нет горизонтальной прокрутки и ошибок', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/#tasks', '/#budget']) {
      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    }
  }
  expect(errors).toEqual([])
})

test('на телефоне видна компактная навигация и работает клавиатура', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /Критические проблемы:/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Тема оформления', { exact: true })).toBeFocused()
  await expect(page.locator('.sidebar')).toBeHidden()
  await page.getByRole('navigation', { name: 'Навигация на телефоне' }).getByRole('button', { name: 'Бюджет', exact: true }).click()
  await expect(page.locator('h1')).toHaveText('Бюджет')
  await expect(page.getByRole('navigation', { name: 'Навигация на телефоне' }).getByRole('button', { name: 'Бюджет', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('назначение снимает только риск исполнителя, расходы пересчитываются', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('risks').getByRole('button', { name: /За оборудование/ }).click()
  await page.getByLabel('Ответственный', { exact: true }).selectOption({ label: 'Помощник' })
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await page.goto('/')
  await expect(page.getByTestId('risks')).not.toContainText('За оборудование никто не отвечает')
  await expect(page.getByTestId('progress')).toContainText('8 из 10')
  await page.goto('/#tasks')
  await page.getByRole('button', { name: 'Проверить оборудование', exact: true }).click()
  await page.getByLabel('Статус', { exact: true }).selectOption('done')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await page.goto('/')
  await expect(page.getByTestId('risks')).toContainText('1 критическая проблема')
  await expect(page.getByTestId('progress')).toContainText('9 из 10')
  await page.getByRole('button', { name: 'Бюджет', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить расход' }).click()
  await page.getByLabel('Название статьи').fill('Аренда проектора')
  await page.getByLabel('Дополнительные ожидаемые расходы, ₽').fill('1000')
  await page.getByRole('button', { name: 'Сохранить расходы' }).click()
  await expect(page.getByTestId('budget-total')).toContainText('23 000')
  await expect(page.getByTestId('budget-overrun')).toContainText('3 000')
})
