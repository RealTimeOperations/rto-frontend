import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type ContainerPoint = {
  site: string
  category: '0.8cm' | '5cm'
  status: 'Completed' | 'Pending' | 'Mismatch'
  supervisor: string
  vehicle: string
  lat: number
  lon: number
}

type FilterKey = '08_completed' | '08_pending' | '08_mismatch' | '5_completed' | '5_pending' | '5_mismatch'

const FILTER_KEYS: FilterKey[] = ['08_completed', '08_pending', '08_mismatch', '5_completed', '5_pending', '5_mismatch']

const COLOR_PALETTE: Record<string, string> = {
  '0.8cm_Completed': '#6BB124',
  '0.8cm_Pending': '#3b82f6',
  '0.8cm_Mismatch': '#ef4444',
  '5cm_Completed': '#C133A4',
  '5cm_Pending': '#eab308',
  '5cm_Mismatch': '#f97316',
}

const TOGGLE_COLORS: Record<FilterKey, string> = {
  '08_completed': '#10b981',
  '08_pending': '#3b82f6',
  '08_mismatch': '#ef4444',
  '5_completed': '#a855f7',
  '5_pending': '#f59e0b',
  '5_mismatch': '#f97316',
}

const MAP_CENTER: [number, number] = [29.6105, 73.1388]
const MAP_ZOOM = 13
const HAROONABAD: [number, number] = [29.6105, 73.1388]
const FAQIRWALI: [number, number] = [29.47, 73.04]

const LOCATION_MARKERS = [
  { lat: 29.6105, lon: 73.1388, name: 'Haroonabad', minZoom: 10, maxZoom: 20, type: 'city' },
  { lat: 29.47, lon: 73.04, name: 'Faqirwali', minZoom: 10, maxZoom: 20, type: 'city' },
  { lat: 29.615, lon: 73.145, name: 'Govt Islamia Degree College', minZoom: 14, maxZoom: 20, type: 'landmark' },
  { lat: 29.608, lon: 73.135, name: 'Bahawalnagar Haroonabad Road', minZoom: 13, maxZoom: 20, type: 'road' },
  { lat: 29.612, lon: 73.14, name: 'City Center', minZoom: 15, maxZoom: 20, type: 'area' },
  { lat: 29.605, lon: 73.13, name: 'Industrial Area', minZoom: 14, maxZoom: 20, type: 'area' },
  { lat: 29.62, lon: 73.15, name: 'Residential Area', minZoom: 15, maxZoom: 20, type: 'area' },
]

function defaultFilters(): Record<FilterKey, boolean> {
  return {
    '08_completed': true, '08_pending': true, '08_mismatch': true,
    '5_completed': true, '5_pending': true, '5_mismatch': true,
  }
}

function esc(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getMarkerIcon(hex: string) {
  const svg = `<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16C0 26 16 42 16 42C16 42 32 26 32 16C32 7.16 24.84 0 16 0Z" fill="${hex}"/><g transform="translate(8, 8)" fill="white"><path d="M2 3h12v1.5H2z"/><path d="M6 1.5h4V3H6z"/><path d="M3 5.5l1 9.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5-1.5l1-9.5H3zm3 8.5H5V7h1v7zm2.5 0h-1V7h1v7zm2.5 0h-1V7h1v7z"/></g></svg>`
  return L.divIcon({ className: 'rto-custom-marker', html: svg, iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -36] })
}

