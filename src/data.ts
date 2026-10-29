export type Section = 'overview' | 'tasks' | 'budget'
export type TaskStatus = 'open' | 'doing' | 'done'
export const statuses: Record<TaskStatus, string> = { open: 'Не начато', doing: 'В работе', done: 'Выполнено' }
export interface Member { id: string; name: string; role: string }
export type EntityId = string | number
export interface Stage { id: string; title: string; collapsed: boolean }
export interface Task {
  id: EntityId; stageId: string; dependencies?: EntityId[]; title: string; note: string; due: string; status: TaskStatus
  ownerId: string | null; critical: boolean; kind: 'preparation' | 'venue'; controlDate: string | null
}
export interface Expense {
  id: EntityId; title: string; category: string; plan: number | null
  paid: number; agreed: number | null; expected: number | null; required: boolean
}
export interface EventData {
  id: string; title: string; type: string; format: string; date: string
  participants: number; limit: number; team: Member[]; stages: Stage[]; tasks: Task[]; expenses: Expense[]
}
export interface EventTemplate {
  id: string; name: string; format: string; type: string; participants: number; limit: number
  stages: Pick<Stage, 'id' | 'title'>[]; team: Member[]
  tasks: (Omit<Task, 'due' | 'controlDate' | 'status'> & { dueOffset: number; controlOffset: number | null })[]
  expenses: Pick<Expense, 'id' | 'title' | 'category' | 'plan' | 'required'>[]
}
export interface NewEvent { title: string; type: string; format: string; date: string; participants: number; limit: number; template: string }
export interface Store { version: 3; events: EventData[]; templates: EventTemplate[]; activeId: string; firstLaunch: string }
export interface Risk {
  id: string; kind: 'venue' | 'unassigned' | 'overdue' | 'over_budget' | 'unknown_cost'
  title: string; reason: string; action: string; severity: 'critical' | 'warning'
  owner: string | null; due: string | null
  target: { type: 'task' | 'expense'; id: EntityId } | { type: 'budget' }
}
const storageKey = 'soberi-demo-v1'
const maxAmount = 100_000_000
export function dateKey(date: Date) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '0001-01-01' && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
}
export function addDays(date: string, count: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + count); return value.toISOString().slice(0, 10) }
export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', ...(options ?? { day: 'numeric', month: 'long' }) }).format(new Date(`${date}T12:00:00Z`)) }
export function money(value: number | null) { return value === null ? 'Неизвестно' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value).replaceAll('\u00a0', ' ') + ' ₽' }
export function daysUntil(date: string, today = dateKey(new Date())) { return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) }
export function dayWord(days: number) { const n = Math.abs(days); return n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней' }
const cents = (value: number) => Math.round(value * 100)
const rubles = (value: number) => value / 100
export function parseAmount(raw: string, nullable = false): { value: number | null; error: string | null } {
  const value = raw.trim().replace(/[\s\u00a0]/g, '')
  if (!value) return nullable ? { value: null, error: null } : { value: null, error: 'Укажите сумму. Если расходов нет, введите 0.' }
  if (value.startsWith('-')) return { value: null, error: 'Сумма не может быть отрицательной.' }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return { value: null, error: 'Введите число с точностью до двух знаков после запятой.' }
  const amount = Number(value.replace(',', '.'))
  if (!Number.isFinite(amount) || amount > maxAmount) return { value: null, error: 'Сумма должна быть не больше 100 000 000 ₽.' }
  return { value: rubles(cents(amount)), error: null }
}
export function validAmount(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maxAmount && Math.abs(value * 100 - cents(value)) < .00001 }
export function expenseUnknown(expense: Expense) { return expense.plan === null || expense.agreed === null || expense.expected === null }
export function forecastUnknown(expense: Expense) { return expense.agreed === null || expense.expected === null }
export function expenseTotal(expense: Expense) { return rubles(cents(expense.paid) + cents(expense.agreed ?? 0) + cents(expense.expected ?? 0)) }
export function totals(expenses: Expense[]) {
  const sum = (key: 'paid' | 'agreed' | 'expected' | 'plan') => rubles(expenses.reduce((total, item) => total + cents(item[key] ?? 0), 0))
  return { paid: sum('paid'), agreed: sum('agreed'), expected: sum('expected'), plan: sum('plan'), total: rubles(expenses.reduce((total, item) => total + cents(expenseTotal(item)), 0)), unknownCount: expenses.filter(forecastUnknown).length, unknownPlanCount: expenses.filter(item => item.plan === null).length }
}
export function recordPayment(expense: Expense, amount: number): Expense {
  if (!Number.isFinite(amount)) throw new Error('Введите корректное число для суммы оплаты.')
  if (amount <= 0) throw new Error('Сумма оплаты должна быть больше нуля.')
  if (!validAmount(amount)) throw new Error('Укажите сумму с точностью до копеек, не больше 100 000 000 ₽.')
  if (expense.agreed === null) throw new Error('Сначала уточните остаток подтверждённых обязательств.')
  if (cents(amount) > cents(expense.agreed)) throw new Error('Сумма оплаты превышает остаток обязательств.')
  if (!validAmount(rubles(cents(expense.paid) + cents(amount)))) throw new Error('Итог оплаченного превышает допустимую сумму.')
  return { ...expense, paid: rubles(cents(expense.paid) + cents(amount)), agreed: rubles(cents(expense.agreed) - cents(amount)) }
}
export function memberName(event: EventData, id: string | null) { return event.team.find(member => member.id === id)?.name ?? 'Не назначен' }
export function makeTeam(eventId: string): Member[] { return [
  { id: `${eventId}-admin`, name: 'Администратор', role: 'Организация, участники и бюджет' },
  { id: `${eventId}-teacher`, name: 'Преподаватель', role: 'Программа и проведение занятия' },
  { id: `${eventId}-helper`, name: 'Помощник', role: 'Материалы и помощь на площадке' },
] }
const templateItems: [string, string, number | null, number][] = [
  ['Определить тему и формат', 'Согласовать тему, формат и длительность мастер-класса.', 1, -7],
  ['Составить программу мастер-класса', 'Подготовить программу с практической частью.', 1, -6],
  ['Согласовать преподавателя', 'Подтвердить участие, время и условия работы.', 0, -6],
  ['Рассчитать бюджет', 'Собрать статьи расходов и согласовать лимит.', 0, -5],
  ['Подготовить анонс', 'Составить текст и подготовить афишу.', 2, -5],
  ['Открыть запись участников', 'Подготовить список участников и способ записи.', 0, -4],
  ['Заказать материалы', 'Рассчитать материалы на ожидаемое число участников.', 2, -4],
  ['Отправить напоминания участникам', 'Сообщить время, адрес и что взять с собой.', 0, -3],
  ['Подтвердить помещение', 'Получить подтверждение бронирования площадки. Выполните задачу после подтверждения.', 0, -2],
  ['Проверить оборудование', 'Назначить ответственного, проверить проектор, звук, ноутбук и подключение.', null, -1],
]
export function defaultStages(eventId: string): Stage[] { return ['Помещение', 'Программа', 'Материалы', 'Оборудование', 'Команда', 'День мероприятия'].map((title, index) => ({ id: `${eventId}-stage-${index}`, title, collapsed: false })) }
export function makeTasks(date: string, team: Member[], demo = false, stages = defaultStages('plan')): Task[] {
  const groups = [1, 1, 4, 4, 4, 4, 2, 5, 0, 3]
  return templateItems.map(([title, note, owner, offset], index) => ({ id: demo ? index + 1 : crypto.randomUUID(), stageId: stages[groups[index]].id, title, note, due: addDays(date, offset), status: demo && index < 8 ? 'done' : demo && index === 8 ? 'doing' : 'open', ownerId: owner === null ? null : team[owner]?.id ?? null, critical: index > 7, kind: index === 8 ? 'venue' : 'preparation', controlDate: index === 8 ? addDays(date, -3) : null }))
}
export function pastTemplateDeadlines(date: string, today = dateKey(new Date())) { return templateItems.filter(item => addDays(date, item[3]) < today).length }
export function createEvent(input: NewEvent, id: string = crypto.randomUUID(), template?: EventTemplate): EventData {
  if (template) return eventFromTemplate(input, id, template)
  const team = makeTeam(id)
  const stages = input.template === 'workshop' ? defaultStages(id) : [{ id: `${id}-preparation`, title: 'Подготовка', collapsed: false }]
  return { id, title: input.title, type: input.type, format: input.format, date: input.date, participants: input.participants, limit: input.limit, team, stages, tasks: input.template === 'workshop' ? makeTasks(input.date, team, false, stages) : [], expenses: [] }
}
export function createDemo(firstLaunch: string): EventData {
  const date = addDays(firstLaunch, 3), team = makeTeam('demo')
  const stages = defaultStages('demo')
  return { id: 'demo', title: 'Открытый мастер-класс', type: 'Образовательная студия', format: 'Мастер-класс', date, participants: 30, limit: 20000, team, stages, tasks: makeTasks(date, team, true, stages), expenses: [
    { id: 1, title: 'Аренда помещения', category: 'Площадка', plan: 7000, paid: 3000, agreed: 4000, expected: 0, required: true },
    { id: 2, title: 'Работа преподавателя', category: 'Команда', plan: 8000, paid: 5000, agreed: 3000, expected: 0, required: true },
    { id: 3, title: 'Материалы для мастер-класса', category: 'Материалы', plan: 2000, paid: 0, agreed: 2000, expected: 0, required: true },
    { id: 4, title: 'Вода и кофе для участников', category: 'Гостеприимство', plan: 1500, paid: 0, agreed: 0, expected: 2500, required: false },
    { id: 5, title: 'Печать раздаточных материалов', category: 'Полиграфия', plan: 1000, paid: 0, agreed: 0, expected: 1500, required: false },
    { id: 6, title: 'Расходные материалы и доставка', category: 'Организация', plan: 500, paid: 0, agreed: 0, expected: 1000, required: false },
  ] }
}
export function collectRisks(event: EventData, today = dateKey(new Date())): Risk[] {
  const risks: Risk[] = []
  for (const task of event.tasks) {
    if (task.status === 'done') continue
    const owner = event.team.find(member => member.id === task.ownerId)?.name ?? null
    const target = { type: 'task' as const, id: task.id }
    if (task.kind === 'venue' && task.controlDate && today >= task.controlDate) risks.push({ id: `venue-${task.id}`, kind: 'venue', title: 'Помещение не подтверждено', reason: `Контрольный срок — ${formatDate(task.controlDate)}. Без подтверждения брони мероприятие может остаться без площадки.`, action: 'Подтвердить помещение', severity: 'critical', owner, due: task.controlDate, target })
    if (task.critical && !owner) risks.push({ id: `unassigned-${task.id}`, kind: 'unassigned', title: task.title === 'Проверить оборудование' ? 'За оборудование никто не отвечает' : `Нет ответственного: ${task.title}`, reason: 'Критическая задача осталась без исполнителя. Назначьте участника команды; выполнение отмечается отдельно.', action: 'Назначить ответственного', severity: 'critical', owner: null, due: task.due, target })
    if (task.critical && task.due < today) risks.push({ id: `overdue-${task.id}`, kind: 'overdue', title: `Просрочено: ${task.title}`, reason: `Задача не выполнена к ${formatDate(task.due)}. Проверьте результат и согласуйте реальный срок.`, action: 'Открыть задачу', severity: 'critical', owner, due: task.due, target })
  }
  const sum = totals(event.expenses)
  if (sum.total > event.limit) {
    const expense = [...event.expenses].sort((a, b) => (b.expected ?? 0) - (a.expected ?? 0) || expenseTotal(b) - expenseTotal(a))[0]
    risks.push({ id: 'over-budget', kind: 'over_budget', title: `Бюджет превышен на ${money(rubles(cents(sum.total) - cents(event.limit)))}`, reason: `${sum.unknownCount ? 'Уже известные' : 'Ожидаемые'} расходы ${money(sum.total)} при лимите ${money(event.limit)}. Пересмотрите статью «${expense?.title ?? 'Расходы'}».`, action: 'Пересмотреть расходы', severity: 'warning', owner: null, due: null, target: expense ? { type: 'expense', id: expense.id } : { type: 'budget' } })
  }
  for (const expense of event.expenses) if (expense.required && expenseUnknown(expense)) risks.push({ id: `unknown-${expense.id}`, kind: 'unknown_cost', title: `Неизвестна стоимость: ${expense.title}`, reason: 'Обязательная статья не полностью оценена. Уточните план, обязательства и ожидаемые расходы; ноль означает известное отсутствие затрат.', action: 'Уточнить стоимость', severity: 'critical', owner: null, due: null, target: { type: 'expense', id: expense.id } })
  return risks
}

type Row = Record<string, unknown>
const row = (value: unknown): Row => value && typeof value === 'object' ? value as Row : {}
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const validId = (value: unknown): value is EntityId => typeof value === 'string' ? !!value.trim() : typeof value === 'number' && Number.isFinite(value)
function uniqueRecords<T extends { id: EntityId }>(items: T[], prefix: string): T[] {
  const reserved = new Set(items.map(item => item.id)), used = new Set<EntityId>()
  return items.map((item, index) => {
    if (!used.has(item.id)) { used.add(item.id); return item }
    let id = `${prefix}-${index}`, suffix = 0
    while (reserved.has(id) || used.has(id)) id = `${prefix}-${index}-${++suffix}`
    used.add(id)
    return { ...item, id }
  })
}
export function normalizeStore(input: unknown, today = dateKey(new Date())): Store {
  const source = row(input)
  const firstLaunch = isDate(source.firstLaunch) && source.firstLaunch >= '0001-01-05' && source.firstLaunch <= '9999-12-28' ? source.firstLaunch : today
  const templates = normalizeTemplates(source.templates)
  if (!Array.isArray(source.events) || !source.events.length) return { version: 3, templates, firstLaunch, activeId: 'demo', events: [createDemo(firstLaunch)] }
  const events: EventData[] = uniqueRecords(source.events.map((raw, eventIndex) => {
    const item = row(raw), id = text(item.id, `event-${eventIndex}`), date = isDate(item.date) ? item.date : addDays(firstLaunch, 3)
    const team: Member[] = Array.isArray(item.team) && item.team.length ? uniqueRecords(item.team.map((rawMember, index) => { const member = row(rawMember); return { id: text(member.id, `${id}-member-${index}`), name: text(member.name, `Участник ${index + 1}`), role: text(member.role, 'Участник команды') } }), `${id}-member-recovered`) : makeTeam(id)
    const tasks: Task[] = Array.isArray(item.tasks) ? uniqueRecords(item.tasks.map((rawTask, index) => {
      const task = row(rawTask), title = text(task.title, `Задача ${index + 1}`)
      const venue = task.kind === 'venue' || (!task.kind && title === 'Подтвердить помещение')
      return { id: validId(task.id) ? task.id : index + 1, stageId: typeof task.stageId === 'string' ? task.stageId : '', ...(Array.isArray(task.dependencies) ? { dependencies: task.dependencies.filter(validId) } : {}), title, note: typeof task.note === 'string' ? task.note : '', due: isDate(task.due) ? task.due : date, status: task.status === 'done' || task.status === 'doing' || task.status === 'open' ? task.status : task.done === true ? 'done' : 'open', ownerId: team.find(member => member.id === task.ownerId || member.name === task.owner)?.id ?? null, critical: task.critical === true, kind: venue ? 'venue' : 'preparation', controlDate: venue ? (isDate(task.controlDate) ? task.controlDate : addDays(date, -3)) : null } as Task
    }), `${id}-task-recovered`) : []
    const expenses: Expense[] = Array.isArray(item.expenses) ? uniqueRecords(item.expenses.map((rawExpense, index) => {
      const expense = row(rawExpense)
      const paid = validAmount(expense.paid) ? expense.paid : 0
      const agreed = validAmount(expense.agreed) ? expense.agreed : null
      const expected = validAmount(expense.expected) ? expense.expected : null
      return { id: validId(expense.id) ? expense.id : index + 1, title: text(expense.title, `Расход ${index + 1}`), category: text(expense.category, 'Организация'), paid, agreed, expected, plan: 'plan' in expense ? validAmount(expense.plan) ? expense.plan : null : rubles(cents(paid) + cents(agreed ?? 0) + cents(expected ?? 0)), required: typeof expense.required === 'boolean' ? expense.required : typeof expense.category === 'string' && ['Площадка', 'Команда', 'Материалы'].includes(expense.category) }
    }), `${id}-expense-recovered`) : []
    const stages = Array.isArray(item.stages) ? uniqueRecords(item.stages.map((rawStage, index) => { const stage = row(rawStage); return { id: text(stage.id, `${id}-stage-${index}`), title: text(stage.title, 'Этап'), collapsed: stage.collapsed === true } }), `${id}-stage-recovered`) : undefined
    const plan = normalizePlan(id, stages, tasks)
    return { id, title: text(item.title, 'Мероприятие'), type: text(item.type, 'Команда'), format: text(item.format, 'Мастер-класс'), date, participants: typeof item.participants === 'number' && Number.isInteger(item.participants) && item.participants >= 1 && item.participants <= 100000 ? item.participants : 30, limit: validAmount(item.limit) ? item.limit : 20000, team, ...plan, expenses }
  }), 'event-recovered')
  return { version: 3, templates, firstLaunch, events, activeId: events.some(event => event.id === source.activeId) ? String(source.activeId) : events[0].id }
}
export function restoreDemo(store: Store): Store { const demo = createDemo(store.firstLaunch); return { ...store, activeId: 'demo', events: store.events.some(event => event.id === 'demo') ? store.events.map(event => event.id === 'demo' ? demo : event) : [demo, ...store.events] } }
let recoveryWriteBlocked = false
const comparable = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
function preserveSource(raw: string) {
  try {
    const key = 'soberi-demo-recovery-v1'
    const previous = localStorage.getItem(key)
    if (previous) { try { if (row(JSON.parse(previous)).raw === raw) return true } catch { /* Replace an unreadable recovery record. */ } }
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), raw }))
    return true
  } catch { return false }
}
export function readStore(): Store {
  let raw: string | null = null
  recoveryWriteBlocked = false
  try {
    raw = localStorage.getItem(storageKey)
    const parsed = JSON.parse(raw ?? 'null'), result = normalizeStore(parsed)
    if (raw && comparable(result) !== comparable(parsed)) recoveryWriteBlocked = !preserveSource(raw)
    return result
  } catch {
    if (raw) recoveryWriteBlocked = !preserveSource(raw)
    return normalizeStore(null)
  }
}
export function saveStore(store: Store) { if (recoveryWriteBlocked) return false; try { localStorage.setItem(storageKey, JSON.stringify(store)); return true } catch { return false } }

