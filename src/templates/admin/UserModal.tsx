import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModalState, Profile } from './types'

type Props = {
  state: ModalState
  lockRole?: 'employee' | 'supervisor'
  onClose: () => void
  onSaved: () => void
}

// Auto-format CNIC while typing: 31104-1234567-8
function formatCnic(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 13)
  if (d.length <= 5) return d
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
}

export default function UserModal({ state, onClose, onSaved, lockRole }: Props) {
  const editing = state.mode === 'edit' ? state.user : null
  const viewing = state.mode === 'view' ? state.user : null
  const [username, setUsername] = useState(editing?.username ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState(lockRole ?? editing?.role ?? 'employee')
    const [status, setStatus] = useState(editing?.status ?? 'active')
  const [cnic, setCnic] = useState(editing?.cnic ?? '')
  // Permissions (only relevant when role is employee)
  const [permAttendance, setPermAttendance] = useState(editing?.can_attendance ?? false)
  const [permVehicles, setPermVehicles]       = useState(editing?.can_vehicles    ?? false)
  const [permContainers, setPermContainers] = useState(editing?.can_containers  ?? false)
  const [loadedPassword, setLoadedPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // CNIC is required only for Supervisor login forms
  const cnicRequired = lockRole === 'supervisor'

  // Load stored CNIC and permissions when opening edit/view mode
  useEffect(() => {
    const target = editing ?? viewing
    if (!target) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('cnic, can_attendance, can_vehicles, can_containers, password_plain')
        .eq('id', target.id)
        .maybeSingle()
      if (!alive) return
      if (data?.cnic) setCnic(data.cnic)
      if (data?.password_plain) {
        setPassword(data.password_plain)
        setLoadedPassword(data.password_plain)
      }
      if (data) {
        setPermAttendance(Boolean(data.can_attendance))
        setPermVehicles(Boolean(data.can_vehicles))
        setPermContainers(Boolean(data.can_containers))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dynamic titles based on locked role
  const roleLabel = lockRole === 'employee' ? 'Employee' : lockRole === 'supervisor' ? 'Supervisor' : 'User'
  const addLabel = lockRole ? `Add ${roleLabel} Login` : 'Add User'
  const title =
    state.mode === 'add'
      ? addLabel
      : state.mode === 'edit'
        ? (lockRole ? `Edit ${roleLabel} Login` : 'Edit User')
        : (lockRole ? `${roleLabel} Details` : 'User Details')

  function friendly(msg: string) {
    if (msg.includes('Username:')) return msg
    if (msg.includes('already taken')) return 'This username is already taken.'
    if (msg.includes('Password must')) return 'Password must be at least 6 characters.'
    return msg
  }

  // Save CNIC directly on the profiles table
  async function saveCnic(userId: string, value: string) {
    const { error: err } = await supabase.from('profiles').update({ cnic: value || null }).eq('id', userId)
    if (err) console.error('CNIC save error:', err)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    // CNIC validation
    const cnicValue = cnic.trim()
    if (cnicRequired && !cnicValue) {
      setError('CNIC is required for Supervisor login.')
      return
    }
    if (cnicValue && !/^\d{5}-\d{7}-\d{1}$/.test(cnicValue)) {
      setError('Please enter a valid CNIC format: 31104-1234567-8')
      return
    }

    setSaving(true)
    const finalRole = lockRole ?? role

    if (state.mode === 'add') {
      const { error: err } = await supabase.rpc('admin_create_user', {
        p_username: username.trim(),
        p_password: password,
        p_role: finalRole,
      })
      if (err) {
        setError(friendly(err.message))
        setSaving(false)
        return
      }
      // Save CNIC and permissions against the newly created login account
      const { data: allUsers } = await supabase.rpc('admin_list_users')
      const created = ((allUsers as Profile[]) ?? []).find(u => u.username === username.trim())
      if (created) {
        const upd: Record<string, any> = { password_plain: password }
        if (cnicValue) upd.cnic = cnicValue
        if (finalRole === 'employee') {
          upd.can_attendance = permAttendance
          upd.can_vehicles = permVehicles
          upd.can_containers = permContainers
        }
        await supabase.from('profiles').update(upd).eq('id', created.id)
      }
      onSaved()
    } else if (state.mode === 'edit' && editing) {
      const passwordChanged = password !== '' && password !== loadedPassword
      const { error: err } = await supabase.rpc('admin_update_user', {
        p_id: editing.id,
        p_username: username.trim(),
        p_password: passwordChanged ? password : null,
        p_role: finalRole,
        p_status: status,
      })
      if (err) {
        setError(friendly(err.message))
        setSaving(false)
        return
      }
      // Save CNIC, password copy and permissions in one update
      const upd: Record<string, any> = { cnic: cnicValue || null }
      if (passwordChanged) upd.password_plain = password
      if (finalRole === 'employee') {
        upd.can_attendance = permAttendance
        upd.can_vehicles = permVehicles
        upd.can_containers = permContainers
      }
      await supabase.from('profiles').update(upd).eq('id', editing.id)
      onSaved()
    }
    setSaving(false)
  }

  const inputClass = 'w-full h-11 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition'

  // Final role used for conditional rendering in the form
  const finalRole = lockRole ?? role

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
        <h3 className="running-text text-lg font-bold mb-5">{title}</h3>
        {viewing ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-white/50">Username</span><span className="text-white font-mono">@{viewing.username}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/50">CNIC</span><span className="text-white font-mono">{cnic || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/50">Password</span><span className="text-white font-mono">{password || '—'}</span></div>
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
                    <svg className="h-5 w-5 animate-[eye-stroke-cycle_6s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {/* CNIC field: optional for Employee, required for Supervisor */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                CNIC {cnicRequired ? <span className="text-red-300">*</span> : <span className="text-white/40">(optional)</span>}
              </label>
              <input
                required={cnicRequired}
                value={cnic}
                onChange={e => setCnic(formatCnic(e.target.value))}
                placeholder="31104-1234567-8"
                inputMode="numeric"
                className={inputClass}
              />
            </div>
            {/* User Type is hidden when role is locked; only Status remains */}
            <div className={lockRole ? '' : 'grid grid-cols-2 gap-3'}>
              {!lockRole && (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">User Type</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
                    <option value="employee">Employee</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            {/* ✅ Permission toggles — visible ONLY in Edit mode for Employees */}
            {(finalRole === 'employee' && state.mode === 'edit') && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs font-bold tracking-widest text-white/60 uppercase">Dashboard Access</div>
                {[
                  {
                    key: 'attendance',
                    label: 'Attendance',
                    value: permAttendance,
                    set: setPermAttendance,
                    onTrack: 'bg-emerald-500/30 border-emerald-400/60',
                    onKnob: 'translate-x-5 bg-emerald-300',
                  },
                  {
                    key: 'vehicles',
                    label: 'Vehicles',
                    value: permVehicles,
                    set: setPermVehicles,
                    onTrack: 'bg-sky-500/30 border-sky-400/60',
                    onKnob: 'translate-x-5 bg-sky-300',
                  },
                  {
                    key: 'containers',
                    label: 'Containers',
                    value: permContainers,
                    set: setPermContainers,
                    onTrack: 'bg-lime-500/30 border-lime-400/60',
                    onKnob: 'translate-x-5 bg-lime-300',
                  },
                ].map(t => (
                  <label key={t.key} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-white/80 font-medium">{t.label}</span>
                    <button
                      type="button"
                      onClick={() => t.set(!t.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                        t.value ? t.onTrack : 'bg-white/10 border-white/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full shadow transition-transform duration-200 ${
                          t.value ? t.onKnob : 'translate-x-0.5 bg-white/70'
                        }`}
                      />
                    </button>
                  </label>
                ))}
                <p className="text-[11px] text-white/40">
                  Selected dashboards will be visible to this employee after login.
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
              <button type="submit" disabled={saving} className="running-button flex-1 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
                {saving ? 'Saving…' : state.mode === 'add' ? addLabel : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}