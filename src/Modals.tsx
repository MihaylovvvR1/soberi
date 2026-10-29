import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { addDays, expenseTotal, forecastUnknown, isDate, money, parseAmount, pastTemplateDeadlines, recordPayment, statuses, templatePastDeadlines } from './data'
import type { EntityId, EventData, EventTemplate, Expense, Member, NewEvent, Stage, Task, TaskStatus } from './data'
import { Icon } from './Icons'

export function Modal({ title, children, onClose, tourId }: { title: string; children: ReactNode; onClose: () => void; tourId?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!; dialog.showModal()
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = oldOverflow }
  }, [])
  return <dialog className="modal" ref={ref} data-tour={tourId} aria-labelledby="modal-title" onCancel={onClose} onClick={e => {
    if (e.target !== e.currentTarget) return
    const bounds = e.currentTarget.getBoundingClientRect()
    if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose()
  }}><div className="modal-heading"><div><span className="eyebrow">СОБЕРИ · РАБОЧЕЕ ПРОСТРАНСТВО</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Закрыть окно" onClick={onClose}><Icon name="close" /></button></div>{children}</dialog>
}
function Actions({ label, onCancel, children }: { label: string; onCancel: () => void; children?: ReactNode }) {
  return <div className="modal-actions">{children}<button className="button secondary" type="button" onClick={onCancel}>Отмена</button><button className="button primary" type="submit">{label}<Icon name="arrow" size={16} /></button></div>
}
function FieldError({ message }: { message?: string }) { return message ? <span className="field-error" role="alert">{message}</span> : null }
type Errors = Record<string, string>
const getText = (form: FormData, name: string) => String(form.get(name) ?? '').trim()

