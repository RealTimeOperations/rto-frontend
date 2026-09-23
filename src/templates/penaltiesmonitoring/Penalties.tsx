import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Row = Record<string, any>

type Props = {
  penalties: Row[]
  loading?: boolean
  permissions?: any
}

/* ===== Custom dropdown (project style) ===== */
function Dropdown({ label, value, options, onChange, width }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  width?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`relative ${width ?? 'w-36 sm:w-44'}`}>
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-2 h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-semibold text-white hover:border-emerald-400/50 transition">
        <span className="truncate">{value || label}</span>
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-full min-w-40 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#071b15] shadow-2xl z-50">
            <div onClick={() => { onChange(''); setOpen(false) }} className={`px-3 py-2 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${!value ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/70'}`}>All {label}</div>
            {options.map(o => (
              <div key={o} onClick={() => { onChange(o); setOpen(false) }} className={`px-3 py-2 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${value === o ? 'text-emerald-300 bg-emerald-500/10' : 'text-white'}`}>{o}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function isYes(v: any) {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === '1' || s === 'true' || s === 'y'
}

function statusBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v.includes('resolved') || v.includes('closed') || v.includes('finalized')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
  if (v.includes('new')) return 'bg-sky-500/15 text-sky-300 border-sky-400/40'
  if (v.includes('grevience') || v.includes('grievance')) return 'bg-purple-500/15 text-purple-300 border-purple-400/40'
  if (v.includes('forward')) return 'bg-amber-500/15 text-amber-300 border-amber-400/40'
  return 'bg-white/5 text-white/60 border-white/15'
}

function fmtDate(v: any) {
  const s = String(v || '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function Penalties({ penalties, loading = false, permissions }: Props) {
  const [search, setSearch] = useState('')
  const [fType, setFType] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fImposed, setFImposed] = useState('')
  const [fAddedBy, setFAddedBy] = useState('')

  // ✅ 1. Office-wise FMO assignments
  const [fmoAssignments, setFmoAssignments] = useState<{ fmo_name: string; hnd_office: boolean; faqirwali_office: boolean }[]>([])
  useEffect(() => {
    async function loadAssignments() {
      const { data } = await supabase.from('fmo_office_assignments').select('fmo_name, hnd_office, faqirwali_office')
      setFmoAssignments(data || [])
    }
    loadAssignments()
  }, [])

  // ✅ 2. Employee ki allowed offices check karein
  const allowedOffices = useMemo(() => {
    if (!permissions) return ['hnd', 'faqirwali'] 
    const offices = []
    if (permissions.penalties_hnd) offices.push('hnd')
    if (permissions.penalties_faqirwali) offices.push('faqirwali')
    return offices 
  }, [permissions])

  // ✅ 3. Penalties ko filter karein sirf allowed offices ke FMOs ke liye
  const filteredPenalties = useMemo(() => {
    if (allowedOffices.length === 2) return penalties 
    return penalties.filter((p: Row) => {
      const fmo = fmoAssignments.find(f => f.fmo_name === p.added_by)
      if (!fmo) return false 
      if (allowedOffices.includes('hnd') && fmo.hnd_office) return true
      if (allowedOffices.includes('faqirwali') && fmo.faqirwali_office) return true
      return false
    })
  }, [penalties, fmoAssignments, allowedOffices])

  const typeOptions = useMemo(() => [...new Set(filteredPenalties.map((p: Row) => String(p.penalty_type || '').trim()).filter(Boolean))].sort(), [filteredPenalties])
  const statusOptions = useMemo(() => [...new Set(filteredPenalties.map((p: Row) => String(p.status || '').trim()).filter(Boolean))].sort(), [filteredPenalties])
  const addedByOptions = useMemo(() => [...new Set(filteredPenalties.map((p: Row) => String(p.added_by || '').trim()).filter(Boolean))].sort(), [filteredPenalties])
  const imposedOptions = ['TM Imposed', 'FMO Imposed', 'No']

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    return filteredPenalties.filter((p: Row) => {
      if (s && !String(p.id || '').toLowerCase().includes(s)) return false
      if (fType && String(p.penalty_type || '').trim() !== fType) return false
      if (fStatus && String(p.status || '').trim() !== fStatus) return false
      if (fImposed === 'TM Imposed' && !isYes(p.tm_imposed)) return false
      if (fImposed === 'FMO Imposed' && !isYes(p.penalty_imposed)) return false
      if (fImposed === 'No' && (isYes(p.tm_imposed) || isYes(p.penalty_imposed))) return false
      if (fAddedBy && String(p.added_by || '').trim() !== fAddedBy) return false
      return true
    })
  }, [filteredPenalties, search, fType, fStatus, fImposed, fAddedBy])

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-190px)] min-h-[340px]">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Penalties</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {loading ? '…' : filtered.length}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown label="Penalty Type" value={fType} options={typeOptions} onChange={setFType} />
          <Dropdown label="Status" value={fStatus} options={statusOptions} onChange={setFStatus} width="w-32 sm:w-40" />
          <Dropdown label="Penalty Imposed" value={fImposed} options={imposedOptions} onChange={setFImposed} />
          <Dropdown label="Added By" value={fAddedBy} options={addedByOptions} onChange={setFAddedBy} />
          
          <div className="relative w-40 sm:w-52">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Penalty ID..." className="w-full h-9 sm:h-10 pl-9 pr-9 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-medium text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2" /><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" /></svg>
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-red-300 transition">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-emerald-400/25 bg-[#04231c]/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
        <div className="h-full overflow-auto [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_rgba(2,27,22,0.6)]">
          <table className="w-full text-sm min-w-[1500px]">
            <thead className="sticky top-0 z-10 bg-[#0a4038]">
              <tr className="text-left text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 uppercase border-b border-emerald-400/20">
                <th className="px-3 sm:px-4 py-3">Sr#</th>
                <th className="px-3 sm:px-4 py-3">Penalty ID</th>
                <th className="px-3 sm:px-4 py-3">Penalty Type</th>
                <th className="px-3 sm:px-4 py-3">Penalty Sub Type</th>
                <th className="px-3 sm:px-4 py-3">Amount (Rs.)</th>
                <th className="px-3 sm:px-4 py-3">Status</th>
                <th className="px-3 sm:px-4 py-3">Penalty Imposed</th>
                <th className="px-3 sm:px-4 py-3">TAT</th>
                <th className="px-3 sm:px-4 py-3">Added By</th>
                <th className="px-3 sm:px-4 py-3">UC / Ward</th>
                <th className="px-3 sm:px-4 py-3">Created Date & Time</th>
                <th className="px-3 sm:px-4 py-3">Final Action Time</th>
                <th className="px-3 sm:px-4 py-3">Can Auto Imposed</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-white/50 text-xs">Loading penalties…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-white/50 text-xs">{filteredPenalties.length === 0 ? 'No penalties found' : 'No matching penalties'}</td></tr>
              ) : (
                filtered.map((p: Row, i: number) => {
                  const autoYes = String(p.can_auto_imposed ?? '').trim() === '1' || /yes|true/i.test(String(p.can_auto_imposed ?? ''))
                  return (
                    <tr key={String(p.id ?? i)} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                      <td className="px-3 sm:px-4 py-2.5 text-white/50 text-[11px]">{i + 1}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-amber-300 font-mono text-[11px] font-bold whitespace-nowrap">{p.id}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/90 text-[11px] font-semibold">{p.penalty_type || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/70 text-[11px]">{p.penalty_sub_type || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-emerald-300 text-[11px] font-bold whitespace-nowrap">{Number(p.penalty_amount || 0).toLocaleString()}</td>
                      <td className="px-3 sm:px-4 py-2.5"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusBadge(p.status)}`}>{p.status || '—'}</span></td>
                      <td className="px-3 sm:px-4 py-2.5"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${isYes(p.tm_imposed) ? 'bg-purple-500/15 text-purple-300 border-purple-400/40' : 'bg-white/5 text-white/50 border-white/15'}`}>{isYes(p.tm_imposed) ? 'Yes' : 'No'}</span></td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/70 text-[11px]">{p.tat || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/80 text-[11px]">{p.added_by || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/60 text-[11px]">{p.uc_ward || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/60 text-[10px] whitespace-nowrap">{fmtDate(p.created_at)}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-white/60 text-[10px] whitespace-nowrap">{fmtDate(p.final_action_time)}</td>
                      <td className="px-3 sm:px-4 py-2.5"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${autoYes ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' : 'bg-white/5 text-white/50 border-white/15'}`}>{autoYes ? 'Yes' : 'No'}</span></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}