function normalizePlan(eventId: string, incoming: Stage[] | undefined, tasks: Task[]) {
  const stages = incoming ? [...incoming] : tasks.length ? defaultStages(eventId) : [{ id: `${eventId}-preparation`, title: 'Подготовка', collapsed: false }]
  let fallback: Stage | undefined
  const repaired = tasks.map(task => {
    if (stages.some(stage => stage.id === task.stageId)) return task
    if (!incoming) {
      const index = task.kind === 'venue' ? 0 : /оборудов/i.test(task.title) ? 3 : /материал/i.test(task.title) ? 2 : /програм|тем[ау]|формат/i.test(task.title) ? 1 : /напоминан/i.test(task.title) ? 5 : 4
      return { ...task, stageId: stages[index].id }
    }
    fallback ??= { id: `${eventId}-recovered-stage`, title: 'Без этапа', collapsed: false }
    return { ...task, stageId: fallback.id }
  })
  if (fallback) { const recovered = fallback; if (!stages.some(stage => stage.id === recovered.id)) stages.push(recovered) }
  return { stages, tasks: repaired }
}
export function reorderList<T extends { id: EntityId }>(items: T[], id: EntityId, targetId: EntityId, placement: 'before' | 'after' = 'before'): T[] {
  if (id === targetId || !items.some(item => item.id === id) || !items.some(item => item.id === targetId)) return items
  const item = items.find(item => item.id === id)!, rest = items.filter(item => item.id !== id)
  const index = rest.findIndex(item => item.id === targetId) + (placement === 'after' ? 1 : 0)
  return [...rest.slice(0, index), item, ...rest.slice(index)]
}
export function reorderStage(event: EventData, id: string, targetId: string, placement: 'before' | 'after' = 'before'): EventData { return { ...event, stages: reorderList(event.stages, id, targetId, placement) } }
export function reorderTask(event: EventData, id: EntityId, stageId: string, targetId: EntityId | null, placement: 'before' | 'after' = 'before'): EventData {
  const task = event.tasks.find(item => item.id === id)
  if (!task || !event.stages.some(stage => stage.id === stageId) || targetId === id) return event
  const rest = event.tasks.filter(item => item.id !== id)
  const targetIndex = targetId === null ? -1 : rest.findIndex(item => item.id === targetId && item.stageId === stageId)
  let index = targetIndex >= 0 ? targetIndex + (placement === 'after' ? 1 : 0) : rest.map(item => item.stageId === stageId).lastIndexOf(true) + 1
  if (targetIndex < 0 && index === 0) index = rest.length
  const moved = { ...task, stageId }
  return { ...event, tasks: [...rest.slice(0, index), moved, ...rest.slice(index)] }
}
export function removeStage(event: EventData, id: string): EventData {
  const removed = new Set(event.tasks.filter(task => task.stageId === id).map(task => task.id))
  return { ...event, stages: event.stages.filter(stage => stage.id !== id), tasks: event.tasks.filter(task => !removed.has(task.id)).map(task => task.dependencies?.some(id => removed.has(id)) ? { ...task, dependencies: task.dependencies.filter(id => !removed.has(id)) } : task) }
}
export function removeTask(event: EventData, id: EntityId): EventData {
  return { ...event, tasks: event.tasks.filter(task => task.id !== id).map(task => task.dependencies?.includes(id) ? { ...task, dependencies: task.dependencies.filter(dependency => dependency !== id) } : task) }
}
export function saveEventTemplate(event: EventData, name: string): EventTemplate {
  return { id: crypto.randomUUID(), name, format: event.format, type: event.type, participants: event.participants, limit: event.limit,
    stages: event.stages.map(({ id, title }) => ({ id, title })), team: event.team.map(member => ({ ...member })),
    tasks: event.tasks.map(({ due, controlDate, status: _status, ...task }) => ({ ...task, ...(task.dependencies ? { dependencies: [...task.dependencies] } : {}), dueOffset: daysUntil(due, event.date), controlOffset: controlDate ? daysUntil(controlDate, event.date) : null })),
    expenses: event.expenses.map(({ id, title, category, plan, required }) => ({ id, title, category, plan, required })) }
}
export function templatePastDeadlines(template: EventTemplate, date: string, today: string) { return template.tasks.filter(task => addDays(date, task.dueOffset) < today).length }
function eventFromTemplate(input: NewEvent, id: string, template: EventTemplate): EventData {
  const memberIds = new Map(template.team.map(member => [member.id, crypto.randomUUID()]))
  const stageIds = new Map(template.stages.map(stage => [stage.id, crypto.randomUUID()]))
  const taskIds = new Map<EntityId, string>(template.tasks.map(task => [task.id, crypto.randomUUID()]))
  const stages = template.stages.map(stage => ({ ...stage, id: stageIds.get(stage.id)!, collapsed: false }))
  const tasks: Task[] = template.tasks.map(({ dueOffset, controlOffset, ...task }) => ({ ...task, id: taskIds.get(task.id)!, stageId: stageIds.get(task.stageId)!, ownerId: task.ownerId ? memberIds.get(task.ownerId) ?? null : null, status: 'open', due: addDays(input.date, dueOffset), controlDate: controlOffset === null ? null : addDays(input.date, controlOffset), ...(task.dependencies ? { dependencies: task.dependencies.flatMap(id => taskIds.has(id) ? [taskIds.get(id)!] : []) } : {}) }))
  if (tasks.some(task => !isDate(task.due) || (task.controlDate !== null && !isDate(task.controlDate)))) throw new Error('Сроки шаблона выходят за допустимый диапазон дат. Выберите другую дату мероприятия.')
  return { id, title: input.title, format: input.format, type: input.type, participants: input.participants, limit: input.limit, date: input.date, stages, tasks,
    team: template.team.map(member => ({ ...member, id: memberIds.get(member.id)! })),
    expenses: template.expenses.map(expense => ({ ...expense, id: crypto.randomUUID(), paid: 0, agreed: 0, expected: expense.plan })) }
}
function normalizeTemplates(input: unknown): EventTemplate[] {
  if (!Array.isArray(input)) return []
  return input.flatMap(raw => {
    const item = row(raw)
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !Array.isArray(item.stages) || !Array.isArray(item.tasks) || !Array.isArray(item.team) || !Array.isArray(item.expenses)) return []
    const nonempty = (value: unknown) => typeof value === 'string' && !!value.trim()
    const offset = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 3652058
    const list = (value: unknown[]) => value.map(row)
    const unique = (items: Row[]) => items.every(item => validId(item.id)) && new Set(items.map(item => item.id)).size === items.length
    const stages = list(item.stages), team = list(item.team), tasks = list(item.tasks), expenses = list(item.expenses)
    if (!nonempty(item.id) || !nonempty(item.name) || !nonempty(item.format) || !nonempty(item.type) || !validAmount(item.limit) || typeof item.participants !== 'number' || !Number.isInteger(item.participants) || item.participants < 1 || item.participants > 100000) return []
    if (![stages, team, tasks, expenses].every(unique)) return []
    if (stages.some(stage => !nonempty(stage.id) || !nonempty(stage.title)) || team.some(member => !nonempty(member.id) || !nonempty(member.name) || typeof member.role !== 'string')) return []
    if (tasks.some(task => !nonempty(task.title) || typeof task.note !== 'string' || typeof task.critical !== 'boolean' || (task.kind !== 'venue' && task.kind !== 'preparation') || !offset(task.dueOffset) || (task.controlOffset !== null && !offset(task.controlOffset)) || !stages.some(stage => stage.id === task.stageId) || (task.ownerId !== null && !team.some(member => member.id === task.ownerId)) || (task.dependencies !== undefined && (!Array.isArray(task.dependencies) || !task.dependencies.every(id => tasks.some(item => item.id === id)))))) return []
    if (expenses.some(expense => !nonempty(expense.title) || !nonempty(expense.category) || typeof expense.required !== 'boolean' || (expense.plan !== null && !validAmount(expense.plan)))) return []
    const template = item as unknown as EventTemplate
    return [template]
  }).filter((template, index, items) => items.findIndex(item => item.id === template.id) === index)
}