export function CreateEventForm({ defaultDate, today, templates, onSubmit, onCancel }: { defaultDate: string; today: string; templates: EventTemplate[]; onSubmit: (value: NewEvent) => string | void; onCancel: () => void }) {
  const [date, setDate] = useState(defaultDate)
  const [template, setTemplate] = useState('workshop')
  const [format, setFormat] = useState('Мастер-класс'), [type, setType] = useState('Образовательная студия'), [participantsText, setParticipantsText] = useState('30'), [limitText, setLimitText] = useState('20000')
  const [errors, setErrors] = useState<Errors>({})
  const selected = templates.find(item => item.id === template)
  const past = isDate(date) ? template === 'workshop' ? pastTemplateDeadlines(date, today) : selected ? templatePastDeadlines(selected, date, today) : 0 : 0
  function chooseTemplate(id: string) {
    setTemplate(id); setErrors({})
    const selected = templates.find(item => item.id === id)
    if (selected) { setDate(''); setFormat(selected.format); setType(selected.type); setParticipantsText(String(selected.participants)); setLimitText(String(selected.limit)) }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget), next: Errors = {}
    const title = getText(form, 'title'), format = getText(form, 'format'), participantsRaw = getText(form, 'participants'), participants = Number(participantsRaw), limit = parseAmount(getText(form, 'limit'))
    if (!title) next.title = 'Укажите название мероприятия.'
    if (!format) next.format = 'Укажите формат мероприятия.'
    if (!isDate(date) || date < '2020-01-01' || date > '2100-12-31') next.date = 'Выберите корректную дату с 2020 по 2100 год.'
    if (!/^\d+$/.test(participantsRaw) || !Number.isInteger(participants) || participants < 1 || participants > 100000) next.participants = 'Укажите целое число участников от 1 до 100 000.'
    if (limit.error) next.limit = limit.error
    setErrors(next)
    if (!Object.keys(next).length) { const error = onSubmit({ title, format, type: getText(form, 'type'), date, participants, limit: limit.value!, template }); if (error) setErrors({ template: error }) }
  }
  return <form onSubmit={submit} className="modal-form" noValidate>
    <p className="form-description">Создайте своё мероприятие. Задачи, расходы и команда будут храниться отдельно.</p>
    <label>Название мероприятия<input name="title" maxLength={90} placeholder="Например, день открытых дверей" autoFocus aria-invalid={!!errors.title} /><FieldError message={errors.title} /></label>
    <label>Формат мероприятия<input name="format" value={format} onChange={e => setFormat(e.target.value)} maxLength={60} placeholder="Мастер-класс, встреча, лекция…" aria-invalid={!!errors.format} /><FieldError message={errors.format} /></label>
    <label>Тип команды<select name="type" value={type} onChange={e => setType(e.target.value)}><option>Образовательная студия</option><option>Образовательный центр</option><option>Студенческая команда</option><option>Творческая студия</option></select></label>
    <div className="form-columns"><label>Дата мероприятия<input name="date" type="date" value={date} onChange={e => setDate(e.target.value)} aria-invalid={!!errors.date} /><FieldError message={errors.date} /></label><label>Ожидаемые участники<input aria-label="Ожидаемые участники" name="participants" inputMode="numeric" value={participantsText} onChange={e => setParticipantsText(e.target.value)} aria-invalid={!!errors.participants} /><FieldError message={errors.participants} /></label></div>
    <label>Бюджет, ₽<input aria-label="Бюджет, ₽" name="limit" inputMode="decimal" value={limitText} onChange={e => setLimitText(e.target.value)} aria-invalid={!!errors.limit} /><FieldError message={errors.limit} /></label>
    <label>Начальный план<select aria-label="Начальный план" value={template} onChange={e => chooseTemplate(e.target.value)}><option value="workshop">Шаблон «Мастер-класс» — 10 задач</option><option value="empty">Пустой план — без задач</option>{templates.length > 0 && <optgroup label="Мои шаблоны">{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}</select><FieldError message={errors.template} /></label>
    {selected && <div className="form-note"><Icon name="info" size={18} /><span>Выберите новую дату. Скопируются этапы, задачи, команда и плановые статьи. Выполнение, подтверждения, обязательства и оплаты сбросятся. Сроки сохранят смещение относительно даты события.</span></div>}
    {past > 0 && <div className="warning-banner" role="status"><Icon name="alert" size={18} /><div><strong>{past} рекомендованных сроков уже прошли</strong><p>{template === 'workshop' ? 'Шаблон рассчитан на подготовку за неделю. ' : ''}Измените дату мероприятия или пересмотрите сроки задач после создания. Прошедшие сроки не будут сдвинуты автоматически.</p></div></div>}
    {isDate(date) && date < today && <div className="warning-banner">Дата мероприятия уже прошла. Убедитесь, что выбрали её верно.</div>}
    <div className="form-note"><Icon name="info" size={18} /><span>{template === 'workshop' ? 'Сроки задач отсчитываются от даты мероприятия. Контроль брони помещения — за три дня.' : selected ? 'Сроки задач пересчитаются от новой даты.' : 'Вы добавите задачи и сроки самостоятельно.'} Команду можно изменить в обзоре.</span></div>
    <Actions label="Создать мероприятие" onCancel={onCancel} />
  </form>
}

