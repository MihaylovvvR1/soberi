import { useSyncExternalStore } from 'react'
import { Icon } from './Icons'

type ThemePreference = 'light' | 'dark' | 'system'
declare global {
  interface Window { soberiTheme: { get: () => ThemePreference; set: (value: ThemePreference) => void } }
}
function subscribe(notify: () => void) {
  window.addEventListener('soberi-theme-change', notify)
  return () => window.removeEventListener('soberi-theme-change', notify)
}
const getSnapshot = () => window.soberiTheme.get()

export function ThemeControl() {
  const preference = useSyncExternalStore(subscribe, getSnapshot)
  return <div className="theme-control" data-tour="theme">
    <Icon name={preference === 'light' ? 'sun' : preference === 'dark' ? 'moon' : 'monitor'} size={17} />
    <select aria-label="Тема оформления" value={preference} onChange={event => window.soberiTheme.set(event.target.value as ThemePreference)}>
      <option value="light">Светлая</option>
      <option value="dark">Тёмная</option>
      <option value="system">Системная</option>
    </select>
  </div>
}
