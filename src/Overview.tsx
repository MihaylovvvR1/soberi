import type { EventData, Risk, Section, Task } from './data'
import { collectRisks, daysUntil, dayWord, formatDate, memberName, money, totals } from './data'
import { Icon } from './Icons'
import type { ReactNode } from 'react'
import type { WidgetId, WorkspaceSettings } from './workspace'
import { WorkspaceBoard } from './WorkspaceBoard'

export function Overview({ event, today, navigate, editTask, showTeam, openRisk, workspace, editing, onWorkspaceChange, onResetLayout }: {
  event: EventData
  today: string
  openRisk: (risk: Risk) => void
  navigate: (section: Section) => void
  editTask: (task: Task) => void
  showTeam: () => void
  workspace: WorkspaceSettings
  editing: boolean
  onWorkspaceChange: (update: (settings: WorkspaceSettings) => WorkspaceSettings) => void
  onResetLayout: () => void
}) {
  const complete = event.tasks.filter(task => task.status === 'done').length
  const open = event.tasks.length - complete
  const progress = Math.round(complete / event.tasks.length * 100) || 0
  const remaining = daysUntil(event.date, today)
  const budget = totals(event.expenses)
  const overrun = Math.max(0, budget.total - event.limit)
  const risks = collectRisks(event, today)
  const criticalCount = risks.filter(risk => risk.severity === 'critical').length
  const warningCount = risks.length - criticalCount
  const upcoming = [...event.tasks].filter(task => task.status !== 'done').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3)

  const widgets: Record<WidgetId, ReactNode> = {
    event: (<section className="event-hero" aria-label="Мероприятие">
      <div className="event-hero-content">
        <div className="event-kicker">{event.format} · {event.type}<span className="event-stage">В подготовке</span></div>
        <h2>{event.title}</h2>
        <div className="event-meta">
          <span><Icon name="calendar" size={16} />{formatDate(event.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <button onClick={showTeam} aria-label="Команда мероприятия"><Icon name="people" size={16} /><span>{event.team.map(member => member.name).join(', ')}</span><Icon name="chevron" size={14} /></button>
        </div>
      </div>
      <div className="event-numbers">
        <div><span>{remaining >= 0 ? 'До мероприятия' : 'После мероприятия'}</span><strong>{Math.abs(remaining)} <small>{dayWord(remaining)}</small></strong></div>
        <div><span>Ожидаем участников</span><strong>{event.participants} <small>человек</small></strong></div>
      </div>
    </section>),
    risks: (<section className={`risk-card ${risks.length === 0 ? 'no-risks' : criticalCount === 0 ? 'warnings-only' : ''}`} data-testid="risks" aria-labelledby="risk-title">
        <div className="risk-heading" data-tour="antifail">
          <div className="section-title"><span className="risk-shield"><Icon name="shield" size={25} /></span><h2 id="risk-title" tabIndex={-1}>Антипровал</h2></div>
          <div className="risk-counts">{criticalCount > 0 && <span className="pill red">{criticalCount} {criticalCount === 1 ? 'критическая проблема' : criticalCount < 5 ? 'критические проблемы' : 'критических проблем'}</span>}{warningCount > 0 && <span className="pill amber">{warningCount} предупреждение</span>}{!risks.length && <span className="pill green">Известных рисков нет</span>}</div>
        </div>
        <p className="risk-intro">{risks.length ? 'Проверьте условия и расходы, которые требуют внимания.' : 'Сейчас проблем не обнаружено. Продолжайте подготовку и уточняйте данные.'}</p>
        <div className="risk-items">
          {risks.map((risk, index) => <article className={`risk-item risk-${risk.severity}`} key={risk.id} data-risk-kind={risk.kind}>
            <span className="risk-index" aria-hidden="true">0{index + 1}</span>
            <div className="risk-item-content">
              <h3>{risk.title}</h3>
              <p className="risk-description">{risk.reason}</p>
              <div className="risk-assignment">{risk.target.type === 'task' ? <span>Ответственный: <strong className={!risk.owner ? 'text-red' : ''}>{risk.owner || 'Не назначен'}</strong></span> : <span>Бюджет мероприятия</span>}{risk.due && <span>До {formatDate(risk.due)}</span>}</div>
              <button className="risk-action" data-tour={risk.kind === 'unassigned' && risk.target.type === 'task' && risk.target.id === 'training-equipment' ? 'assign-problem' : undefined} aria-label={`${risk.title}: ${risk.action}`} onClick={() => openRisk(risk)}>{risk.action}<Icon name="arrow" size={16} /></button>
            </div>
          </article>)}
        </div>
        <div className="risk-footer"><Icon name="info" size={16} /><span>Выполненные задачи не отменяют критические риски.</span></div>
      </section>),
    progress: (<section className="progress-summary" data-testid="progress">
          <div className="section-card-header"><h2>Выполнено задач</h2><span className="progress-percentage">{progress}%</span></div>
          <div className="progress-value">{complete} <span>из {event.tasks.length}</span></div>
          <div className="progress-track" role="progressbar" aria-label="Выполнено задач" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <p>{event.tasks.length === 0 ? 'План пока пуст. Добавьте задачи.' : open === 0 ? 'Все задачи выполнены' : `${open} ${open === 1 ? 'задача' : open < 5 ? 'задачи' : 'задач'} в работе`}</p>
        </section>),
    upcoming: (<section className="upcoming-card">
          <div className="section-card-header"><h2>Ближайшие действия</h2><Icon name="flag" size={18} /></div>
          <div className="upcoming-list">{upcoming.length ? upcoming.map(task => <button className="upcoming-item" key={task.id} onClick={() => editTask(task)}>
            <span className="upcoming-check" aria-hidden="true" />
            <span><strong>{task.title}</strong><span className="upcoming-meta">{formatDate(task.due)}<span>·</span><span className={!task.ownerId ? 'text-red' : ''}>{memberName(event, task.ownerId)}</span></span></span>
            <Icon name="chevron" size={16} />
          </button>) : <div className="empty-upcoming"><Icon name={event.tasks.length ? 'check' : 'tasks'} />{event.tasks.length ? 'Все задачи выполнены' : 'Добавьте первую задачу'}</div>}</div>
          <button className="text-button upcoming-link" onClick={() => navigate('tasks')}>Открыть все задачи<Icon name="arrow" size={16} /></button>
        </section>),
    budget: (<section className="budget-overview" aria-labelledby="budget-summary-title">
      <div className="section-card-header"><div className="section-title"><Icon name="wallet" size={20} /><h2 id="budget-summary-title">Бюджет мероприятия</h2></div><button className="text-button" onClick={() => navigate('budget')}>Подробнее<Icon name="arrow" size={16} /></button></div>
      <div className="budget-overview-grid">
        <div className="budget-main"><span className="stat-label">{budget.unknownCount ? 'Известная часть ожидаемого итога' : 'Ожидаемый итог'}</span><div className="budget-big-value">{money(budget.total)}<span>Лимит {money(event.limit)}</span></div></div>
        <dl className="budget-breakdown"><div><dt>Оплачено</dt><dd>{money(budget.paid)}</dd></div><div><dt>По договорённостям</dt><dd>{money(budget.agreed)}</dd></div><div><dt>Ожидается</dt><dd>{money(budget.expected)}</dd></div></dl>
      </div>
      <div className={`budget-summary-note ${overrun ? 'is-warning' : ''}`}><Icon name={overrun ? 'alert' : 'info'} size={16} /><span>{overrun ? `Превышение на ${money(overrun)}. Пересмотрите расходы до мероприятия.` : 'Расходы в пределах запланированного бюджета.'}</span></div>
      {budget.unknownCount > 0 && <p className="field-hint">Не все суммы известны. Итог может вырасти после уточнения {budget.unknownCount} статей.</p>}
    </section>),
    team: <TeamWidget event={event} showTeam={showTeam} />,
  }
  return <WorkspaceBoard widgets={widgets} settings={workspace} editing={editing} onChange={onWorkspaceChange} onReset={onResetLayout} />
}

function TeamWidget({ event, showTeam }: { event: EventData; showTeam: () => void }) {
  return <section className="team-widget card"><div className="section-card-header"><div className="section-title"><Icon name="people" size={20} /><h2>Команда</h2></div><button className="text-button" onClick={showTeam}>Редактировать команду<Icon name="arrow" size={16} /></button></div><div className="team-widget-list">{event.team.map((member, index) => <div key={member.id}><span className={`avatar avatar-${index % 3}`}>{member.name[0]}</span><div><strong>{member.name}</strong><p>{member.role}</p></div></div>)}</div></section>
}
