import { useEffect, useMemo, useRef, useState } from 'react'

type Row = Record<string, any>

type ReportRow = {
  site: string
  supervisor: string
  category: string
  lat: number
  lon: number
  vehicle: string
  dateTime: string
  status: 'Completed' | 'Pending' | 'Mismatch'
}

type FilterKey = 'completed' | 'pending' | 'mismatch'

const FILTER_META: Record<FilterKey, { label: string; short: string; emoji: string; headerColor: string; badge: string; text: string }> = {
  mismatch: {
    label: 'Mismatch Containers',
    short: 'Mismatch',
    emoji: '⚠️',
    headerColor: '#ef4444',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    text: 'text-red-400',
  },
  pending: {
    label: 'Pending Containers',
    short: 'Pending',
    emoji: '⏳',
    headerColor: '#f59e0b',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    text: 'text-amber-400',
  },
  completed: {
    label: 'Completed Containers',
    short: 'Completed',
    emoji: '✅',
    headerColor: '#10b981',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-400',
  },
}

// ✅ Auto caption — copy hone par image ke sath ye text bhi clipboard mein jata hai
const WA_CAPTIONS: Record<FilterKey, string> = {
  mismatch: 'Rejected Containers on Tracker',
  pending: 'Pending Containers For Serviced',
  completed: 'Completed Containers',
}

function fmtPortalDate(s: string) {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return s
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  return `${datePart} ${timePart}`
}

function escXml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ✅ Dashboard (Time Pill) jaisa exact time parse karne ke liye (UTC/Timezone offset ko ignore karta hai)
function parseLocal(s: string): Date {
  const clean = String(s).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '').replace(' ', 'T')
  const d = new Date(clean)
  return isNaN(d.getTime()) ? new Date(s) : d
}

