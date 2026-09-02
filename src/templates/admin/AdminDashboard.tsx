import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from './types'

export default function AdminDashboard() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Load all users for statistics
  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('admin_list_users')
      setUsers((data as Profile[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const count = (fn: (u: Profile) => boolean) => users.filter(fn).length

  const cards = [
    { label: 'Total Users', value: users.length, icon: '👥' },
    { label: 'Active Users', value: count(u => u.status === 'active'), icon: '✅' },
    { label: 'Inactive Users', value: count(u => u.status === 'inactive'), icon: '⛔' },
    { label: 'Employees', value: count(u => u.role === 'employee'), icon: '🧑‍💼' },
    { label: 'Supervisors', value: count(u => u.role === 'supervisor'), icon: '📋' },
  ]

  if (loading) {
    return <div className="text-white/60 text-sm">Loading statistics…</div>
  }

  return (
    <div>
      <h2 className="running-text text-xl font-bold mb-5">Dashboard Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-[#0a2d24]/80 border border-emerald-500/15 rounded-2xl p-5 shadow-[0_8px_20px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.06)]"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-white/55 mt-1">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}