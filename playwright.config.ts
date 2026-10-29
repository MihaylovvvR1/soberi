import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const executablePath = process.env.SOBERI_BROWSER_PATH || (existsSync(windowsChrome) ? windowsChrome : undefined)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: { executablePath },
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
