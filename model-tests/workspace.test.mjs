import test from 'node:test'
import assert from 'node:assert/strict'
import * as workspace from '../src/workspace.ts'
import * as data from '../src/data.ts'

test('настройки блоков независимы от данных плана, скрытие не отключает риски', () => {
  const event = data.createDemo('2026-10-28'), original = structuredClone(event)
  const settings = workspace.defaultWorkspace()
  const hidden = workspace.changeWidget(settings, 'risks', { visible: false })
  const moved = workspace.reorderWidget(hidden, 'team', 'event', 'after')
  assert.equal(moved.widgets.find(item => item.id === 'risks').visible, false)
  assert.deepEqual(event, original)
  assert.ok(data.collectRisks(event, '2026-10-28').some(risk => risk.severity === 'critical'))
  const resized = workspace.changeWidget(moved, 'budget', { width: 1 })
  assert.equal(resized.widgets.find(item => item.id === 'budget').width, 1)
  assert.equal(settings.widgets.find(item => item.id === 'risks').visible, true)
})

test('миграция расположения восстанавливает недостающие блоки и обязательные сведения', () => {
  const result = workspace.normalizeWorkspace({ widgets: [{ id: 'event', visible: false, width: 9 }, { id: 'risks', visible: false, width: 1 }, { id: 'risks', visible: true, width: 2 }, { id: 'deleted-widget', visible: true, width: 2 }] })
  assert.equal(result.widgets.length, 6)
  assert.equal(new Set(result.widgets.map(item => item.id)).size, 6)
  assert.equal(result.widgets.find(item => item.id === 'event').visible, true)
  assert.equal(result.widgets.find(item => item.id === 'risks').visible, false)
  assert.ok(result.widgets.every(item => item.width === 1 || item.width === 2))
})
