// @ts-nocheck
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import {
  BarChart3,
  Building2,
  CheckSquare,
  Link2,
  LogIn,
  Sparkles,
  Zap,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { Button } from '../components/common/Button'
import { Field, TextInput } from '../components/common/Input'

const FEATURES = [
  { icon: Building2, title: 'One portfolio, three models', text: 'Owned businesses, equity stakes and client work under a single roof.' },
  { icon: BarChart3, title: 'Financial clarity', text: 'Consolidated revenue, expenses and profit streams at a glance.' },
  { icon: CheckSquare, title: 'Unified task board', text: 'Move work across every venture without switching apps.' },
]

export function Login() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    window.setTimeout(() => {
      const result = login(email, password)
      if (result.ok) {
        navigate(from, { replace: true })
      } else {
        setError(result.error)
        setLoading(false)
      }
    }, 400)
  }

  const fillDemo = () => {
    setEmail('zain@zainpreneur.io')
    setPassword('zain123')
    setError(undefined)
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 lg:block">
        <div
          className="absolute -left-32 -top-32 size-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 right-0 size-[28rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #d946ef 0%, transparent 70%)' }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 font-display text-xl font-extrabold text-white shadow-lg shadow-brand-500/30">
              Z
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-extrabold tracking-tight text-white">Zainpreneur</p>
              <p className="text-xs font-medium text-slate-400">Business Command Center</p>
            </div>
          </div>

          <div>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">
              Run every venture
              <br />
              from one place.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              Manage owned businesses, equity investments and client engagements — their finances, tasks and momentum —
              in a single, beautifully organized workspace.
            </p>

            <ul className="mt-10 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-brand-300 ring-1 ring-white/10">
                    <feature.icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            <Zap className="mr-1 inline size-3.5 text-amber-400" />
            Demo workspace — data is stored locally in your browser.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 hidden items-center gap-3 lg:flex">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-fuchsia-500 font-display text-lg font-extrabold text-white">
              Z
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Zainpreneur</span>
          </div>

          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Sign in to your command center to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="login-email" required>
              <TextInput
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" htmlFor="login-password" required>
              <TextInput
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}

            <Button type="submit" icon={<LogIn className="size-4" />} fullWidth disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <button
            type="button"
            onClick={fillDemo}
            className="mt-5 w-full cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-xs text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-300"
          >
            <Sparkles className="mr-1 inline size-3.5" />
            Use demo access — any valid email &amp; a 4+ character password
          </button>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 dark:text-slate-500">
            <Link2 className="size-3.5" />
            No sign-up required. Everything runs in your browser.
          </p>
        </div>
      </div>
    </div>
  )
}