import { supabase } from '../../lib/supabase'

export default function Admin() {
  // Sign the user out (App will redirect to /login automatically)
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#06231c] to-[#0b352a]">
      <div className="flex items-center justify-between px-7 py-3.5 bg-[#06231c]/90 border-b border-emerald-500/20">
        <div className="font-bold text-white">🛡️ RTO Admin Portal</div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/15 border border-red-500/40 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition"
        >
          Logout
        </button>
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Admin Portal</h1>
          <p className="text-white/60 text-sm">Real Time Operations — Suthra Punjab</p>
        </div>
      </div>
    </div>
  )
}