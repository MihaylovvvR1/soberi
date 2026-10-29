import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

await mkdir('docs/media', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.SOBERI_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1600, height: 1280 }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow' })
await page.goto('http://localhost:5173/')
await page.getByRole('button', { name: 'Начать работу', exact: true }).click()
for (const theme of ['light', 'dark']) {
  await page.getByLabel('Тема оформления', { exact: true }).selectOption(theme)
  await page.locator('h1').click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `docs/media/overview-${theme}.jpg`, type: 'jpeg', quality: 88 })
}
await page.getByLabel('Тема оформления', { exact: true }).selectOption('light')
await page.goto('http://localhost:5173/#budget')
await page.waitForTimeout(250)
await page.screenshot({ path: 'docs/media/budget.jpg', type: 'jpeg', quality: 88 })
await page.goto('http://localhost:5173/#tasks')
await page.waitForTimeout(250)
await page.screenshot({ path: 'docs/media/tasks.jpg', type: 'jpeg', quality: 88 })
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(250)
await page.screenshot({ path: 'docs/media/mobile.jpg', type: 'jpeg', quality: 90 })
await browser.close()

const ffmpeg = process.env.SOBERI_FFMPEG ?? resolve('.tools/ffmpeg/package/ffmpeg.exe')
const filter = '[0:v]split=5[a][b][c][d][e];[a]trim=start=0.3:end=1.3,setpts=PTS-STARTPTS[v0];[b]trim=start=15.5:end=17.5,setpts=PTS-STARTPTS[v1];[c]trim=start=28.2:end=30.2,setpts=PTS-STARTPTS[v2];[d]trim=start=34.2:end=36.5,setpts=PTS-STARTPTS[v3];[e]trim=start=40.5:end=44.5,setpts=PTS-STARTPTS[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,fps=8,scale=960:-1:flags=lanczos,split[frames][paletteinput];[paletteinput]palettegen=max_colors=128[palette];[frames][palette]paletteuse=dither=bayer:bayer_scale=3'
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', 'docs/media/soberi-demo.mp4', '-filter_complex', filter, '-loop', '0', 'docs/media/demo-preview.gif'], { stdio: 'pipe' })
if (existsSync('docs/media/soberi-intro.mp4')) execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', 'docs/media/soberi-intro.mp4', '-vf', 'crop=1920:640:0:220,fps=15,scale=800:-1:flags=lanczos,tpad=stop_mode=clone:stop_duration=1.2,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', 'docs/media/soberi-intro.gif'], { stdio: 'pipe' })
console.log('README screenshots and preview are ready')
