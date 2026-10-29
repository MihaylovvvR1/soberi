import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragMoveEvent } from '@dnd-kit/core'
import type { EntityId } from './data'
import { Icon } from './Icons'

export interface DragMeta { kind: 'widget' | 'stage' | 'task'; key: EntityId; label: string; stageId?: string }
export type Placement = 'before' | 'after'
interface DragPreview { active: DragMeta | null; target: string | null; placement: Placement }
const Preview = createContext<DragPreview>({ active: null, target: null, placement: 'before' })
const meta = (value: unknown) => value as DragMeta
const collision: CollisionDetection = args => {
  const kind = meta(args.active.data.current).kind
  const containers = args.droppableContainers.filter(item => {
    const target = meta(item.data.current)
    return target && (kind === 'task' ? target.kind === 'task' || target.kind === 'stage' : target.kind === kind)
  })
  const filtered = { ...args, droppableContainers: containers }
  if (!args.pointerCoordinates) return closestCenter(filtered)
  const hits = pointerWithin(filtered)
  const tasks = kind === 'task' ? hits.filter(hit => containers.find(item => item.id === hit.id)?.data.current?.kind === 'task') : []
  return tasks.length ? tasks : hits
}
function placement(event: DragMoveEvent | DragEndEvent, pointerY: number | null): Placement {
  if (!event.over) return 'before'
  if (meta(event.active.data.current).kind === 'task' && meta(event.over.data.current).kind === 'stage') return 'after'
  const rect = event.active.rect.current.translated
  // event.delta includes scroll adjustment; collision coordinates stay in viewport space.
  const y = pointerY ?? (rect ? rect.top + rect.height / 2 : 0)
  return y >= event.over.rect.top + event.over.rect.height / 2 ? 'after' : 'before'
}
export function DragBoard({ children, onDrop }: { children: ReactNode; onDrop: (active: DragMeta, target: DragMeta, placement: Placement) => void }) {
  const [preview, setPreview] = useState<DragPreview>({ active: null, target: null, placement: 'before' })
  const pointerY = useRef<number | null>(null)
  const detectCollision = useCallback<CollisionDetection>(args => { pointerY.current = args.pointerCoordinates?.y ?? null; return collision(args) }, [])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor))
  const clear = () => setPreview({ active: null, target: null, placement: 'before' })
  function move(event: DragMoveEvent) {
    const target = event.over ? String(event.over.id) : null, next = placement(event, pointerY.current)
    setPreview(previous => previous.target === target && previous.placement === next ? previous : { ...previous, target, placement: next })
  }
  return <Preview.Provider value={preview}><DndContext sensors={sensors} collisionDetection={detectCollision}
    accessibility={{ screenReaderInstructions: { draggable: 'Для переноса нажмите пробел на ручке, используйте стрелки и снова пробел. Escape отменяет перенос. Также доступны кнопки «Выше» и «Ниже».' }, announcements: {
      onDragStart: ({ active }) => `Переносится ${meta(active.data.current).label}.`,
      onDragOver: ({ over }) => over ? `Место вставки: ${meta(over.data.current).label}.` : 'За пределами места вставки.',
      onDragEnd: ({ over }) => over ? 'Перестановка завершена.' : 'Перестановка отменена.',
      onDragCancel: () => 'Перестановка отменена.',
    } }}
    onDragStart={({ active }) => setPreview({ active: meta(active.data.current), target: null, placement: 'before' })}
    onDragMove={move} onDragOver={move} onDragCancel={clear}
    onDragEnd={event => { if (event.over && event.over.id !== event.active.id) onDrop(meta(event.active.data.current), meta(event.over.data.current), placement(event, pointerY.current)); clear() }}>
    {children}{createPortal(<DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>{preview.active && <div className="drag-ghost" aria-hidden="true"><Icon name="grip" size={20} />{preview.active.label}</div>}</DragOverlay>, document.body)}
  </DndContext></Preview.Provider>
}
export function DragSurface({ item, disabled = false, className = '', children, ...attributes }: {
  item: DragMeta; disabled?: boolean; className?: string; children: (handle: ReactNode) => ReactNode
  'data-testid'?: string; 'data-widget-id'?: string; 'data-stage-id'?: string; 'data-task-id'?: EntityId; 'data-width'?: number; id?: string
}) {
  const id = `${item.kind}:${item.key}`
  const draggable = useDraggable({ id, data: item, disabled, attributes: { roleDescription: 'перемещаемый элемент' } })
  const droppable = useDroppable({ id, data: item, disabled })
  const setNodeRef = useCallback((node: HTMLDivElement | null) => { draggable.setNodeRef(node); droppable.setNodeRef(node) }, [draggable.setNodeRef, droppable.setNodeRef])
  const preview = useContext(Preview)
  const over = preview.target === id && preview.active && `${preview.active.kind}:${preview.active.key}` !== id
  const handle = <button type="button" ref={draggable.setActivatorNodeRef} {...draggable.listeners} {...draggable.attributes} aria-label={`Перетащить: ${item.label}`} className="drag-handle" title="Перетащить за ручку"><Icon name="grip" size={19} /></button>
  return <div ref={setNodeRef} {...attributes} className={`${className} ${draggable.isDragging ? 'is-dragging' : ''} ${over ? `drop-${preview.placement}` : ''}`}>{children(handle)}{over && <span className={`insertion-label insertion-${preview.placement}`} aria-hidden="true">{preview.active?.kind === 'task' && item.kind === 'stage' ? 'В конец этапа' : 'Место вставки'}</span>}</div>
}
