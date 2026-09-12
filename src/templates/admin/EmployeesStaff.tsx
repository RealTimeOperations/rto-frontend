import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type StaffRow = Record<string, any>

const EMPTY_FORM = {
  name: '',
  work_type: '',
  email: '',
}

export default function EmployeesStaff() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; row: StaffRow }>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('staff_employees').select('*').order('created_at', { ascending: true })
    setRows(data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setError('')
    setModal({ mode: 'add' })
  }

  function openEdit(row: StaffRow) {
    setForm({
      name: String(row.name ?? ''),
      work_type: String(row.work_type ?? ''),
      email: String(row.email ?? ''),
    })
    setError('')
    setModal({ mode: 'edit', row })
  }

  async function handleSave() {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    const emailValue = form.email.trim().toLowerCase()
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { setError('Please enter a valid email address'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      work_type: form.work_type.trim() || null,
      email: emailValue || null,
    }
    const query =
      modal?.mode === 'edit'
        ? supabase.from('staff_employees').update(payload).eq('id', (modal as { mode: 'edit'; row: StaffRow }).row.id)
        : supabase.from('staff_employees').insert(payload)
    const { error: err } = await query
    setSaving(false)
    if (err) { setError(err.message); return }
    setModal(null)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('staff_employees').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const filtered = rows.filter(r => {
    const s = search.toLowerCase()
    return (
      String(r.name ?? '').toLowerCase().includes(s) ||
      String(r.work_type ?? '').toLowerCase().includes(s) ||
      String(r.email ?? '').toLowerCase().includes(s)
    )
  })

  const inputClass = 'w-full h-11 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition'

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="running-text text-xl font-bold">Employees Staff</h2>
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
            Total: {loading ? '…' : rows.length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / work type / email…"
            className="h-10 px-4 w-56 bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500 transition"
          />
          <button
            onClick={openAdd}
            className="running-button px-6 py-2.5 rounded-full text-white text-xs font-bold hover:opacity-90 transition"
          >
            + Add Employee Staff
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-[#0a2d24]/80 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-white/50 text-xs border-b border-white/10">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Work Type</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-white/50">Loading staff…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-white/50">No staff found</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white text-xs font-semibold">{r.name || '—'}</td>
                  <td className="px-4 py-3 text-white/70 text-xs">{r.work_type || '—'}</td>
                  <td className="px-4 py-3 text-white/70 text-xs">{r.email || <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(r)} aria-label="Edit staff" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(r)} aria-label="Delete staff" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <h3 className="running-text text-lg font-bold mb-5">{modal.mode === 'add' ? 'Add Employee Staff' : 'Edit Employee Staff'}</h3>
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center mb-4">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Employee name" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">Work Type</label>
                <input value={form.work_type} onChange={e => setForm(f => ({ ...f, work_type: e.target.value }))} placeholder="Work Type" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  Email <span className="text-white/40">(optional)</span>
                </label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. ali@gmail.com" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 pt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="running-button flex-1 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add Staff' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Employee Staff</h3>
            <p className="text-white/60 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">{deleteTarget.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-bold hover:bg-red-500/30 transition disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}