import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ✅ Backend API (penalties attachments + image proxy)
const API_BASE = 'http://localhost:8000'

// ✅ Attachments normalize: DB mein comma-joined string / JSON string / array — sab handle karo
//    e.g. '["url1.jpg,/path2.jpg"]' → ['https://.../url1.jpg', 'https://suthra.punjab.gov.pk/path2.jpg']
function normalizeAttachments(v: any): string[] {
  let arr: any[] = []
  if (Array.isArray(v)) arr = v
  else if (typeof v === 'string') {
    const s = v.trim()
    if (s.startsWith('[')) {
      try { arr = JSON.parse(s) } catch { arr = [s] }
    } else arr = [s]
  }
  const out: string[] = []
  for (const item of arr) {
    for (let piece of String(item ?? '').split(',')) {
      piece = piece.trim()
      if (!piece) continue
      if (piece.startsWith('http')) out.push(piece)
      else if (piece.startsWith('//')) out.push('https:' + piece)
      else if (piece.startsWith('/')) out.push('https://suthra.punjab.gov.pk' + piece)
    }
  }
  return [...new Set(out)]
} 

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
// ✅ 12 columns ki fixed widths (total = 100%) — header + body dono mein same → alignment barqarar
const COL_WIDTHS = ['3%','9%','9%','11%','6%','9%','7%','4%','11%','11%','12%','8%']
export default function Penalties({ penalties, loading = false, permissions }: Props) {
  const [search, setSearch] = useState('')
  const [fType, setFType] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fImposed, setFImposed] = useState('')
  const [fAddedBy, setFAddedBy] = useState('')
  // ✅ Penalty images popup (portal attachments)
  const [attachPen, setAttachPen] = useState<Row | null>(null)
  const [attachImgs, setAttachImgs] = useState<{ url: string; blob: Blob }[]>([])
  const [attachLoading, setAttachLoading] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [copyMsg, setCopyMsg] = useState('')
  const flashTimer = useRef<number | null>(null)
  // ✅ Session memory cache — popup dobara kholne par images instant (koi network nahi)
  const attachCacheRef = useRef<Map<string, { url: string; blob: Blob }[]>>(new Map())

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

  // ✅ Penalty images: portal attachments fetch + popup + copy logic
  function flash(msg: string) {
    setCopyMsg(msg)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopyMsg(''), 2000)
  }
  async function openAttachments(p: Row) {
    setAttachPen(p)
    setAttachImgs([])
    setAttachError('')
    setCopyMsg('')
    // ✅ Session cache: popup dobara kholne par foran images (koi network call nahi)
    const cached = attachCacheRef.current.get(String(p.id ?? ''))
    if (cached && cached.length > 0) {
      setAttachImgs(cached)
      return
    }
    // ✅ Images ki list DB (penaltiesdata.attachments) se — auto-sync store karta hai
    const urls: string[] = normalizeAttachments(p.attachments)
    if (urls.length === 0) {
      setAttachError('No images found for this penalty')
      return
    }
    setAttachLoading(true)
    // ✅ PARALLEL + PROGRESSIVE: sab images ek sath fetch hon, har image aate hi foran show ho
    const slots: ({ url: string; blob: Blob } | null)[] = urls.map(() => null)
    try {
      await Promise.all(urls.map(async (u, i) => {
        try {
          const pr = await fetch(API_BASE + '/penalties/attachment-image?url=' + encodeURIComponent(u))
          if (!pr.ok) return
          const blob = await pr.blob()
          if (blob.size > 0) {
            slots[i] = { url: URL.createObjectURL(blob), blob }
            setAttachImgs(slots.filter((s): s is { url: string; blob: Blob } => s !== null))
          }
        } catch {}
      }))
      const loaded = slots.filter((s): s is { url: string; blob: Blob } => s !== null)
      if (loaded.length === 0) throw new Error('Failed to load images')
      attachCacheRef.current.set(String(p.id ?? ''), loaded)   // ✅ session cache mein save
      setAttachImgs(loaded)
    } catch (e: any) {
      setAttachError(e?.message || 'Failed to load images')
    } finally {
      setAttachLoading(false)
    }
  }
  function closeAttachments() {
    // ✅ Object URLs revoke NAHI karte — session cache mein reuse hoti hain
    setAttachImgs([])
    setAttachPen(null)
    setAttachError('')
    setCopyMsg('')
  }
  // ✅ Blob → PNG convert (canvas ke zariye) — Clipboard write sirf image/png accept karta hai
  function blobToPng(blob: Blob): Promise<Blob> {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob)
      const el = new Image()
      el.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = el.naturalWidth || 1
          canvas.height = el.naturalHeight || 1
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas not supported')
          ctx.drawImage(el, 0, 0)
          canvas.toBlob(b => {
            URL.revokeObjectURL(url)
            if (b) res(b)
            else rej(new Error('PNG not generated'))
          }, 'image/png')
        } catch (e) {
          URL.revokeObjectURL(url)
          rej(e)
        }
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        rej(new Error('Image load failed'))
      }
      el.src = url
    })
  }
  async function copyBlobToClipboard(blob: Blob) {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !('write' in navigator.clipboard)) {
      throw new Error('Clipboard not supported')
    }
    // ✅ JPEG/WebP ho to pehle PNG banayein — warna browser write reject kar deta hai
    let out = blob
    if ((blob.type || '') !== 'image/png') {
      out = await blobToPng(blob)
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': out })])
  }
  async function copySingleImage(i: number) {
    const im = attachImgs[i]
    if (!im) return
    try {
      await copyBlobToClipboard(im.blob)
      flash(`Image ${i + 1} copied`)
    } catch (e: any) {
      alert(`Copy failed: ${e?.message || e}`)
    }
  }
  async function copyAllImages() {
    if (attachImgs.length === 0) return
    if (attachImgs.length === 1) return copySingleImage(0)
    try {
      const imgs = await Promise.all(
        attachImgs.map(im => new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image()
          el.onload = () => res(el)
          el.onerror = () => rej(new Error('Image load failed'))
          el.src = im.url
        }))
      )
      const gap = 24
      const w = Math.max(...imgs.map(im => im.naturalWidth))
      const h = imgs.reduce((s, im) => s + im.naturalHeight, 0) + gap * (imgs.length - 1)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      let y = 0
      for (const im of imgs) {
        ctx.drawImage(im, 0, y)
        y += im.naturalHeight + gap
      }
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Combined image not generated')
      await copyBlobToClipboard(blob)
      flash(`All ${imgs.length} images copied (combined)`)
    } catch (e: any) {
      alert(`Copy failed: ${e?.message || e}`)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-120px)] min-h-[420px]">
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

      {/* ✅ Penalty Images Popup — portal attachments (eye button) */}
    {attachPen && (
      <>
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeAttachments} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-emerald-400/30 bg-[#04231c] shadow-[0_30px_80px_rgba(0,0,0,0.6)] max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold truncate">
                  <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent">Penalty </span>
                  <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent">Images</span>
                </div>
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-300 truncate">{String(attachPen.id ?? '')}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {attachImgs.length > 1 && (
                  <button
                    type="button"
                    onClick={copyAllImages}
                    className="h-9 px-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Copy All
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeAttachments}
                  aria-label="Close images"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 transition"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {copyMsg && (
                <div className="px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] font-bold text-center">{copyMsg}</div>
              )}
              {attachLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="h-10 w-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-300 animate-spin" />
                  <div className="text-xs font-semibold text-white/70">Loading images…</div>
                </div>
              ) : attachError ? (
                <div className="px-4 py-6 rounded-xl border border-red-400/30 bg-red-500/10 text-red-300 text-xs font-bold text-center">{attachError}</div>
              ) : (
                <div className={`grid gap-4 ${attachImgs.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {attachImgs.map((im, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                      <img src={im.url} alt={`Penalty image ${i + 1}`} className="w-full rounded-lg object-contain bg-white/5 max-h-[45dvh]" />
                      <button
                        type="button"
                        onClick={() => copySingleImage(i)}
                        className="h-8 px-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center justify-center gap-1.5"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        Copy Image {i + 1}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    <div className="flex-1 min-h-0 rounded-2xl border border-emerald-400/25 bg-[#04231c]/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
        {/* ✅ Horizontal sync wrapper — mobile par hi scroll; lg+ par content fit */}
        <div className="h-full overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
          <div className="min-w-[1200px] lg:min-w-0 h-full flex flex-col">

            {/* ✅ Header — scroll area se BAHAR, border ke sath joined */}
            <div className="flex-shrink-0 bg-[#0a4038] lg:pr-[10px]">
              <table className="w-full table-fixed">
                <colgroup>
                  {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr className="text-center text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 uppercase border-b border-emerald-400/20">
                    <th className="px-2 sm:px-3 py-3 text-left">Sr#</th>
                    <th className="px-2 sm:px-3 py-3 text-left">Penalty ID</th>
                    <th className="px-2 sm:px-3 py-3">Penalty Type</th>
                    <th className="px-2 sm:px-3 py-3">Penalty Sub Type</th>
                    <th className="px-2 sm:px-3 py-3">Amount (Rs.)</th>
                    <th className="px-2 sm:px-3 py-3">Status</th>
                    <th className="px-2 sm:px-3 py-3">Penalty Imposed</th>
                    <th className="px-2 sm:px-3 py-3">TAT</th>
                    <th className="px-2 sm:px-3 py-3">Added By</th>
                    <th className="px-2 sm:px-3 py-3">UC / Ward</th>
                    <th className="px-2 sm:px-3 py-3">Created Date & Time</th>
                    <th className="px-2 sm:px-3 py-3 text-center">View</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* ✅ Body — vertical scroll bar SIRF rows area mein (header tak stop) */}
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_rgba(2,27,22,0.6)] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-[rgba(2,27,22,0.6)] [&::-webkit-scrollbar-thumb]:bg-[rgba(16,185,129,0.45)] [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full table-fixed">
                <colgroup>
                  {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <tbody>
                  {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-white/50 text-xs">Loading penalties…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-white/50 text-xs">{filteredPenalties.length === 0 ? 'No penalties found' : 'No matching penalties'}</td></tr>
                  ) : (
                    filtered.map((p: Row, i: number) => {
                      return (
                        <tr key={String(p.id ?? i)} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition text-center">
                          <td className="px-2 sm:px-3 py-2.5 text-white/50 text-[11px] text-left">{i + 1}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-amber-300 font-mono text-[11px] font-bold text-left">{p.id}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/90 text-[11px] font-semibold">{p.penalty_type || '—'}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/70 text-[11px]">{p.penalty_sub_type || '—'}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-emerald-300 text-[11px] font-bold whitespace-nowrap">{Number(p.penalty_amount || 0).toLocaleString()}</td>
                          <td className="px-2 sm:px-3 py-2.5"><span title={String(p.status || '—')} className={`inline-block max-w-full truncate px-2 py-1 rounded-full text-[10px] font-bold border ${statusBadge(p.status)}`}>{p.status || '—'}</span></td>
                          <td className="px-2 sm:px-3 py-2.5"><span className={`inline-block max-w-full truncate px-2 py-1 rounded-full text-[10px] font-bold border ${isYes(p.tm_imposed) ? 'bg-purple-500/15 text-purple-300 border-purple-400/40' : 'bg-white/5 text-white/50 border-white/15'}`}>{isYes(p.tm_imposed) ? 'Yes' : 'No'}</span></td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/70 text-[11px]">{p.tat || '—'}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/80 text-[11px]">{p.added_by || '—'}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/60 text-[11px]">{p.uc_ward || '—'}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-white/60 text-[10px]">{fmtDate(p.created_at)}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-center">
                            <button
                              type="button"
                              title="View penalty images (portal attachments)"
                              onClick={() => openAttachments(p)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/25 hover:text-white transition"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}