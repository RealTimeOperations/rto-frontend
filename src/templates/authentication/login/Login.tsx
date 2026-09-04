import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import LoginAnimation from './LoginAnimation'

type LoginProps = {
  onLoginStart: () => void
  onLoginSuccess: () => void
  onLoginFail: () => void
}

export default function Login({ onLoginStart, onLoginSuccess, onLoginFail }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  // Handle login: Supabase Auth + role verification
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    onLoginStart()

    const identifier = email.trim().toLowerCase()
    // Admin logs in with email, other users with username
    const loginEmail = identifier.includes('@') ? identifier : identifier + '@rto.local'

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      onLoginFail()
      setError('Invalid username or password')
      setLoading(false)
      return
    }

    const { data: roleData } = await supabase.rpc('get_my_role')
    const role = (roleData as string | null) ?? null

    if (!role) {
      await supabase.auth.signOut()
      onLoginFail()
      setError('You do not have access')
      setLoading(false)
      return
    }

    localStorage.setItem('rto_role_' + data.user.id, role)

    onLoginSuccess()

    setLoading(false)
    }

  const features = [
    {
      title1: 'ATTENDANCE',
      desc: 'Track and manage real-time attendance with accuracy.',
      icon: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />,
      line: 'bg-emerald-400/70 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#d1fae5,transparent)]',
    },
    {
      title1: 'VEHICLES',
      desc: 'Monitor vehicle locations and status in real-time.',
      icon: (
        <>
          <path d="M1 5h13v11H1z" />
          <path d="M14 8h4.6L22 11.6V16h-8z" />
          {/* Rear wheel: tread + rim + hub */}
          <circle cx="6" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
          <circle cx="6" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="6" cy="17.5" r="0.7" />
          {/* Front wheel: tread + rim + hub */}
          <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
          <circle cx="17.5" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="17.5" cy="17.5" r="0.7" />
        </>
      ),
      line: 'bg-emerald-400/70 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#d1fae5,transparent)]',
    },
    {
      title1: 'CONTAINERS',
      desc: 'Track dustbin container status and collections efficiently.',
      icon: (
        <>
          <path d="M9 2h6l1 2h5v2H3V4h5z" />
          <path d="M5 7h14l-1.2 15H6.2z" />
        </>
      ),
      line: 'bg-lime-400/70 shadow-[0_0_12px_2px_rgba(163,230,53,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#fef9c3,transparent)]',
    },
  ]

  return (
    <div className="relative h-screen min-h-screen overflow-hidden bg-[#071b15]">
      {/* Background image (filhal comment out — coded scene step by step banega) */}
      <div
        className="absolute inset-0 bg-no-repeat pointer-events-none"
        style={{ backgroundImage: 'url(/loginpagebackground.png)', backgroundSize: '100% 100%' }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full min-h-0 flex-col px-6 pt-2 pb-2 lg:px-10 lg:pt-3 lg:pb-3">
        {/* Header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Left: Zakwan + divider */}
          <div className="flex items-center justify-between gap-4">
            <img
              src="/logos/zakwan-logo.png"
              alt="Zakwan Builders & Developers"
              className="h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
            />
            <div className="hidden md:block h-12 w-px bg-[linear-gradient(180deg,#059669,#7acba4,#059669)] bg-[length:100%_200%] animate-[text-run-vertical_2.5s_linear_infinite]" />
          </div>

          {/* Center */}
          <div className="hidden md:flex items-center gap-3">
            <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-12 xl:h-14 w-auto object-contain animate-[logo-pulse_4s_ease-in-out_infinite]" />
            <div>
              <div className="text-lg xl:text-xl font-extrabold tracking-wider leading-tight bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">REAL TIME</div>
              <div className="inline-block">
                <div className="text-lg xl:text-xl font-extrabold tracking-[0.15em] leading-tight bg-[linear-gradient(180deg,#059669,#10b981,#34d399,#10b981,#059669)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">OPERATIONS</div>
                <div className="flex justify-between w-full text-[9px] xl:text-[10px] tracking-widest text-slate-300 mt-1">
                  <span>MONITOR</span>
                  <span>•</span>
                  <span>TRACK</span>
                  <span>•</span>
                  <span>OPTIMIZE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: divider + Suthra */}
          <div className="flex items-center justify-between gap-4">
            <div className="hidden md:block h-12 w-px bg-[linear-gradient(180deg,#059669,#7acba4,#059669)] bg-[length:100%_200%] animate-[text-run-vertical_2.5s_linear_infinite]" />
            <img
              src="/logos/suthra-logo.png"
              alt="Suthra Punjab Authority"
              className="h-20 sm:h-24 md:h-32 lg:h-36 xl:h-40 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
            />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 min-h-0 flex flex-col lg:flex-row items-center lg:items-stretch gap-6 lg:gap-8 pt-2 lg:pt-4 pb-0 overflow-hidden login-main">
          {/* Left hero */}
          <section className="flex-1 min-h-0 w-full flex flex-col lg:pl-6 xl:pl-10 login-left">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold leading-tight">
              <span className="bg-[linear-gradient(180deg,#64748b,#94a3b8,#cbd5e1,#94a3b8,#64748b)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">REAL TIME</span>
              <br />
              <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">OPERATIONS</span>
            </h1>
            <p className="text-slate-300 text-sm xl:text-base mt-3 max-w-md">
              Smart Monitoring System for Attendance, Vehicles
              <br />
              <span className="text-emerald-400 font-semibold inline-block pb-3 border-b-4 border-emerald-400">
                & Containers for Tehsil Haroonabad
              </span>
            </p>
            {/* Feature cards — design match */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-4xl login-features">
              {features.map(f => (
                <div
                  key={f.title1}
                  className="relative overflow-hidden rounded-2xl border border-emerald-400/15 bg-linear-to-br from-[#0c2b23] to-[#081f19] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  {/* Dot grid top-right — running colors */}
                  <div className="absolute top-4 right-4 h-[34px] w-[34px] opacity-60 bg-[linear-gradient(135deg,#059669_0%,#059669_40%,#ffffff_50%,#059669_60%,#059669_100%)] bg-[length:300%_300%] animate-[text-run-diagonal_2.5s_linear_infinite] [mask-image:radial-gradient(circle,#000_2px,transparent_2px)] [mask-size:10px_10px]" />
                  {/* Faint arc */}
                  <div className="absolute -right-10 top-10 h-40 w-40 rounded-full border border-emerald-400/10" />
                  {/* Hexagon + title side by side */}
                  <div className="flex items-center">
                    <div className="relative h-14 w-14 shrink-0">
                      <svg className="absolute inset-0 h-full w-full text-emerald-400/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
                        <path d="M12 1.5l9 5.25v10.5L12 22.5l-9-5.25V6.75z" />
                      </svg>
                      <svg className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" viewBox="0 0 24 24" fill="rgba(0,0,0,0.45)" stroke="currentColor" strokeWidth="0.8">
                        <path d="M12 1.5l9 5.25v10.5L12 22.5l-9-5.25V6.75z" />
                      </svg>
                      <svg className="absolute inset-0 m-auto h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                        {f.icon}
                      </svg>
                    </div>
                    <div className="ml-0.5 h-px w-6 bg-emerald-400/60" />
                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                    <div>
                      <div className="text-sm font-extrabold tracking-wide leading-snug bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">{f.title1}</div>
                      <div className="text-sm font-extrabold tracking-wide leading-snug bg-linear-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-transparent">MONITORING</div>
                    </div>
                  </div>

                  {/* Bottom line: static glow (inner shadow) + running highlight */}
                  <div className={`absolute bottom-0 left-0 right-0 h-px ${f.line}`} />
                  <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
                    <div className={`absolute inset-0 ${f.run} bg-[length:40%_100%] bg-no-repeat animate-[line-run_2.5s_linear_infinite]`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Animation container — running border, bottom form ke sath aligned */}
            <div className="relative w-full max-w-4xl mt-4 flex-1 min-h-0 max-h-[200px] rounded-[26px] overflow-hidden shadow-[0_0_18px_rgba(16,185,129,0.18)] login-animation">
              <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />  
              <div className="absolute inset-0.5 rounded-3xl bg-[#071b15]" />
              <div className="absolute inset-0.5 rounded-3xl overflow-hidden">
                <LoginAnimation />
              </div>
            </div>
          </section>

          {/* Right: login card */}
          <section className="w-full max-w-sm shrink-0 lg:flex lg:flex-col lg:justify-start lg:-translate-x-25">
            <div className="relative w-full rounded-[26px] overflow-hidden shadow-[0_0_18px_rgba(16,185,129,0.18)]">
              <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />

              <form
                onSubmit={handleLogin}
                autoComplete="off"
                className="relative m-0.5 rounded-3xl bg-[#071b15] p-8 shadow-[inset_0_4px_8px_rgba(255,255,255,0.12),inset_0_-6px_12px_rgba(0,0,0,0.65),inset_4px_0_8px_rgba(255,255,255,0.05),inset_-4px_0_8px_rgba(0,0,0,0.4)]"
              >
                {/* Circle with running border */}
                <div className="relative h-24 w-24 mx-auto mb-4 rounded-full overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />
                  <div className="absolute inset-0.5 rounded-full bg-[#071b15] flex items-center justify-center">
                    <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-16 w-16 object-contain animate-[logo-pulse_4s_ease-in-out_infinite]" />
                  </div>
                </div>

                <h2 className="text-center text-2xl font-bold mb-1 bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">Welcome Back!</h2>
                <p className="text-center text-xs text-white/55 mb-7">Login to continue to Real Time Operations</p>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-xs font-semibold mb-1.5 bg-linear-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Username / Email</label>
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#10b981,#34d399,#7acba4,#34d399,#10b981)] opacity-60" />
                    <div className="relative m-[1.5px] rounded-[11px] bg-[#071b15]">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-10 5L2 7" />
                      </svg>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        placeholder="username ya admin@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 bg-transparent rounded-[11px] text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-semibold mb-1.5 bg-linear-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Password</label>
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#10b981,#34d399,#7acba4,#34d399,#10b981)] opacity-60" />
                    <div className="relative m-[1.5px] rounded-[11px] bg-[#071b15]">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-12 pl-10 pr-11 bg-transparent rounded-[11px] text-white text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition animate-[eye-run_3s_linear_infinite]"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-xs mb-6">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    Remember Me
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="running-button w-full h-12 rounded-full text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                >
                  {loading ? 'Logging in…' : 'Login'}
                  {!loading && (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}