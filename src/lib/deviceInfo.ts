// ✅ Device fingerprint — sirf hardware/OS level traits (sab browsers mein SAME rehta hai)
export function deviceFingerprint(): string {
  const s = window.screen
  const traits = [
    s.width, s.height, s.availWidth, s.availHeight, s.colorDepth, s.pixelDepth,
    window.devicePixelRatio || 1,
    navigator.platform || 'na',
    navigator.hardwareConcurrency || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'na',
  ]
  const raw = traits.join('|')
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  return 'dev-' + h.toString(16)
}