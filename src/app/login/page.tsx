'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ChevronDown, ChevronUp, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DemoCredential {
  role: string
  email: string
  password: string
  badge: string
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  { role: 'Employee', email: 'employee@demo.com', password: 'Demo@1234', badge: 'bg-slate-100 text-slate-700' },
  { role: 'Manager', email: 'manager@demo.com', password: 'Demo@1234', badge: 'bg-indigo-100 text-indigo-700' },
  { role: 'Admin', email: 'admin@demo.com', password: 'Demo@1234', badge: 'bg-violet-100 text-violet-700' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Invalid email or password. Check your credentials and try again.'
        : authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  function fillDemo(cred: DemoCredential) {
    setEmail(cred.email)
    setPassword(cred.password)
    setDemoOpen(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-none">AQTracker</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-none">Goal Setting &amp; Tracking</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">

          {/* Header */}
          <div className="mb-7">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Sign in to your account</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the portal</p>
          </div>

          {/* Role pills */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-slate-400 font-medium">Roles:</span>
            {DEMO_CREDENTIALS.map((c) => (
              <span key={c.role} className={cn('text-xs font-medium px-2 py-0.5 rounded-full', c.badge)}>
                {c.role}
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
            >
              {demoOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Demo credentials
            </button>

            {demoOpen && (
              <div className="mt-3 space-y-2">
                {DEMO_CREDENTIALS.map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => fillDemo(cred)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition group"
                  >
                    <div className="text-left">
                      <p className="text-xs font-medium text-slate-700 group-hover:text-indigo-700">{cred.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{cred.password}</p>
                    </div>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cred.badge)}>
                      {cred.role}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-slate-400 text-center pt-1">Click a row to auto-fill the form</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} AQTracker. Internal use only.
        </p>
      </div>
    </div>
  )
}