function popupHtml(c: ContainerPoint) {
  const statusColor = c.status === 'Completed' ? '#6ee7b7' : c.status === 'Pending' ? '#93c5fd' : '#fca5a5'
  const vehicle =
    c.status === 'Completed' && c.vehicle && c.vehicle !== 'nan' && c.vehicle !== 'None'
      ? `<div style="background:#071b15;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);margin-bottom:10px;">
           <div style="font-size:10px;color:rgba(255,255,255,0.6);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Serviced Vehicle</div>
           <div style="font-size:15px;color:#6ee7b7;font-weight:700;">🚛 ${esc(c.vehicle)}</div>
         </div>`
      : ''
  return `
    <div style="min-width:260px;background:#0d372c;border-radius:16px;overflow:hidden;border:1px solid rgba(52,211,153,0.25);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
      <div style="background:#071b15;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:15px;font-weight:700;color:white;margin-bottom:4px;">📍 Container Details</div>
        <div style="font-size:12px;color:#a7f3d0;font-weight:500;line-height:1.4;">${esc(c.site)}</div>
      </div>
      <div style="padding:14px 16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div style="background:#071b15;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);">
            <div style="font-size:9px;color:rgba(255,255,255,0.6);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Category</div>
            <div style="font-size:14px;color:white;font-weight:700;">${esc(c.category.toUpperCase())}</div>
          </div>
          <div style="background:#071b15;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);">
            <div style="font-size:9px;color:rgba(255,255,255,0.6);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Status</div>
            <div style="font-size:14px;color:${statusColor};font-weight:700;">${esc(c.status)}</div>
          </div>
        </div>
        <div style="background:#071b15;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);margin-bottom:8px;">
          <div style="font-size:9px;color:rgba(255,255,255,0.6);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Assigned Supervisor</div>
          <div style="font-size:14px;color:white;font-weight:700;">${esc(c.supervisor || 'Unknown')}</div>
        </div>
        ${vehicle}
        <div style="background:#071b15;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:11px;color:rgba(255,255,255,0.6);font-weight:600;">Latitude:</span><span style="font-size:11px;color:white;font-weight:700;font-family:monospace;">${c.lat.toFixed(5)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="font-size:11px;color:rgba(255,255,255,0.6);font-weight:600;">Longitude:</span><span style="font-size:11px;color:white;font-weight:700;font-family:monospace;">${c.lon.toFixed(5)}</span></div>
        </div>
        <a href="https://www.google.com/maps?q=${c.lat},${c.lon}" target="_blank" rel="noreferrer" style="display:block;text-align:center;background:linear-gradient(135deg,rgba(16,185,129,0.9),rgba(5,150,105,0.9));color:white;padding:10px;border-radius:12px;text-decoration:none;font-weight:600;font-size:13px;">🗺️ Open in Google Maps</a>
      </div>
    </div>`
}

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer w-11 h-6 flex-shrink-0">
      <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 rounded-full transition-colors duration-200" style={{ background: checked ? color : 'rgba(255,255,255,0.2)' }} />
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
    </label>
  )
}

const MAP_CSS = `
  .rto-custom-marker { background: transparent !important; border: none !important; will-change: transform; }
  .rto-custom-marker svg { display: block; }
  .rto-custom-marker:hover svg { transform: scale(1.1); }
  .rto-searched svg { transform: scale(1.45); transform-origin: bottom center; z-index: 99999 !important; }
  .leaflet-popup-content-wrapper { background: transparent !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .leaflet-popup-content { margin: 0 !important; width: auto !important; }
  .leaflet-popup-tip { background: #0d372c !important; border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important; }
  .rto-location-label { background: transparent !important; border: none !important; }
  @media (max-width: 640px) {
    .rto-custom-marker svg { width: 24px !important; height: 32px !important; }
    .leaflet-control-attribution { display: none !important; }
  }
`

