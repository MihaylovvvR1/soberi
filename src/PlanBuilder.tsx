import { useState } from 'react'
import type { EntityId, EventData, Stage, Task } from './data'
import { formatDate, memberName, reorderStage, reorderTask, statuses } from './data'
import { DragBoard, DragSurface } from './DragSurface'
import { Icon } from './Icons'

interface Props {
  event: EventData; today: string
  editTask: (task?: Task, stageId?: string) => void
  toggleTask: (task: Task) => void
  onChange: (update: (event: EventData) => EventData) => void
  editStage: (stage?: Stage) => void; deleteStage: (stage: Stage) => void; saveTemplate: () => void
}
export function PlanBuilder({ event, today, editTask, toggleTask, onChange, editStage, deleteStage, saveTemplate }: Props) {
  const [filter, setFilter] = useState('all'), [owner, setOwner] = useState('all'), [search, setSearch] = useState('')
  const complete = event.tasks.filter(task => task.status === 'done').length
  const progress = event.tasks.length ? Math.round(complete / event.tasks.length * 100) : 0
  const filtered = event.tasks.filter(task =>
    (filter === 'all' || (filter === 'pending' ? task.status !== 'done' : task.status === filter)) &&
    (owner === 'all' || (owner === 'unassigned' ? !task.ownerId : task.ownerId === owner)) &&
    `${task.title} ${memberName(event, task.ownerId)}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))
  const tabs = [{ id: 'all', label: 'Все задачи', count: event.tasks.length }, { id: 'pending', label: 'Открытые', count: event.tasks.length - complete }, { id: 'doing', label: 'В работе', count: event.tasks.filter(task => task.status === 'doing').length }, { id: 'done', label: 'Выполненные', count: complete }]
  function moveStage(stage: Stage, direction: -1 | 1) {
    const index = event.stages.findIndex(item => item.id === stage.id), target = event.stages[index + direction]
    if (target) onChange(current => reorderStage(current, stage.id, target.id, direction < 0 ? 'before' : 'after'))
  }
  function moveTask(task: Task, tasks: Task[], direction: -1 | 1) {
    const target = tasks[tasks.findIndex(item => item.id === task.id) + direction]
    if (target) onChange(current => reorderTask(current, task.id, task.stageId, target.id, direction < 0 ? 'before' : 'after'))
  }
  const transfer = (id: EntityId, stageId: string) => onChange(current => reorderTask(current, id, stageId, null))
  return <div className="view plan-view">
    <section className="compact-event"><div><span className="blue-dot" /><strong>{event.title}</strong></div><span><Icon name="calendar" size={16} />{formatDate(event.date)}</span></section>
    <section className="task-progress-strip"><div><span className="icon-tile"><Icon name="tasks" /></span><div><strong>{complete} из {event.tasks.length} задач выполнено</strong><p>Меняйте порядок задач, сохраняя сроки и назначения.</p></div></div><div className="strip-progress"><span>{progress}%</span><div><i style={{ width: `${progress}%` }} /></div></div></section>
    <div className="plan-heading"><div><h2>План по этапам</h2><p>Переносите за ручку или используйте кнопки порядка.</p></div><div className="builder-actions"><button className="button secondary small" onClick={saveTemplate}><Icon name="flag" size={16} />Сохранить как шаблон</button><button className="button secondary small" onClick={() => editStage()}><Icon name="plus" size={16} />Добавить этап</button><button className="button primary small" onClick={() => editTask()} disabled={!event.stages.length}><Icon name="plus" size={16} />Добавить задачу</button></div></div>
    <section className="card plan-filters"><div className="table-toolbar"><div className="filter-tabs" aria-label="Фильтр задач">{tabs.map(item => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>{item.label} <span>{item.count}</span></button>)}</div><label className="search-field"><Icon name="search" size={17} /><input aria-label="Поиск задач" placeholder="Найти задачу…" value={search} onChange={e => setSearch(e.target.value)} /></label></div><div className="task-filter-row"><label>Ответственный<select aria-label="Фильтр по ответственному" value={owner} onChange={e => setOwner(e.target.value)}><option value="all">Все участники</option><option value="unassigned">Не назначен</option>{event.team.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>{(filter !== 'all' || owner !== 'all' || search) && <button className="text-button" onClick={() => { setFilter('all'); setOwner('all'); setSearch('') }}>Сбросить фильтры</button>}</div></section>
    <DragBoard onDrop={(active, target, placement) => {
      if (active.kind === 'stage' && target.kind === 'stage') onChange(current => reorderStage(current, String(active.key), String(target.key), placement))
      if (active.kind === 'task') onChange(current => reorderTask(current, active.key, target.kind === 'stage' ? String(target.key) : target.stageId!, target.kind === 'task' ? target.key : null, placement))
    }}>
      <div className="stage-list">{event.stages.map((stage, stageIndex) => {
        const all = event.tasks.filter(task => task.stageId === stage.id), tasks = filtered.filter(task => task.stageId === stage.id)
        return <DragSurface key={stage.id} item={{ kind: 'stage', key: stage.id, label: stage.title }} className="plan-stage" data-testid="plan-stage" data-stage-id={stage.id}>
          {handle => <>
            <header className="stage-heading"><div className="stage-heading-main">{handle}<button className="icon-button collapse-stage" aria-label={`${stage.collapsed ? 'Развернуть' : 'Свернуть'} этап: ${stage.title}`} aria-expanded={!stage.collapsed} onClick={() => onChange(current => ({ ...current, stages: current.stages.map(item => item.id === stage.id ? { ...item, collapsed: !item.collapsed } : item) }))}><Icon name={stage.collapsed ? 'chevron' : 'down'} size={17} /></button><div><h3>{stage.title}</h3><span>Задач: {all.length} · выполнено: {all.filter(task => task.status === 'done').length}{all.some(task => task.critical) ? ` · критических: ${all.filter(task => task.critical).length}` : ''}</span></div></div><div className="stage-actions"><button className="order-button" aria-label={`Выше этап: ${stage.title}`} disabled={stageIndex === 0} onClick={() => moveStage(stage, -1)}><Icon name="up" size={15} />Выше</button><button className="order-button" aria-label={`Ниже этап: ${stage.title}`} disabled={stageIndex === event.stages.length - 1} onClick={() => moveStage(stage, 1)}><Icon name="down" size={15} />Ниже</button><button className="icon-button" aria-label={`Переименовать этап: ${stage.title}`} onClick={() => editStage(stage)}><Icon name="edit" size={16} /></button><button className="icon-button stage-delete" aria-label={`Удалить этап: ${stage.title}`} onClick={() => deleteStage(stage)}><Icon name="close" size={17} /></button></div></header>
            {!stage.collapsed && <div className="stage-tasks">
              {tasks.map((task, index) => {
                const done = task.status === 'done', overdue = !done && task.due < today
                return <DragSurface key={task.id} item={{ kind: 'task', key: task.id, stageId: stage.id, label: task.title }} className={`task-row builder-task-row ${done ? 'is-done' : ''}`} data-testid="task-row" data-task-id={task.id}>
                  {taskHandle => <>
                    <div className="task-name-cell">{taskHandle}<button className={`task-checkbox ${done ? 'checked' : ''}`} role="checkbox" aria-checked={done} aria-label={`${done ? 'Вернуть в работу' : 'Выполнить'}: ${task.title}`} onClick={() => toggleTask(task)}>{done && <Icon name="check" size={14} />}</button><button className="task-name" onClick={() => editTask(task)}>{task.title}{task.critical && !done && <span className="critical-mark" aria-hidden="true">!</span>}</button></div>
                    <div className={`task-owner ${!task.ownerId ? 'unassigned' : ''}`}><span>{memberName(event, task.ownerId)}</span></div>
                    <span className={`task-date ${overdue ? 'text-red overdue-date' : ''}`}><span>{formatDate(task.due, { day: 'numeric', month: 'short' })}{overdue && <small>Просрочено</small>}</span></span>
                    <span className={`pill status-pill ${done ? 'green' : task.status === 'doing' ? 'blue' : 'neutral'}`}>{statuses[task.status]}</span>
                    <button className="icon-button row-edit" aria-label={`Изменить задачу: ${task.title}`} onClick={() => editTask(task)}><Icon name="chevron" size={17} /></button>
                    <div className="task-order-controls"><button className="order-button" aria-label={`Выше задачу: ${task.title}`} disabled={index === 0} onClick={() => moveTask(task, tasks, -1)}><Icon name="up" size={14} />Выше</button><button className="order-button" aria-label={`Ниже задачу: ${task.title}`} disabled={index === tasks.length - 1} onClick={() => moveTask(task, tasks, 1)}><Icon name="down" size={14} />Ниже</button><label>В этап<select aria-label={`Этап для задачи: ${task.title}`} value={task.stageId} onChange={e => transfer(task.id, e.target.value)}>{event.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.title}</option>)}</select></label></div>
                  </>}
                </DragSurface>
              })}
              {!tasks.length && <p className="stage-empty">{all.length ? 'В этом этапе нет задач по выбранным фильтрам.' : 'В этом этапе пока нет задач. Можно добавить или перенести из другого.'}</p>}
            </div>}
            <div className="stage-footer"><button className="text-button" onClick={() => editTask(undefined, stage.id)} aria-label={`Добавить задачу в этап: ${stage.title}`}><Icon name="plus" size={15} />Добавить задачу в этап</button>{stage.collapsed && <span>Этап свёрнут</span>}</div>
          </>}
        </DragSurface>
      })}</div>
    </DragBoard>
    {!event.stages.length && <div className="card empty-state"><Icon name="tasks" size={30} /><h3>Добавьте первый этап</h3><p>Этапы помогут организовать задачи и сохранить свой шаблон.</p><button className="text-button" onClick={() => editStage()}>Добавить первый этап</button></div>}
    <div className="table-footer"><span>По фильтрам: {filtered.length} из {event.tasks.length} задач</span><span>Перестановка не меняет выполнение и критические условия.</span></div>
  </div>
}
