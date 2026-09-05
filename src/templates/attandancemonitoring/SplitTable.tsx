import { ReactNode } from 'react'

type Props = {
  widths: number[]   // percentages (total = 100)
  headers: string[]
  minW?: number      // ab use nahi hota
  small?: boolean    // ✅ chhota text (report ke liye)
  center?: number[]  // ✅ center-align columns (indexes)
  children: ReactNode
}

export default function SplitTable({ widths, headers, small, center, children }: Props) {
  const sizeCls = small ? 'text-[10px] sm:text-[11px]' : 'text-xs sm:text-sm'

  const cols = (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  )

  return (
    <div className="rto-run-border relative mt-5 rounded-2xl overflow-hidden border border-transparent shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      {/* ✅ Header — poori width, koi horizontal scroll nahi */}
      <table className={`rto-table w-full table-fixed text-left ${sizeCls}`}>
        {cols}
        <thead className="bg-[#073b2d] text-emerald-200">
          <tr>
                {headers.map((h, i) => (
                  <th key={h} className={`px-2 sm:px-3 py-3 font-bold uppercase tracking-wider text-[10px] sm:text-xs shadow-[0_2px_10px_rgba(0,0,0,0.35)] ${center?.includes(i) ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
          </tr>
        </thead>
      </table>

      {/* ✅ Body — sirf vertical scroll (rows) */}
      <div className="rto-scroll overflow-y-auto max-h-[calc(100vh-300px)] min-h-[380px] overscroll-contain bg-[#04241c]">
        <table className={`rto-table w-full table-fixed text-left ${sizeCls}`}>
          {cols}
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}