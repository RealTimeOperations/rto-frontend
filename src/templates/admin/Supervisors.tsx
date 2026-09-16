import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import UserModal from './UserModal' 
import type { ModalState, Profile } from './types'

// ✅ Session duration calculate karo
function sessionDuration(loginAt?: string | null, logoutAt?: string | null) {
  if (!loginAt) return '—'
  const start = new Date(loginAt).getTime()
  const end = logoutAt ? new Date(logoutAt).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - start) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return logoutAt ? `${h}h ${m}m` : `${h}h ${m}m (active)`
}

export default function Supervisors() {
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)
  const [resetting, setResetting] = useState(false)
  const [search, setSearch] = useState('')
  // ✅ Device binding toggle (Reset popup ke andar) — default ON
  const [bindingOn, setBindingOn] = useState(true)
  const [savingBinding, setSavingBinding] = useState(false)

  // Load only supervisor login accounts
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_users')
    const all = (data as Profile[]) ?? []
    setSupervisors(all.filter(u => u.role === 'supervisor'))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.rpc('admin_delete_user', { p_id: deleteTarget.id })
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const filtered = supervisors.filter(u => {
    const s = search.toLowerCase()
    return (
      String(u.username ?? '').toLowerCase().includes(s) ||
      String(u.cnic ?? '').includes(s)
    )
  })

  // ✅ Device binding reset (admin) — confirmation popup ke baad
  async function handleReset() {
    if (!resetTarget) return
    setResetting(true)
    await supabase.rpc('admin_reset_device', { p_id: resetTarget.id })
    setResetting(false)
    setResetTarget(null)
    load()
  }

  // ✅ Device binding ON/OFF — foran save hota hai (default ON)
  async function handleBindingToggle(enabled: boolean) {
    if (!resetTarget) return
    setSavingBinding(true)
    setBindingOn(enabled)
    await supabase.rpc('admin_set_device_binding', { p_id: resetTarget.id, p_enabled: enabled })
    setSavingBinding(false)
    load()
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-nowrap">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Supervisors Accounts</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {loading ? '…' : supervisors.length}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* ✅ Button pehle — mobile par sirf "+ Add" */}
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="running-button flex-none px-3 sm:px-6 h-9 sm:h-auto sm:py-2.5 rounded-full text-white text-[11px] sm:text-xs font-bold hover:opacity-90 transition whitespace-nowrap"
          >
            <span className="sm:hidden">+ Add</span>
            <span className="hidden sm:inline">+ Add Supervisors Login</span>
          </button>
          {/* ✅ Search baad mein — cross button ke sath */}
          <div className="relative flex-1 sm:flex-none min-w-0 sm:w-56">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search username / CNIC…"
              className="h-9 sm:h-10 px-3 sm:px-4 pr-8 w-full bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-red-300"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Login accounts table */}
      <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-[#0a2d24]/80 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <table className="w-full text-sm min-w-[1400px]">
          <thead>
            <tr className="text-left text-white/50 text-xs border-b border-white/10">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">CNIC</th>
              <th className="px-4 py-3">Bound Device</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Login Time</th>
              <th className="px-4 py-3">Logout Time</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-white/50">Loading supervisors…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-white/50">{supervisors.length === 0 ? 'No supervisor accounts found' : 'No matching supervisors'}</td></tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-white/80 text-xs font-mono">{u.cnic || <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-white/80">{u.bound_device_name || <span className="text-white/30">—</span>}</div>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {u.bound_device_id ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] font-bold">BOUND</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-white/5 border border-white/15 text-white/40 text-[9px] font-bold">NOT BOUND</span>
                      )}
                      {(u as any).device_binding_enabled === false && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-400/40 text-red-300 text-[9px] font-bold">BINDING OFF</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    <div>{u.last_location || <span className="text-white/30">—</span>}</div>
                    {u.last_coordinates && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(u.last_coordinates)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 hover:underline text-[10px] font-semibold"
                      >
                        📍 View on Map
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.last_logout_at ? new Date(u.last_logout_at).toLocaleString() : <span className="text-amber-300 text-[10px] font-bold">ACTIVE</span>}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{sessionDuration(u.last_login_at, u.last_logout_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
                      u.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/15 text-red-300 border-red-500/40'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal({ mode: 'view', user: u })} aria-label="View supervisor" className="p-2 rounded-lg text-cyan-300 hover:bg-cyan-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', user: u })} aria-label="Edit supervisor" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setResetTarget(u)
                          setBindingOn((u as any).device_binding_enabled !== false)
                        }}
                        title="Reset device binding"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 transition whitespace-nowrap"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Reset Device
                      </button>
                      <button onClick={() => setDeleteTarget(u)} aria-label="Delete supervisor" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          state={modal}
          lockRole="supervisor"
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Supervisor Login</h3>
            <p className="text-white/60 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">{deleteTarget.username}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-bold hover:bg-red-500/30 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Reset Device confirmation popup */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-amber-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-400/40">
                <svg className="h-5 w-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-amber-300">Reset Device Binding</h3>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Are you sure you want to reset the device binding for{' '}
              <span className="text-white font-semibold">{resetTarget.username}</span>?
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/60 mb-4 space-y-1.5">
              <div className="flex justify-between gap-3">
                <span>Current device:</span>
                <span className="text-white/85 font-semibold text-right">{resetTarget.bound_device_name || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Bound on:</span>
                <span className="text-white/85 font-semibold text-right">{resetTarget.bound_at ? new Date(resetTarget.bound_at).toLocaleString() : '—'}</span>
              </div>
              <p className="pt-1 text-white/45">
                After reset, the supervisor can login from any device. The next successful login will bind that device.
              </p>
            </div>

            {/* ✅ Device Binding toggle — default ON, supervisor-wise save */}
            <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 mb-6 ${
              bindingOn ? 'bg-emerald-500/10 border-emerald-400/40' : 'bg-red-500/10 border-red-400/40'
            }`}>
              <div>
                <div className={`text-xs font-bold ${bindingOn ? 'text-emerald-300' : 'text-red-300'}`}>
                  Device Binding: {bindingOn ? 'ON' : 'OFF'}
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">
                  {bindingOn
                    ? 'Supervisor sirf apni bound device se login kar sakta hai.'
                    : 'Supervisor kisi bhi device se login kar sakta hai (binding disabled).'}
                </div>
              </div>
              <button
                type="button"
                disabled={savingBinding}
                onClick={() => handleBindingToggle(!bindingOn)}
                aria-label="Toggle device binding"
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${bindingOn ? 'bg-emerald-500' : 'bg-white/15'} disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${bindingOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition disabled:opacity-50"
              >
                {resetting ? 'Resetting…' : 'Reset Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}