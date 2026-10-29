import type { CSSProperties } from 'react'

const paths = {
  grip: 'M8 5h.01 M16 5h.01 M8 12h.01 M16 12h.01 M8 19h.01 M16 19h.01',
  up: 'm6 15 6-6 6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5l1.5 1.5 M5 19l1.5-1.5 M17.5 6.5l1.5-1.5',
  moon: 'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z',
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  tasks: 'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
  wallet: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6 M20 12h-5v5h5 M16 14.5h.1',
  plus: 'M12 5v14 M5 12h14',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  arrow: 'M5 12h14 m-6-6 6 6-6 6',
  arrowUp: 'M7 17 17 7 M7 7h10v10',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z M7 14h2 M13 14h2 M7 18h2',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z M12 8v5 M12 17h.01',
  alert: 'm12 3 10 18H2L12 3Z M12 9v5 M12 17h.01',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12 M6 18 18 6',
  search: 'm21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  building: 'M3 21h18 M5 21V3h14v18 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M10 21v-5h4v5',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  flag: 'M4 22V3 M4 4c5-5 11 5 16 0v10c-5 5-11-5-16 0',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Z M13 6l5 5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  monitor: 'M3 3h18v13H3z M8 21h8 M12 16v5',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  return: 'M9 4 4 9l5 5 M4 9h10a6 6 0 0 1 0 12h-3',
} as const
export type IconName = keyof typeof paths
export function Icon({ name, size = 20, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>
}
export function Logo() {
  return <div className="logo" aria-label="СОБЕРИ"><img className="brand-mark" src="/brand/mark.png" alt="" width="36" height="37" /><span className="logo-name">СОБЕРИ</span></div>
}
export function WorkshopArt() {
  return <svg className="workshop-art" viewBox="0 0 340 200" fill="none" aria-hidden="true">
    <path d="m18 151 136-78 165 95-136 79L18 151Z" fill="#e2e9ff" transform="translate(0 -20)" />
    <path d="m47 135 110-63 126 73-110 64-126-74Z" fill="white" stroke="#c4d1ff" />
    <path d="m47 135 126 73v9L47 144v-9Z" fill="#d4dfff"/><path d="m173 208 110-63v9l-110 63v-9Z" fill="#adc0ff"/>
    <path d="M66 124V41l91-52v83l-91 52Z" fill="#f8faff" stroke="#c2d0ff" transform="translate(0 23)"/>
    <path d="m77 69 67-38v48l-67 39V69Z" fill="#003bff"/>
    <path d="m87 75 12-7m-12 18 45-26m-45 37 29-17" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".8"/>
    <path d="m164 118 57-32 51 29-57 33-51-30Z" fill="#003bff"/><path d="M164 118v10l51 30v-10l-51-30Z" fill="#002ed0"/><path d="m215 148 57-33v10l-57 33v-10Z" fill="#5e83ff"/>
    <path d="M171 132v29m93-31v29m-50 1v30" stroke="#7391ef" strokeWidth="5" strokeLinecap="round"/>
    <path d="m193 111 15-9 17 10-15 9-17-10Z" fill="white"/><path d="m227 120 14-8 12 7-14 8-12-7Z" fill="#a8bdff"/>
    <path d="m118 155 21-12 21 12-21 12-21-12Z" fill="#b6c8ff"/><path d="M118 155v15l21 12v-15l-21-12Z" fill="#87a3ff"/><path d="m139 167 21-12v15l-21 12v-15Z" fill="#c9d5ff"/>
    <path d="M273 64v-8m-4 4h8 M305 112v-6m-3 3h6 M37 93v-6m-3 3h6" stroke="#83a0ff" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="244" cy="54" r="18" fill="white" stroke="#cad6ff"/><path d="m237 54 5 5 10-11" stroke="#003bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}
