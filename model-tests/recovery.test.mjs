import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemo, normalizeStore, readStore, saveStore, saveEventTemplate } from '../src/data.ts'
import { normalizeWorkspace } from '../src/workspace.ts'

test('повреждённый шаблон не сбрасывает сохранённые мероприятия и исправные шаблоны', () => {
  const demo = createDemo('2026-10-29'), own = { ...structuredClone(demo), id: 'own', title: 'Моё событие' }
  const valid = saveEventTemplate(demo, 'Рабочий шаблон')
  const source = { version: 3, firstLaunch: '2026-10-29', activeId: 'own', events: [demo, own], templates: [null, { id: 'broken', name: 'Ошибка', stages: [null], tasks: [null], expenses: [], team: [] }, valid] }
  const recovered = normalizeStore(source)
  assert.equal(recovered.activeId, 'own')
  assert.equal(recovered.events.length, 2)
  assert.equal(recovered.events[1].title, 'Моё событие')
  assert.equal(recovered.templates.length, 1)
  assert.deepEqual(recovered.templates[0], valid)
})

test('шаблоны с неверными суммами и неполными участниками не допускаются к созданию', () => {
  const demo = createDemo('2026-10-29'), valid = saveEventTemplate(demo, 'Рабочий шаблон')
  const badAmount = structuredClone(valid); badAmount.id = 'bad-amount'; badAmount.expenses[0].plan = -1
  const badMember = structuredClone(valid); badMember.id = 'bad-member'; badMember.team[0] = null
  const result = normalizeStore({ events: [demo], templates: [badAmount, badMember, valid] })
  assert.deepEqual(result.templates, [valid])
})

test('повторяющиеся идентификаторы восстанавливаются без потери записей и смешивания событий', () => {
  const demo = createDemo('2026-10-29'), other = structuredClone(demo)
  other.title = 'Другое событие'
  demo.tasks.push(structuredClone(demo.tasks[0]))
  demo.team.push(structuredClone(demo.team[0]))
  demo.expenses.push(structuredClone(demo.expenses[0]))
  const result = normalizeStore({ events: [demo, other] })
  assert.equal(new Set(result.events.map(item => item.id)).size, 2)
  for (const items of [result.events[0].tasks, result.events[0].team, result.events[0].expenses]) assert.equal(new Set(items.map(item => item.id)).size, items.length)
  assert.equal(result.events[0].tasks.length, 11)
  assert.equal(result.events[1].title, 'Другое событие')
})

test('исходная некорректная строка сохраняется перед восстановлением, при отказе записи не затирается', () => {
  const original = globalThis.localStorage
  const values = new Map([['soberi-demo-v1', '{broken but valuable']])
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  try {
    const restored = readStore()
    assert.equal(restored.events[0].id, 'demo')
    assert.equal(JSON.parse(values.get('soberi-demo-recovery-v1')).raw, '{broken but valuable')
    assert.equal(saveStore(restored), true)
    assert.equal(saveStore(readStore()), true)
    assert.equal(JSON.parse(values.get('soberi-demo-recovery-v1')).raw, '{broken but valuable', 'Повторная загрузка не должна затирать резерв здоровым примером')
    values.set('soberi-demo-v1', '{another broken value')
    globalThis.localStorage.setItem = () => { throw Error('quota') }
    const blocked = readStore()
    globalThis.localStorage.setItem = (key, value) => values.set(key, value)
    assert.equal(saveStore(blocked), false)
    assert.equal(values.get('soberi-demo-v1'), '{another broken value')
  } finally { globalThis.localStorage = original }
})

test('крайние повреждённые даты первого запуска не создают нечитаемую дату примера', () => {
  for (const firstLaunch of ['0001-01-01', '9999-12-31', 'not-a-date']) {
    assert.equal(normalizeStore({ firstLaunch }, '2026-10-29').events[0].date, '2026-11-01')
  }
})

test('JSON-объект вместо строкового значения не сбрасывает здоровые записи', () => {
  const demo = createDemo('2026-10-29'), template = saveEventTemplate(demo, 'Шаблон')
  template.tasks[0].kind = { toString: null }
  demo.expenses[0].category = { toString: null }
  delete demo.expenses[0].required
  const result = normalizeStore({ activeId: 'demo', events: [demo], templates: [template] })
  assert.equal(result.events[0].title, demo.title)
  assert.equal(result.templates.length, 0)
  assert.equal(result.events[0].expenses[0].category, 'Организация')
  const layout = normalizeWorkspace({ widgets: [{ id: 'team', visible: false, width: 1 }, { id: { toString: null } }] })
  assert.equal(layout.widgets[0].id, 'team')
  assert.equal(layout.widgets[0].visible, false)
})
