import { useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import { addDays, collectRisks, createEvent as buildEvent, dateKey, formatDate, readStore, recordPayment, removeStage, removeTask, reorderTask, restoreDemo, saveEventTemplate, saveStore } from './data'
import type { EventData, Expense, NewEvent, Risk, Section, Stage, Task } from './data'
import { Icon, Logo } from './Icons'
import { Overview, Tasks, Budget } from './Views'
import { ConfirmForm, CreateEventForm, ExpenseForm, Modal, PaymentForm, StageForm, TaskForm, TeamForm, TemplateForm } from './Modals'
import { ThemeControl } from './ThemeControl'
import { changeWidget, defaultWorkspace, readWorkspace, saveWorkspace } from './workspace'
import type { WorkspaceSettings } from './workspace'
import { LearningTour } from './LearningTour'
import { learningSteps, makeTrainingEvent, practicalDone, practiceBaseline, readLearning, trainingInstruction, writeLearning } from './onboarding'
import type { LearningStatus, TrainingSession } from './onboarding'

const navigation = [
  { id: 'overview', title: 'Обзор мероприятия', icon: 'overview' },
  { id: 'tasks', title: 'Задачи', icon: 'tasks' },
  { id: 'budget', title: 'Бюджет', icon: 'wallet' },
] as const
function sectionFromHash(): Section { const value = location.hash.slice(1); return value === 'tasks' || value === 'budget' ? value : 'overview' }
type Dialog = { type: 'create' | 'help' | 'restore' | 'reset-layout' } | { type: 'task'; eventId: string; task?: Task; initialStageId?: string } | { type: 'expense'; eventId: string; expense?: Expense } | { type: 'payment'; eventId: string; expense: Expense } | { type: 'delete-task'; eventId: string; task: Task } | { type: 'team' | 'save-template'; eventId: string } | { type: 'stage'; eventId: string; stage?: Stage } | { type: 'delete-stage'; eventId: string; stage: Stage } | null

export default function App() {
  const [store, setStore] = useState(readStore)
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState('')
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [savedWorkspace, setSavedWorkspace] = useState(readWorkspace)
  const [editingWorkspace, setEditingWorkspace] = useState(false)
  const [workspaceUnavailable, setWorkspaceUnavailable] = useState(false)
  const [training, setTraining] = useState<TrainingSession | null>(null)
  const [learning, setLearning] = useState(readLearning)
  const learningFocus = useRef<HTMLElement | null>(null)
  const event = training?.event ?? store.events.find(item => item.id === store.activeId)!
  const workspace = training?.layout ?? savedWorkspace
  const availableEvents = training ? [training.event] : store.events
  const openTasks = event.tasks.filter(task => task.status !== 'done').length
  const criticalCount = collectRisks(event, today).filter(risk => risk.severity === 'critical').length
  const dialogEvent = dialog && 'eventId' in dialog ? dialog.eventId === event.id ? event : store.events.find(item => item.id === dialog.eventId) ?? event : event

  useEffect(() => { setStorageUnavailable(!saveStore(store)) }, [store])
  useEffect(() => { setWorkspaceUnavailable(!saveWorkspace(savedWorkspace)) }, [savedWorkspace])
  useEffect(() => { const interval = setInterval(() => setToday(dateKey(new Date())), 30000); return () => clearInterval(interval) }, [])
  useEffect(() => { const onHash = () => setSection(sectionFromHash()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash) }, [])
  useEffect(() => { document.title = `СОБЕРИ — ${navigation.find(item => item.id === section)!.title}` }, [section])
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timeout) }, [toast])
  function navigate(next: Section) { location.hash = next === 'overview' ? '' : next; setSection(next); setEditingWorkspace(false) }
  function updateEvent(id: string, transform: (value: EventData) => EventData) {
    if (training) { setTraining(previous => previous && previous.event.id === id ? { ...previous, event: transform(previous.event) } : previous); return }
    setStore(previous => ({ ...previous, events: previous.events.map(item => item.id === id ? transform(item) : item) }))
  }
  function setWorkspace(update: SetStateAction<WorkspaceSettings>) {
    if (training) { setTraining(previous => previous ? { ...previous, layout: typeof update === 'function' ? update(previous.layout) : update } : previous); return }
    setSavedWorkspace(update)
  }
  function switchEvent(id: string) { if (training) return; setStore(previous => ({ ...previous, activeId: id })); setDialog(null); navigate('overview') }
  function rememberLearning(status: LearningStatus) { setLearning(status); writeLearning(status) }
  function startTraining() {
    learningFocus.current = document.activeElement as HTMLElement
    const sample = makeTrainingEvent(today), layout = defaultWorkspace()
    setTraining({ step: 0, event: sample, layout, baseline: practiceBaseline(sample, layout), returnSection: section, returnEditing: editingWorkspace, returnScroll: scrollY })
    rememberLearning('started'); setDialog(null); setToast(''); navigate('overview')
  }
  function finishTraining(completed = false) {
    if (!training) return
    const previous = training
    setDialog(null); setTraining(null); rememberLearning(completed ? 'completed' : 'skipped')
    navigate(previous.returnSection); setEditingWorkspace(previous.returnEditing)
    setToast(completed ? 'Обучение завершено. Вы вернулись к своему мероприятию.' : 'Обучение закрыто. Ваши данные сохранены.')
    requestAnimationFrame(() => { window.scrollTo({ top: previous.returnScroll, behavior: 'instant' }); const original = learningFocus.current; (original?.isConnected ? original : document.querySelector<HTMLElement>('[data-tour="learning-launch"]'))?.focus({ preventScroll: true }) })
  }
  function goTrainingStep(index: number) {
    if (!training) return
    if (index >= learningSteps.length) { finishTraining(true); return }
    const task = training.event.tasks.find(task => task.id === 'training-equipment')
    const nextSection = index === 3 || (index === 2 && task?.ownerId) ? 'tasks' : index === 4 ? 'budget' : 'overview'
    setDialog(null); navigate(nextSection)
    setTraining(previous => previous ? { ...previous, step: Math.max(0, index), baseline: practiceBaseline(previous.event, previous.layout), layout: changeWidget(changeWidget(previous.layout, 'risks', { visible: true }), 'progress', index === 5 ? { visible: true } : {}), event: { ...previous.event, stages: previous.event.stages.map(stage => stage.id === task?.stageId ? { ...stage, collapsed: false } : stage) } } : previous)
  }
  useEffect(() => {
    if (!training || dialog) return
    if (practicalDone(learningSteps[training.step], training.event, training.layout, training.baseline)) { goTrainingStep(training.step + 1); return }
    const assigned = training.event.tasks.find(task => task.id === 'training-equipment')?.ownerId
    const expected = training.step === 3 || (training.step === 2 && assigned) ? 'tasks' : training.step === 4 ? 'budget' : 'overview'
    if (section !== expected) navigate(expected)
  }, [training, dialog, section])
  function saveTask(task: Task) { updateEvent(dialogEvent.id, value => { const old = value.tasks.find(item => item.id === task.id); const next = { ...value, tasks: old ? value.tasks.map(item => item.id === task.id ? task : item) : [...value.tasks, task] }; return old && old.stageId !== task.stageId ? reorderTask(next, task.id, task.stageId, null) : next }); setDialog(null); setToast('Задача сохранена') }
  function toggleTask(task: Task) { updateEvent(event.id, value => ({ ...value, tasks: value.tasks.map(item => item.id === task.id ? { ...item, status: item.status === 'done' ? 'doing' : 'done' } : item) })); setToast(task.status === 'done' ? 'Задача возвращена в работу' : 'Задача выполнена') }
  function createEvent(values: NewEvent): string | void {
    if (training) return 'Завершите обучение, чтобы создать своё мероприятие.'
    const template = store.templates.find(item => item.id === values.template)
    if (!['workshop', 'empty'].includes(values.template) && !template) return 'Шаблон не найден. Выберите другой начальный план.'
    let created: EventData
    try { created = buildEvent(values, crypto.randomUUID(), template) } catch (error) { return error instanceof Error ? error.message : 'Не удалось создать мероприятие.' }
    setStore(previous => ({ ...previous, events: [...previous.events, created], activeId: created.id }))
    setDialog(null); navigate('overview'); setToast(values.template !== 'empty' ? 'Мероприятие создано. Проверьте сроки плана.' : 'Мероприятие создано с пустым планом.')
  }
  function saveExpense(expense: Expense) {
    updateEvent(dialogEvent.id, value => ({ ...value, expenses: value.expenses.some(item => item.id === expense.id) ? value.expenses.map(item => item.id === expense.id ? expense : item) : [...value.expenses, expense] }))
    setDialog(null); setToast('Статья расходов сохранена')
  }
  function payExpense(amount: number): string | void {
    if (dialog?.type !== 'payment') return 'Выберите статью расходов.'
    const current = store.events.find(item => item.id === dialog.eventId)?.expenses.find(item => item.id === dialog.expense.id)
    if (!current) return 'Статья расходов больше не найдена.'
    try {
      const paid = recordPayment(current, amount)
      updateEvent(dialog.eventId, value => ({ ...value, expenses: value.expenses.map(item => item.id === paid.id ? paid : item) }))
      setDialog(null); setToast('Оплата учтена. Ожидаемый итог не изменился.')
    } catch (error) { return error instanceof Error ? error.message : 'Проверьте сумму оплаты.' }
  }
  function openRisk(risk: Risk) {
    const target = risk.target
    if (target.type === 'task') {
      const task = event.tasks.find(item => item.id === target.id)
      if (task) { navigate('tasks'); setDialog({ type: 'task', eventId: event.id, task }) }
    } else {
      navigate('budget')
      if (target.type === 'expense') { const expense = event.expenses.find(item => item.id === target.id); if (expense) setDialog({ type: 'expense', eventId: event.id, expense }) }
    }
  }
  function showRisks() {
    setWorkspace(current => changeWidget(current, 'risks', { visible: true })); navigate('overview')
    requestAnimationFrame(() => { const heading = document.getElementById('risk-title'); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) })
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Перейти к содержимому</a>
    <aside className="sidebar">
      <div className="brand"><Logo /><span className="brand-tagline">От идеи до события</span></div>
      <div className="workspace"><span className="workspace-icon"><Icon name="building" size={20} /></span><div><strong>Моё пространство</strong><span>Образовательная студия</span></div></div>
      <button className="button primary create-button" onClick={() => setDialog({ type: 'create' })}><Icon name="plus" size={18} />Создать мероприятие</button>
      <div className="nav-label">МЕРОПРИЯТИЕ</div>
      <div className="event-select-wrap" data-tour="event-picker"><select aria-label="Текущее мероприятие" value={event.id} onChange={e => switchEvent(e.target.value)}>{availableEvents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Icon name="down" size={16} /></div>
      <nav aria-label="Главное меню">{navigation.map(item => <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`} aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} size={20} /><span>{item.title}</span>{item.id === 'tasks' && openTasks > 0 && <span className="nav-count">{openTasks}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Icon name="flag" size={20} /><strong>Большие события.<br />Понятные шаги.</strong><p>Всё важное для подготовки —<br />в одном месте.</p></div>
        <button className="help-button" onClick={() => setDialog({ type: 'help' })}><Icon name="help" size={19} />Как это работает<Icon name="arrowUp" size={16} /></button>
        <div className="sidebar-version"><span className="local-dot" />Демонстрация проекта</div>
      </div>
    </aside>
    <div className="main-shell">
      <div className="workspace-watermark" aria-hidden="true"><img src="/brand/mark.png" alt="" /></div>
      <header className="topbar"><div className="mobile-brand"><Logo /></div><div className="breadcrumb"><span>Рабочее пространство</span><Icon name="chevron" size={14} /><strong>{navigation.find(item => item.id === section)!.title}</strong></div><div className="topbar-actions">{criticalCount > 0 && <button className="header-risk-indicator" aria-label={`Критические проблемы: ${criticalCount}. Показать Антипровал`} onClick={showRisks}><Icon name="shield" size={16} /><span className="risk-indicator-text">Критические: </span>{criticalCount}</button>}<span className="demo-label"><span />Демонстрация проекта</span><ThemeControl /><button className="icon-button mobile-create" aria-label="Создать мероприятие" onClick={() => setDialog({ type: 'create' })}><Icon name="plus" /></button></div></header>
      <div className="mobile-event-switcher" data-tour="event-picker"><Icon name="calendar" size={16} /><select aria-label="Текущее мероприятие" value={event.id} onChange={e => switchEvent(e.target.value)}>{availableEvents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><h1>{navigation.find(item => item.id === section)!.title}</h1><p>{section === 'overview' ? 'Сначала — важное. Затем — всё остальное.' : section === 'tasks' ? 'Кто делает, что и к какому сроку.' : 'Что уже оплачено и какие расходы ещё впереди.'}</p></div><span className="heading-date"><Icon name="calendar" size={16} />{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date())}</span><button className="button secondary small learning-launch" data-tour="learning-launch" onClick={startTraining}><Icon name="help" size={16} />Обучение</button></div>
        {learning === 'new' && !training && <section className="learning-offer" aria-label="Знакомство с СОБЕРИ"><div><strong>Первый раз в СОБЕРИ?</strong><p>Семь коротких шагов: попробуйте подготовку на отдельном учебном примере.</p></div><div><button className="button primary small" onClick={startTraining}>Пройти обучение<Icon name="arrow" size={15} /></button><button className="button secondary small" onClick={() => rememberLearning('dismissed')}>Начать работу</button></div></section>}
        {(storageUnavailable || workspaceUnavailable) && <div className="warning-banner"><Icon name="info" size={18} />Не удалось сохранить изменения. Они останутся доступны до обновления страницы.</div>}
        {section === 'overview' && <><div className="screen-settings-action"><button data-tour="screen-settings" className={`button ${editingWorkspace ? 'primary' : 'secondary'} small`} onClick={() => setEditingWorkspace(value => !value)}><Icon name={editingWorkspace ? 'check' : 'overview'} size={16} />{editingWorkspace ? 'Готово' : 'Настроить экран'}</button></div><Overview event={event} today={today} navigate={navigate} openRisk={openRisk} editTask={task => setDialog({ type: 'task', eventId: event.id, task })} showTeam={() => setDialog({ type: 'team', eventId: event.id })} workspace={workspace} editing={editingWorkspace} onWorkspaceChange={setWorkspace} onResetLayout={() => setDialog({ type: 'reset-layout' })} /></>}
        {section === 'tasks' && <Tasks key={event.id} event={event} today={today} editTask={(task, initialStageId) => setDialog({ type: 'task', eventId: event.id, task, initialStageId })} toggleTask={toggleTask} onChange={update => updateEvent(event.id, update)} editStage={stage => setDialog({ type: 'stage', eventId: event.id, stage })} deleteStage={stage => setDialog({ type: 'delete-stage', eventId: event.id, stage })} saveTemplate={() => setDialog({ type: 'save-template', eventId: event.id })} />}
        {section === 'budget' && <Budget event={event} editExpense={expense => setDialog({ type: 'expense', eventId: event.id, expense })} recordPayment={expense => setDialog({ type: 'payment', eventId: event.id, expense })} />}
        <footer className="page-footer"><span>СОБЕРИ — чтобы всё получилось.</span><button className="text-button restore-demo" onClick={() => setDialog({ type: 'restore' })}><Icon name="return" size={14} />Восстановить пример</button><span><Icon name="monitor" size={13} />Данные сохраняются в этом браузере</span></footer>
      </main>
    </div>
    <nav className="mobile-navigation" aria-label="Навигация на телефоне"><img className="mobile-navigation-mark" src="/brand/mark.png" alt="" width="22" height="23" />{navigation.map(item => <button key={item.id} className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} size={21} /><span>{item.id === 'overview' ? 'Обзор' : item.title}</span>{item.id === 'tasks' && openTasks > 0 && <span className="mobile-task-count" aria-label={`${openTasks} открытых задач`}>{openTasks}</span>}</button>)}</nav>
    {toast && <div className="toast" role="status"><span><Icon name="check" size={17} /></span>{toast}<button className="icon-button" aria-label="Скрыть уведомление" onClick={() => setToast('')}><Icon name="close" size={16} /></button></div>}
    {dialog && <Modal tourId={dialog.type === 'task' ? 'task-dialog' : undefined} key={dialog.type} title={dialog.type === 'create' ? 'Создать мероприятие' : dialog.type === 'task' ? (dialog.task ? 'Задача подготовки' : 'Новая задача') : dialog.type === 'expense' ? (dialog.expense ? 'Редактировать расходы' : 'Новая статья расходов') : dialog.type === 'payment' ? 'Отметить оплату' : dialog.type === 'delete-task' ? 'Удалить задачу?' : dialog.type === 'restore' ? 'Восстановить пример?' : dialog.type === 'team' ? 'Команда мероприятия' : dialog.type === 'stage' ? (dialog.stage ? 'Переименовать этап' : 'Новый этап') : dialog.type === 'delete-stage' ? 'Удалить этап?' : dialog.type === 'save-template' ? 'Сохранить свой шаблон' : dialog.type === 'reset-layout' ? 'Сбросить расположение?' : 'От идеи до события'} onClose={() => setDialog(null)}>
      {dialog.type === 'create' && <CreateEventForm defaultDate={addDays(today, 3)} today={today} templates={store.templates} onSubmit={createEvent} onCancel={() => setDialog(null)} />}
      {dialog.type === 'task' && <TaskForm task={dialog.task} initialStageId={dialog.initialStageId} event={dialogEvent} today={today} onSubmit={saveTask} onCancel={() => setDialog(null)} onDelete={dialog.task ? () => setDialog({ type: 'delete-task', eventId: dialog.eventId, task: dialog.task! }) : undefined} />}
      {dialog.type === 'expense' && <ExpenseForm expense={dialog.expense} nextId={crypto.randomUUID()} onSubmit={saveExpense} onCancel={() => setDialog(null)} />}
      {dialog.type === 'payment' && <PaymentForm expense={dialog.expense} onSubmit={payExpense} onCancel={() => setDialog(null)} />}
      {dialog.type === 'team' && <TeamForm event={dialogEvent} onSubmit={team => { updateEvent(dialog.eventId, value => ({ ...value, team })); setDialog(null); setToast('Команда сохранена') }} onCancel={() => setDialog(null)} />}
      {dialog.type === 'stage' && <StageForm stage={dialog.stage} onSubmit={stage => { updateEvent(dialog.eventId, value => ({ ...value, stages: value.stages.some(item => item.id === stage.id) ? value.stages.map(item => item.id === stage.id ? stage : item) : [...value.stages, stage] })); setDialog(null); setToast('Этап сохранён') }} onCancel={() => setDialog(null)} />}
      {dialog.type === 'delete-stage' && <ConfirmForm label="Удалить этап и задачи" onCancel={() => setDialog(null)} onConfirm={() => { updateEvent(dialog.eventId, value => removeStage(value, dialog.stage.id)); setDialog(null); setToast('Этап и его задачи удалены') }}><p>Этап «{dialog.stage.title}» будет удалён. Будет удалено задач: <strong>{dialogEvent.tasks.filter(task => task.stageId === dialog.stage.id).length}</strong>.</p>{dialogEvent.tasks.some(task => task.stageId === dialog.stage.id && task.critical) && <div className="critical-form-note" role="alert"><Icon name="alert" size={18} />Среди них критических задач: {dialogEvent.tasks.filter(task => task.stageId === dialog.stage.id && task.critical).length}. Их проверки тоже будут удалены. Удаление не означает, что эти условия выполнены.</div>}<p>Остальные этапы и их задачи сохранятся. </p></ConfirmForm>}
      {dialog.type === 'save-template' && <TemplateForm event={dialogEvent} onSubmit={name => { if (store.templates.some(template => template.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) return 'Шаблон с таким названием уже есть. Выберите другое название.'; const template = saveEventTemplate(dialogEvent, name); setStore(previous => ({ ...previous, templates: [...previous.templates, template] })); setDialog(null); setToast('Шаблон сохранён. Он доступен при создании мероприятия.') }} onCancel={() => setDialog(null)} />}
      {dialog.type === 'reset-layout' && <ConfirmForm label="Сбросить расположение" onCancel={() => setDialog(null)} onConfirm={() => { setWorkspace(defaultWorkspace()); setDialog(null); setToast('Расположение блоков восстановлено') }}><p>Вернутся исходные порядок и ширина блоков, скрытые блоки снова появятся. Задачи, сроки, команда и бюджет мероприятий сохранятся.</p></ConfirmForm>}
      {dialog.type === 'delete-task' && <ConfirmForm label="Удалить задачу" onCancel={() => setDialog({ type: 'task', eventId: dialog.eventId, task: dialog.task })} onConfirm={() => { updateEvent(dialog.eventId, value => removeTask(value, dialog.task.id)); setDialog(null); setToast('Задача удалена') }}><p>Задача «{dialog.task.title}» будет удалена из мероприятия «{dialogEvent.title}». Показатели и предупреждения пересчитаются.</p></ConfirmForm>}
      {dialog.type === 'restore' && <ConfirmForm label="Восстановить пример" onCancel={() => setDialog(null)} onConfirm={() => { setStore(previous => restoreDemo(previous)); setDialog(null); navigate('overview'); setToast('Демонстрационный пример восстановлен') }}><p>Вернутся исходные задачи, команда и бюджет «Открытого мастер-класса». Ваши другие мероприятия сохранятся.</p><p>Дата примера останется прежней: {formatDate(addDays(store.firstLaunch, 3), { day: 'numeric', month: 'long', year: 'numeric' })}. Текущие изменения самого примера будут заменены.</p></ConfirmForm>}
      {dialog.type === 'help' && <div className="help-content"><p>СОБЕРИ помогает небольшой команде подготовить мероприятие и вовремя заметить важные пропуски.</p><div><Icon name="overview" /><section><strong>Смотрите на картину целиком</strong><p>В обзоре собраны сроки, прогресс и критические проблемы. Закрытые задачи сами по себе не гарантируют готовность.</p></section></div><div><Icon name="tasks" /><section><strong>Договоритесь, кто что делает</strong><p>Откройте задачу, назначьте ответственного, уточните срок и отметьте выполнение.</p></section></div><div><Icon name="wallet" /><section><strong>Планируйте полную стоимость</strong><p>Бюджет учитывает оплаченные суммы, оставшиеся договорённости и дополнительные ожидаемые расходы.</p></section></div><div className="form-note"><Icon name="info" size={18} />Это демонстрация бизнес-идеи. Данные хранятся в вашем браузере.</div></div>}
    </Modal>}
    {training && <LearningTour instruction={trainingInstruction(training, dialog?.type === 'task' && dialog.task?.id === 'training-equipment', editingWorkspace)} onNext={() => goTrainingStep(training.step + 1)} onBack={() => goTrainingStep(training.step - 1)} onExit={() => finishTraining()} onRetry={() => goTrainingStep(training.step)} />}
  </div>
}
