/* Runs in <head>, before CSS and React, to set the first painted theme. */
(() => {
  const key = 'soberi-theme'
  const root = document.documentElement
  let preference = 'system'
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved
  } catch { /* The system preference also works without local storage. */ }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
    root.dataset.themePreference = preference
    root.dataset.theme = theme
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101319' : '#ffffff')
  }
  window.soberiTheme = {
    get: () => preference,
    set: value => {
      if (value !== 'light' && value !== 'dark' && value !== 'system') return
      preference = value
      try { localStorage.setItem(key, value) } catch { /* Keep the choice for this tab. */ }
      apply()
      window.dispatchEvent(new Event('soberi-theme-change'))
    },
  }
  media.addEventListener('change', apply)
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return
    const value = event.key === null ? null : event.newValue
    preference = value === 'light' || value === 'dark' ? value : 'system'
    apply()
    window.dispatchEvent(new Event('soberi-theme-change'))
  })
  apply()
})()
