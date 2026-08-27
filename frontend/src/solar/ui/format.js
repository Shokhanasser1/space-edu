/** Number formatting for the info panel. Locale-neutral: digits and units only. */

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function superscript(n) {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

export function formatMass(kg) {
  if (!kg) return '—';
  const exp = Math.floor(Math.log10(kg));
  const mantissa = kg / 10 ** exp;
  return `${mantissa.toFixed(2)} × 10${superscript(exp)} kg`;
}

export function formatInt(n) {
  return Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
}

/** Sidereal day as hours+minutes, or days when it is longer than two days. */
export function formatHours(hours, units) {
  const h = Math.abs(hours);
  if (h < 48) {
    const whole = Math.floor(h);
    const min = Math.round((h - whole) * 60);
    return `${whole} ${units.h} ${String(min).padStart(2, '0')} ${units.min}`;
  }
  return `${(h / 24).toFixed(1)} ${units.d}`;
}

export function formatAU(au, units) {
  const mkm = au * 149.597870;
  const auText = au < 0.01 ? au.toFixed(5) : au.toFixed(3);
  return `${auText} ${units.au} · ${mkm < 10 ? mkm.toFixed(2) : mkm.toFixed(1)} ${units.mkm}`;
}

export function formatLightTime(minutes, units) {
  if (minutes < 1) return `${(minutes * 60).toFixed(1)} s`;
  if (minutes < 120) return `${minutes.toFixed(1)} ${units.min}`;
  return `${(minutes / 60).toFixed(2)} ${units.h}`;
}

export function formatPeriod(days, units) {
  if (Math.abs(days) < 400) return `${Math.abs(days).toFixed(2)} ${units.days}`;
  return `${(Math.abs(days) / 365.25).toFixed(2)} ${units.years}`;
}

export function formatDateTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`,
  };
}

export function toDateInputValue(ms) {
  return formatDateTime(ms).date;
}
