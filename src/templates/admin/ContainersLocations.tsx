import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type LocationRow = {
  site: string
  category: string
  supervisor: string
  lat: number | null
  lon: number | null
}

type FormState = {
  site: string
  category: string
  supervisor: string
  lat: string
  lon: string
}

const EMPTY_FORM: FormState = { site: '', category: '0.8cm', supervisor: '', lat: '', lon: '' }

export default function ContainersLocations() {
  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  // Add / Edit modal state
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; originalSite: string }>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<LocationRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 2500)
  }

  // ---- Load all locations from Supabase
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('contanerlocations')
        .select('site, category, supervisor, lat, lon')
        .order('site', { ascending: true })
      if (error) throw error
      setRows((data ?? []) as LocationRow[])
      setLoadError('')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ---- Search filter (site / supervisor / category)
  const filtered = search.trim()
    ? rows.filter(r =>
        r.site.toLowerCase().includes(search.toLowerCase()) ||
        (r.supervisor ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.category ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rows

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModal({ mode: 'add' })
  }

  function openEdit(row: LocationRow) {
    setForm({
      site: row.site,
      category: row.category || '0.8cm',
      supervisor: row.supervisor || '',
      lat: row.lat != null ? String(row.lat) : '',
      lon: row.lon != null ? String(row.lon) : '',
    })
    setFormError('')
    setModal({ mode: 'edit', originalSite: row.site })
  }

  // ---- Save (add or update)
  async function handleSave() {
    if (!modal) return
    const site = form.site.trim()
    const supervisor = form.supervisor.trim()
    const lat = parseFloat(form.lat)
    const lon = parseFloat(form.lon)
    if (!site) { setFormError('Site name is required'); return }
    if (!supervisor) { setFormError('Supervisor is required'); return }
    if (isNaN(lat) || isNaN(lon)) { setFormError('Latitude & Longitude must be valid numbers'); return }

    setSaving(true)
    try {
      const payload = { site, category: form.category, supervisor, lat, lon }
      if (modal.mode === 'add') {
        const { error } = await supabase.from('contanerlocations').insert(payload)
        if (error) throw error
        showToast('success', 'Location added successfully')
      } else {
        const { error } = await supabase
          .from('contanerlocations')
          .update(payload)
          .eq('site', modal.originalSite)
        if (error) throw error
        showToast('success', 'Location updated successfully')
      }
      setModal(null)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || (e instanceof Error ? e.message : 'Save failed')
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  // ---- Delete (after confirmation)
  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('contanerlocations')
        .delete()
        .eq('site', confirmDelete.site)
      if (error) throw error
      showToast('success', 'Location deleted successfully')
      setConfirmDelete(null)
      await load()
    } catch (e) {
      showToast('error', (e as any)?.message || 'Delete failed')
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30 transition'

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Containers Locations
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Manage fixed container sites (Supabase table: contanerlocations) — add, update or delete locations
          </p>
        </div>
        <button
          onClick={openAdd}
          className="running-button px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
        >
          + Add Location
        </button>
      </div>

      {/* Toolbar: search + count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search site, supervisor or category..."
            className={inputCls + ' pl-9'}
          />
          <svg className="absolute left-3 top-3 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <span className="text-xs font-bold text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
          Total: {filtered.length}{search.trim() ? ` / ${rows.length}` : ''}
        </span>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl">
          {loadError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
        <div className="max-h-[65vh] overflow-auto [scrollbar-width:thin]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/10 bg-[#0a2e26]">
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">#</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">SITE</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CATEGORY</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">SUPERVISOR</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">LATITUDE</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">LONGITUDE</th>
                <th className="px-3 py-3 font-bold tracking-widest text-white/70 whitespace-nowrap text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">Loading locations…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                    {rows.length === 0 ? 'No locations found — add the first one!' : 'No match for your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.site} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                    <td className="px-3 py-2.5 text-white/40 font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-white/90">{r.site}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          (r.category || '').includes('0.8')
                            ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                            : 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                        }`}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/70">{r.supervisor}</td>
                    <td className="px-3 py-2.5 text-white/60 font-mono text-[11px]">{r.lat != null ? Number(r.lat).toFixed(5) : '—'}</td>
                    <td className="px-3 py-2.5 text-white/60 font-mono text-[11px]">{r.lon != null ? Number(r.lon).toFixed(5) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit location"
                          className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(r)}
                          title="Delete location"
                          className="p-2 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 hover:bg-red-500/25 transition"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

      {/* ===== Add / Edit Modal ===== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-white mb-4">
              {modal.mode === 'add' ? 'Add Container Location' : 'Update Container Location'}
            </h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold tracking-wider text-white/60 mb-1">SITE NAME *</label>
                <input
                  type="text"
                  value={form.site}
                  onChange={e => setForm({ ...form, site: e.target.value })}
                  placeholder="e.g. Beat No 1 H-101 Main Bazar"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-white/60 mb-1">CATEGORY *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className={inputCls}
                  >
                    <option value="0.8cm">0.8cm</option>
                    <option value="5cm">5cm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-white/60 mb-1">SUPERVISOR *</label>
                  <input
                    type="text"
                    value={form.supervisor}
                    onChange={e => setForm({ ...form, supervisor: e.target.value })}
                    placeholder="e.g. Mani Khan"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-white/60 mb-1">LATITUDE *</label>
                  <input
                    type="text"
                    value={form.lat}
                    onChange={e => setForm({ ...form, lat: e.target.value })}
                    placeholder="29.614312"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-white/60 mb-1">LONGITUDE *</label>
                  <input
                    type="text"
                    value={form.lon}
                    onChange={e => setForm({ ...form, lon: e.target.value })}
                    placeholder="73.144908"
                    className={inputCls}
                  />
                </div>
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs p-2.5 rounded-xl">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 running-button rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add Location' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Container Location</h3>
            <p className="text-white/60 text-sm mb-1">Are you sure you want to delete this location?</p>
            <p className="text-emerald-200 text-sm font-semibold mb-6 break-words">{confirmDelete.site}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-bold hover:bg-red-500/30 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
              : 'bg-red-500/15 border-red-400/40 text-red-300'
          }`}
        >
          {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.message}
        </div>
      )}
    </div>
  )
}