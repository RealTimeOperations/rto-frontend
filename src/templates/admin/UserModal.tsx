import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModalState } from './types'

type Props = {
  state: ModalState
  onClose: () => void
  onSaved: () => void
}

export default function UserModal({ state, onClose, onSaved }: Props) {
  const editing = state.mode === 'edit' ? state.user : null
  const viewing = state.mode === 'view' ? state.user : null

  const [username, setUsername] = useState(editing?.username ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState(editing?.role ?? 'employee')
  const [status, setStatus] = useState(editing?.status ?? 'active')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const title = state.mode === 'add' ? 'Add User' : state.mode === 'edit' ? 'Edit User' : 'User Details'

  function friendly(msg: string) {
    if (msg.includes('Username:')) return msg
    if (msg.includes('already taken')) return 'This username is already taken.'
    if (msg.includes('Password must')) return 'Password must be at least 6 characters.'
    return msg
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSaving(true)

    if (state.mode === 'add') {
      const { error: err } = await supabase.rpc('admin_create_user', {
        p_username: username.trim(),
        p_password: password,
        p_role: role,
      })
      if (err) setError(friendly(err.message))
      else onSaved()
    } else if (state.mode === 'edit' && editing) {
      const { error: err } = await supabase.rpc('admin_update_user', {
        p_id: editing.id,
        p_username: username.trim(),
        p_password: password || null,
        p_role: role,
        p_status: status,
      })
      if (err) setError(friendly(err.message))
      else onSaved()
    }
    setSaving(false)
  }

  const inputClass = 'w-full h-11 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
        <h3 className="running-text text-lg font-bold mb-5">{title}</h3>

        {viewing ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-white/50">Username</span><span className="text-white font-mono">@{viewing.username}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/50">Role</span><span className="text-white capitalize">{viewing.role}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/50">Status</span><span className="text-white capitalize">{viewing.status}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/50">Created</span><span className="text-white">{new Date(viewing.created_at).toLocaleString()}</span></div>
            <button onClick={onClose} className="running-button w-full py-2.5 rounded-full text-white text-sm font-bold mt-2 hover:opacity-90 transition">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Honeypot field to absorb browser autofill */}
            <input type="text" name="fake_field" tabIndex={-1} autoComplete="off" className="absolute -left-248 h-0 w-0 opacity-0" />

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center">{error}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Username</label>
              <input
                required
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. ali_123"
                maxLength={30}
                autoComplete="off"
                className={inputClass}
              />
              <p className="text-white/40 text-xs mt-1">3-30 characters, letters, numbers, underscore only</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Password {state.mode === 'edit' && <span className="text-white/40">(leave blank to keep current)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={state.mode === 'add'}
                  name="user_password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">User Type</label>
                <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
                  <option value="employee">Employee</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
              <button type="submit" disabled={saving} className="running-button flex-1 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
                {saving ? 'Saving…' : state.mode === 'add' ? 'Add User' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}