export function TaskForm({ task, event, today, initialStageId, onSubmit, onCancel, onDelete }: { task?: Task; initialStageId?: string; event: EventData; today: string; onSubmit: (value: Task) => void; onCancel: () => void; onDelete?: () => void }) {
  const [kind, setKind] = useState<Task['kind']>(task?.kind ?? 'preparation')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'open')
  const [due, setDue] = useState(task?.due ?? event.date)
  const [errors, setErrors] = useState<Errors>({})
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget), next: Errors = {}
    const title = getText(form, 'title'), ownerId = getText(form, 'owner') || null, controlDate = kind === 'venue' ? getText(form, 'controlDate') : null, stageId = getText(form, 'stageId')
    if (!title) next.title = 'Укажите название задачи.'
    if (!isDate(due)) next.due = 'Выберите корректный срок выполнения.'
    if (ownerId && !event.team.some(member => member.id === ownerId)) next.owner = 'Выберите участника команды этого мероприятия.'
    if (!event.stages.some(stage => stage.id === stageId)) next.stageId = 'Выберите этап мероприятия.'
    if (kind === 'venue' && (!isDate(controlDate) || (isDate(due) && controlDate > due))) next.controlDate = 'Контрольная дата должна быть корректной и не позже срока задачи.'
    setErrors(next)
    if (!Object.keys(next).length) onSubmit({ ...task, id: task?.id ?? crypto.randomUUID(), stageId, title, note: getText(form, 'note'), due, status, ownerId, critical: form.has('critical'), kind, controlDate })
  }
  return <form className="modal-form" onSubmit={submit} noValidate>
    <label>Название задачи<input name="title" defaultValue={task?.title} maxLength={120} autoFocus aria-invalid={!!errors.title} /><FieldError message={errors.title} /></label>
    <label>Этап задачи<select name="stageId" aria-label="Этап задачи" defaultValue={task?.stageId ?? initialStageId ?? event.stages[0]?.id}>{event.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.title}</option>)}</select><FieldError message={errors.stageId} /></label>
    <label>Описание<textarea name="note" defaultValue={task?.note} maxLength={1000} rows={3} placeholder="Что нужно сделать и какой результат получить" /></label>
    <label data-tour="task-owner">Ответственный<select aria-label="Ответственный" name="owner" defaultValue={task?.ownerId ?? ''}><option value="">Не назначен</option>{event.team.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select><FieldError message={errors.owner} /></label>
    <div className="form-columns"><label>Срок выполнения<input name="due" type="date" value={due} onChange={e => setDue(e.target.value)} aria-invalid={!!errors.due} /><FieldError message={errors.due} /></label><label data-tour="task-status">Статус<select aria-label="Статус" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    <label className="checkbox-label"><input name="critical" type="checkbox" defaultChecked={task?.critical} />Критическая задача</label>
    <label>Назначение задачи<select aria-label="Назначение задачи" value={kind} onChange={e => setKind(e.target.value as Task['kind'])}><option value="preparation">Подготовка мероприятия</option><option value="venue">Подтверждение помещения</option></select></label>
    {kind === 'venue' && <label>Контрольный срок брони<input name="controlDate" type="date" defaultValue={task?.controlDate ?? addDays(event.date, -3)} aria-invalid={!!errors.controlDate} /><FieldError message={errors.controlDate} /><span className="field-hint">С этой даты «Антипровал» напоминает о неподтверждённом помещении. Отметьте задачу выполненной после получения подтверждения.</span></label>}
    {isDate(due) && due < today && status !== 'done' && <div className="warning-banner"><Icon name="alert" size={18} />Срок уже прошёл. Укажите реальную дату или отметьте фактически выполненную задачу.</div>}
    {isDate(due) && due > event.date && <div className="warning-banner">Срок позже даты мероприятия. Проверьте, успеете ли вы подготовиться.</div>}
    <Actions label="Сохранить изменения" onCancel={onCancel}>{onDelete && <button type="button" className="delete-button" onClick={onDelete}>Удалить задачу</button>}</Actions>
  </form>
}

