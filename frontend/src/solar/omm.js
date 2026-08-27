import { twoline2satrec } from 'satellite.js';

/**
 * CelesTrak's JSON (OMM) → the two TLE lines satellite.js knows how to read.
 *
 * satellite.js 4.1 parses TLEs by column and has no OMM entry point, and the
 * JSON is what our backend caches (one format for everything, easier to read
 * in a debugger). Rebuilding the fixed-width lines is the cheapest bridge:
 * forty lines here against a fork of the library.
 */

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function fixed(value, width, decimals) {
  return Number(value).toFixed(decimals).padStart(width, ' ');
}

/** `.00014920`-style: sign, no leading zero, 8 decimals. */
function derivative(value) {
  const v = Number(value) || 0;
  const s = Math.abs(v).toFixed(8).replace(/^0/, '');
  return (v < 0 ? '-' : ' ') + s;
}

/** `26616-3`-style: mantissa of 5 digits with an implied decimal point and a
 *  signed single-digit exponent. */
function exponential(value) {
  const v = Number(value) || 0;
  if (v === 0) return ' 00000-0';
  const exp = Math.floor(Math.log10(Math.abs(v))) + 1;
  const mantissa = Math.round((Math.abs(v) / Math.pow(10, exp)) * 1e5);
  const expSign = exp < 0 ? '-' : '+';
  return `${v < 0 ? '-' : ' '}${pad(mantissa, 5)}${expSign}${Math.abs(exp)}`;
}

function epochToTleDay(iso) {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const day = (date.getTime() - start) / 86_400_000 + 1;
  return `${pad(year % 100, 2)}${day.toFixed(8).padStart(12, '0')}`;
}

function checksum(line) {
  let sum = 0;
  for (const ch of line) {
    if (ch >= '0' && ch <= '9') sum += Number(ch);
    else if (ch === '-') sum += 1;
  }
  return sum % 10;
}

export function ommToTle(omm) {
  const satnum = pad(omm.NORAD_CAT_ID, 5).slice(-5);
  // '1998-067A' → '98067A': two-digit year, no dash, padded to eight.
  const intl = String(omm.OBJECT_ID || '').replace(/^\d{2}(\d{2})-/, '$1').padEnd(8, ' ').slice(0, 8);
  const line1 = `1 ${satnum}${omm.CLASSIFICATION_TYPE || 'U'} ${intl} ${epochToTleDay(omm.EPOCH)} ${derivative(omm.MEAN_MOTION_DOT)} ${exponential(omm.MEAN_MOTION_DDOT)} ${exponential(omm.BSTAR)} ${omm.EPHEMERIS_TYPE ?? 0} ${String(omm.ELEMENT_SET_NO ?? 999).padStart(4, ' ').slice(-4)}`;
  const ecc = Number(omm.ECCENTRICITY).toFixed(7).slice(2);
  const line2 = `2 ${satnum} ${fixed(omm.INCLINATION, 8, 4)} ${fixed(omm.RA_OF_ASC_NODE, 8, 4)} ${ecc} ${fixed(omm.ARG_OF_PERICENTER, 8, 4)} ${fixed(omm.MEAN_ANOMALY, 8, 4)} ${fixed(omm.MEAN_MOTION, 11, 8)}${String(omm.REV_AT_EPOCH ?? 0).padStart(5, ' ').slice(-5)}`;
  return [`${line1}${checksum(line1)}`, `${line2}${checksum(line2)}`];
}

export function ommToSatrec(omm) {
  const [l1, l2] = ommToTle(omm);
  return twoline2satrec(l1, l2);
}
