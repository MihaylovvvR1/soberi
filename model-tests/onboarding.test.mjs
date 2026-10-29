import test from 'node:test'
import assert from 'node:assert/strict'
import { makeTrainingEvent, practicalDone, placeTip, readLearning, writeLearning } from '../src/onboarding.ts'
import { createDemo } from '../src/data.ts'
import { defaultWorkspace, reorderWidget } from '../src/workspace.ts'

test('учебный пример независим, даты актуальны, реальные данные не затронуты', () => {
  const original = createDemo('2026-01-01'), saved = structuredClone(original)
  const training = makeTrainingEvent('2026-10-28')
  assert.notEqual(training.id, original.id)
  assert.equal(training.date, '2026-10-31')
  const task = training.tasks.find(task => task.id === 'training-equipment')
  assert.equal(task.ownerId, null)
  assert.equal(task.status, 'open')
  task.ownerId = training.team[0].id
  assert.deepEqual(original, saved)
})

test('практика проверяет реальные изменения, а не выбор поля или открытие режима', () => {
  const event = makeTrainingEvent('2026-10-28'), layout = defaultWorkspace()
  const baseline = { owner: null, status: 'open', order: layout.widgets.map(widget => widget.id).join(',') }
  assert.equal(practicalDone('assign', event, layout, baseline), false)
  event.tasks.find(task => task.id === 'training-equipment').ownerId = 'missing-member'
  assert.equal(practicalDone('assign', event, layout, baseline), false)
  event.tasks.find(task => task.id === 'training-equipment').ownerId = event.team[0].id
  assert.equal(practicalDone('assign', event, layout, baseline), true)
  assert.equal(practicalDone('status', event, layout, baseline), false)
  event.tasks.find(task => task.id === 'training-equipment').status = 'done'
  assert.equal(practicalDone('status', event, layout, baseline), true)
  assert.equal(practicalDone('layout', event, layout, baseline), false)
  assert.equal(practicalDone('layout', event, reorderWidget(layout, 'progress', 'upcoming'), baseline), true)
})

test('подсказка остаётся в окне на узких и широких экранах', () => {
  const beside = placeTip({ left: 370, top: 11, width: 540, height: 698 }, { width: 340, height: 281 }, { width: 1280, height: 720 })
  assert.ok(beside.left >= 910, 'Подсказка должна стоять рядом с формой, а не над кнопкой сохранения')
  for (const width of [320, 390, 768, 1366]) for (const height of [480, 850]) {
    for (const target of [{ left: 4, top: 4, width: 100, height: 44 }, { left: width - 50, top: height - 60, width: 44, height: 44 }]) {
      const tip = placeTip(target, { width: Math.min(340, width - 24), height: 230 }, { width, height })
      assert.ok(tip.left >= 12 && tip.top >= 12)
      assert.ok(tip.left + Math.min(340, width - 24) <= width - 12)
      assert.ok(tip.top + 230 <= height - 12)
    }
  }
})

test('пропуск и завершение сохраняются отдельно, повреждение и отказ хранилища обработаны', () => {
  let stored = null
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value } }
  assert.equal(readLearning(storage), 'new')
  assert.equal(writeLearning('skipped', storage), true)
  assert.equal(readLearning(storage), 'skipped')
  writeLearning('completed', storage)
  assert.equal(readLearning(storage), 'completed')
  stored = '{broken'
  assert.equal(readLearning(storage), 'new')
  assert.equal(writeLearning('completed', { setItem: () => { throw Error('blocked') } }), false)
})
