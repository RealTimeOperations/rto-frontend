import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminDashboard from './AdminDashboard'
import Users from './Users'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'dashboard' | 'users'>('dashboard')

  // Sign the user out (App will redirect to /login automatically)
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-semibold transition ${
      active
        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
        : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-linear-to-br from-[#06231c] to-[#0b352a]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-3.5 bg-[#06231c]/90 border-b border-emerald-500/20">
        <div className="font-bold text-white">🛡️ RTO Admin Portal</div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTab('dashboard')} className={tabClass(tab === 'dashboard')}>
            Dashboard
          </button>
          <button onClick={() => setTab('users')} className={tabClass(tab === 'users')}>
            Users
          </button>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-500/25 transition"
          >
            Home
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/15 border border-red-500/40 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-7">
        {tab === 'dashboard' ? <AdminDashboard /> : <Users />}
      </div>
    </div>
  )
}