import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type FMO = {
  id: string
  fmo_name: string
  hnd_office: boolean
  faqirwali_office: boolean
}

export default function PenaltiesFMODetails() {
  const [fmos, setFmos] = useState<FMO[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentFmo, setCurrentFmo] = useState<FMO | null>(null)
  
  // Form states
  const [newFmoName, setNewFmoName] = useState('')
  const [editFmoName, setEditFmoName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load FMOs directly from Supabase
  async function loadFMOs() {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('fmo_office_assignments')
        .select('*')
        .order('fmo_name', { ascending: true })
      
      if (err) throw err
      setFmos(data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load FMOs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFMOs()
  }, [])

  // Toggle office assignment
  async function toggleOffice(fmoId: string, fmoName: string, office: 'hnd' | 'faqirwali', value: boolean) {
    const key = `${fmoId}-${office}`
    if (updating.has(key)) return
    
    setUpdating(prev => new Set(prev).add(key))
    setError('')
    
    const fmo = fmos.find(f => f.id === fmoId)
    if (!fmo) return

    const payload = {
      hnd_office: office === 'hnd' ? value : fmo.hnd_office,
      faqirwali_office: office === 'faqirwali' ? value : fmo.faqirwali_office,
    }

    try {
      const { error: err } = await supabase
        .from('fmo_office_assignments')
        .update(payload)
        .eq('id', fmoId)
      
      if (err) throw err
      
      // Update local state immediately
      setFmos(prev => prev.map(f => f.id === fmoId ? { ...f, ...payload } : f))
    } catch (e: any) {
      setError(e.message || 'Failed to update')
    } finally {
      setUpdating(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // Add new FMO
  async function handleAddFMO() {
    if (!newFmoName.trim()) {
      setError('FMO name is required')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('fmo_office_assignments')
        .insert({
          fmo_name: newFmoName.trim(),
          hnd_office: false,
          faqirwali_office: false,
        })
      
      if (err) {
        if (err.message.includes('duplicate') || err.code === '23505') {
          throw new Error('This FMO name already exists')
        }
        throw err
      }
      
      setNewFmoName('')
      setIsAddModalOpen(false)
      await loadFMOs()
    } catch (e: any) {
      setError(e.message || 'Failed to add FMO')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit Modal
  function openEditModal(fmo: FMO) {
    setCurrentFmo(fmo)
    setEditFmoName(fmo.fmo_name)
    setError('')
    setIsEditModalOpen(true)
  }

  // Save Edit
  async function handleEditFMO() {
    if (!editFmoName.trim() || !currentFmo) {
      setError('FMO name is required')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('fmo_office_assignments')
        .update({ fmo_name: editFmoName.trim() })
        .eq('id', currentFmo.id)
      
      if (err) {
        if (err.message.includes('duplicate') || err.code === '23505') {
          throw new Error('This FMO name already exists')
        }
        throw err
      }
      
      setEditFmoName('')
      setCurrentFmo(null)
      setIsEditModalOpen(false)
      await loadFMOs()
    } catch (e: any) {
      setError(e.message || 'Failed to update FMO')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Delete Modal
  function openDeleteModal(fmo: FMO) {
    setCurrentFmo(fmo)
    setError('')
    setIsDeleteModalOpen(true)
  }

  // Delete FMO
  async function handleDeleteFMO() {
    if (!currentFmo) return
    setIsSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('fmo_office_assignments')
        .delete()
        .eq('id', currentFmo.id)
      
      if (err) throw err
      
      setCurrentFmo(null)
      setIsDeleteModalOpen(false)
      await loadFMOs()
    } catch (e: any) {
      setError(e.message || 'Failed to delete FMO')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Penalties FMO{' '}
          </span>
          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Office Details
          </span>
        </h2>
        <button
          onClick={() => { setIsAddModalOpen(true); setError('') }}
          className="h-9 px-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center gap-1.5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add FMO
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-red-200 text-lg font-bold leading-none">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-emerald-400/25 bg-[#04231c]/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0a4038]">
              <tr className="text-left text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 uppercase border-b border-emerald-400/20">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">FMO Name</th>
                <th className="px-4 py-3 text-center">HND Office</th>
                <th className="px-4 py-3 text-center">FaqirWali Office</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/50 text-xs">
                    Loading FMO data…
                  </td>
                </tr>
              ) : fmos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/50 text-xs">
                    No FMO data available. Click "Add FMO" to create one.
                  </td>
                </tr>
              ) : (
                fmos.map((fmo, i) => (
                  <tr key={fmo.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-white/40 text-[10px] font-bold">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] sm:text-xs font-semibold text-white/90">{fmo.fmo_name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        enabled={fmo.hnd_office}
                        onChange={(v) => toggleOffice(fmo.id, fmo.fmo_name, 'hnd', v)}
                        disabled={updating.has(`${fmo.id}-hnd`)}
                        label="HND"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        enabled={fmo.faqirwali_office}
                        onChange={(v) => toggleOffice(fmo.id, fmo.fmo_name, 'faqirwali', v)}
                        disabled={updating.has(`${fmo.id}-faqirwali`)}
                        label="FaqirWali"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(fmo)}
                          className="h-7 px-3 rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(fmo)}
                          className="h-7 px-3 rounded-lg border border-red-400/40 bg-red-500/15 text-red-300 text-[10px] font-bold hover:bg-red-500/25 transition"
                        >
                          Delete
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <Modal onClose={() => { setIsAddModalOpen(false); setError('') }} title="Add New FMO">
          <input
            type="text"
            value={newFmoName}
            onChange={e => setNewFmoName(e.target.value)}
            placeholder="Enter FMO name..."
            className="w-full h-10 px-3 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 text-[11px] sm:text-xs font-medium text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400/50"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAddFMO()}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setIsAddModalOpen(false); setNewFmoName(''); setError('') }}
              className="h-9 px-4 rounded-xl border border-white/15 bg-white/5 text-white/70 text-[11px] sm:text-xs font-bold hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFMO}
              disabled={isSubmitting || !newFmoName.trim()}
              className="h-9 px-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && currentFmo && (
        <Modal onClose={() => { setIsEditModalOpen(false); setCurrentFmo(null); setError('') }} title="Edit FMO Name">
          <input
            type="text"
            value={editFmoName}
            onChange={e => setEditFmoName(e.target.value)}
            placeholder="Enter new FMO name..."
            className="w-full h-10 px-3 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 text-[11px] sm:text-xs font-medium text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400/50"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleEditFMO()}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setIsEditModalOpen(false); setCurrentFmo(null); setEditFmoName(''); setError('') }}
              className="h-9 px-4 rounded-xl border border-white/15 bg-white/5 text-white/70 text-[11px] sm:text-xs font-bold hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleEditFMO}
              disabled={isSubmitting || !editFmoName.trim()}
              className="h-9 px-4 rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300 text-[11px] sm:text-xs font-bold hover:bg-sky-500/25 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && currentFmo && (
        <Modal onClose={() => { setIsDeleteModalOpen(false); setCurrentFmo(null); setError('') }} title="Confirm Delete">
          <p className="text-[11px] sm:text-xs text-white/70 mb-4">
            Are you sure you want to delete <span className="text-white font-bold">{currentFmo.fmo_name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setIsDeleteModalOpen(false); setCurrentFmo(null); setError('') }}
              className="h-9 px-4 rounded-xl border border-white/15 bg-white/5 text-white/70 text-[11px] sm:text-xs font-bold hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteFMO}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl border border-red-400/40 bg-red-500/15 text-red-300 text-[11px] sm:text-xs font-bold hover:bg-red-500/25 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Reusable Modal Component
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-400/30 bg-[#04231c] shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-extrabold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}

// Toggle Component
function Toggle({ enabled, onChange, disabled, label }: {
  enabled: boolean
  onChange: (v: boolean) => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 ${
        enabled ? 'bg-emerald-500' : 'bg-white/10'
      }`}
      title={`${label} Office ${enabled ? 'ON' : 'OFF'}`}
    >
      <span className="sr-only">{label}</span>
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  )
}