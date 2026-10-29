import { test, expect } from '@playwright/test'

test('выбор темы сохраняется и применяется до загрузки React', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Тема оформления', { exact: true }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.reload()
  await expect(page.getByLabel('Тема оформления', { exact: true })).toHaveValue('dark')
  await page.route(/\/src\/main\.tsx(?:\?|$)/, route => route.abort())
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#root')).toBeEmpty()
})

test('системная тема реагирует на настройку ОС, явный выбор имеет приоритет', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Тема оформления', { exact: true }).selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Тема оформления', { exact: true }).selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('в обеих темах все разделы и формы работают без переполнения', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 390, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      await page.goto('/')
      await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
      for (const route of ['', '#tasks', '#budget']) {
        await page.goto('/' + route)
        await expect(page.locator('h1')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      }
      await page.getByRole('button', { name: 'Добавить расход' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByLabel('Название статьи')).toBeEditable()
      await page.keyboard.press('Escape')
    }
  }
  expect(errors).toEqual([])
})

test('неназначенный ответственный выделен как критическая проблема в обеих темах', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/#tasks')
    await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
    const channels = await page.locator('.task-owner.unassigned').evaluate(element => getComputedStyle(element).color.match(/\d+/g)!.map(Number))
    expect(channels[0]).toBeGreaterThan(channels[1] + 30)
  }
})
