import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    const { data: roleData, error: roleError } = await supabase.rpc('get_my_role')
    const role = (roleData as string | null) ?? null
    console.log('DEBUG:', { userId: data.user.id, role, roleError })

    if (role !== 'admin') {
      await supabase.auth.signOut()
      setError('You do not have admin access')
      setLoading(false)
      return
    }

    setLoading(false)
    // App will automatically redirect to /admin
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-linear-to-br from-[#06231c] to-[#0b352a]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-[#0a2d24]/85 border border-emerald-500/25 rounded-2xl p-9 shadow-2xl backdrop-blur-xl"
      >
        <div className="text-center text-4xl mb-2">🛡️</div>
        <h1 className="text-center text-xl font-bold text-white mb-1">Real Time Operations</h1>
        <p className="text-center text-xs text-white/55 mb-7">Admin Portal — Sign in to continue</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-white/70 mb-1.5">Email</label>
          <input
            type="email"
            required
            placeholder="admin@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-white/70 mb-1.5">Password</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-linear-to-r from-emerald-600 to-emerald-500 rounded-xl text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}