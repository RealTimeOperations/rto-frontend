import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from './types'
import PasswordChangeModal from './PasswordChangeModal'
import { resetMonitoringTabs, } from '../../lib/resetTabs'
import { trackDeviceLogout } from '../../lib/deviceInfo'

export default function AdminDashboard() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDevicesModal, setShowDevicesModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('admin_list_users')
      setUsers((data as Profile[]) ?? [])
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setCurrentUser(profile)
      }
      setLoading(false)
    }
    load()
  }, [])

  const visibleUsers = users.filter(u => u.role === 'employee' || u.role === 'supervisor')
  const count = (fn: (u: Profile) => boolean) => visibleUsers.filter(fn).length
  const cards = [
    { label: 'Total Accounts', value: visibleUsers.length, icon: <UsersIcon />, ring: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' },
    { label: 'Active', value: count(u => u.status === 'active'), icon: <CheckCircleIcon />, ring: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' },
    { label: 'Inactive', value: count(u => u.status === 'inactive'), icon: <BanIcon />, ring: 'border-red-400/30 bg-red-500/10 text-red-300' },
    { label: 'Employees Accounts', value: count(u => u.role === 'employee'), icon: <UserCheckIcon />, ring: 'border-sky-400/30 bg-sky-500/10 text-sky-300' },
    { label: 'Supervisors Accounts', value: count(u => u.role === 'supervisor'), icon: <ClipboardIcon />, ring: 'border-amber-400/30 bg-amber-500/10 text-amber-300' },
  ]

  async function handleLogout() {
    resetMonitoringTabs()
    await trackDeviceLogout(currentUser?.id)
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="text-white/60 text-sm">Loading statistics…</div>
  }

  return (
    <div className="relative">
      {/* ===== Top Right: User Profile Menu ===== */}
      <div className="absolute top-0 right-0 z-20">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#0a2d24]/80 border border-emerald-400/20 hover:border-emerald-400/40 transition-all duration-300"
        >
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-white/90">{currentUser?.username || 'Admin'}</span>
            <span className="text-[10px] text-white/50">{currentUser?.email || 'admin@system.local'}</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 top-14 mt-2 w-64 rounded-2xl border border-emerald-400/20 bg-[#0d372c] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-20">
              <div className="px-4 py-3 border-b border-white/10">
                <div className="text-xs font-bold text-white/60 uppercase tracking-wider">Account Settings</div>
              </div>
              {/* ✅ Devices Info button */}
              <button
                onClick={() => {
                  setShowDevicesModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-emerald-500/10 hover:text-emerald-300 transition flex items-center gap-3"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                Devices Info
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-emerald-500/10 hover:text-emerald-300 transition flex items-center gap-3"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10 transition flex items-center gap-3 border-t border-white/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dashboard Content */}
      <div className="pt-20">
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

      {/* Password Change Modal */}
      {showPasswordModal && (
        <PasswordChangeModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false)
            handleLogout()
          }}
        />
      )}

      {/* ✅ Devices Info Modal */}
      {showDevicesModal && (
        <DevicesModal userId={currentUser?.id ?? null} onClose={() => setShowDevicesModal(false)} />
      )}
    </div>
  )
}

/* =========================================================
DEVICES INFO MODAL — login history + block/unblock
========================================================= */
type DeviceRow = {
  id: number
  user_id: string
  device_id: string
  device_name: string | null
  user_agent: string | null
  location: string | null
  coordinates: string | null
  first_login_at: string | null
  last_login_at: string | null
  last_logout_at: string | null
  is_current: boolean
  is_blocked: boolean
}

function DevicesModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_devices', { p_user_id: userId })
    if (!error) setDevices((data as DeviceRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleBlock(d: DeviceRow) {
    setBusyId(d.id)
    await supabase.rpc('admin_set_device_blocked', { p_device_id: d.id, p_blocked: !d.is_blocked })
    await load()
    setBusyId(null)
  }

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/25 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <h3 className="text-base font-bold text-white">Devices Info</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition" aria-label="Close">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /> <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {loading ? (
            <div className="text-white/60 text-sm text-center py-8">Loading devices…</div>
          ) : devices.length === 0 ? (
            <div className="text-white/60 text-sm text-center py-8">No device records found.</div>
          ) : (
            devices.map(d => (
              <div key={d.id} className={`rounded-xl border p-4 ${d.is_blocked ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{d.device_name || 'Unknown Device'}</span>
                      {d.is_current && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">Current Session</span>
                      )}
                      {d.is_blocked && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 border border-red-400/40 text-red-300">Blocked</span>
                      )}
                      {!d.is_current && !d.is_blocked && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/15 text-white/50">Logged Out</span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50 font-mono">{d.device_id}</div>
                    {d.user_agent && <div className="mt-1 text-[11px] text-white/40 truncate" title={d.user_agent}>{d.user_agent}</div>}
                  </div>
                  <button
                    onClick={() => toggleBlock(d)}
                    disabled={busyId === d.id}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-50 ${
                      d.is_blocked
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-red-500/15 border-red-400/40 text-red-300 hover:bg-red-500/25'
                    }`}
                  >
                    {busyId === d.id ? '…' : d.is_blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <div className="text-white/40 font-semibold">First Login</div>
                    <div className="text-white/80 font-medium">{fmt(d.first_login_at)}</div>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <div className="text-white/40 font-semibold">Last Login</div>
                    <div className="text-white/80 font-medium">{fmt(d.last_login_at)}</div>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <div className="text-white/40 font-semibold">Last Logout</div>
                    <div className="text-white/80 font-medium">{d.is_current ? '—' : fmt(d.last_logout_at)}</div>
                  </div>
                </div>
                {d.location && <div className="mt-2 text-[11px] text-white/50">📍 {d.location}</div>}
              </div>
            ))
          )}
        </div>
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