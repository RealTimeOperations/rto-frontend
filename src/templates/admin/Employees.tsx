import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import UserModal from './UserModal'
import type { ModalState, Profile } from './types'

export default function Employees() {
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_users')
    const allUsers = (data as Profile[]) ?? []
    // Filter only employees
    const employeeUsers = allUsers.filter(u => u.role === 'employee')
    setEmployees(employeeUsers)
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

  const filtered = employees.filter(e => {
    const s = search.toLowerCase()
    return (
      String(e.username ?? '').toLowerCase().includes(s) ||
      String(e.email ?? '').toLowerCase().includes(s)
    )
  })

  const roleBadge = (role: string) =>
    role === 'admin'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : role === 'supervisor'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-nowrap">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Employees Accounts</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {loading ? '…' : employees.length}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* ✅ Button pehle */}
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="running-button flex-none px-3 sm:px-6 h-9 sm:h-auto sm:py-2.5 rounded-full text-white text-[11px] sm:text-xs font-bold hover:opacity-90 transition whitespace-nowrap"
          >
            <span className="sm:hidden">+ Add</span>
            <span className="hidden sm:inline">+ Add Employees Login</span>
          </button>
          {/* ✅ Search baad mein */}
          <div className="relative flex-1 sm:flex-none min-w-0 sm:w-56">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search username / email…"
              className="h-9 sm:h-10 px-3 sm:px-4 pr-8 w-full bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500 transition"
            />
            {/* ✅ Cross button — sirf jab text ho */}
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

      <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-[#0a2d24]/80 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-white/50 text-xs border-b border-white/10">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-white/50">Loading employees…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-white/50">{employees.length === 0 ? 'No employees found' : 'No matching employees'}</td></tr>
            ) : (
              filtered.map(employee => (
                <tr key={employee.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white font-mono text-xs">{employee.username}</td>
                  <td className="px-4 py-3 text-white/80 text-xs">{employee.email || <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${roleBadge(employee.role)}`}>
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
                      employee.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/15 text-red-300 border-red-500/40'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{new Date(employee.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal({ mode: 'view', user: employee })} aria-label="View employee" className="p-2 rounded-lg text-cyan-300 hover:bg-cyan-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', user: employee })} aria-label="Edit employee" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(employee)} aria-label="Delete employee" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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
          lockRole="employee"
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
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Employee</h3>
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
    </div>
  )
}