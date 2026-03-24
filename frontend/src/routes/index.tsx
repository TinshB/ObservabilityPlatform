import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout  from '@/layouts/MainLayout'
import AuthLayout  from '@/layouts/AuthLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PrivateRoute from './PrivateRoute'
import { RouteTracer } from '@/telemetry'

// ── Lazy-loaded pages (code splitting per route) ──────────────────────────────
// Each import() becomes a separate bundle chunk, reducing the initial load size.

const LoginPage     = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const NotFoundPage  = lazy(() => import('@/pages/NotFoundPage'))

// Sprint 3
const UsersPage     = lazy(() => import('@/pages/admin/UsersPage'))
const RolesPage     = lazy(() => import('@/pages/admin/RolesPage'))
const ProfilePage   = lazy(() => import('@/pages/admin/ProfilePage'))

// Sprint 4
const ServicesPage  = lazy(() => import('@/pages/services/ServicesPage'))

// Sprint 5
const MetricsExplorerPage = lazy(() => import('@/pages/metrics/MetricsExplorerPage'))

// Sprint 6
const LogExplorerPage = lazy(() => import('@/pages/logs/LogExplorerPage'))

// Sprint 7
const TraceViewerPage        = lazy(() => import('@/pages/traces/TraceViewerPage'))
const TransactionTracesPage  = lazy(() => import('@/pages/traces/TransactionTracesPage'))
const TraceDetailPage        = lazy(() => import('@/pages/traces/TraceDetailPage'))

// Sprint 8
const ServiceDeepDivePage = lazy(() => import('@/pages/services/ServiceDeepDivePage'))
const ApmOverviewPage     = lazy(() => import('@/pages/apm/ApmOverviewPage'))

// Sprint 10
const AlertsPage        = lazy(() => import('@/pages/alerts/AlertsPage'))
const SlaRulesPage      = lazy(() => import('@/pages/alerts/SlaRulesPage'))
const AlertChannelsPage = lazy(() => import('@/pages/alerts/AlertChannelsPage'))

// Sprint 11
const AlertHistoryPage  = lazy(() => import('@/pages/alerts/AlertHistoryPage'))
const DependencyMapPage = lazy(() => import('@/pages/dependencies/DependencyMapPage'))

// Sprint 12
const WorkflowListPage      = lazy(() => import('@/pages/workflows/WorkflowListPage'))
const WorkflowBuilderPage   = lazy(() => import('@/pages/workflows/WorkflowBuilderPage'))
const WorkflowDashboardPage = lazy(() => import('@/pages/workflows/WorkflowDashboardPage'))

// Sprint 13
const DashboardListPage   = lazy(() => import('@/pages/dashboards/DashboardListPage'))
const DashboardCanvasPage = lazy(() => import('@/pages/dashboards/DashboardCanvasPage'))

// Sprint 14
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const SyntheticMonitoringPage = lazy(() => import('@/pages/synthetic/SyntheticMonitoringPage'))

// Billing (US-BILL-001)
const BillingPage = lazy(() => import('@/pages/billing/BillingPage'))

// AI Insights (Coming Soon)
const AiInsightsPage = lazy(() => import('@/pages/ai-insights/AiInsightsPage'))

// Future routes (added as sprints deliver them):
//  Sprint 15-16: /ai

/** MainLayout + RouteTracer — creates a span per route navigation. */
function RouteTracerLayout() {
  return (
    <RouteTracer>
      <MainLayout />
    </RouteTracer>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen message="Loading…" />}>
      <Routes>
        {/* ── Unauthenticated (auth layout) ──────────────────────────── */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* ── Authenticated application routes ───────────────────────── */}
        <Route element={<PrivateRoute />}>
          <Route element={<RouteTracerLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/apm" element={<ErrorBoundary><ApmOverviewPage /></ErrorBoundary>} />
            <Route path="/services" element={<ErrorBoundary><ServicesPage /></ErrorBoundary>} />
            <Route path="/services/:serviceId" element={<ErrorBoundary><ServiceDeepDivePage /></ErrorBoundary>} />
            <Route path="/metrics" element={<ErrorBoundary><MetricsExplorerPage /></ErrorBoundary>} />
            <Route path="/logs" element={<ErrorBoundary><LogExplorerPage /></ErrorBoundary>} />
            <Route path="/transactions" element={<ErrorBoundary><TraceViewerPage /></ErrorBoundary>} />
            <Route path="/transactions/:operation" element={<ErrorBoundary><TransactionTracesPage /></ErrorBoundary>} />
            <Route path="/transactions/:operation/traces/:traceId" element={<ErrorBoundary><TraceDetailPage /></ErrorBoundary>} />
            <Route path="/traces/:traceId" element={<ErrorBoundary><TraceDetailPage /></ErrorBoundary>} />
            <Route path="/admin/users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
            <Route path="/admin/roles" element={<ErrorBoundary><RolesPage /></ErrorBoundary>} />
            <Route path="/alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
            <Route path="/alerts/history" element={<ErrorBoundary><AlertHistoryPage /></ErrorBoundary>} />
            <Route path="/sla-rules" element={<ErrorBoundary><SlaRulesPage /></ErrorBoundary>} />
            <Route path="/alerts/channels" element={<ErrorBoundary><AlertChannelsPage /></ErrorBoundary>} />
            <Route path="/dependencies" element={<ErrorBoundary><DependencyMapPage /></ErrorBoundary>} />
            <Route path="/workflows" element={<ErrorBoundary><WorkflowListPage /></ErrorBoundary>} />
            <Route path="/workflows/:workflowId" element={<ErrorBoundary><WorkflowBuilderPage /></ErrorBoundary>} />
            <Route path="/workflows/:workflowId/dashboard" element={<ErrorBoundary><WorkflowDashboardPage /></ErrorBoundary>} />
            <Route path="/dashboards" element={<ErrorBoundary><DashboardListPage /></ErrorBoundary>} />
            <Route path="/dashboards/:dashboardId" element={<ErrorBoundary><DashboardCanvasPage /></ErrorBoundary>} />
            <Route path="/reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
            <Route path="/synthetic" element={<ErrorBoundary><SyntheticMonitoringPage /></ErrorBoundary>} />
            <Route path="/admin/billings" element={<ErrorBoundary><BillingPage /></ErrorBoundary>} />
            <Route path="/ai-insights" element={<ErrorBoundary><AiInsightsPage /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
          </Route>
        </Route>

        {/* ── Catch-all ──────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
