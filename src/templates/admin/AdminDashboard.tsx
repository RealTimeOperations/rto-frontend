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

  // ✅ Sirf Employees + Supervisors stats — admin exclude
  const visibleUsers = users.filter(u => u.role === 'employee' || u.role === 'supervisor')
  const count = (fn: (u: Profile) => boolean) => visibleUsers.filter(fn).length

  const cards = [
    { label: 'Total Accounts', value: visibleUsers.length, icon: <UsersIcon />, ring: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' },
    { label: 'Active', value: count(u => u.status === 'active'), icon: <CheckCircleIcon />, ring: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' },
    { label: 'Inactive', value: count(u => u.status === 'inactive'), icon: <BanIcon />, ring: 'border-red-400/30 bg-red-500/10 text-red-300' },
    { label: 'Employees Accounts', value: count(u => u.role === 'employee'), icon: <UserCheckIcon />, ring: 'border-sky-400/30 bg-sky-500/10 text-sky-300' },
    { label: 'Supervisors Accounts', value: count(u => u.role === 'supervisor'), icon: <ClipboardIcon />, ring: 'border-amber-400/30 bg-amber-500/10 text-amber-300' },
  ]

  if (loading) {
    return <div className="text-white/60 text-sm">Loading statistics…</div>
  }

  return (
    <div>
      <h2 className="running-text text-lg sm:text-xl font-bold mb-4 sm:mb-5">Dashboard Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-[#0a2d24]/80 border border-emerald-500/15 rounded-2xl p-3.5 sm:p-5 shadow-[0_8px_20px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.06)]"
          >
            <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border ${card.ring} mb-2 sm:mb-3`}>
              {card.icon}
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">{card.value}</div>
            <div className="text-[10px] sm:text-xs text-white/55 mt-0.5 sm:mt-1 leading-snug">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   PREMIUM CARD ICONS
========================================================= */
function UsersIcon() {
  return (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

function UserCheckIcon() {
  return (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  )
}