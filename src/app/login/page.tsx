'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ChevronDown, ChevronUp, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { BorderBeam } from '@/components/ui/border-beam'
import { ShimmerButton } from '@/components/ui/shimmer-button'

interface DemoCredential {
  role: string
  email: string
  password: string
  badge: string
  rowBg: string
  rowBorder: string
  rolePill: string
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    role: 'Employee',
    email: 'employee@demo.com',
    password: 'Demo@1234',
    badge: 'bg-slate-100 text-slate-700',
    rowBg: 'hover:bg-slate-50',
    rowBorder: 'hover:border-slate-300',
    rolePill: 'bg-slate-100 text-slate-700',
  },
  {
    role: 'Manager',
    email: 'manager@demo.com',
    password: 'Demo@1234',
    badge: 'bg-indigo-100 text-indigo-700',
    rowBg: 'hover:bg-indigo-50',
    rowBorder: 'hover:border-indigo-300',
    rolePill: 'bg-indigo-100 text-indigo-700',
  },
  {
    role: 'Admin',
    email: 'admin@demo.com',
    password: 'Demo@1234',
    badge: 'bg-violet-100 text-violet-700',
    rowBg: 'hover:bg-violet-50',
    rowBorder: 'hover:border-violet-300',
    rolePill: 'bg-violet-100 text-violet-700',
  },
]

// Metric cards shown in the right decorative panel
const PANEL_METRICS = [
  { label: 'Goals Set', value: '247', delay: 0 },
  { label: 'Approved', value: '189', delay: 0.15 },
  { label: 'Completion', value: '78%', delay: 0.3 },
]

function FloatingMetricCard({
  label,
  value,
  delay,
}: {
  label: string
  value: string
  delay: number
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 3.5,
        ease: 'easeInOut',
        repeat: Infinity,
        delay,
      }}
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-4 text-white"
    >
      <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </motion.div>
  )
}


export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Invalid email or password. Check your credentials and try again.'
          : authError.message,
      )
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
    <div className="min-h-screen flex overflow-hidden relative bg-slate-50">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-40 bg-indigo-100 -top-48 -left-32"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-40 bg-violet-100 top-1/2 -right-48"
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity, delay: 2 }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-40 bg-slate-200 bottom-0 left-1/4"
          animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity, delay: 5 }}
        />
      </div>

      {/* Left: login form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Logo / wordmark */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 leading-none tracking-tight">AQTracker</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-none font-medium">Performance Management Portal</p>
            </div>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
            className="relative bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-2xl p-8"
          >
            <BorderBeam size={220} duration={12} colorFrom="#6366f1" colorTo="#8b5cf6" />

            {/* Header */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your account</h1>
              <p className="text-sm text-slate-500 mt-1.5">Enter your credentials to access the portal</p>
            </div>

            {/* Role pills — staggered entrance */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Roles:</span>
              {DEMO_CREDENTIALS.map((c, i) => (
                <motion.span
                  key={c.role}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.08 }}
                  className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', c.badge)}
                >
                  {c.role}
                </motion.span>
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div className="relative">
                <motion.label
                  htmlFor="email"
                  animate={emailFocused || email ? { y: -26, scale: 0.82, color: '#6366f1' } : { y: 0, scale: 1, color: '#64748b' }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute left-4 top-3.5 text-sm font-medium pointer-events-none origin-left z-10"
                  style={{ transformOrigin: 'left center' }}
                >
                  Email address
                </motion.label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className={cn(
                    'w-full h-12 px-4 pt-4 pb-1 text-sm border rounded-xl bg-white text-slate-900 placeholder-transparent focus:outline-none transition-all duration-200',
                    emailFocused
                      ? 'ring-2 ring-indigo-500/20 border-indigo-400'
                      : 'border-slate-300 hover:border-slate-400',
                  )}
                  placeholder="you@company.com"
                />
              </div>

              {/* Password field */}
              <div className="relative">
                <motion.label
                  htmlFor="password"
                  animate={passwordFocused || password ? { y: -26, scale: 0.82, color: '#6366f1' } : { y: 0, scale: 1, color: '#64748b' }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute left-4 top-3.5 text-sm font-medium pointer-events-none origin-left z-10"
                  style={{ transformOrigin: 'left center' }}
                >
                  Password
                </motion.label>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full h-12 px-4 pr-12 pt-4 pb-1 text-sm border rounded-xl bg-white text-slate-900 placeholder-transparent focus:outline-none transition-all duration-200',
                    passwordFocused
                      ? 'ring-2 ring-indigo-500/20 border-indigo-400'
                      : 'border-slate-300 hover:border-slate-400',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <ShimmerButton
                type="submit"
                disabled={loading}
                borderRadius="12px"
                background="rgba(79, 70, 229, 1)"
                className="w-full h-12 text-sm font-semibold mt-1"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </ShimmerButton>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setDemoOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                {demoOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Demo credentials
              </button>

              <AnimatePresence>
                {demoOpen && (
                  <motion.div
                    key="demo-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {DEMO_CREDENTIALS.map((cred) => (
                        <button
                          key={cred.email}
                          type="button"
                          onClick={() => fillDemo(cred)}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 transition-all duration-150 group',
                            'hover:-translate-y-0.5',
                            cred.rowBg,
                            cred.rowBorder,
                          )}
                        >
                          <div className="text-left">
                            <p className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">{cred.email}</p>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">{cred.password}</p>
                          </div>
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cred.rolePill)}>
                            {cred.role}
                          </span>
                        </button>
                      ))}
                      <p className="text-xs text-slate-400 text-center pt-1">Click a row to auto-fill the form</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <p className="text-center text-xs text-slate-400 mt-6">
            &copy; {new Date().getFullYear()} AQTracker. Internal use only.
          </p>
        </div>
      </div>

      {/* Right: decorative panel (desktop only) */}
      <div className="hidden lg:flex relative w-[420px] xl:w-[480px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex-col items-center justify-center p-12 overflow-hidden">
        {/* Decorative blobs inside the panel */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-80 h-80 rounded-full bg-indigo-500/30 blur-3xl -top-20 -right-20"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
          />
          <motion.div
            className="absolute w-64 h-64 rounded-full bg-violet-500/30 blur-3xl bottom-10 -left-10"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, delay: 3 }}
          />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          {/* Panel heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold text-white leading-tight tracking-tight">
              Align. Track. Achieve.
            </h2>
            <p className="text-indigo-200 text-sm mt-3 leading-relaxed">
              A unified performance management portal for goal setting, tracking, and quarterly check-ins across your organization.
            </p>
          </motion.div>

          {/* Floating metric cards */}
          <div className="flex flex-col gap-4">
            {PANEL_METRICS.map((m) => (
              <FloatingMetricCard key={m.label} label={m.label} value={m.value} delay={m.delay} />
            ))}
          </div>

          {/* Bottom tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-indigo-300 text-xs text-center mt-12 leading-relaxed"
          >
            Trusted by teams across departments for annual performance cycles
          </motion.p>
        </div>
      </div>
    </div>
  )
}