export function ExpenseForm({ expense, nextId, onSubmit, onCancel }: { expense?: Expense; nextId: EntityId; onSubmit: (value: Expense) => void; onCancel: () => void }) {
  const [amounts, setAmounts] = useState({ plan: expense?.plan?.toString() ?? '', paid: String(expense?.paid ?? 0), agreed: expense?.agreed === null ? '' : String(expense?.agreed ?? 0), expected: expense?.expected === null ? '' : String(expense?.expected ?? 0) })
  const [errors, setErrors] = useState<Errors>({})
  const fields = [{ key: 'plan', label: 'План, ₽' }, { key: 'paid', label: 'Уже оплачено, ₽' }, { key: 'agreed', label: 'Остаток подтверждённых обязательств, ₽' }, { key: 'expected', label: 'Дополнительные ожидаемые расходы, ₽' }] as const
  const parsed = Object.fromEntries(fields.map(({ key }) => [key, parseAmount(amounts[key], key !== 'paid')])) as Record<keyof typeof amounts, ReturnType<typeof parseAmount>>
  const preview = (parsed.paid.value ?? 0) + (parsed.agreed.value ?? 0) + (parsed.expected.value ?? 0)
  const unknown = parsed.agreed.value === null || parsed.expected.value === null
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget), next: Errors = {}, title = getText(form, 'title')
    if (!title) next.title = 'Укажите название статьи расходов.'
    for (const { key } of fields) if (parsed[key].error) next[key] = parsed[key].error!
    setErrors(next)
    if (!Object.keys(next).length) onSubmit({ id: expense?.id ?? nextId, title, category: getText(form, 'category'), plan: parsed.plan.value, paid: parsed.paid.value!, agreed: parsed.agreed.value, expected: parsed.expected.value, required: form.has('required') })
  }
  return <form className="modal-form" onSubmit={submit} noValidate>
    <p className="form-description">План хранится отдельно. В ожидаемый итог входят только оплаты, остаток обязательств и дополнительные расходы.</p>
    <label>Название статьи<input name="title" maxLength={90} defaultValue={expense?.title} autoFocus aria-invalid={!!errors.title} /><FieldError message={errors.title} /></label>
    <label>Категория<select name="category" defaultValue={expense?.category ?? 'Организация'}>{['Площадка', 'Команда', 'Материалы', 'Оборудование', 'Гостеприимство', 'Полиграфия', 'Организация', 'Другое'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label className="checkbox-label"><input name="required" type="checkbox" defaultChecked={expense?.required} />Обязательная статья расходов</label>
    <div className="field-hint">Пустое поле — стоимость неизвестна. Введите 0, если точно знаете, что затрат нет. Оплаченное всегда указывается числом.</div>
    {fields.map(({ key, label }) => <label key={key}>{label}<input aria-label={label} name={key} inputMode="decimal" value={amounts[key]} placeholder={key === 'paid' ? '0' : 'Неизвестно'} onChange={e => setAmounts(previous => ({ ...previous, [key]: e.target.value }))} aria-invalid={!!errors[key]} /><FieldError message={errors[key]} /></label>)}
    <div className="expense-form-total"><span>{unknown ? 'Известная часть ожидаемого итога' : 'Ожидаемый итог по статье'}</span><strong>{Object.values(parsed).some(value => value.error) ? 'Проверьте суммы' : money(Math.round(preview * 100) / 100)}</strong></div>
    {expense && <div className="form-note"><Icon name="info" size={18} /><span>Для оплаты обязательства используйте «Отметить оплату» в бюджете. Сумма автоматически перейдёт из остатка в оплачено.</span></div>}
    <Actions label="Сохранить расходы" onCancel={onCancel} />
  </form>
}

export function PaymentForm({ expense, onSubmit, onCancel }: { expense: Expense; onSubmit: (amount: number) => string | void; onCancel: () => void }) {
  const [error, setError] = useState('')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const parsed = parseAmount(getText(new FormData(e.currentTarget), 'amount'))
    if (parsed.error) { setError(parsed.error); return }
    try { recordPayment(expense, parsed.value!); setError(onSubmit(parsed.value!) ?? '') } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось учесть оплату.') }
  }
  return <form className="modal-form" onSubmit={submit} noValidate>
    <h3 className="payment-title">{expense.title}</h3><p className="form-description">Остаток обязательств: <strong>{money(expense.agreed)}</strong>. Оплачено: {money(expense.paid)}.</p>
    <label>Сумма оплаты, ₽<input aria-label="Сумма оплаты, ₽" name="amount" inputMode="decimal" defaultValue={expense.agreed ?? ''} autoFocus aria-invalid={!!error} /><FieldError message={error} /></label>
    <div className="form-note"><Icon name="return" size={19} /><span>Сумма перейдёт из остатка обязательств в оплачено. {forecastUnknown(expense) ? 'Известная часть ожидаемого итога' : 'Ожидаемый итог'} {money(expenseTotal(expense))} от этого не изменится.</span></div>
    <Actions label="Учесть оплату" onCancel={onCancel} />
  </form>
}

