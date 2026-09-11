import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export type SupervisorRow = {
  id: number
  name: string
  father_husband: string | null
  cnic: string
  designation: string | null
  region: string | null
  uc_ward: string | null
  attendance_point: string | null
  role: string | null
}

export type SupervisorDataModalState =
  | { mode: 'add' }
  | { mode: 'edit'; row: SupervisorRow }

type Props = {
  state: SupervisorDataModalState
  onClose: () => void
  onSaved: () => void
}

const DESIGNATIONS = ['Helper', 'Sanitary Supervisor', 'Sanitary Worker']
const REGIONS = ['Haroonabad', 'Border', 'Faqeerwali', 'Shaheed Chowk']

export default function SupervisorDataModal({ state, onClose, onSaved }: Props) {
  const editing = state.mode === 'edit' ? state.row : null
  const [name, setName] = useState(editing?.name ?? '')
  const [father, setFather] = useState(editing?.father_husband ?? '')
  const [cnic, setCnic] = useState(editing?.cnic ?? '')
  const [designation, setDesignation] = useState(editing?.designation ?? 'Helper')
  const [region, setRegion] = useState(editing?.region ?? 'Haroonabad')
  const [ucWard, setUcWard] = useState(editing?.uc_ward ?? '')
  const [point, setPoint] = useState(editing?.attendance_point ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const title = state.mode === 'add' ? 'Add Supervisor' : 'Edit Supervisor'

  function friendly(msg: string) {
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('cnic')) return 'Yeh CNIC pehle se mojood hai.'
    return msg
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      name: name.trim(),
      father_husband: father.trim(),
      cnic: cnic.trim(),
      designation,
      region,
      uc_ward: ucWard.trim(),
      attendance_point: point.trim(),
      role: 'Supervisor',
    }
    if (state.mode === 'add') {
      const { error: err } = await supabase.from('assigned_supervisors').insert(payload)
      if (err) setError(friendly(err.message))
      else onSaved()
    } else if (editing) {
      const { error: err } = await supabase.from('assigned_supervisors').update(payload).eq('id', editing.id)
      if (err) setError(friendly(err.message))
      else onSaved()
    }
    setSaving(false)
  }

  const inputClass = 'w-full h-11 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto rto-scroll">
        <h3 className="running-text text-lg font-bold mb-5">{title}</h3>
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl text-center">{error}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Abdul Rehman" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Father/Husband</label>
              <input value={father} onChange={e => setFather(e.target.value)} placeholder="e.g. Talib Hussain" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">CNIC</label>
              <input required value={cnic} onChange={e => setCnic(e.target.value)} placeholder="31104-1234567-8" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Designation</label>
              <select value={designation} onChange={e => setDesignation(e.target.value)} className={inputClass}>
                {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)} className={inputClass}>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">UC/Ward</label>
              <input required value={ucWard} onChange={e => setUcWard(e.target.value)} placeholder="e.g. UC-100, Chak 86/5R" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Attendance Point</label>
            <input required value={point} onChange={e => setPoint(e.target.value)} placeholder="e.g. Mian Town" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Role</label>
            <input value="Supervisor" disabled className={`${inputClass} opacity-60`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
            <button type="submit" disabled={saving} className="running-button flex-1 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
              {saving ? 'Saving…' : state.mode === 'add' ? 'Add Supervisor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}