export default function ContainersMap({ containers }: { containers: ContainerPoint[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const standardRef = useRef<L.TileLayer | null>(null)
  const satelliteRef = useRef<L.TileLayer | null>(null)
  const layersRef = useRef<Partial<Record<FilterKey, L.LayerGroup>>>({})
  const locationLayerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const highlightedRef = useRef<L.Marker | null>(null)
  const lastSigRef = useRef<string>('')
  const labelsRef = useRef(false)
  const debRef = useRef<number | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('rto_cont_map_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.f) return { ...defaultFilters(), ...parsed.f }
        return { ...defaultFilters(), ...parsed }
      }
    } catch {}
    return defaultFilters()
  })
  // ✅ Master toggles — subs se bilkul independent (subs par react nahi karte)
  const [groupOn, setGroupOn] = useState<Record<'08' | '5', boolean>>(() => {
    try {
      const saved = localStorage.getItem('rto_cont_map_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.g) return { '08': true, '5': true, ...parsed.g }
      }
    } catch {}
    return { '08': true, '5': true }
  })
  const [labelsEnabled, setLabelsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('rto_cont_map_labels') === '1' } catch { return false }
  })
  const [satellite, setSatellite] = useState<boolean>(() => {
    try { return localStorage.getItem('rto_cont_map_sat') === '1' } catch { return false }
  })
  const [panelOpen, setPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef('')

  // ✅ Filter counts — har category/status ke containers kitne hain
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      '08_completed': 0, '08_pending': 0, '08_mismatch': 0,
      '5_completed': 0, '5_pending': 0, '5_mismatch': 0,
    }
    containers.forEach(x => {
      const key = ((x.category === '0.8cm' ? '08_' : '5_') + x.status.toLowerCase()) as FilterKey
      c[key] += 1
    })
    return c
  }, [containers])

  // ✅ City slide pill — map center ke hisaab se khud slide hota hai
  const [activeCity, setActiveCity] = useState<'haroonabad' | 'faqirwali' | null>(null)
  const [citySlider, setCitySlider] = useState({ left: 0, width: 0, visible: false })
  const harBtnRef = useRef<HTMLButtonElement>(null)
  const faqBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeCity === 'haroonabad' && harBtnRef.current) {
      setCitySlider({ left: harBtnRef.current.offsetLeft, width: harBtnRef.current.offsetWidth, visible: true })
    } else if (activeCity === 'faqirwali' && faqBtnRef.current) {
      setCitySlider({ left: faqBtnRef.current.offsetLeft, width: faqBtnRef.current.offsetWidth, visible: true })
    } else {
      setCitySlider(s => ({ ...s, width: 0, visible: false }))
    }
  }, [activeCity])

  // ---- Map init (once)
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { center: MAP_CENTER, zoom: MAP_ZOOM, zoomControl: false })
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    standardRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps', keepBuffer: 3, subdomains: ['0', '1', '2', '3'] })
    satelliteRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps', keepBuffer: 3, subdomains: ['0', '1', '2', '3'] })
    // ✅ Tiles fail hon to automatically fallback host par switch
    let tileErrors = 0
    let switched = false
    const swapToFallback = () => {
      if (switched) return
      switched = true
      const isSat = map.hasLayer(satelliteRef.current!)
      const fb = L.tileLayer(`https://www.google.com/maps/vt?lyrs=${isSat ? 'y' : 'm'}&x={x}&y={y}&z={z}`, { maxZoom: 20, attribution: '© Google Maps', keepBuffer: 3 })
      if (isSat) { map.removeLayer(satelliteRef.current!); satelliteRef.current = fb; map.addLayer(fb) }
      else { map.removeLayer(standardRef.current!); standardRef.current = fb; map.addLayer(fb) }
    }
    standardRef.current.on('tileerror', () => { tileErrors++; if (tileErrors > 8) swapToFallback() })
    satelliteRef.current.on('tileerror', () => { tileErrors++; if (tileErrors > 8) swapToFallback() })
    let satInitial = false
    try { satInitial = localStorage.getItem('rto_cont_map_sat') === '1' } catch {}
    ;(satInitial ? satelliteRef.current : standardRef.current)!.addTo(map)

    // Layer groups (filters) — foran map par add karo
    FILTER_KEYS.forEach(k => {
      const g = L.layerGroup()
      layersRef.current[k] = g
    })
    locationLayerRef.current = L.layerGroup().addTo(map)

    // Location markers (zoom-based)
    const updateLocationMarkers = () => {
      const layer = locationLayerRef.current
      if (!layer) return
      layer.clearLayers()
      const z = map.getZoom()
      LOCATION_MARKERS.forEach(loc => {
        if (z < loc.minZoom || z > loc.maxZoom) return
        const color = loc.type === 'city' ? '#10b981' : loc.type === 'landmark' ? '#ef4444' : loc.type === 'road' ? '#059669' : '#8b5cf6'
        L.circleMarker([loc.lat, loc.lon], { radius: loc.type === 'city' ? 6 : 4, fillColor: color, color: '#fff', weight: 2, opacity: 0.8, fillOpacity: 0.7 }).addTo(layer)
        L.marker([loc.lat, loc.lon], {
          interactive: false,
          icon: L.divIcon({
            className: 'rto-location-label',
            html: `<div style="background:rgba(255,255,255,0.9);color:#1f2937;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;border:1px solid rgba(255,255,255,0.5);">${loc.name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, -10],
          }),
        }).addTo(layer)
      })
    }
    map.on('zoomend', updateLocationMarkers)
    updateLocationMarkers()

    // ✅ City highlight: map center kis city ke qareeb hai
    const updateActiveCity = () => {
      const c = map.getCenter()
      if (Math.abs(c.lat - 29.6105) < 0.05 && Math.abs(c.lng - 73.1388) < 0.05) setActiveCity('haroonabad')
      else if (Math.abs(c.lat - 29.47) < 0.05 && Math.abs(c.lng - 73.04) < 0.05) setActiveCity('faqirwali')
      else setActiveCity(null)
    }
    map.on('moveend', updateActiveCity)
    updateActiveCity()

    // Map state persistence
    const saveMapState = () => {
      try {
        const c = map.getCenter()
        localStorage.setItem('rto_cont_map_state', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }))
      } catch {}
    }
    map.on('moveend', saveMapState)
    map.on('zoomend', saveMapState)
    try {
      const saved = localStorage.getItem('rto_cont_map_state')
      if (saved) {
        const st = JSON.parse(saved)
        if (st.lat && st.lng && st.zoom) map.setView([st.lat, st.lng], st.zoom)
      }
    } catch {}

    const onResize = () => setTimeout(() => map.invalidateSize(), 100)
    window.addEventListener('resize', onResize)
    setTimeout(() => map.invalidateSize(), 150)

    mapRef.current = map
    setMapReady(true)
    console.log('🗺️ Map ready')
    return () => {
      window.removeEventListener('resize', onResize)
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // ---- Filters + master groups -> layer groups on/off
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    FILTER_KEYS.forEach(k => {
      let g = layersRef.current[k]
      if (!g) {
        g = L.layerGroup()
        layersRef.current[k] = g
      }
      const prefix = (k.startsWith('08_') ? '08' : '5') as '08' | '5'
      const visible = groupOn[prefix] && filters[k]
      if (visible) { if (!map.hasLayer(g)) g.addTo(map) }
      else { if (map.hasLayer(g)) map.removeLayer(g) }
    })
    try { localStorage.setItem('rto_cont_map_filters', JSON.stringify({ f: filters, g: groupOn })) } catch {}
  }, [filters, groupOn, mapReady])

  // ---- Labels toggle
  useEffect(() => {
    labelsRef.current = labelsEnabled
    markersRef.current.forEach((m, site) => {
      m.unbindTooltip()
      m.bindTooltip(site, { permanent: labelsEnabled, direction: 'top', offset: [0, -40] })
    })
    try { localStorage.setItem('rto_cont_map_labels', labelsEnabled ? '1' : '0') } catch {}
  }, [labelsEnabled])

  // ---- Markers rebuild (sirf jab data asal mein badle ya map ready ho)
  const sig = containers.map(c => `${c.site}|${c.status}|${c.category}|${c.vehicle}`).join('~')
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (sig === lastSigRef.current) return
    lastSigRef.current = sig

    // Groups ko ensure karo (map par attached)
    FILTER_KEYS.forEach(k => {
      let g = layersRef.current[k]
      if (!g) {
        g = L.layerGroup()
        layersRef.current[k] = g
      }
      g.clearLayers()
      if (filters[k] && !map.hasLayer(g)) g.addTo(map)
    })
    markersRef.current.clear()
    highlightedRef.current = null

    let built = 0
    let skipped = 0
    containers.forEach(c => {
      // Invalid coordinates skip karo (warna marker ghayab rehta hai)
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon) || (c.lat === 0 && c.lon === 0)) {
        skipped++
        return
      }
      const key = ((c.category === '0.8cm' ? '08_' : '5_') + c.status.toLowerCase()) as FilterKey
      const icon = getMarkerIcon(COLOR_PALETTE[`${c.category}_${c.status}`] || '#6b7280')
      const m = L.marker([c.lat, c.lon], { icon })
      m.bindPopup(popupHtml(c), { maxWidth: 340 })
      m.bindTooltip(c.site, { permanent: labelsRef.current, direction: 'top', offset: [0, -40] })
      m.on('popupclose', () => {
        m.getElement()?.classList.remove('rto-searched')
        if (highlightedRef.current === m) highlightedRef.current = null
      })
      const g = layersRef.current[key]
      if (g) {
        g.addLayer(m)
        if (!map.hasLayer(g)) g.addTo(map)
      }
      markersRef.current.set(c.site, m)
      built++
    })
    console.log(`📍 Markers built: ${built} | skipped (bad coords): ${skipped} | containers: ${containers.length}`)
  }, [sig, containers, mapReady])

  // ---- Search
  function performSearch(showAlert: boolean) {
    const map = mapRef.current
    if (!map) return
    if (highlightedRef.current) {
      highlightedRef.current.getElement()?.classList.remove('rto-searched')
      highlightedRef.current = null
    }
    const val = searchRef.current.toLowerCase().trim()
    if (!val) {
      map.closePopup()
      map.setView(MAP_CENTER, MAP_ZOOM)
      return
    }
    const found = containers.find(c => c.site.toLowerCase().includes(val))
    if (found) {
      map.setView([found.lat, found.lon], 18)
      const m = markersRef.current.get(found.site)
      if (m) {
        window.setTimeout(() => m.openPopup(), 400)
        m.getElement()?.classList.add('rto-searched')
        highlightedRef.current = m
      }
    } else if (showAlert) {
      window.alert('No container found with this name!')
    }
  }

  function onSearchChange(v: string) {
    setSearch(v)
    searchRef.current = v
    if (debRef.current) window.clearTimeout(debRef.current)
    debRef.current = window.setTimeout(() => performSearch(false), 500)
  }

  function clearSearch() {
    setSearch('')
    searchRef.current = ''
    if (debRef.current) window.clearTimeout(debRef.current)
    const map = mapRef.current
    if (!map) return
    if (highlightedRef.current) {
      highlightedRef.current.getElement()?.classList.remove('rto-searched')
      highlightedRef.current = null
    }
    map.closePopup()
    map.setView(MAP_CENTER, MAP_ZOOM)
  }

  // ---- Satellite / Standard toggle
  function toggleSatellite() {
    const map = mapRef.current
    if (!map || !standardRef.current || !satelliteRef.current) return
    const next = !satellite
    if (next) {
      map.removeLayer(standardRef.current)
      map.addLayer(satelliteRef.current)
    } else {
      map.removeLayer(satelliteRef.current)
      map.addLayer(standardRef.current)
    }
    setSatellite(next)
    try { localStorage.setItem('rto_cont_map_sat', next ? '1' : '0') } catch {}
  }

  // ---- Master toggle: sirf group enable/disable karta hai (subs ko touch nahi karta)
  function setGroup(prefix: '08' | '5', on: boolean) {
    setGroupOn(g => ({ ...g, [prefix]: on }))
  }

  const searchBox = (mobile: boolean) => (
    <div className="relative" style={{ height: 40 }}>
      <input
        type="text"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        onKeyUp={e => { if (e.key === 'Enter') { if (debRef.current) window.clearTimeout(debRef.current); performSearch(true) } }}
        placeholder="Search..."
        className={`${mobile ? 'w-40' : 'w-32 md:w-36 xl:w-48'} h-10 pl-3 pr-9 rto-run-border border border-transparent rounded-full focus:ring-2 focus:ring-emerald-400/50 outline-none transition text-[11px] sm:text-xs font-medium text-white placeholder-white/40 backdrop-blur-md bg-[#071b15]/80`}
      />
      <button
        type="button"
        onClick={clearSearch}
        title="Clear Search"
        className="absolute right-1 top-1 text-white/70 hover:text-white transition flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/10"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )

  const filterCard = (title: string, prefix: '08' | '5') => {
    const enabled = groupOn[prefix]
    return (
      <div className="rounded-2xl p-3 sm:p-4 border border-emerald-400/25 shadow-2xl bg-[#071b15]/90 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 border-b border-white/10">
          <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            {title}
            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/10 border border-white/15 text-white/80">
              {counts[`${prefix}_completed` as FilterKey] + counts[`${prefix}_pending` as FilterKey] + counts[`${prefix}_mismatch` as FilterKey]}
            </span>
          </span>
          <Toggle checked={enabled} onChange={v => setGroup(prefix, v)} color="#10b981" />
        </div>
        {/* ✅ Master OFF ho to subs disabled (dim + click-block) */}
        <div className={`space-y-1 sm:space-y-2 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none'}`}>
          {(['completed', 'pending', 'mismatch'] as const).map(st => {
            const key = `${prefix}_${st}` as FilterKey
            return (
              <label key={key} className="flex items-center justify-between cursor-pointer p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition">
                <span className="text-[11px] sm:text-xs font-semibold text-white/90 capitalize flex items-center gap-1.5">
                  {st}
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/10 border border-white/15 text-white/80">
                    {counts[key]}
                  </span>
                </span>
                <Toggle checked={filters[key]} onChange={v => setFilters(f => ({ ...f, [key]: v }))} color={TOGGLE_COLORS[key]} />
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="pt-[60px] md:pt-[72px] h-dvh flex flex-col bg-[#021b16]">
      <div className="relative flex-1 z-0 bg-[#e5e3df]">
        <div ref={mapDivRef} className="h-full w-full" />

        {/* LEFT: filter toggle + cards */}
        <div className="absolute top-3 left-2 sm:left-4 z-[1000] flex flex-col gap-2 sm:gap-3">
          <button
            onClick={() => setPanelOpen(v => !v)}
            title="Filters"
            className="rto-run-border w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-transparent shadow-2xl flex items-center justify-center text-emerald-100 hover:bg-black/60 hover:text-white transition-all duration-300 active:scale-95 flex-shrink-0 bg-[#071b15]/80 backdrop-blur-md"
          >
            {panelOpen ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          {panelOpen && (
            <div className="flex flex-col gap-2 sm:gap-3 w-48 sm:w-56 lg:w-64 max-h-[70vh] overflow-y-auto">
              {filterCard('0.8cm Containers', '08')}
              {filterCard('5cm Containers', '5')}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: desktop controls (RTO theme) */}
        <div className="absolute top-3 right-2 sm:right-4 z-[1000] hidden sm:flex items-center gap-2">
          <div className="rto-run-border flex items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/80 backdrop-blur-md px-3 h-10 flex-shrink-0">
            <span className="text-[10px] md:text-[11px] xl:text-xs font-bold text-emerald-100 whitespace-nowrap">Show Labels</span>
            <Toggle checked={labelsEnabled} onChange={setLabelsEnabled} color="#10b981" />
          </div>
          {/* ✅ City slide pill — bilkul tabs jaisa sliding indicator */}
          <div className="rto-run-border relative flex items-center gap-1 rounded-full border border-transparent bg-[#071b15]/80 backdrop-blur-md px-1.5 py-1.5 flex-shrink-0">
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-linear-to-r from-[#00764c] to-[#058962] shadow-[0_0_15px_rgba(0,255,170,0.15)] transition-all duration-300 ease-out pointer-events-none"
              style={{ left: citySlider.left, width: citySlider.width, opacity: citySlider.visible ? 1 : 0 }}
            />
            <button
              ref={harBtnRef}
              onClick={() => {
                setActiveCity('haroonabad')
                mapRef.current?.flyTo(HAROONABAD, 13, { duration: 1.6, easeLinearity: 0.22 })
              }}
              className={`relative z-10 h-7 px-3 rounded-full text-[10px] md:text-[11px] xl:text-xs font-bold whitespace-nowrap transition-colors duration-300 ${
                activeCity === 'haroonabad' ? 'text-white drop-shadow-[0_0_6px_rgba(167,243,208,0.4)]' : 'text-white/60 hover:text-emerald-200'
              }`}
            >
              Haroonabad
            </button>
            <button
              ref={faqBtnRef}
              onClick={() => {
                setActiveCity('faqirwali')
                mapRef.current?.flyTo(FAQIRWALI, 13, { duration: 1.6, easeLinearity: 0.22 })
              }}
              className={`relative z-10 h-7 px-3 rounded-full text-[10px] md:text-[11px] xl:text-xs font-bold whitespace-nowrap transition-colors duration-300 ${
                activeCity === 'faqirwali' ? 'text-white drop-shadow-[0_0_6px_rgba(167,243,208,0.4)]' : 'text-white/60 hover:text-emerald-200'
              }`}
            >
              Faqirwali
            </button>
          </div>
          {searchBox(false)}
        </div>

        {/* TOP-RIGHT: mobile floating search */}
        <div className="absolute top-3 right-2 z-[1000] sm:hidden">{searchBox(true)}</div>

        {/* BOTTOM-LEFT: satellite / standard toggle */}
        <button
          onClick={toggleSatellite}
          className="absolute bottom-6 left-4 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-2xl cursor-pointer overflow-hidden border border-emerald-400/30 z-[1000] transition-transform hover:scale-105 active:scale-95"
          title="Toggle map layer"
        >
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: satellite ? "url('https://mt1.google.com/vt/lyrs=m&x=4686&y=2986&z=13')" : "url('https://mt1.google.com/vt/lyrs=s&x=4686&y=2986&z=13')" }}
          />
          <div className="absolute bottom-0 left-0 w-full bg-black/60 text-white text-[10px] font-bold py-1.5 flex items-center justify-center gap-1 backdrop-blur-md">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l12 5 12-5-12-5z" />
              <path d="M2 17l12 5 12-5" />
              <path d="M2 12l12 5 12-5" />
            </svg>
            <span>{satellite ? 'Standard' : 'Satellite'}</span>
          </div>
        </button>

        <style>{MAP_CSS}</style>
      </div>
    </div>
  )
}