import { create } from 'zustand'
import type {
  Dashboard,
  DashboardLayout,
  Widget,
  WidgetDataResponse,
} from '@/types/dashboard'
import type { LayoutItem } from 'react-grid-layout'

interface DashboardState {
  // Dashboard data
  dashboard: Dashboard | null
  parsedLayout: DashboardLayout | null

  // Variable values: { varName: selectedValue }
  variableValues: Record<string, string>

  // Widget data keyed by widget ID
  widgetData: Record<string, WidgetDataResponse>

  // UI state
  dirty: boolean
  loading: boolean
  resolving: boolean
  error: string | null

  // Actions
  setDashboard: (dashboard: Dashboard) => void
  setLoading: (loading: boolean) => void
  setResolving: (resolving: boolean) => void
  setError: (error: string | null) => void
  markDirty: () => void
  markClean: () => void

  // Layout mutations
  updateGridLayout: (layouts: readonly LayoutItem[]) => void
  addWidget: (widget: Widget) => void
  updateWidget: (widget: Widget) => void
  removeWidget: (widgetId: string) => void

  // Variable actions
  setVariableValue: (name: string, value: string) => void

  // Widget data
  setWidgetData: (data: WidgetDataResponse[]) => void

  // Serialize layout back to JSON string
  getLayoutJson: () => string

  // Reset
  reset: () => void
}

const DEFAULT_LAYOUT: DashboardLayout = { widgets: [], variables: [] }

function parseLayout(json: string | null | undefined): DashboardLayout {
  if (!json) return { ...DEFAULT_LAYOUT }
  try {
    const parsed = JSON.parse(json)
    return {
      widgets: parsed.widgets ?? [],
      variables: parsed.variables ?? [],
    }
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboard: null,
  parsedLayout: null,
  variableValues: {},
  widgetData: {},
  dirty: false,
  loading: false,
  resolving: false,
  error: null,

  setDashboard: (dashboard) => {
    const parsedLayout = parseLayout(dashboard.layout)
    // Initialize variable values from defaults
    const variableValues: Record<string, string> = {}
    for (const v of parsedLayout.variables) {
      if (v.currentValue) variableValues[v.name] = v.currentValue
      else if (v.defaultValue) variableValues[v.name] = v.defaultValue
    }
    set({ dashboard, parsedLayout, variableValues, dirty: false, error: null })
  },

  setLoading: (loading) => set({ loading }),
  setResolving: (resolving) => set({ resolving }),
  setError: (error) => set({ error }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),

  updateGridLayout: (layouts) => {
    const { parsedLayout } = get()
    if (!parsedLayout) return

    const updatedWidgets = parsedLayout.widgets.map((w) => {
      const layoutItem = layouts.find((l) => l.i === w.id)
      if (layoutItem) {
        return {
          ...w,
          gridPos: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
        }
      }
      return w
    })

    set({
      parsedLayout: { ...parsedLayout, widgets: updatedWidgets },
      dirty: true,
    })
  },

  addWidget: (widget) => {
    const { parsedLayout } = get()
    if (!parsedLayout) return
    set({
      parsedLayout: {
        ...parsedLayout,
        widgets: [...parsedLayout.widgets, widget],
      },
      dirty: true,
    })
  },

  updateWidget: (widget) => {
    const { parsedLayout } = get()
    if (!parsedLayout) return
    set({
      parsedLayout: {
        ...parsedLayout,
        widgets: parsedLayout.widgets.map((w) => (w.id === widget.id ? widget : w)),
      },
      dirty: true,
    })
  },

  removeWidget: (widgetId) => {
    const { parsedLayout, widgetData } = get()
    if (!parsedLayout) return
    const { [widgetId]: _, ...remainingData } = widgetData
    set({
      parsedLayout: {
        ...parsedLayout,
        widgets: parsedLayout.widgets.filter((w) => w.id !== widgetId),
      },
      widgetData: remainingData,
      dirty: true,
    })
  },

  setVariableValue: (name, value) => {
    set((state) => ({
      variableValues: { ...state.variableValues, [name]: value },
    }))
  },

  setWidgetData: (data) => {
    const map: Record<string, WidgetDataResponse> = {}
    for (const d of data) {
      map[d.widgetId] = d
    }
    set({ widgetData: map })
  },

  getLayoutJson: () => {
    const { parsedLayout } = get()
    return JSON.stringify(parsedLayout ?? DEFAULT_LAYOUT)
  },

  reset: () =>
    set({
      dashboard: null,
      parsedLayout: null,
      variableValues: {},
      widgetData: {},
      dirty: false,
      loading: false,
      resolving: false,
      error: null,
    }),
}))
