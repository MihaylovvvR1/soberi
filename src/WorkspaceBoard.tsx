import type { ReactNode } from 'react'
import { DragBoard, DragSurface } from './DragSurface'
import { changeWidget, reorderWidget, widgetNames } from './workspace'
import type { WidgetId, WorkspaceSettings } from './workspace'
import { Icon } from './Icons'

interface Props {
  widgets: Record<WidgetId, ReactNode>; settings: WorkspaceSettings; editing: boolean
  onChange: (update: (settings: WorkspaceSettings) => WorkspaceSettings) => void
  onReset: () => void
}
export function WorkspaceBoard({ widgets, settings, editing, onChange, onReset }: Props) {
  const visible = settings.widgets.filter(widget => widget.visible)
  const hidden = settings.widgets.filter(widget => !widget.visible)
  function move(id: WidgetId, direction: -1 | 1) {
    const index = visible.findIndex(widget => widget.id === id), target = visible[index + direction]
    if (target) onChange(current => reorderWidget(current, id, target.id, direction < 0 ? 'before' : 'after'))
  }
  return <div className={`workspace-constructor ${editing ? 'is-editing' : ''}`}>
    {editing && <section className="workspace-edit-panel" aria-label="Настройка рабочего пространства">
      <div className="workspace-edit-heading"><div><strong>Режим настройки экрана</strong><p>Меняйте порядок ручками или кнопками. Настройки общие для ваших мероприятий.</p></div><button className="button secondary small" onClick={onReset}><Icon name="return" size={16} />Сбросить расположение</button></div>
      <div className="hidden-widgets"><span>Скрытые блоки:</span>{hidden.length ? hidden.map(widget => <button className="restore-widget" key={widget.id} onClick={() => onChange(current => changeWidget(current, widget.id, { visible: true }))}><Icon name="plus" size={14} />Вернуть: {widgetNames[widget.id]}</button>) : <span>Все блоки показаны</span>}</div>
    </section>}
    <DragBoard onDrop={(active, target, placement) => onChange(current => reorderWidget(current, active.key as WidgetId, target.key as WidgetId, placement))}>
      <div className="workspace-grid">{visible.map((widget, index) => <DragSurface key={widget.id} id={`workspace-${widget.id}`} item={{ kind: 'widget', key: widget.id, label: widgetNames[widget.id] }} disabled={!editing} className={`workspace-widget widget-${widget.id}`} data-testid="workspace-widget" data-widget-id={widget.id} data-width={widget.width}>
        {handle => <>
          {editing && <div className="widget-edit-controls" data-tour={`widget-controls-${widget.id}`}><div className="widget-edit-title">{handle}<strong>{widgetNames[widget.id]}</strong></div><div className="widget-edit-actions"><button className="order-button" aria-label={`Выше блок: ${widgetNames[widget.id]}`} disabled={index === 0} onClick={() => move(widget.id, -1)}><Icon name="up" size={14} />Выше</button><button className="order-button" aria-label={`Ниже блок: ${widgetNames[widget.id]}`} disabled={index === visible.length - 1} onClick={() => move(widget.id, 1)}><Icon name="down" size={14} />Ниже</button><label>Ширина<select aria-label={`Ширина блока: ${widgetNames[widget.id]}`} value={widget.width} onChange={e => onChange(current => changeWidget(current, widget.id, { width: Number(e.target.value) as 1 | 2 }))}><option value={1}>1 колонка</option><option value={2}>2 колонки</option></select></label>{widget.id !== 'event' ? <button className="order-button hide-widget" aria-label={`Скрыть блок: ${widgetNames[widget.id]}`} onClick={() => onChange(current => changeWidget(current, widget.id, { visible: false }))}><Icon name="eye" size={15} />Скрыть</button> : <span className="required-widget">Обязательный блок</span>}</div></div>}
          <div className="widget-content">{widgets[widget.id]}</div>
        </>}
      </DragSurface>)}</div>
    </DragBoard>
  </div>
}
