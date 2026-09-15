import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SplitTable from '../attandancemonitoring/SplitTable'
import SupervisorDataModal, { type SupervisorDataModalState, type SupervisorRow } from './SupervisorDataModal'

export default function SupervisorsData() {
  const [rows, setRows] = useState<SupervisorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<SupervisorDataModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupervisorRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  // Load company supervisor records from assigned_supervisors table
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('assigned_supervisors')
      .select('*')
      .order('id', { ascending: true })
    if (err) {
      setError(err.message)
      console.error('SupervisorsData fetch error:', err)
    } else {
      setRows((data as SupervisorRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: err } = await supabase
      .from('assigned_supervisors')
      .delete()
      .eq('id', deleteTarget.id)
    if (err) console.error('Delete error:', err)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  const desigBadge = (d: string) =>
    d === 'Sanitary Supervisor'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      : d === 'Sanitary Worker'
        ? 'bg-sky-500/15 text-sky-300 border-sky-400/40'
        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'

  // ✅ Search filter: name / CNIC / designation / UC-Ward
  const filtered = rows.filter(r => {
    const s = search.toLowerCase()
    return (
      String(r.name ?? '').toLowerCase().includes(s) ||
      String(r.cnic ?? '').includes(s) ||
      String(r.designation ?? '').toLowerCase().includes(s) ||
      String(r.uc_ward ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="xl:max-w-[1500px] xl:mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-nowrap">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Supervisors Staff</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full whitespace-nowrap">
            Total: {rows.length}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* ✅ Button pehle — mobile par sirf "+ Add" */}
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="running-button flex-none px-3 sm:px-5 h-9 sm:h-auto sm:py-2.5 rounded-full text-white text-[11px] sm:text-xs font-bold hover:opacity-90 transition whitespace-nowrap"
          >
            <span className="sm:hidden">+ Add</span>
            <span className="hidden sm:inline">+ Add Supervisor</span>
          </button>
          {/* ✅ Search baad mein — bari width + cross button */}
          <div className="relative flex-1 sm:flex-none min-w-0 sm:w-56">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name / CNIC / designation…"
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

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center">
          Failed to load data: {error}
        </div>
      )}

      <SplitTable
        minW={1300}
        center={[9]}
        widths={[4, 10, 10, 11, 12, 7, 13, 14, 9, 10]}
        headers={['Sr#', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'Region', 'UC/Ward', 'Attendance Point', 'Role', 'Actions']}
      >
        {loading ? (
          <tr><td colSpan={10} className="px-4 py-10 text-center text-white/50">Loading supervisors data…</td></tr>
        ) : filtered.length === 0 ? (
          <tr><td colSpan={10} className="px-4 py-10 text-center text-white/50">{rows.length === 0 ? 'No records found' : 'No matching records'}</td></tr>
        ) : (
          filtered.map((r, i) => (
            <tr key={r.id} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="px-2 py-3 text-center text-white/50 font-mono whitespace-nowrap">{i + 1}</td>
              <td className="px-4 py-3 font-semibold text-white/90 whitespace-nowrap">{r.name}</td>
              <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.father_husband}</td>
              <td className="px-4 py-3 font-mono text-emerald-200 whitespace-nowrap">{r.cnic}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3">
                <span className={`rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-semibold border whitespace-nowrap ${desigBadge(r.designation ?? '')}`}>
                  {r.designation}
                </span>
              </td>
              <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.region}</td>
              <td className="px-4 py-3 text-white/70">{r.uc_ward}</td>
              <td className="px-4 py-3 text-white/70">{r.attendance_point}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3">
                <span className="rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold border bg-amber-500/15 border-amber-400/40 text-amber-300 whitespace-nowrap">
                  {r.role}
                </span>
              </td>
              <td className="px-2 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center justify-center gap-1 sm:gap-2">
                  <button onClick={() => setModal({ mode: 'edit', row: r })} aria-label="Edit supervisor" className="p-1.5 sm:p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(r)} aria-label="Delete supervisor" className="p-1.5 sm:p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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
      </SplitTable>
      </div>

      {modal && (
        <SupervisorDataModal
          state={modal}
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
            <h3 className="text-lg font-bold text-red-300 mb-2">Delete Supervisor</h3>
            <p className="text-white/60 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">{deleteTarget.name}</span> ({deleteTarget.cnic})? This action cannot be undone.
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