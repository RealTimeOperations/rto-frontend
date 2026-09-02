import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import UserModal from './UserModal'
import type { ModalState, Profile } from './types'

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_users')
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Delete user after custom confirmation
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.rpc('admin_delete_user', { p_id: deleteTarget.id })
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const roleBadge = (role: string) =>
    role === 'admin'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : role === 'supervisor'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="running-text text-xl font-bold">Users</h2>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="running-button px-6 py-2.5 rounded-full text-white text-xs font-bold hover:opacity-90 transition"
        >
          + Add User
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-[#0a2d24]/80 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <table className="w-full text-sm min-w-150">
          <thead>
            <tr className="text-left text-white/50 text-xs border-b border-white/10">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-white/50">Loading users…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-white/50">No users found</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white font-mono text-xs">@{user.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${roleBadge(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${
                      user.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/15 text-red-300 border-red-500/40'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* View user details */}
                      <button onClick={() => setModal({ mode: 'view', user })} aria-label="View user" className="p-2 rounded-lg text-cyan-300 hover:bg-cyan-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {/* Edit user */}
                      <button onClick={() => setModal({ mode: 'edit', user })} aria-label="Edit user" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      {/* Delete user */}
                      <button onClick={() => setDeleteTarget(user)} aria-label="Delete user" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}

      {/* Custom delete confirmation popup */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete User</h3>
            <p className="text-white/60 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">@{deleteTarget.username}</span>? This action cannot be undone.
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