import test from 'node:test'
import assert from 'node:assert/strict'
import * as model from '../src/data.ts'

const base = '2026-10-28'
test('пример содержит 8/10 задач, отдельную команду и бюджет 22000', () => {
  const event = model.createDemo(base)
  assert.equal(event.date, '2026-10-31')
  assert.equal(event.tasks.filter(task => task.status === 'done').length, 8)
  assert.equal(event.team.length, 3)
  const sum = model.totals(event.expenses)
  assert.deepEqual([sum.paid, sum.agreed, sum.expected, sum.total], [8000, 9000, 5000, 22000])
  assert.equal(sum.plan, 20000)
})

test('риски зависят от контрольного срока, назначения, выполнения и бюджета', () => {
  const event = model.createDemo(base)
  assert.deepEqual(model.collectRisks(event, base).map(risk => risk.kind).sort(), ['over_budget', 'unassigned', 'venue'])
  const equipment = event.tasks.find(task => task.title === 'Проверить оборудование')
  equipment.ownerId = event.team[2].id
  assert.equal(equipment.status, 'open')
  assert.equal(model.collectRisks(event, base).some(risk => risk.kind === 'unassigned'), false)
  const venue = event.tasks.find(task => task.kind === 'venue')
  assert.equal(model.collectRisks(event, '2026-10-27').some(risk => risk.kind === 'venue'), false)
  assert.equal(model.collectRisks(event, '2026-10-30').some(risk => risk.kind === 'overdue'), true)
  venue.status = 'done'
  assert.equal(model.collectRisks(event, base).some(risk => risk.kind === 'venue'), false)
})

test('оплата переносит обязательство, сохраняя ожидаемый итог и план', () => {
  const event = model.createDemo(base)
  const expense = event.expenses[0]
  const paid = model.recordPayment(expense, 1500.25)
  assert.equal(paid.paid, 4500.25)
  assert.equal(paid.agreed, 2499.75)
  assert.equal(paid.plan, expense.plan)
  assert.equal(model.totals([paid]).total, model.totals([expense]).total)
  assert.throws(() => model.recordPayment(expense, 4000.01), /остаток/)
  assert.throws(() => model.recordPayment(expense, -1), /больше нуля/)
  assert.throws(() => model.recordPayment(expense, NaN), /число/)
})

test('неизвестная обязательная стоимость отличается от нуля', () => {
  const event = model.createDemo(base)
  event.expenses = [{ id: 1, title: 'Проектор', category: 'Оборудование', plan: null, paid: 0, agreed: null, expected: 0, required: true }]
  assert.equal(model.collectRisks(event, base).some(risk => risk.kind === 'unknown_cost'), true)
  assert.equal(model.totals(event.expenses).unknownCount, 1)
  event.expenses[0].plan = 0
  event.expenses[0].agreed = 0
  assert.equal(model.collectRisks(event, base).some(risk => risk.kind === 'unknown_cost'), false)
  assert.equal(model.totals(event.expenses).unknownCount, 0)
})

test('числа проверяются без превращения пустого или неверного значения в ноль', () => {
  assert.equal(model.parseAmount('', true).value, null)
  assert.equal(model.parseAmount('0', true).value, 0)
  assert.equal(model.parseAmount('1 250,50').value, 1250.5)
  for (const value of ['-1', 'abc', 'Infinity', '1e4', '12.345', '100000001']) assert.ok(model.parseAmount(value).error)
  assert.ok(model.parseAmount('').error)
})

test('новые мероприятия изолированы, пустой план пуст, шаблон предупреждает о прошедших сроках', () => {
  const input = { title: 'Встреча', format: 'Встреча', type: 'Студенческая команда', date: '2026-10-31', participants: 12, limit: 5000, template: 'empty' }
  const a = model.createEvent(input, 'a')
  const b = model.createEvent({ ...input, template: 'workshop' }, 'b')
  assert.equal(a.tasks.length, 0)
  assert.equal(b.tasks.length, 10)
  assert.notEqual(a.team[0].id, b.team[0].id)
  a.team[0].name = 'Ольга'
  assert.notEqual(b.team[0].name, 'Ольга')
  assert.equal(model.pastTemplateDeadlines(input.date, base), 7)
})

test('миграция прежних данных сохраняет статусы, суммы и назначение в пределах команды', () => {
  const raw = { firstLaunch: base, activeId: 'old', events: [{ id: 'old', title: 'Старое мероприятие', type: 'Студия', date: '2026-11-10', participants: 20, limit: 10000, tasks: [{ id: 9, title: 'Подтвердить помещение', note: 'Бронь', done: false, owner: 'Администратор', due: '2026-11-08', critical: true }], expenses: [{ id: 1, title: 'Зал', category: 'Площадка', paid: 1000, agreed: 2000, expected: 500 }] }] }
  const migrated = model.normalizeStore(raw, base)
  const event = migrated.events[0]
  assert.equal(event.tasks[0].status, 'open')
  assert.equal(event.tasks[0].ownerId, event.team[0].id)
  assert.equal(event.tasks[0].kind, 'venue')
  assert.equal(model.totals(event.expenses).total, 3500)
})

test('восстановление возвращает исходную дату примера и не удаляет другие мероприятия', () => {
  const demo = model.createDemo(base)
  const other = model.createEvent({ title: 'Свой проект', format: 'Встреча', type: 'Команда', date: '2026-11-20', participants: 5, limit: 0, template: 'empty' }, 'other')
  demo.tasks = []
  const restored = model.restoreDemo({ version: 2, firstLaunch: base, activeId: 'other', events: [demo, other] })
  assert.equal(restored.events.find(event => event.id === 'other'), other)
  assert.equal(restored.events.find(event => event.id === 'demo').date, '2026-10-31')
  assert.equal(restored.events.find(event => event.id === 'demo').tasks.length, 10)
  assert.equal(restored.activeId, 'demo')
})

test('сроки шаблона у нижней границы дат валидны и не меняются при восстановлении состояния', () => {
  const event = model.createEvent({ title: 'История', format: 'Мастер-класс', type: 'Команда', date: '2020-01-01', participants: 5, limit: 0, template: 'workshop' }, 'boundary')
  assert.ok(event.tasks.every(task => model.isDate(task.due)))
  const store = { version: 2, firstLaunch: base, activeId: event.id, events: [event] }
  assert.deepEqual(model.normalizeStore(JSON.parse(JSON.stringify(store)), base).events[0].tasks, event.tasks)
})

test('неизвестный план не меняет полноту известного денежного прогноза', () => {
  const expense = { id: 1, title: 'Материалы', category: 'Материалы', plan: null, paid: 10, agreed: 20, expected: 30, required: false }
  assert.equal(model.totals([expense]).total, 60)
  assert.equal(model.totals([expense]).unknownCount, 0)
})
