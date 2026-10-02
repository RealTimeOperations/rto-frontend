import { supabase } from './supabase'

// ✅ Har browser/device ki unique ID (localStorage persist)
export function getDeviceId(): string {
  let id = localStorage.getItem('rto_device_id')
  if (!id) {
    id = 'DEV-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase()
    localStorage.setItem('rto_device_id', id)
  }
  return id
}

// ✅ Readable device name (OS + Browser)
export function getDeviceName(): string {
  const ua = navigator.userAgent
  let os = 'Unknown OS'
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'
  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  return `${os} • ${browser}`
}

// ✅ Login ke BAAD call karein — returns true agar device BLOCKED ho
export async function trackDeviceLogin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('track_device_login', {
      p_user_id: userId,
      p_device_id: getDeviceId(),
      p_device_name: getDeviceName(),
      p_user_agent: navigator.userAgent,
      p_coordinates: '',
    })
    if (error) console.error('track_device_login:', error)
    return data === true
  } catch (e) {
    console.error('track_device_login:', e)
    return false
  }
}

// ✅ Logout se PEHLE call karein
export async function trackDeviceLogout(userId?: string) {
  try {
    let uid = userId
    if (!uid) {
      const { data } = await supabase.auth.getSession()
      uid = data.session?.user.id ?? undefined
    }
    if (uid) await supabase.rpc('track_device_logout', { p_user_id: uid, p_device_id: getDeviceId() })
  } catch (e) {
    console.error('track_device_logout:', e)
  }
}