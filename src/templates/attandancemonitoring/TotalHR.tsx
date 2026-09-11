import { useMemo, useState, useEffect } from 'react'
import SplitTable from './SplitTable'
import * as XLSX from 'xlsx'

type Row = Record<string, any>

type Props = {
  rows: Row[]
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

export default function TotalHR({ rows, loading }: Props) {
  const [search, setSearch] = useState('')
  const [ucWard, setUcWard] = useState('')
  const [downloading, setDownloading] = useState(false)
  
  // ✅ Custom searchable dropdown states
  const [isUcDropdownOpen, setIsUcDropdownOpen] = useState(false)
  const [ucDropdownSearch, setUcDropdownSearch] = useState('')

  // ✅ Dropdown ke bahar click karne par band ho jaye
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUcDropdownOpen && !(event.target as Element).closest('.uc-dropdown-container')) {
        setIsUcDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isUcDropdownOpen])

  // ✅ Sab unique UC/Ward ki list (sorted) — dropdown ke liye
  const ucList = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const v = String(r.uc_ward ?? '').trim()
      if (v) set.add(v)
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const filtered = useMemo(() => {
    let list = [...rows]

    // ✅ UC/Ward filter
    if (ucWard) {
      list = list.filter(r => String(r.uc_ward ?? '').trim() === ucWard)
      
      // ✅ Jab filter apply ho, to pehle Designation aur phir Attendance Point ke hisaab se sort karo
      list = list.sort((a, b) => {
        const desigA = cleanDesig(a.designation ?? '').trim()
        const desigB = cleanDesig(b.designation ?? '').trim()
        
        // Pehle Designation se compare karo
        if (desigA !== desigB) {
          return desigA.localeCompare(desigB)
        }
        
        // Agar Designation same ho, to Attendance Point se compare karo
        const pointA = String(a.attendance_point ?? '').trim()
        const pointB = String(b.attendance_point ?? '').trim()
        return pointA.localeCompare(pointB)
      })
    } else {
      // ✅ Jab filter na ho, to Name ke hisaab se sort karo (pehle wala logic)
      list = list.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    }

    const q = norm(search)
    if (q) {
      list = list.filter(r => matchRow(r, q))
    }
    return list
  }, [rows, search, ucWard])

  // ✅ Excel download function
  async function handleDownloadExcel() {
    if (filtered.length === 0) return
    setDownloading(true)
    
    try {
      // Prepare data for Excel
      const excelData = filtered.map((r, i) => ({
        'Sr#': i + 1,
        'Name': r.name ?? '',
        'Father/Husband': r.father_name ?? '',
        'CNIC': r.cnic ?? '',
        'Designation': cleanDesig(r.designation ?? ''),
        'UC/Ward': r.uc_ward ?? '',
        'Attendance Point': r.attendance_point ?? '',
        'Type': r.work_type ?? '',
        'Sanitation Beat': r.sanitation_beat ?? '',
      }))

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Set column widths
      const colWidths = [
        { wch: 6 },   // Sr#
        { wch: 25 },  // Name
        { wch: 22 },  // Father/Husband
        { wch: 18 },  // CNIC
        { wch: 20 },  // Designation
        { wch: 25 },  // UC/Ward
        { wch: 30 },  // Attendance Point
        { wch: 15 },  // Type
        { wch: 20 },  // Sanitation Beat
      ]
      worksheet['!cols'] = colWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assigned HR')

      // Generate filename with date
      const today = new Date()
      const dateStr = today.toLocaleDateString('en-GB').replace(/\//g, '-')
      const filename = `assigned-hr-${dateStr}.xlsx`

      // Download file
      XLSX.writeFile(workbook, filename)
    } catch (err) {
      console.error('Excel download error:', err)
      alert('Failed to download Excel file. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Heading + filters + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Assigned HR
        </h1>
        <span className="w-fit text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
          Total: {filtered.length}
        </span>

        {/* ✅ Right side: Download + Dropdown + Search grouped together */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:ml-auto w-full sm:w-auto">
          
          {/* ✅ Download Excel Button (left side, icon + "Excel" only) */}
          <button
            onClick={handleDownloadExcel}
            disabled={downloading || filtered.length === 0}
            className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[11px] sm:text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? 'Saving…' : 'Excel'}
          </button>

          {/* ✅ Searchable UC/Ward Dropdown */}
          <div className="relative w-full sm:w-64 uc-dropdown-container">
            <button
              type="button"
              onClick={() => setIsUcDropdownOpen(!isUcDropdownOpen)}
              className="w-full flex items-center justify-between rounded-full border border-white/15 bg-[#071b15] px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-white/80 outline-none focus:border-emerald-400/60 transition-colors hover:border-emerald-400/40"
            >
              <span className="truncate">{ucWard || 'All UC/Wards'}</span>
              <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${isUcDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    className="w-full rounded-lg border border-white/15 bg-[#0a2520] px-3 pr-8 py-1.5 text-[11px] text-white/80 placeholder-white/35 outline-none focus:border-emerald-400/60"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  {/* ✅ Cross button inside dropdown search */}
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
                    className={`w-full text-left px-4 py-2 text-[11px] transition-colors ${ucWard === '' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/80 hover:bg-white/5'}`}
                  >
                    All
                  </button>
                  {ucList.filter(u => u !== 'All').filter(u => u.toLowerCase().includes(ucDropdownSearch.toLowerCase())).map(u => (
                    <button
                      key={u}
                      onClick={() => { setUcWard(u); setUcDropdownSearch(''); setIsUcDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-[11px] transition-colors ${ucWard === u ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      {u}
                    </button>
                  ))}
                  {ucList.filter(u => u !== 'All').filter(u => u.toLowerCase().includes(ucDropdownSearch.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-[11px] text-white/40 text-center">Koi match nahi mila</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ✅ Main Search Bar */}
          <div className="relative w-full sm:w-64">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value) }}
              placeholder="Search CNIC, Name…"
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

      {/* Table */}
      <SplitTable
        minW={1330}
        widths={[4, 14, 12, 12, 14, 14, 12, 8, 10]}
        headers={['Sr#', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point', 'Type', 'Sanitation Beat']}
      >
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Loading HR data…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Koi record nahi mila</td></tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-2 py-3 text-center text-white/50 font-mono whitespace-nowrap">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-white/90">{r.name}</td>
                  <td className="px-4 py-3 text-white/70">{r.father_name}</td>
                  <td className="px-4 py-3 font-mono text-emerald-200 whitespace-nowrap">{r.cnic}</td>
                  <td className="px-4 py-3 text-white/70">{cleanDesig(r.designation)}</td>
                  <td className="px-4 py-3 text-white/70">{r.uc_ward}</td>
                  <td className="px-4 py-3 text-white/70">{r.attendance_point}</td>
                  <td className="px-4 py-3 text-white/70">{r.work_type}</td>
                  <td className="px-4 py-3 text-white/70">{r.sanitation_beat}</td>
                </tr>
              ))
            )}
      </SplitTable>
    </div>
  )
}