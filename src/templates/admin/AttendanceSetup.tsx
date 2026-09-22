import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type BaseRow = {
  id: string
  label: string
  value: number
  sort_order: number
  type: string
  present_target: number | null
  updated_at: string
}

export default function AttendanceSetup() {
  const [rows, setRows] = useState<BaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  // ✅ Present target editing (category only)
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null)
  const [editTargetValue, setEditTargetValue] = useState('')
  // Designation add form
  const [showAddDesig, setShowAddDesig] = useState(false)
  const [desigLabel, setDesigLabel] = useState('')
  const [desigValue, setDesigValue] = useState('')
  // Category add form
  const [showAddCat, setShowAddCat] = useState(false)
  const [catLabel, setCatLabel] = useState('')
  const [catValue, setCatValue] = useState('')
  const [catTarget, setCatTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // ✅ Delete confirmation popup
  const [deleteTarget, setDeleteTarget] = useState<BaseRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('base_values')
      .select('*')
      .order('sort_order', { ascending: true })
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const desigRows = rows.filter(r => (r.type ?? 'designation') === 'designation')
  const catRows = rows.filter(r => r.type === 'category')
  // ✅ Category Wise Total HR row ka present target
  const totalTargetRow = rows.find(r => r.type === 'total_present_target')

  function startEdit(row: BaseRow) {
    setEditingId(row.id)
    setEditValue(String(row.value))
    // ✅ Category ho to PRESENT TARGET editor bhi sath khole
    if (row.type === 'category') {
      setEditingTargetId(row.id)
      setEditTargetValue(row.present_target != null ? String(row.present_target) : '')
    }
  }

  async function saveEdit(id: string) {
    setError('')
    const v = parseInt(editValue)
    if (isNaN(v) || v < 0) { setError('Please enter a valid non-negative number'); return }
    // ✅ Category editing ke doran PRESENT TARGET bhi validate + save karo
    let t: number | null | undefined = undefined
    if (editingTargetId === id) {
      const rawT = editTargetValue.trim()
      t = rawT === '' ? null : parseInt(rawT)
      if (rawT !== '' && (t === null || isNaN(t) || t < 0)) { setError('Please enter a valid non-negative number for present target'); return }
    }
    setSaving(true)
    let err: { message: string } | null = null
    if (id === 'new-total-target') {
      // ✅ Total present target ki row create karo
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1)
      const res = await supabase
        .from('base_values')
        .insert({ label: 'TOTAL PRESENT', value: v, sort_order: maxOrder + 1, type: 'total_present_target' })
      err = res.error
    } else {
      const payload: { value: number; present_target?: number | null } = { value: v }
      if (t !== undefined) payload.present_target = t
      const res = await supabase.from('base_values').update(payload).eq('id', id)
      err = res.error
    }
    setSaving(false)
    if (err) setError(err.message)
    else { setEditingId(null); setEditingTargetId(null); load() }
  }

  async function addRow(type: 'designation' | 'category') {
    setError('')
    const label = (type === 'designation' ? desigLabel : catLabel).trim()
    const v = parseInt(type === 'designation' ? desigValue : catValue)
    if (!label) { setError('Label is required'); return }
    if (isNaN(v) || v < 0) { setError('Value must be a non-negative number'); return }
    // ✅ Category ke liye optional present target
    let t: number | null = null
    if (type === 'category') {
      const rawT = catTarget.trim()
      if (rawT !== '') {
        t = parseInt(rawT)
        if (isNaN(t) || t < 0) { setError('Present target must be a non-negative number'); return }
      }
    }
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1)
    setSaving(true)
    const { error: err } = await supabase
      .from('base_values')
      .insert({ label, value: v, sort_order: maxOrder + 1, type, ...(type === 'category' ? { present_target: t } : {}) })
    setSaving(false)
    if (err) {
      setError(err.message.includes('duplicate') ? 'This label already exists' : err.message)
      return
    }
    if (type === 'designation') { setDesigLabel(''); setDesigValue(''); setShowAddDesig(false) }
    else { setCatLabel(''); setCatValue(''); setCatTarget(''); setShowAddCat(false) }
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: err } = await supabase.from('base_values').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (err) setError(err.message)
    setDeleteTarget(null)
    load()
  }

  const inputClass = 'w-full h-10 px-3 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition'

  function renderTable(title: string, data: BaseRow[], type: 'designation' | 'category', showAdd: boolean, setShowAdd: (v: boolean) => void) {
    const labelState = type === 'designation' ? desigLabel : catLabel
    const setLabel = type === 'designation' ? setDesigLabel : setCatLabel
    const valueState = type === 'designation' ? desigValue : catValue
    const setValue = type === 'designation' ? setDesigValue : setCatValue
    const badgeColor = type === 'designation'
      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
      : 'bg-sky-500/15 border-sky-400/40 text-sky-300'
    const badgeText = type === 'designation' ? 'DESIGNATION' : 'CATEGORY'
    const placeholder = type === 'designation' ? 'e.g. Sanitary Worker' : 'e.g. Manual Sweeping'
    const isCat = type === 'category'
    const colCount = isCat ? 5 : 4

    return (
      <div>
        {/* Section header + add button */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
              {title}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
              {data.length} items
            </span>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="running-button px-5 py-2 rounded-full text-white text-xs font-bold hover:opacity-90 transition"
          >
            {showAdd ? '✕ Cancel' : `+ Add ${badgeText.charAt(0) + badgeText.slice(1).toLowerCase()}`}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-[#0a2d24]/80 p-5">
            <div className={`grid grid-cols-1 gap-3 items-end ${isCat ? 'sm:grid-cols-[1fr_auto_auto_auto]' : 'sm:grid-cols-[1fr_auto_auto]'}`}>
              <div>
                <label className="block text-[11px] font-semibold text-white/60 mb-1.5">Label</label>
                <input
                  value={labelState}
                  onChange={e => setLabel(e.target.value)}
                  placeholder={placeholder}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/60 mb-1.5">Total Value</label>
                <input
                  type="number"
                  min="0"
                  value={valueState}
                  onChange={e => setValue(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} w-28`}
                />
              </div>
              {isCat && (
                <div>
                  <label className="block text-[11px] font-semibold text-white/60 mb-1.5">Present Target (optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={catTarget}
                    onChange={e => setCatTarget(e.target.value)}
                    placeholder="—"
                    className={`${inputClass} w-28`}
                  />
                </div>
              )}
              <button
                onClick={() => addRow(type)}
                disabled={saving}
                className="running-button h-10 px-6 rounded-xl text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-[#0a2d24]/80 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
          <table className="w-full text-xs sm:text-sm [&_th]:px-3 [&_td]:px-3 [&_th]:py-2.5 [&_td]:py-2.5">
            <thead>
              <tr className="text-left text-white/50 text-xs border-b border-white/10">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">LABEL</th>
                <th className="px-4 py-3">TOTAL VALUE</th>
                {isCat && <th className="px-4 py-3">PRESENT TARGET</th>}
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-white/50">Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-white/50">No {badgeText.toLowerCase()} values found</td></tr>
              ) : (
                data.map((r, i) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-white/40 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-white/90">{r.label}</td>
                    <td className="px-4 py-3">
                      {editingId === r.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEdit(r.id)}
                            className="h-8 w-24 px-2 bg-white/10 border border-emerald-400/40 rounded-lg text-white text-sm outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={saving}
                            className="h-8 px-3 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditingTargetId(null) }}
                            className="h-8 px-3 rounded-lg bg-white/5 border border-white/15 text-white/60 text-xs font-bold hover:bg-white/10 transition"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-300 font-bold">
                          {r.value.toLocaleString()}
                        </span>
                      )}
                    </td>
                    {isCat && (
                      <td className="px-4 py-3">
                        {editingTargetId === r.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={editTargetValue}
                              onChange={e => setEditTargetValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveEdit(r.id)}
                              className="h-8 w-24 px-2 bg-white/10 border border-amber-400/40 rounded-lg text-white text-sm outline-none"
                            />
                            <button
                              onClick={() => saveEdit(r.id)}
                              disabled={saving}
                              className="h-8 px-3 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition disabled:opacity-50"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditingTargetId(null) }}
                              className="h-8 px-3 rounded-lg bg-white/5 border border-white/15 text-white/60 text-xs font-bold hover:bg-white/10 transition"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-amber-300 font-bold">
                            {r.present_target != null ? r.present_target.toLocaleString() : '—'}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(r)} aria-label="Edit" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteTarget(r)} aria-label="Delete" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Attendance Setup
        </h1>
        <p className="text-xs text-white/50 mt-1">
          Manage sanctioned posts (Total values) used in the Attendance Dashboard statistics tables
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-red-200 text-lg font-bold leading-none">✕</button>
        </div>
      )}

      {/* ✅ Dono tables side-by-side (bari screens) — stacked sirf chhoti screens par */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-start">
        {renderTable('Designation Values', desigRows, 'designation', showAddDesig, setShowAddDesig)}
        {renderTable('Category Values', catRows, 'category', showAddCat, setShowAddCat)}
      </div>

      {/* ✅ Total Present Target — Category Wise Total HR row ke liye */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-amber-400/20 bg-[#0a2d24]/80 p-4">
        <div>
          <div className="text-sm font-bold text-amber-300">Total Present Target (Category Wise)</div>
          <div className="text-[11px] text-white/50 mt-0.5">
            Category Wise table ki Total HR row ka PRESENT yellow rahe ga jab tak is target se kam ho
          </div>
        </div>
        {editingId === 'new-total-target' || (totalTargetRow && editingId === totalTargetRow.id) ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit(totalTargetRow ? totalTargetRow.id : 'new-total-target')}
              className="h-9 w-28 px-2 bg-white/10 border border-amber-400/40 rounded-lg text-white text-sm outline-none"
              autoFocus
            />
            <button
              onClick={() => saveEdit(totalTargetRow ? totalTargetRow.id : 'new-total-target')}
              disabled={saving}
              className="h-9 px-3 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition disabled:opacity-50"
            >
              ✓
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-white/60 text-xs font-bold hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>
        ) : totalTargetRow ? (
          <div className="flex items-center gap-2">
            <span className="text-amber-300 font-extrabold text-xl">
              {totalTargetRow.value.toLocaleString()}
            </span>
            <button
              onClick={() => startEdit(totalTargetRow)}
              aria-label="Edit total present target"
              title="Edit total present target"
              className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingId('new-total-target'); setEditValue('') }}
            className="running-button px-4 py-2 rounded-full text-white text-xs font-bold hover:opacity-90 transition"
          >
            + Set Target
          </button>
        )}
      </div>

      {/* Note */}
      <div className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-xl p-3">
        <strong className="text-amber-300">Note:</strong> These values are used as the Total column in the Attendance Dashboard's "Designation Wise Statistics" and "Category Wise Statistics" tables. The remaining columns (HIRED, CHECKIN, etc.) are calculated from live data.
      </div>

      {/* ✅ Delete confirmation popup */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Row</h3>
            <p className="text-white/60 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">{deleteTarget.label}</span>? This action cannot be undone.
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