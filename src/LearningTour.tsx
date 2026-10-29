import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TourInstruction } from './onboarding'
import { placeTip } from './onboarding'
import { Icon } from './Icons'

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
const visible = (element: Element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
function findVisible(selector?: string): HTMLElement | null { return selector ? [...document.querySelectorAll<HTMLElement>(selector)].find(visible) ?? null : null }
interface Geometry { left: number; top: number; width: number; height: number; tipLeft: number; tipTop: number }
interface Props { instruction: TourInstruction; onNext: () => void; onBack: () => void; onExit: () => void; onRetry: () => void }

export function LearningTour({ instruction, onNext, onBack, onExit, onRetry }: Props) {
  const layer = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<Element>(document.body)
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [missing, setMissing] = useState(false)
  const callbacks = useRef({ onExit }); callbacks.current = { onExit }
  const supportsPopover = 'showPopover' in HTMLElement.prototype

  useLayoutEffect(() => {
    if (supportsPopover && layer.current && !layer.current.matches(':popover-open')) layer.current.showPopover()
  }, [host, supportsPopover])

  useEffect(() => {
    document.body.classList.toggle('tour-form-active', !!instruction.form)
    let frame = 0, missingTimer = 0, first = true, currentTarget: HTMLElement | null = null
    setMissing(false)
    const observer = new ResizeObserver(() => schedule())
    function measure() {
      const modal = document.querySelector<HTMLDialogElement>('dialog[open]')
      const candidate = findVisible(instruction.target)
      const target = modal && candidate && !modal.contains(candidate) ? null : candidate
      if (!target) {
        const recoveryHost = modal ?? document.body
        setHost(previous => previous === recoveryHost ? previous : recoveryHost)
        setGeometry(null)
        if (!missingTimer) missingTimer = window.setTimeout(() => setMissing(true), 1200)
        return
      }
      if (missingTimer) { clearTimeout(missingTimer); missingTimer = 0 }
      setMissing(false)
      const nextHost = target.closest('dialog[open]') ?? document.body
      setHost(previous => previous === nextHost ? previous : nextHost)
      if (currentTarget !== target) { if (currentTarget) observer.unobserve(currentTarget); observer.observe(target); currentTarget = target }
      const initialRect = target.getBoundingClientRect()
      if (first || initialRect.bottom < 0 || initialRect.top > innerHeight) {
        first = false
        if (!instruction.form) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
        schedule()
      }
      const viewport = window.visualViewport
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight
      const offsetTop = viewport?.offsetTop ?? 0, offsetLeft = viewport?.offsetLeft ?? 0
      document.body.dataset.tourCompact = String(height < 600)
      document.body.style.setProperty('--tour-viewport-height', `${height}px`)
      const size = { width: card.current?.offsetWidth ?? Math.min(340, width - 24), height: card.current?.offsetHeight ?? 230 }
      document.body.style.setProperty('--tour-tip-height', `${size.height}px`)
      const rect = target.getBoundingClientRect()
      const left = Math.min(offsetLeft + width - 4, Math.max(offsetLeft + 4, rect.left - 5)), top = Math.min(offsetTop + height - 4, Math.max(offsetTop + 4, rect.top - 5))
      const right = Math.min(offsetLeft + width - 4, rect.right + 5), bottom = Math.min(offsetTop + height - 4, rect.bottom + 5)
      const box = { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
      const point = instruction.form && width < 1280 ? { left: (width - size.width) / 2, top: 12 } : placeTip({ ...box, left: left - offsetLeft, top: top - offsetTop }, size, { width, height })
      const next = { ...box, tipLeft: point.left + offsetLeft, tipTop: point.top + offsetTop }
      setGeometry(previous => previous && Object.keys(next).every(key => Math.abs(previous[key as keyof Geometry] - next[key as keyof Geometry]) < .5) ? previous : next)
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const mutations = new MutationObserver(records => { if (records.some(record => record.target !== document.body && !layer.current?.contains(record.target))) schedule() })
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'style', 'class'] })
    if (card.current) observer.observe(card.current)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame); clearTimeout(missingTimer); observer.disconnect(); mutations.disconnect()
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule)
      document.body.classList.remove('tour-form-active')
      delete document.body.dataset.tourCompact
      document.body.style.removeProperty('--tour-tip-height'); document.body.style.removeProperty('--tour-viewport-height')
    }
  }, [instruction.key, instruction.target, instruction.form, host])

  const found = geometry !== null
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = findVisible(instruction.focus)
      if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center', behavior: 'instant' }) }
      else card.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [instruction.key, instruction.focus, host, found])

  useEffect(() => {
    function allowed() { return findVisible(instruction.interactive) }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (document.activeElement instanceof HTMLSelectElement && document.activeElement.matches(':open')) return
        if (document.querySelector('.drag-handle[aria-pressed="true"]')) return
        event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onExit(); return
      }
      if (event.key !== 'Tab') return
      const area = allowed()
      const elements = [...new Set([...(area ? [area, ...area.querySelectorAll<HTMLElement>(focusable)] : []), ...card.current?.querySelectorAll<HTMLElement>(focusable) ?? []])].filter(element => element.matches(focusable) && visible(element))
      if (!elements.length) return
      const current = elements.indexOf(document.activeElement as HTMLElement)
      const index = current < 0 ? event.shiftKey ? elements.length - 1 : 0 : (current + (event.shiftKey ? -1 : 1) + elements.length) % elements.length
      event.preventDefault(); elements[index].focus()
    }
    function focusin(event: FocusEvent) {
      const target = event.target as Node, area = allowed()
      if (card.current && !card.current.contains(target) && !area?.contains(target)) card.current.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin, true)
    return () => { document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true) }
  }, [instruction.key, instruction.interactive, host])

  const width = innerWidth, height = innerHeight
  const hole = geometry ?? { left: 0, top: 0, width: 0, height: 0 }
  const right = hole.left + hole.width, bottom = hole.top + hole.height
  const position = geometry ? { left: geometry.tipLeft, top: geometry.tipTop } : { left: Math.max(12, (width - Math.min(340, width - 24)) / 2), top: Math.max(12, height / 2 - 120) }
  return createPortal(<div ref={layer} className="tour-layer" popover={supportsPopover ? 'manual' : undefined}>
    <svg className="tour-shading" aria-hidden="true" width="100%" height="100%"><defs><mask id="tour-spotlight-mask"><rect width="100%" height="100%" fill="white" /><rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="10" fill="black" /></mask></defs><rect width="100%" height="100%" fill="#050a16" fillOpacity=".68" mask="url(#tour-spotlight-mask)" /></svg>
    <div className="tour-blocker" style={{ inset: `0 0 auto 0`, height: hole.top }} />
    <div className="tour-blocker" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
    <div className="tour-blocker" style={{ top: hole.top, left: right, right: 0, height: hole.height }} />
    <div className="tour-blocker" style={{ top: bottom, bottom: 0, left: 0, right: 0 }} />
    {geometry && <div className="tour-spotlight" aria-hidden="true" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />}
    <div ref={card} className="tour-tip" role="dialog" aria-label="Обучение СОБЕРИ" aria-describedby="tour-description" data-tour-step={instruction.index + 1} style={position}>
      <div className="tour-tip-top"><span>УЧЕБНЫЙ ПРИМЕР</span><button className="tour-skip" onClick={onExit}>Пропустить<Icon name="close" size={14} /></button></div>
      <div className="tour-progress"><span>Шаг {instruction.index + 1} из 7</span><span>{instruction.practical ? 'Попробуй сам' : 'Знакомство'}</span></div>
      <div className="tour-progress-track" aria-hidden="true"><span style={{ width: `${(instruction.index + 1) / 7 * 100}%` }} /></div>
      <h2 tabIndex={-1}>{missing ? 'Элемент сейчас недоступен' : instruction.title}</h2>
      <p id="tour-description" aria-live="polite">{missing ? 'Можно повторить показ или пропустить этот шаг. Твои мероприятия останутся без изменений.' : instruction.body}</p>
      <div className="tour-tip-actions"><button className="button secondary small" disabled={instruction.index === 0} onClick={onBack}>Назад</button>{missing ? <div className="tour-recovery"><button className="text-button" onClick={onRetry}>Повторить показ</button><button className="button primary small" onClick={onNext}>Пропустить этот шаг</button></div> : instruction.practical ? <span className="tour-wait"><Icon name="info" size={15} />Выполни действие в подсвеченной области</span> : <button className="button primary small" onClick={onNext}>{instruction.index === 6 ? 'Завершить обучение' : 'Далее'}<Icon name="arrow" size={15} /></button>}</div>
    </div>
  </div>, host)
}
