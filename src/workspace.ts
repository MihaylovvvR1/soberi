export const workspaceKey = 'soberi-workspace-v1'
export const widgetNames = { event: 'Сведения о мероприятии', risks: 'Антипровал', upcoming: 'Ближайшие задачи', budget: 'Бюджет', team: 'Команда', progress: 'Прогресс' } as const
export type WidgetId = keyof typeof widgetNames
export interface WidgetSetting { id: WidgetId; visible: boolean; width: 1 | 2 }
export interface WorkspaceSettings { version: 1; widgets: WidgetSetting[] }
export function defaultWorkspace(): WorkspaceSettings { return { version: 1, widgets: [
  { id: 'event', visible: true, width: 2 }, { id: 'risks', visible: true, width: 2 },
  { id: 'upcoming', visible: true, width: 1 }, { id: 'progress', visible: true, width: 1 },
  { id: 'budget', visible: true, width: 2 }, { id: 'team', visible: true, width: 2 },
] } }
export function normalizeWorkspace(value: unknown): WorkspaceSettings {
  const defaults = defaultWorkspace()
  if (!value || typeof value !== 'object' || !('widgets' in value) || !Array.isArray(value.widgets)) return defaults
  const widgets: WidgetSetting[] = []
  for (const raw of value.widgets) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !Object.hasOwn(widgetNames, raw.id) || widgets.some(widget => widget.id === raw.id)) continue
    const id = raw.id as WidgetId
    widgets.push({ id, width: raw.width === 1 ? 1 : 2, visible: id === 'event' || raw.visible !== false })
  }
  return { version: 1, widgets: [...widgets, ...defaults.widgets.filter(item => !widgets.some(widget => widget.id === item.id))] }
}
export function changeWidget(settings: WorkspaceSettings, id: WidgetId, changes: Partial<Pick<WidgetSetting, 'visible' | 'width'>>): WorkspaceSettings {
  return { ...settings, widgets: settings.widgets.map(widget => widget.id === id ? { ...widget, ...changes, visible: id === 'event' ? true : changes.visible ?? widget.visible } : widget) }
}
export function reorderWidget(settings: WorkspaceSettings, id: WidgetId, targetId: WidgetId, placement: 'before' | 'after' = 'before'): WorkspaceSettings {
  if (id === targetId) return settings
  const widget = settings.widgets.find(widget => widget.id === id)
  if (!widget || !settings.widgets.some(item => item.id === targetId)) return settings
  const rest = settings.widgets.filter(widget => widget.id !== id), index = rest.findIndex(widget => widget.id === targetId) + (placement === 'after' ? 1 : 0)
  return { ...settings, widgets: [...rest.slice(0, index), widget, ...rest.slice(index)] }
}
export function readWorkspace() { try { return normalizeWorkspace(JSON.parse(localStorage.getItem(workspaceKey) ?? 'null')) } catch { return defaultWorkspace() } }
export function saveWorkspace(settings: WorkspaceSettings) { try { localStorage.setItem(workspaceKey, JSON.stringify(settings)); return true } catch { return false } }