export default function ContainersReport({ locations, portal }: { locations: Row[]; portal: Row[] }) {
  const [filter, setFilter] = useState<FilterKey>('mismatch')
  const [supFilter, setSupFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [ddOpen, setDdOpen] = useState(false)
  const [supOpen, setSupOpen] = useState(false)
  const [modal, setModal] = useState<ReportRow | null>(null)
  const [copying, setCopying] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'limit' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<number | null>(null)

  const headBoxRef = useRef<HTMLDivElement>(null)
  const bodyBoxRef = useRef<HTMLDivElement>(null)
  const [sbw, setSbw] = useState(0)
  function onBodyScroll(e: React.UIEvent<HTMLDivElement>) {
    if (headBoxRef.current) headBoxRef.current.scrollLeft = e.currentTarget.scrollLeft
  }

  function showToast(type: 'success' | 'limit' | 'error', message: string) {
    setToast({ type, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }

  const rows = useMemo(() => {
    const locBySite = new Map<string, Row>()
    locations.forEach(l => locBySite.set(String(l.site ?? ''), l))
    const sorted = [...portal].sort((a, b) => String(a.site ?? '').localeCompare(String(b.site ?? '')))
    const out: ReportRow[] = []
    for (const p of sorted) {
      const site = String(p.site ?? '').trim()
      if (!site) continue
      const cs = String(p.container_serviced ?? '').trim().toUpperCase()
      const sa = String(p.serviced_on_app ?? '').trim().toUpperCase()
      const st = String(p.serviced_by_tracker ?? '').trim().toUpperCase()
      const loc = locBySite.get(site)
      let status: ReportRow['status'] | null = null
      if (sa === 'YES' && st === 'NO') status = 'Mismatch'
      else if (cs === 'NO' && sa === 'NO' && st === 'NO') status = 'Pending'
      else if (cs === 'YES' && sa === 'YES' && st === 'YES') status = 'Completed'
      if (!status) continue
      out.push({
        site,
        status,
        supervisor: String(loc?.supervisor ?? '').trim() || 'Unknown',
        category: String(loc?.category ?? '').includes('0.8') ? '0.8cm' : '5cm',
        lat: Number(loc?.lat ?? 0),
        lon: Number(loc?.lon ?? 0),
        vehicle: String(p.app_vehicle ?? '').trim(),
        dateTime: fmtPortalDate(String(p.app_date_time ?? '')),
      })
    }
    return out
  }, [locations, portal])

  const supNames = useMemo(() => [...new Set(rows.map(r => r.supervisor))].sort(), [rows])

  useEffect(() => {
    if (supFilter !== 'all' && !supNames.includes(supFilter)) setSupFilter('all')
  }, [supNames, supFilter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const statusWanted = filter.charAt(0).toUpperCase() + filter.slice(1)
    return rows.filter(
      r =>
        r.status === statusWanted &&
        (supFilter === 'all' || r.supervisor === supFilter) &&
        (q === '' || r.site.toLowerCase().includes(q))
    )
  }, [rows, filter, supFilter, search])

  const meta = FILTER_META[filter]
  const colSpan = filter === 'mismatch' ? 6 : filter === 'completed' ? 5 : 4

  // ✅ Header table ko body ke scrollbar-gutter ke BARABAR right padding — perfect column alignment (har filter par)
  useEffect(() => {
    const el = bodyBoxRef.current
    if (!el) return
    const update = () => setSbw(el.offsetWidth - el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [filter, filtered.length])

  const lastUpdated = useMemo(() => {
    let maxT = 0
    for (const r of portal) {
      // ✅ parseLocal use karo taake Time Pill aur Copy Image ka time 100% same ho
      const t = r.fetched_at ? parseLocal(r.fetched_at).getTime() : 0
      if (t > maxT) maxT = t
    }
    return maxT ? new Date(maxT) : null
  }, [portal])

  const colWidths =
    filter === 'mismatch'
      ? ['3rem', '26%', '18%', '18%', '16%', '3.5rem']
      : filter === 'completed'
        ? ['3rem', '32%', '24%', '18%', '3.5rem']
        : ['3rem', '52%', '22%', '3.5rem']

  const thCls = 'px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-widest text-emerald-300/90 uppercase whitespace-nowrap'

  async function copyReportAsImage() {
    if (filtered.length > 100) {
      showToast('limit', 'Copied! Failed Because Containers Above 100.')
      return
    }
    setCopying(true)
    try {
      const headers =
        filter === 'mismatch'
          ? ['Sr#', 'Primary Site', 'App Vehicle', 'App Date/Time', 'Supervisor']
          : filter === 'completed'
            ? ['Sr#', 'Primary Site', 'App Vehicle', 'Supervisor']
            : ['Sr#', 'Primary Site', 'Supervisor']
      const body = filtered.map((r, i) =>
        filter === 'mismatch'
          ? [String(i + 1), r.site, r.vehicle || '-', r.dateTime || '-', r.supervisor]
          : filter === 'completed'
            ? [String(i + 1), r.site, r.vehicle || '-', r.supervisor]
            : [String(i + 1), r.site, r.supervisor]
      )
      let imgColWidths = [60, 320, 280, 240, 160]
      if (headers.length === 4) imgColWidths = [60, 380, 260, 220]
      if (headers.length === 3) imgColWidths = [60, 450, 250]
      const rowHeight = 45
      const padding = 30
      const tableWidth = imgColWidths.slice(0, headers.length).reduce((a, b) => a + b, 0)
      const totalWidth = tableWidth + padding * 2
      const lu = lastUpdated
      const luText = lu
        ? `Last Updated: ${lu.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`
        : `Generated: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`
      const titleText = `${meta.label} Report`
      const availWidth = totalWidth - padding * 2
      const stacked = titleText.length * 14.5 + luText.length * 12.2 + 40 > availWidth
      const headerH = stacked ? 130 : 90
      const totalHeight = headerH + padding + rowHeight + body.length * rowHeight + 45
      const startY = headerH + padding

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
<defs><style>
.title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 26px; font-weight: 800; fill: #1e293b; }
.subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; fill: #0f172a; font-weight: 800; letter-spacing: 0.01em; }
.th-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; font-weight: 700; fill: #ffffff; text-transform: uppercase; }
.td-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; fill: #0f172a; font-weight: 600; }
.footer { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; fill: #94a3b8; }
</style></defs>
<rect width="100%" height="100%" fill="#ffffff"/>
<rect x="0" y="0" width="${totalWidth}" height="${headerH}" fill="#f8fafc"/>
<rect x="0" y="${headerH - 4}" width="${totalWidth}" height="4" fill="${meta.headerColor}"/>
<text x="${padding}" y="${stacked ? 45 : 50}" class="title">${titleText}</text>
<text x="${totalWidth - padding}" y="${stacked ? 85 : 53}" class="subtitle" text-anchor="end">${luText}</text>
<rect x="${padding}" y="${startY}" width="${tableWidth}" height="${rowHeight}" fill="#1e293b"/>`

      let cx = padding
      headers.forEach((h, i) => {
        const w = imgColWidths[i]
        const x = i === 0 ? cx + w / 2 : cx + 15
        svg += `<text x="${x}" y="${startY + 28}" class="th-text" text-anchor="${i === 0 ? 'middle' : 'start'}">${escXml(h)}</text>`
        cx += w
      })

      body.forEach((rowCells, ri) => {
        const ry = startY + rowHeight + ri * rowHeight
        svg += `<rect x="${padding}" y="${ry}" width="${tableWidth}" height="${rowHeight}" fill="${ri % 2 === 0 ? '#ffffff' : '#f1f5f9'}"/>`
        svg += `<line x1="${padding}" y1="${ry + rowHeight}" x2="${padding + tableWidth}" y2="${ry + rowHeight}" stroke="#e2e8f0" stroke-width="1"/>`
        let cellX = padding
        rowCells.forEach((cell, ci) => {
          const w = imgColWidths[ci]
          let txt = cell
          let maxChars = 35
          if (ci === 1) maxChars = 40
          if (ci === 2 && headers.length >= 4) maxChars = 32
          if (ci === 3 && headers.length === 5) maxChars = 25
          if (txt.length > maxChars) txt = txt.substring(0, maxChars - 2) + '..'
          const x = ci === 0 ? cellX + w / 2 : cellX + 15
          svg += `<text x="${x}" y="${ry + 28}" class="td-text" text-anchor="${ci === 0 ? 'middle' : 'start'}">${escXml(txt)}</text>`
          cellX += w
        })
      })

      svg += `<text x="${totalWidth - padding}" y="${totalHeight - 20}" class="footer" text-anchor="end">Generated by Container Monitoring System</text></svg>`

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('img'))
        img.src = url
      })
      const canvas = document.createElement('canvas')
      const scale = 4
      canvas.width = totalWidth * scale
      canvas.height = totalHeight * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const pngBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (pngBlob && navigator.clipboard && typeof (navigator.clipboard as any).write === 'function') {
        // ✅ Image + auto caption (text) dono clipboard mein
        try {
          await (navigator.clipboard as any).write([
            new ClipboardItem({
              'image/png': pngBlob,
              'text/plain': new Blob([WA_CAPTIONS[filter]], { type: 'text/plain' }),
            }),
          ])
        } catch {
          await (navigator.clipboard as any).write([new ClipboardItem({ 'image/png': pngBlob })])
        }
        showToast('success', 'Copied! Successfully.')
      } else {
        throw new Error('Clipboard not supported')
      }
    } catch {
      showToast('error', 'Copied! Failed Error in copying')
    } finally {
      setCopying(false)
    }
  }

  const selectCls =
    'w-full flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-[#0a2a22] transition text-white'

  return (
    <div className="flex flex-col gap-2 sm:gap-3 flex-1 min-h-0 overflow-hidden">
      {/* ===== Top bar: title + controls (mobile/tablet: filters upar, search+copy neeche) ===== */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Title — hamesha EK line, mobile par chhota */}
        <h3 className="order-1 w-full lg:w-auto lg:mr-auto min-w-0 flex items-center gap-1.5 text-xs sm:text-sm md:text-base lg:text-lg font-extrabold text-white whitespace-nowrap">
          <span className={meta.text}>{meta.emoji}</span>
          <span className="truncate">{meta.label} Report</span>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold border flex-shrink-0 ${meta.badge}`}>
            Total: {filtered.length}
          </span>
        </h3>

        {/* Copy Report — mobile par neeche, desktop par pehle */}
        <button
          onClick={() => copyReportAsImage()}
          disabled={copying}
          className="order-5 lg:order-2 running-button flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-white text-[11px] sm:text-xs font-bold transition-all shadow-lg whitespace-nowrap disabled:opacity-60 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {copying ? 'Generating HD...' : 'Copy Report'}
        </button>

        {/* Status filter — mobile par UPAR */}
        <div className="order-2 lg:order-3 relative w-[calc(50%-0.25rem)] lg:w-32 min-w-0">
          <button type="button" onClick={() => { setDdOpen(v => !v); setSupOpen(false) }} className={selectCls}>
            <span className="truncate">{meta.emoji} {meta.short}</span>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {ddOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDdOpen(false)} />
              <div className="absolute right-0 mt-1 min-w-36 rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 bg-[#071b15]">
                {(Object.keys(FILTER_META) as FilterKey[]).map(k => (
                  <div
                    key={k}
                    onClick={() => { setFilter(k); setDdOpen(false) }}
                    className={`px-3 py-2 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${filter === k ? 'text-emerald-300 bg-emerald-500/10' : 'text-white'}`}
                  >
                    {FILTER_META[k].emoji} {FILTER_META[k].short}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Supervisor filter — mobile par UPAR */}
        <div className="order-3 lg:order-4 relative w-[calc(50%-0.25rem)] lg:w-40 min-w-0">
          <button type="button" onClick={() => { setSupOpen(v => !v); setDdOpen(false) }} className={selectCls}>
            <span className="truncate">👥 {supFilter === 'all' ? 'All Supervisors' : supFilter}</span>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {supOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSupOpen(false)} />
              <div className="absolute right-0 mt-1 min-w-44 rounded-xl border border-white/10 shadow-2xl z-50 overflow-y-auto bg-[#071b15] max-h-64">
                <div
                  onClick={() => { setSupFilter('all'); setSupOpen(false) }}
                  className={`px-3 py-2 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${supFilter === 'all' ? 'text-emerald-300 bg-emerald-500/10' : 'text-white'}`}
                >
                  👥 All Supervisors
                </div>
                {supNames.map(n => (
                  <div
                    key={n}
                    onClick={() => { setSupFilter(n); setSupOpen(false) }}
                    className={`px-3 py-2 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${supFilter === n ? 'text-emerald-300 bg-emerald-500/10' : 'text-white'}`}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Search — mobile par NEECHE */}
        <div className="order-4 lg:order-5 relative flex-1 basis-32 min-w-0 lg:flex-none lg:w-56">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Primary Site..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-medium text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition"
          />
          <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          </svg>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1 text-white/60 hover:text-white transition flex items-center justify-center h-6 w-6 rounded-md hover:bg-white/10"
              title="Clear Search"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* ===== Table card ===== */}
      <div className="flex-1 min-h-0 flex flex-col rounded-[24px] border border-emerald-400/25 bg-[#021b16] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
        <div ref={headBoxRef} style={{ paddingRight: sbw }} className="overflow-hidden flex-shrink-0 bg-[#0a4038] border-b border-emerald-400/20">
          <table className="w-full table-fixed min-w-[640px] text-left text-[10px] sm:text-sm">
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-[#0a4038]">
                <th className={`${thCls} text-center`}>Sr#</th>
                <th className={thCls}>Primary Site</th>
                {filter !== 'pending' && <th className={`${thCls} text-center`}>App Vehicle</th>}
                {filter === 'mismatch' && <th className={`${thCls} text-center`}>App Date/Time</th>}
                <th className={`${thCls} text-center`}>Supervisor</th>
                <th className={`${thCls} text-center`}>Info</th>
              </tr>
            </thead>
          </table>
        </div>

        <div
          ref={bodyBoxRef}
          onScroll={onBodyScroll}
          className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-400/30 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          <table className="w-full table-fixed min-w-[640px] text-left text-[10px] sm:text-sm">
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-center text-white/50">
                    <div className="py-6">No {filter} records found.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={`${r.site}-${i}`} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center font-mono text-[10px] sm:text-xs text-white/50">{i + 1}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-semibold text-white/90 truncate" title={r.site}>{r.site}</td>
                    {filter !== 'pending' && (
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-emerald-300 truncate" title={r.vehicle}>{r.vehicle || '—'}</td>
                    )}
                    {filter === 'mismatch' && (
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-[10px] sm:text-xs text-white/60 whitespace-nowrap">{r.dateTime || '—'}</td>
                    )}
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center font-bold text-white/80 truncate" title={r.supervisor}>{r.supervisor}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">
                      <button
                        onClick={() => setModal(r)}
                        title="View Container Details"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-300 hover:bg-sky-500/30 transition"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Container Info Modal ===== */}
      {modal && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="relative w-full max-w-xl md:max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl border border-emerald-400/25 bg-linear-to-br from-[#0d372c] to-[#08261f] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between p-4 bg-[#071b15]/95 backdrop-blur-md border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-base md:text-xl mb-0.5">📍 Container Details</div>
                <div className="text-emerald-200 text-[11px] md:text-sm font-medium">{modal.site}</div>
              </div>
              <button
                onClick={() => setModal(null)}
                className="h-8 w-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-base transition flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-3 md:p-4 bg-[#071b15] border border-white/15">
                <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-0.5 md:mb-1">Category</div>
                <div className="text-white font-bold text-sm md:text-lg">{modal.category.toUpperCase()}</div>
              </div>
              <div className="rounded-xl p-3 md:p-4 bg-[#071b15] border border-white/15">
                <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-0.5 md:mb-1">Status</div>
                <div className="font-bold text-sm md:text-lg" style={{ color: modal.status === 'Completed' ? '#6ee7b7' : modal.status === 'Pending' ? '#93c5fd' : '#fca5a5' }}>
                  {modal.status}
                </div>
              </div>
              <div className="rounded-xl p-3 md:p-4 bg-[#071b15] border border-white/15">
                <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-0.5 md:mb-1">Assigned Supervisor</div>
                <div className="text-white font-bold text-sm md:text-lg">{modal.supervisor}</div>
              </div>
              {modal.vehicle && modal.vehicle !== 'nan' && modal.vehicle !== 'None' && (
                <div className="rounded-xl p-3 md:p-4 bg-[#071b15] border border-white/15">
                  <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-0.5 md:mb-1">Serviced Vehicle</div>
                  <div className="text-emerald-300 font-bold text-sm md:text-lg">🚛 {modal.vehicle}</div>
                </div>
              )}
              <div className="sm:col-span-2 rounded-xl p-3 md:p-4 bg-[#071b15] border border-white/15">
                <div className="flex justify-between mb-1.5 md:mb-2">
                  <span className="text-white/60 text-[11px] md:text-sm font-semibold">Latitude:</span>
                  <span className="text-white font-mono font-bold text-[11px] md:text-sm">{modal.lat.toFixed(5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-[11px] md:text-sm font-semibold">Longitude:</span>
                  <span className="text-white font-mono font-bold text-[11px] md:text-sm">{modal.lon.toFixed(5)}</span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps?q=${modal.lat},${modal.lon}`}
                target="_blank"
                rel="noreferrer"
                className="sm:col-span-2 text-center rounded-xl py-2.5 md:py-3 text-white text-xs md:text-sm font-bold transition hover:opacity-90 bg-linear-to-r from-[#00945f] to-[#06ab7b]"
              >
                🗺️ Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div
          className={`fixed top-20 sm:top-24 right-2 sm:right-4 z-[9999] flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl text-white text-xs sm:text-sm font-bold ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'limit' ? 'bg-orange-600' : 'bg-red-600'
          }`}
          style={{ animation: 'rtoToastIn 0.3s ease' }}
        >
          <span>{toast.type === 'success' ? '✓' : toast.type === 'limit' ? '⚠' : '✕'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <style>{`@keyframes rtoToastIn { from { transform: translateX(120%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>
  )
}