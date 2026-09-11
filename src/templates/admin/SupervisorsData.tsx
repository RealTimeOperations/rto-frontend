import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SplitTable from '../attandancemonitoring/SplitTable'
import SupervisorDataModal, { type SupervisorDataModalState, type SupervisorRow } from './SupervisorDataModal'

type Props = {
  onBack?: () => void
}

export default function SupervisorsData({ onBack }: Props) {
  const [rows, setRows] = useState<SupervisorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<SupervisorDataModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupervisorRow | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/15 text-white/70 text-xs font-semibold hover:bg-white/10 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>
          )}
          <h2 className="running-text text-xl font-bold">Supervisors Data</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
            Total: {rows.length}
          </span>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="running-button px-5 py-2.5 rounded-full text-white text-xs font-bold hover:opacity-90 transition"
          >
            + Add Supervisor
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center">
          Failed to load data: {error}
        </div>
      )}

      <SplitTable
        minW={1300}
        widths={[4, 12, 11, 11, 11, 8, 13, 14, 7, 9]}
        headers={['Sr#', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'Region', 'UC/Ward', 'Attendance Point', 'Role', 'Actions']}
      >
        {loading ? (
          <tr><td colSpan={10} className="px-4 py-10 text-center text-white/50">Loading supervisors data…</td></tr>
        ) : rows.length === 0 ? (
          <tr><td colSpan={10} className="px-4 py-10 text-center text-white/50">No records found</td></tr>
        ) : (
          rows.map((r, i) => (
            <tr key={r.id} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="px-2 py-3 text-center text-white/50 font-mono whitespace-nowrap">{i + 1}</td>
              <td className="px-4 py-3 font-semibold text-white/90 whitespace-nowrap">{r.name}</td>
              <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.father_husband}</td>
              <td className="px-4 py-3 font-mono text-emerald-200 whitespace-nowrap">{r.cnic}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border ${desigBadge(r.designation ?? '')}`}>
                  {r.designation}
                </span>
              </td>
              <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.region}</td>
              <td className="px-4 py-3 text-white/70">{r.uc_ward}</td>
              <td className="px-4 py-3 text-white/70">{r.attendance_point}</td>
              <td className="px-4 py-3">
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold border bg-amber-500/15 border-amber-400/40 text-amber-300 whitespace-nowrap">
                  {r.role}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setModal({ mode: 'edit', row: r })} aria-label="Edit supervisor" className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 transition">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(r)} aria-label="Delete supervisor" className="p-2 rounded-lg text-red-300 hover:bg-red-500/15 transition">
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