export function TeamForm({ event, onSubmit, onCancel }: { event: EventData; onSubmit: (members: Member[]) => void; onCancel: () => void }) {
  const [members, setMembers] = useState(event.team.map(member => ({ ...member })))
  const [error, setError] = useState('')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const clean = members.map(member => ({ ...member, name: member.name.trim(), role: member.role.trim() }))
    if (clean.some(member => !member.name || !member.role)) { setError('Укажите имя и роль каждого участника.'); return }
    if (new Set(clean.map(member => member.name.toLocaleLowerCase('ru'))).size !== clean.length) { setError('Имена участников должны различаться, чтобы назначения были понятны.'); return }
    onSubmit(clean)
  }
  return <form className="modal-form" onSubmit={submit} noValidate><p className="form-description">Команда мероприятия «{event.title}». Изменение имени обновит назначения в его задачах.</p>{members.map((member, index) => <div className="team-editor-row" key={member.id}><label>Имя участника {index + 1}<input value={member.name} maxLength={60} onChange={e => setMembers(previous => previous.map(item => item.id === member.id ? { ...item, name: e.target.value } : item))} /></label><label>Роль участника {index + 1}<input value={member.role} maxLength={90} onChange={e => setMembers(previous => previous.map(item => item.id === member.id ? { ...item, role: e.target.value } : item))} /></label></div>)}<button type="button" className="text-button" onClick={() => setMembers(previous => [...previous, { id: `${event.id}-${crypto.randomUUID()}`, name: '', role: 'Участник команды' }])}><Icon name="plus" size={16} />Добавить участника</button><FieldError message={error} /><Actions label="Сохранить команду" onCancel={onCancel} /></form>
}

export function ConfirmForm({ children, label, onConfirm, onCancel }: { children: ReactNode; label: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="modal-form"><div className="form-description">{children}</div><div className="modal-actions"><button className="button secondary" onClick={onCancel}>Отмена</button><button className="button danger-button" onClick={onConfirm}>{label}</button></div></div>
}

export function StageForm({ stage, onSubmit, onCancel }: { stage?: Stage; onSubmit: (value: Stage) => void; onCancel: () => void }) {
  const [error, setError] = useState('')
  return <form className="modal-form" noValidate onSubmit={e => { e.preventDefault(); const title = getText(new FormData(e.currentTarget), 'title'); if (!title) { setError('Укажите название этапа.'); return } onSubmit({ id: stage?.id ?? crypto.randomUUID(), title, collapsed: stage?.collapsed ?? false }) }}>
    <label>Название этапа<input name="title" defaultValue={stage?.title} maxLength={70} autoFocus aria-invalid={!!error} /><FieldError message={error} /></label><Actions label="Сохранить этап" onCancel={onCancel} />
  </form>
}
export function TemplateForm({ event, onSubmit, onCancel }: { event: EventData; onSubmit: (name: string) => string | void; onCancel: () => void }) {
  const [error, setError] = useState('')
  return <form className="modal-form" noValidate onSubmit={e => { e.preventDefault(); const name = getText(new FormData(e.currentTarget), 'name'); if (!name) { setError('Укажите название шаблона.'); return } setError(onSubmit(name) ?? '') }}>
    <p className="form-description">Сохраните этапы и задачи мероприятия «{event.title}», команду и плановые статьи. Расположение блоков обзора в шаблон не входит.</p>
    <label>Название шаблона<input name="name" defaultValue={`${event.title} — шаблон`} maxLength={100} autoFocus aria-invalid={!!error} /><FieldError message={error} /></label>
    <div className="form-note"><Icon name="info" size={18} /><span>При создании из шаблона вы укажете новую дату. Выполненные статусы, подтверждения и фактические оплаты не переносятся.</span></div><Actions label="Сохранить шаблон" onCancel={onCancel} />
  </form>
}
