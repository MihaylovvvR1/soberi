import { createDemo } from './data.ts'
import type { EventData, Section, TaskStatus } from './data'
import type { WorkspaceSettings } from './workspace'

export const learningKey = 'soberi-onboarding-v1'
export type LearningStatus = 'new' | 'started' | 'dismissed' | 'skipped' | 'completed'
export const learningSteps = ['events', 'risks', 'assign', 'status', 'budget', 'layout', 'theme'] as const
export type LearningStep = typeof learningSteps[number]
export interface PracticeBaseline { owner: string | null; status: TaskStatus; order: string }
export interface TrainingSession {
  step: number; event: EventData; layout: WorkspaceSettings; baseline: PracticeBaseline
  returnSection: Section; returnEditing: boolean; returnScroll: number
}
export function makeTrainingEvent(today: string): EventData {
  const event = createDemo(today)
  const stageIds = new Map(event.stages.map(stage => [stage.id, `training-${stage.id}`]))
  const memberIds = new Map(event.team.map(member => [member.id, `training-${member.id}`]))
  return { ...event, id: 'training-event', title: 'Учебный мастер-класс',
    stages: event.stages.map(stage => ({ ...stage, id: stageIds.get(stage.id)! })),
    team: event.team.map(member => ({ ...member, id: memberIds.get(member.id)! })),
    tasks: event.tasks.map(task => ({ ...task, id: task.id === 10 ? 'training-equipment' : `training-task-${task.id}`, stageId: stageIds.get(task.stageId)!, ownerId: task.ownerId ? memberIds.get(task.ownerId)! : null })),
    expenses: event.expenses.map(expense => ({ ...expense, id: `training-expense-${expense.id}` })) }
}
export const practiceBaseline = (event: EventData, layout: WorkspaceSettings): PracticeBaseline => {
  const task = event.tasks.find(task => task.id === 'training-equipment')
  return { owner: task?.ownerId ?? null, status: task?.status ?? 'open', order: layout.widgets.map(widget => widget.id).join(',') }
}
export function practicalDone(step: LearningStep, event: EventData, layout: WorkspaceSettings, baseline: PracticeBaseline): boolean {
  const task = event.tasks.find(task => task.id === 'training-equipment')
  if (step === 'assign') return !!task?.ownerId && task.ownerId !== baseline.owner && event.team.some(member => member.id === task.ownerId)
  if (step === 'status') return !!task && task.status === (baseline.status === 'done' ? 'doing' : 'done')
  if (step === 'layout') return layout.widgets.map(widget => widget.id).join(',') !== baseline.order
  return false
}
export function readLearning(storage?: Pick<Storage, 'getItem'>): LearningStatus {
  try { const value = JSON.parse((storage ?? localStorage).getItem(learningKey) ?? 'null'); return ['started', 'dismissed', 'skipped', 'completed'].includes(value?.status) ? value.status : 'new' } catch { return 'new' }
}
export function writeLearning(status: LearningStatus, storage?: Pick<Storage, 'setItem'>) {
  try { (storage ?? localStorage).setItem(learningKey, JSON.stringify({ version: 1, status })); return true } catch { return false }
}
interface Box { left: number; top: number; width: number; height: number }
export function placeTip(target: Box, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const gap = 16, margin = 12
  const sideTop = Math.max(margin, Math.min(target.top, viewport.height - size.height - margin))
  const positions = [
    { left: target.left + target.width + gap, top: sideTop },
    { left: target.left - size.width - gap, top: sideTop },
    { left: target.left, top: target.top + target.height + gap },
    { left: target.left, top: target.top - size.height - gap },
  ]
  const fits = (point: { left: number; top: number }) => point.left >= margin && point.top >= margin && point.left + size.width <= viewport.width - margin && point.top + size.height <= viewport.height - margin
  const point = positions.find(fits) ?? { left: (viewport.width - size.width) / 2, top: target.top > viewport.height / 2 ? margin : viewport.height - size.height - margin }
  return { left: Math.max(margin, Math.min(point.left, viewport.width - size.width - margin)), top: Math.max(margin, Math.min(point.top, viewport.height - size.height - margin)) }
}
export interface TourInstruction {
  key: string; index: number; title: string; body: string; target: string; practical: boolean
  interactive?: string; focus?: string; form?: boolean
}
export function trainingInstruction(session: TrainingSession, taskFormOpen: boolean, editing: boolean): TourInstruction {
  const step = learningSteps[session.step], task = session.event.tasks.find(task => task.id === 'training-equipment')
  const common = { key: `${step}-${taskFormOpen}-${editing}-${!!task?.ownerId}`, index: session.step, practical: ['assign', 'status', 'layout'].includes(step) }
  switch (step) {
    case 'events': return { ...common, title: 'Начни с мероприятия', body: 'Мероприятие выбирают здесь. Новое создают кнопкой «Создать мероприятие» или «+» в шапке. Сейчас открыт отдельный учебный пример.', target: '[data-tour="event-picker"]' }
    case 'risks': return { ...common, title: 'Заметь важное', body: 'Здесь собраны вопросы, которые требуют внимания. Предупреждение ведёт к задаче или расходу. Выполненные задачи не отменяют эти риски.', target: '[data-tour="antifail"]' }
    case 'assign': return taskFormOpen
      ? { ...common, title: 'Назначь ответственного', body: 'Выбери участника в поле «Ответственный» и нажми «Сохранить изменения». Назначение ещё не завершает задачу.', target: '[data-tour="task-dialog"]', interactive: '[data-tour="task-dialog"]', focus: '[data-tour="task-owner"] select', form: true }
      : { ...common, title: task?.ownerId ? 'Измени ответственного' : 'Открой проблемную задачу', body: task?.ownerId ? 'Открой проверку оборудования, выбери другого участника и сохрани. Проверим реальное изменение.' : 'За проверку оборудования никто не отвечает. Нажми «Назначить ответственного», чтобы открыть задачу.', target: task?.ownerId ? '[data-task-id="training-equipment"]' : '[data-tour="assign-problem"]', interactive: task?.ownerId ? '[data-task-id="training-equipment"]' : '[data-tour="assign-problem"]' }
    case 'status': return { ...common, title: 'Отметь результат', body: taskFormOpen ? `Выбери статус «${session.baseline.status === 'done' ? 'В работе' : 'Выполнено'}» и сохрани изменения. До сохранения шаг не завершится.` : `Теперь открой проверку оборудования и измени статус на «${session.baseline.status === 'done' ? 'В работе' : 'Выполнено'}». Выполнение и назначение — разные действия.`, target: taskFormOpen ? '[data-tour="task-dialog"]' : '[data-task-id="training-equipment"]', interactive: taskFormOpen ? '[data-tour="task-dialog"]' : '[data-task-id="training-equipment"]', focus: taskFormOpen ? '[data-tour="task-status"] select' : undefined, form: taskFormOpen }
    case 'budget': return { ...common, title: 'Проверь полную стоимость', body: 'Ожидаемый итог включает оплаченные суммы, оставшиеся обязательства и дополнительные расходы. Здесь 22 000 ₽ при лимите 20 000 ₽.', target: '[data-tour="budget-forecast"]' }
    case 'layout': return editing
      ? { ...common, title: 'Переставь блок', body: 'Нажми «Выше» или «Ниже» у блока «Прогресс» либо перетащи его за ручку. Учебное расположение не изменит твой экран.', target: '[data-tour="widget-controls-progress"]', interactive: '[data-tour="widget-controls-progress"]' }
      : { ...common, title: 'Настрой рабочий экран', body: 'Нажми «Настроить экран». Затем попробуем переставить один блок, не меняя задачи и сроки.', target: '[data-tour="screen-settings"]', interactive: '[data-tour="screen-settings"]' }
    case 'theme': return { ...common, title: 'Выбери удобную тему', body: 'Здесь доступны светлая, тёмная и системная темы. Выбор сохраняется в браузере. Можешь попробовать сейчас или завершить обучение.', target: '[data-tour="theme"]', interactive: '[data-tour="theme"]' }
  }
}
