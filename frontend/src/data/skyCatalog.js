/**
 * The generated star catalogue, decoded once into something the sky view can
 * draw.
 *
 * `skyCatalog.json` stores each star as a tuple rather than an object because
 * the same 2319 records written with field names are three times the bytes,
 * and this ships to a phone on a school connection. The order of those fields
 * is a contract between the generator and this file, and **this is the only
 * place allowed to know it** — everything downstream sees named properties.
 * `starFields` travels in the JSON so a mismatch is caught here rather than
 * showing up as a sky with the declinations in the magnitude column.
 *
 * Where the numbers come from, and what is measurement and what is convention:
 * `src/data/ATTRIBUTION.md`. Regenerate with `npm run sky:build`.
 */
import raw from './skyCatalog.json';

const EXPECTED_FIELDS = [
  'hr', 'ra', 'dec', 'vmag', 'bv', 'con', 'greek', 'name', 'distanceLy', 'spectralType',
];

if (raw.starFields.join(',') !== EXPECTED_FIELDS.join(',')) {
  throw new Error(
    `skyCatalog.json field order changed (${raw.starFields.join(',')}). ` +
    'Update EXPECTED_FIELDS in src/data/skyCatalog.js to match, and check every reader.',
  );
}

/** Bayer letters arrive as BSC abbreviations; children read the Greek. */
const GREEK = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ',
  Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π',
  Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};

/**
 * "Alp" -> "α", "Alp1" -> "α¹". The trailing digit is a component number, as in
 * α¹ Cru; BSC writes it inline.
 */
function greekLetter(raw_) {
  if (!raw_) return null;
  const match = /^([A-Za-z]+)(\d*)$/.exec(raw_);
  if (!match) return null;
  const letter = GREEK[match[1]];
  if (!letter) return null;
  const superscripts = { 1: '¹', 2: '²', 3: '³' };
  return letter + (superscripts[match[2]] ?? '');
}

export const stars = raw.stars.map(
  ([hr, ra, dec, vmag, bv, con, greek, name, distanceLy, spectralType]) => ({
    hr,
    ra,
    dec,
    vmag,
    bv,
    constellation: con || null,
    greek: greekLetter(greek),
    // The empty strings in the JSON are "this star has no IAU name" and "no
    // spectral type was published", not names that happen to be blank.
    name: name || null,
    distanceLy,
    spectralType: spectralType || null,
  }),
);

export const starsByHr = new Map(stars.map((star) => [star.hr, star]));

/**
 * Constellation figures, as pairs of stars rather than pairs of HR numbers, so
 * a renderer never has to do the lookup. Any link whose endpoints are not both
 * in the catalogue is dropped here as well as in the generator — belt and
 * braces, because half a line is worse than no line.
 */
export const figures = Object.entries(raw.figures).map(([abbreviation, links]) => ({
  abbreviation,
  links: links
    .map(([fromHr, toHr]) => [starsByHr.get(fromHr), starsByHr.get(toHr)])
    .filter(([from, to]) => from && to),
}));

export const magnitudeLimit = raw.magnitudeLimit;
export const catalogueSources = raw.sources;
export const catalogueEquinox = raw.equinox;
