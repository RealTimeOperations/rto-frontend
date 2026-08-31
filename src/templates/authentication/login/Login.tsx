import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Handle admin login: Supabase Auth + role verification
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    // Fetch the logged-in user's role from the database
    const { data: roleData } = await supabase.rpc('get_my_role')
    const role = (roleData as string | null) ?? null

    if (role !== 'admin') {
      await supabase.auth.signOut()
      setError('You do not have admin access')
      setLoading(false)
      return
    }

    // Cache role for instant future logins
    localStorage.setItem('rto_role_' + data.user.id, role)
    setLoading(false)
    // App will automatically redirect to /admin
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 bg-linear-to-br from-[#06231c] to-[#0b352a]">
      {/* Top-left: Zakwan Builders logo (transparent, responsive, embossed) */}
      <img
        src="/logos/zakwan-logo.png"
        alt="Zakwan Builders & Developers"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)]"
      />

      {/* Top-right: Suthra Punjab Authority logo (aligned, embossed) */}
      <img
        src="/logos/suthra-logo.png"
        alt="Suthra Punjab Authority"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 h-20 sm:h-24 md:h-32 lg:h-36 xl:h-40 w-auto object-contain -translate-y-2 sm:-translate-y-3 drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)]"
      />

      {/* Electric animated border wrapper */}
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.4),0_5px_12px_rgba(0,0,0,0.25)]">
        {/* Rotating conic gradient (running electric colors) */}
        <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#047857,#059669,#6ee7b7,#047857)]" />
        {/* Electric glow layer */}
        <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#047857,#059669,#6ee7b7,#047857)] blur-md opacity-60" />

        <form
          onSubmit={handleLogin}
          className="relative m-0.5 bg-linear-to-br from-[#0d372c] to-[#08261f] rounded-[14px] p-9 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),inset_0_-2px_4px_rgba(0,0,0,0.3)]"
        >
        {/* Real Time Operations logo */}
        <img
          src="/logos/loginform-logo.png"
          alt="Real Time Operations"
          className="h-20 w-20 sm:h-24 sm:w-24 mx-auto mb-4 object-contain rounded-2xl shadow-lg"
        />
        <h1 className="running-text text-center text-xl font-bold mb-1">Real Time Operations</h1>
        <p className="text-center text-xs text-white/55 mb-7">Sign in to continue</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-white/70 mb-1.5">Email</label>
          {/* Electric border wrapper (1px running colors) */}
          <div className="relative rounded-xl overflow-hidden focus-within:shadow-[0_0_14px_rgba(52,211,153,0.3)]">
            <div className="absolute left-[calc(50%-250px)] top-[calc(50%-250px)] h-125 w-125 animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#047857,#059669,#6ee7b7,#047857)]" />
            <div className="absolute inset-px rounded-[11px] bg-[#123a30]" />
            <input
              type="email"
              required
              placeholder="admin@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative w-full h-12 px-4 bg-transparent rounded-xl text-white text-base outline-none"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-white/70 mb-1.5">Password</label>
          {/* Electric border wrapper (1px running colors) */}
          <div className="relative rounded-xl overflow-hidden transition focus-within:shadow-[0_0_14px_rgba(52,211,153,0.3)]">
            <div className="absolute left-[calc(50%-250px)] top-[calc(50%-250px)] h-125 w-125 animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#047857,#059669,#6ee7b7,#047857)]" />
            <div className="absolute inset-px rounded-[11px] bg-[#123a30]" />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 bg-transparent rounded-xl text-white text-base outline-none"
              />
              {/* Show / hide password toggle */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition"
              >
                {showPassword ? (
                  <svg className="h-5 w-5 animate-[eye-stroke-cycle_6s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 animate-[eye-stroke-cycle_6s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="running-button block mx-auto w-44 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        </form>
      </div>
    </div>
  )
}