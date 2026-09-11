import { useMemo, useState, useEffect } from 'react'
import SplitTable from './SplitTable'

type Row = Record<string, any>

type Props = {
  rows: Row[]        // attendance_logs
  employees: Row[]   // assigned_employees (Total HR)
  loading: boolean
}

const norm = (s: any) => String(s ?? '').replace(/-/g, '').trim().toLowerCase()

const cleanDesig = (s: any) => String(s ?? '').replace(/\([^)]*\)/g, '').trim()

/* ✅ Multi-field search: CNIC, Name, UC/Ward, Designation, Attendance Point, Work Type */
const matchRow = (r: Row, q: string) =>
  [r.cnic, r.user_name ?? r.name, r.uc_ward, r.designation, r.attendance_point ?? r.point, r.work_type ?? r.workType].some(f => {
    const s = String(f ?? '').toLowerCase()
    return s.includes(q) || s.replace(/-/g, '').includes(q)
  })

function dutyDuration(checkin?: string, checkout?: string): string {
  if (!checkin || !checkout) return '—'
  const a = new Date(String(checkin).replace(' ', 'T'))
  const b = new Date(String(checkout).replace(' ', 'T'))
  const mins = Math.round((b.getTime() - a.getTime()) / 60000)
  if (isNaN(mins) || mins < 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function empType(code?: string): string {
  return String(code ?? '').toUpperCase().includes('MC') ? 'MC' : 'Contractor'
}

export default function AttendanceReport({ rows, employees, loading }: Props) {
  const [search, setSearch] = useState('')
  const [ucWard, setUcWard] = useState('')
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'on-duty'>('all')
  
  // ✅ Custom searchable dropdown states for UC/Ward
  const [isUcDropdownOpen, setIsUcDropdownOpen] = useState(false)
  const [ucDropdownSearch, setUcDropdownSearch] = useState('')

  // ✅ Copy report menu states
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUcDropdownOpen && !(event.target as Element).closest('.uc-dropdown-container')) {
        setIsUcDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isUcDropdownOpen])

  // ✅ Close copy menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyMenuOpen && !(event.target as Element).closest('.copy-menu-container')) {
        setCopyMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [copyMenuOpen])

  // ✅ Unique UC/Ward list for dropdown
  const ucList = useMemo(() => {
    const set = new Set<string>()
    for (const e of employees) {
      const v = String(e.uc_ward ?? '').trim()
      if (v) set.add(v)
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [employees])

  const attMap = useMemo(() => {
    const map: Record<string, { checkin?: string; checkout?: string }> = {}
    for (const r of rows) {
      const key = norm(r.cnic)
      if (!key) continue
      const t = String(r.date_time ?? '')
      if (!map[key]) map[key] = {}
      const type = String(r.check_type ?? '').toLowerCase()
      if (type === 'checkin') {
        if (!map[key].checkin || t < map[key].checkin!) map[key].checkin = t
      } else if (type === 'checkout') {
        if (!map[key].checkout || t > map[key].checkout!) map[key].checkout = t
      }
    }
    return map
  }, [rows])

  const report = useMemo(() => {
    const list = employees.map(e => {
      const att = attMap[norm(e.cnic)] || {}
      return {
        sr: 0,
        checkin: att.checkin ? 'P' : 'A',
        checkout: att.checkout ? 'P' : '--',
        name: String(e.name ?? ''),
        father: String(e.father_name ?? ''),
        cnic: String(e.cnic ?? ''),
        designation: String(e.designation ?? ''),
        uc_ward: String(e.uc_ward ?? ''),
        point: String(e.attendance_point ?? ''),
        workType: String(e.work_type ?? ''),
        checkinTime: att.checkin ?? '—',
        checkoutTime: att.checkout ?? '—',
        duty: dutyDuration(att.checkin, att.checkout),
        empType: empType(e.employee_code),
      }
    })
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((r, i) => (r.sr = i + 1))
    return list
  }, [employees, attMap])

  const filtered = useMemo(() => {
    let list = [...report]

    // 1. UC/Ward filter
    if (ucWard) {
      list = list.filter(r => String(r.uc_ward ?? '').trim() === ucWard)
    }

    // 2. Status filter (Present / Absent / On Duty)
    if (filter === 'present') {
      // Present: Both Check-in and Check-out must be completed
      list = list.filter(r => r.checkin === 'P' && r.checkout === 'P')
    } else if (filter === 'absent') {
      list = list.filter(r => r.checkin === 'A')
    } else if (filter === 'on-duty') {
      // Check-in hua hai lekin Check-out abhi tak empty hai
      list = list.filter(r => r.checkin === 'P' && r.checkout === '--')
    }

    // 3. Search filter
    const q = norm(search)
    if (q) {
      list = list.filter(r => matchRow(r, q))
    }

    // 4. Smart Sorting
    if (ucWard) {
      list.sort((a, b) => {
        const pointA = String(a.point ?? '').trim()
        const pointB = String(b.point ?? '').trim()
        if (pointA !== pointB) {
          return pointA.localeCompare(pointB)
        }
        const desigA = cleanDesig(a.designation ?? '').trim()
        const desigB = cleanDesig(b.designation ?? '').trim()
        return desigA.localeCompare(desigB)
      })
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }

    list.forEach((r, i) => (r.sr = i + 1))
    return list
  }, [report, ucWard, filter, search])

  // ✅ Build copy list: filters applied + sorted by Designation → UC/Ward → Attendance Point
  function copyList(kind: 'onduty' | 'absent') {
    const q = norm(search)
    const list = report.filter(r => {
      if (ucWard && String(r.uc_ward ?? '').trim() !== ucWard) return false
      if (q && !matchRow(r, q)) return false
      if (kind === 'onduty') return r.checkin === 'P' && r.checkout === '--'
      return r.checkin === 'A'
    })
    // Natural sort: numbers compare as real numbers (Ward 6 < Ward 7 < Ward 9 < Ward 10 < Ward 22),
    // extra spaces normalized, case-insensitive — guaranteed correct order
    const naturalCmp = (a: string, b: string) => {
      const pa = a.replace(/\s+/g, ' ').trim().split(/(\d+)/)
      const pb = b.replace(/\s+/g, ' ').trim().split(/(\d+)/)
      const len = Math.min(pa.length, pb.length)
      for (let i = 0; i < len; i++) {
        const da = /^\d+$/.test(pa[i])
        const db = /^\d+$/.test(pb[i])
        if (da && db) {
          const diff = parseInt(pa[i], 10) - parseInt(pb[i], 10)
          if (diff !== 0) return diff
        } else {
          const c = pa[i].localeCompare(pb[i], undefined, { sensitivity: 'base' })
          if (c !== 0) return c
        }
      }
      return pa.length - pb.length
    }
    // Hamesha yahi sequence: Designation → UC/Ward → Attendance Point
    list.sort((a, b) => {
      const desA = cleanDesig(a.designation ?? '').trim()
      const desB = cleanDesig(b.designation ?? '').trim()
      if (desA !== desB) return naturalCmp(desA, desB)
      const ucA = String(a.uc_ward ?? '')
      const ucB = String(b.uc_ward ?? '')
      if (ucA !== ucB) return naturalCmp(ucA, ucB)
      return naturalCmp(String(a.point ?? ''), String(b.point ?? ''))
    })
    return list.map((r, i) => ({ ...r, sr: i + 1 }))
  }

  // ✅ Draw Excel-style table on canvas (3x scale = crisp "full HD" text) and copy as PNG
  async function copyReportImage(kind: 'onduty' | 'absent') {
    const rows = copyList(kind)
    setCopyMenuOpen(false)
    if (rows.length === 0) {
      setCopyMsg('No records to copy')
      setTimeout(() => setCopyMsg(''), 2500)
      return
    }
    setCopying(true)

    const title = kind === 'onduty' ? 'Remaining Checkout List' : 'Absent List'
    const cols = [
      { label: 'Sr#', w: 44 },
      { label: 'Name', w: 190 },
      { label: 'Father/Husband', w: 170 },
      { label: 'CNIC', w: 130 },
      { label: 'Designation', w: 190 },
      { label: 'UC/Ward', w: 230 },
      { label: 'Attendance Point', w: 230 },
    ]
    const rowH = 24
    const headH = 48
    const width = cols.reduce((s, c) => s + c.w, 0)
    const height = headH + 30 + rows.length * rowH + 8
    // Adaptive ultra-HD scale (2x–8x): canvas limits ke andar maximum crispness,
    // so text stays sharp even when zoomed on any list size
    const maxByDim = Math.floor(65535 / height)
    const maxByArea = Math.floor(Math.sqrt(268435456 / (width * height)))
    const scale = Math.max(2, Math.min(8, maxByDim, maxByArea))

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setCopying(false)
      return
    }
    ctx.scale(scale, scale)

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Single line: heading + bold date + bold total (prominent)
    const when = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    let tx = 10
    ctx.fillStyle = '#1f3864'
    ctx.font = 'bold 20px Arial'
    ctx.fillText(title, tx, 30)
    tx += ctx.measureText(title).width + 16
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 14px Arial'
    ctx.fillText(when, tx, 29)
    tx += ctx.measureText(when).width + 8
    ctx.fillStyle = '#888888'
    ctx.fillText('•', tx, 29)
    tx += ctx.measureText('•').width + 8
    ctx.fillStyle = '#111111'
    const totalText = `Total: ${rows.length}`
    ctx.fillText(totalText, tx, 29)
    tx += ctx.measureText(totalText).width
    if (ucWard) {
      ctx.fillStyle = '#888888'
      const sep = '  •  '
      ctx.fillText(sep, tx, 29)
      tx += ctx.measureText(sep).width
      ctx.fillStyle = '#111111'
      ctx.fillText(ucWard, tx, 29)
    }

    // Blue header row (Excel style)
    let y = headH
    ctx.fillStyle = '#4472c4'
    ctx.fillRect(0, y, width, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px Arial'
    let x = 0
    for (const c of cols) {
      ctx.fillText(c.label, x + 6, y + 20)
      x += c.w
    }
    y += 30

    // Data rows with alternating colors
    const vals = (r: any) => [
      String(r.sr),
      String(r.name ?? ''),
      String(r.father ?? ''),
      String(r.cnic ?? ''),
      cleanDesig(r.designation ?? ''),
      String(r.uc_ward ?? ''),
      String(r.point ?? ''),
    ]
    rows.forEach((r, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#d9e1f2'
      ctx.fillRect(0, y, width, rowH)
      ctx.fillStyle = '#000000'
      ctx.font = '12px Arial'
      let cx = 0
      vals(r).forEach((v, ci) => {
        const w = cols[ci].w
        let text = v
        while (ctx.measureText(text).width > w - 10 && text.length > 3) text = text.slice(0, -2) + '…'
        ctx.fillText(text, cx + 6, y + 16)
        cx += w
      })
      ctx.strokeStyle = '#b4c6e7'
      ctx.lineWidth = 0.6
      ctx.strokeRect(0, y, width, rowH)
      y += rowH
    })

    // Copy to clipboard only — WhatsApp par direct Ctrl+V se paste ho jayegi
    canvas.toBlob(async blob => {
      if (!blob) {
        setCopying(false)
        setCopyMsg('Failed to create image')
        setTimeout(() => setCopyMsg(''), 2500)
        return
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopyMsg('Copied! Paste in WhatsApp (Ctrl+V)')
      } catch {
        setCopyMsg('Clipboard not supported in this browser')
      }
      setCopying(false)
      setTimeout(() => setCopyMsg(''), 3000)
    }, 'image/png')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Heading + stats + filters + search */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Attendance Report
        </h1>
        {/* Single count card — always equals current table rows */}
        <span className="w-fit text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
          Total: {filtered.length}
        </span>

        {/* ✅ Filters & Search Bar Group */}
        <div className="lg:ml-auto flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
          
          {/* ✅ Copy Report menu button */}
          <div className="relative copy-menu-container">
            <button
              type="button"
              onClick={() => setCopyMenuOpen(!copyMenuOpen)}
              disabled={copying}
              className="w-full flex items-center justify-between gap-2.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs sm:text-sm font-bold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50 whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copying ? 'Creating…' : 'Copy Report'}
              </span>
              {/* Dropdown chevron — khulne par rotate hota hai */}
              <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${copyMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {copyMenuOpen && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden">
                <button
                  onClick={() => copyReportImage('onduty')}
                  className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/5 transition-colors"
                >
                  On Duty (Remaining Checkout)
                </button>
                {/* Divider line — dono options alag nazar aayein */}
                <div className="h-px bg-white/10" />
                <button
                  onClick={() => copyReportImage('absent')}
                  className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/5 transition-colors"
                >
                  Absent List
                </button>
              </div>
            )}
            {copyMsg && (
              <div className="absolute z-50 mt-2 left-0 w-full rounded-xl border border-emerald-400/40 bg-[#071b15] px-3 py-2 text-[11px] text-emerald-300 shadow-2xl">
                {copyMsg}
              </div>
            )}
          </div>

          {/* 1. Present/Absent Filter (Same style as Attendance Logs) */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'present' | 'absent' | 'on-duty')}
            className="rounded-full border border-white/15 bg-[#071b15] px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 outline-none focus:border-emerald-400/60"
          >
            <option value="all">All Attendance</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="on-duty">On Duty</option>
          </select>

          {/* 2. UC/Ward Searchable Dropdown (Same as TotalHR) */}
          <div className="relative w-full sm:w-64 uc-dropdown-container">
            <button
              type="button"
              onClick={() => setIsUcDropdownOpen(!isUcDropdownOpen)}
              className="w-full flex items-center justify-between rounded-full border border-white/15 bg-[#071b15] px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 outline-none focus:border-emerald-400/60 transition-colors hover:border-emerald-400/40"
            >
              <span className="truncate">{ucWard || 'All UC/Wards'}</span>
              <svg className={`h-4 w-4 transition-transform duration-200 ${isUcDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isUcDropdownOpen && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden">
                {/* Dropdown Search Input with Cross Button */}
                <div className="p-2 border-b border-white/10 relative">
                  <input
                    type="text"
                    value={ucDropdownSearch}
                    onChange={e => setUcDropdownSearch(e.target.value)}
                    placeholder="Search UC/Ward..."
                    className="w-full rounded-lg border border-white/15 bg-[#0a2520] px-3 pr-8 py-1.5 text-xs text-white/80 placeholder-white/35 outline-none focus:border-emerald-400/60"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  {ucDropdownSearch && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setUcDropdownSearch('') }}
                      aria-label="Clear dropdown search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-red-300"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Dropdown List */}
                <div className="max-h-48 overflow-y-auto rto-scroll">
                  <button
                    onClick={() => { setUcWard(''); setUcDropdownSearch(''); setIsUcDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-xs sm:text-sm transition-colors ${ucWard === '' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/80 hover:bg-white/5'}`}
                  >
                    All
                  </button>
                  {ucList.filter(u => u !== 'All').filter(u => u.toLowerCase().includes(ucDropdownSearch.toLowerCase())).map(u => (
                    <button
                      key={u}
                      onClick={() => { setUcWard(u); setUcDropdownSearch(''); setIsUcDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-xs sm:text-sm transition-colors ${ucWard === u ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      {u}
                    </button>
                  ))}
                  {ucList.filter(u => u !== 'All').filter(u => u.toLowerCase().includes(ucDropdownSearch.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-xs text-white/40 text-center">Koi match nahi mila</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Search Bar with Cross Button */}
          <div className="relative w-full sm:w-64">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value) }}
              placeholder="Search CNIC, Name, UC/Ward…"
              className="w-full rounded-full border border-white/15 bg-[#071b15] pl-9 pr-8 py-2 text-xs sm:text-sm text-white/80 placeholder-white/35 outline-none focus:border-emerald-400/60"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <button
              onClick={() => { setSearch('') }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-red-300"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ✅ SplitTable: header bahir (poora), scroll sirf rows par */}
      <SplitTable
        small
        center={[1, 2]}
        widths={[4, 5, 6, 10, 9, 8, 9, 7, 9, 6, 7, 7, 6, 7]}
        headers={['Sr#', 'Check-In', 'Check-Out', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point', 'Work Type', 'CheckinTime', 'CheckoutTime', 'DutyStatus', 'Employee Type']}
      >
        {loading ? (
          <tr><td colSpan={14} className="px-2 py-10 text-center text-white/50">Loading report…</td></tr>
        ) : filtered.length === 0 ? (
          <tr><td colSpan={14} className="px-2 py-10 text-center text-white/50">Koi record nahi mila</td></tr>
        ) : (
          filtered.map(r => (
            <tr key={r.cnic || r.sr} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="px-2 py-3 text-center text-white/50 font-mono">{r.sr}</td>
              <td className="px-2 py-3 text-center">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold border ${r.checkin === 'P' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'}`}>{r.checkin}</span>
              </td>
              <td className="px-2 py-3 text-center">
                {r.checkout === 'P' ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold border bg-emerald-500/20 border-emerald-400/50 text-emerald-300">P</span>
                ) : (
                  <span className="text-white/35 font-bold">--</span>
                )}
              </td>
              <td className="px-2 py-3 font-semibold text-white/90">{r.name}</td>
              <td className="px-2 py-3 text-white/70">{r.father}</td>
              <td className="px-2 py-3 font-mono text-emerald-200">{r.cnic}</td>
              <td className="px-2 py-3 text-white/70">{cleanDesig(r.designation)}</td>
              <td className="px-2 py-3 text-white/70">{r.uc_ward}</td>
              <td className="px-2 py-3 text-white/70">{r.point}</td>
              <td className="px-2 py-3 text-white/70">{r.workType}</td>
              <td className="px-2 py-3 text-white/70">{r.checkinTime}</td>
              <td className="px-2 py-3 text-white/70">{r.checkoutTime}</td>
              <td className="px-2 py-3 font-bold text-emerald-300">{r.duty}</td>
              <td className="px-2 py-3">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold border ${r.empType === 'MC' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-amber-500/15 border-amber-400/40 text-amber-300'}`}>{r.empType}</span>
              </td>
            </tr>
          ))
        )}
      </SplitTable>
    </div>
  )
}