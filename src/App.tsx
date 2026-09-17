import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { useBusinesses } from './context/BusinessContext'
import { useApplyTheme } from './hooks/useTheme'
import { RequireAuth } from './components/layout/AppLayout'
import { PageSkeleton } from './components/common/Skeleton'

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const BusinessesList = lazy(() => import('./pages/BusinessesList').then((module) => ({ default: module.BusinessesList })))
const BusinessDetail = lazy(() => import('./pages/BusinessDetail').then((module) => ({ default: module.BusinessDetail })))
const Owners = lazy(() => import('./pages/Owners').then((module) => ({ default: module.Owners })))
const Financials = lazy(() => import('./pages/Financials').then((module) => ({ default: module.Financials })))
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({ default: module.Tasks })))
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })))
const Assets = lazy(() => import('./pages/Assets').then((module) => ({ default: module.Assets })))
const Team = lazy(() => import('./pages/Team').then((module) => ({ default: module.Team })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })))

function AppRoutes() {
  const { settings } = useBusinesses()
  useApplyTheme(settings)

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/businesses" element={<BusinessesList />} />
          <Route path="/businesses/:id" element={<BusinessDetail />} />
          <Route path="/owners" element={<Owners />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/team" element={<Team />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return <AppRoutes />
}