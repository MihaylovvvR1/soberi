import test from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.ts'

test('этапы мигрируют без потери задач, дат, статусов и назначений', () => {
  const source = data.createDemo('2026-10-28')
  const legacy = JSON.parse(JSON.stringify(source)); delete legacy.stages
  legacy.tasks.forEach(task => delete task.stageId)
  const normalized = data.normalizeStore({ firstLaunch: '2026-10-28', activeId: 'demo', events: [legacy] })
  assert.ok(normalized.events[0].stages.length > 0)
  for (const task of normalized.events[0].tasks) {
    assert.ok(normalized.events[0].stages.some(stage => stage.id === task.stageId))
    const old = source.tasks.find(item => item.id === task.id)
    assert.deepEqual([task.due, task.ownerId, task.status], [old.due, old.ownerId, old.status])
  }
})

test('перестановки этапов и задач меняют только визуальный порядок и выбранный этап', () => {
  const event = data.createDemo('2026-10-28')
  const before = structuredClone(event)
  const movedStage = data.reorderStage(event, event.stages[0].id, event.stages.at(-1).id, 'after')
  assert.equal(movedStage.stages.at(-1).id, event.stages[0].id)
  assert.deepEqual(movedStage.tasks, event.tasks)
  const task = event.tasks[0]; task.dependencies = [event.tasks[1].id]
  const movedTask = data.reorderTask(event, task.id, event.stages.at(-1).id, null)
  const moved = movedTask.tasks.find(item => item.id === task.id)
  assert.equal(moved.stageId, event.stages.at(-1).id)
  assert.deepEqual({ ...moved, stageId: task.stageId }, task)
  assert.deepEqual(event.stages, before.stages)
})

test('удаление этапа затрагивает только его задачи', () => {
  const event = data.createDemo('2026-10-28'), stage = event.stages[0]
  const removed = data.removeStage(event, stage.id)
  assert.ok(!removed.stages.some(item => item.id === stage.id))
  assert.ok(!removed.tasks.some(task => task.stageId === stage.id))
  assert.deepEqual(removed.tasks, event.tasks.filter(task => task.stageId !== stage.id))
})

test('удаление отдельной задачи убирает только зависимости от неё', () => {
  const event = data.createDemo('2026-10-28')
  event.tasks[2].dependencies = [event.tasks[0].id, event.tasks[1].id]
  const result = data.removeTask(event, event.tasks[0].id)
  assert.deepEqual(result.tasks.find(task => task.id === event.tasks[2].id).dependencies, [event.tasks[1].id])
  assert.deepEqual(event.tasks[2].dependencies, [event.tasks[0].id, event.tasks[1].id])
})

test('собственный шаблон создаёт независимую структуру с новыми ID, датами и чистыми фактами', () => {
  const source = data.createDemo('2026-10-28')
  source.tasks[0].dependencies = [source.tasks[1].id]
  const original = structuredClone(source)
  const template = data.saveEventTemplate(source, 'Мой мастер-класс')
  const clone = data.createEvent({ title: 'Новое событие', date: '2026-12-20', format: source.format, type: source.type, participants: 20, limit: 15000, template: template.id }, 'new', template)
  assert.deepEqual(source, original)
  const sourceIds = new Set([source.id, ...source.stages.map(item => item.id), ...source.tasks.map(item => item.id), ...source.team.map(item => item.id), ...source.expenses.map(item => item.id)])
  const newIds = [clone.id, ...clone.stages.map(item => item.id), ...clone.tasks.map(item => item.id), ...clone.team.map(item => item.id), ...clone.expenses.map(item => item.id)]
  assert.equal(new Set(newIds).size, newIds.length)
  assert.ok(newIds.every(id => !sourceIds.has(id)))
  assert.ok(clone.tasks.every(task => task.status === 'open'))
  assert.equal(clone.tasks[0].due, data.addDays(clone.date, data.daysUntil(source.tasks[0].due, source.date)))
  assert.deepEqual(clone.tasks[0].dependencies, [clone.tasks[1].id])
  assert.ok(clone.expenses.every(expense => expense.paid === 0 && expense.agreed === 0 && expense.expected === expense.plan))
  assert.ok(clone.tasks.every(task => !task.ownerId || clone.team.some(member => member.id === task.ownerId)))
  const saved = data.normalizeStore({ version: 3, firstLaunch: '2026-10-28', activeId: source.id, events: [source], templates: [template] })
  assert.equal(saved.templates[0].name, template.name)
})
