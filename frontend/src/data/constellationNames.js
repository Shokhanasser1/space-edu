/**
 * The 88 constellation names, as the IAU has them.
 *
 * These are the official Latin names adopted by the International
 * Astronomical Union in 1922 and fixed with Delporte's boundaries in 1930 --
 * the same three-letter abbreviations the catalogue uses. Latin is the form
 * used internationally, including in Uzbek astronomy writing, so it is the
 * fallback whenever a language has no name of its own for one.
 *
 * Where Uzbek or Russian *does* have its own name it lives in the locale files
 * under `skyView.constellations.<abbr>`, and `constellationName()` prefers it.
 * Ursa Major is worth the trip: Russian calls it Большая Медведица and Uzbek
 * calls it Yetti Qaroqchi, "the seven robbers", which is a different story
 * about the same seven stars and exactly the point the sky view makes about
 * the lines being a drawing.
 */
export const IAU_LATIN = {
  And: 'Andromeda', Ant: 'Antlia', Aps: 'Apus', Aql: 'Aquila', Aqr: 'Aquarius',
  Ara: 'Ara', Ari: 'Aries', Aur: 'Auriga', Boo: 'Boötes', CMa: 'Canis Major',
  CMi: 'Canis Minor', CVn: 'Canes Venatici', Cae: 'Caelum', Cam: 'Camelopardalis',
  Cap: 'Capricornus', Car: 'Carina', Cas: 'Cassiopeia', Cen: 'Centaurus',
  Cep: 'Cepheus', Cet: 'Cetus', Cha: 'Chamaeleon', Cir: 'Circinus',
  Cnc: 'Cancer', Col: 'Columba', Com: 'Coma Berenices', CrA: 'Corona Australis',
  CrB: 'Corona Borealis', Crt: 'Crater', Cru: 'Crux', Crv: 'Corvus',
  Cyg: 'Cygnus', Del: 'Delphinus', Dor: 'Dorado', Dra: 'Draco', Equ: 'Equuleus',
  Eri: 'Eridanus', For: 'Fornax', Gem: 'Gemini', Gru: 'Grus', Her: 'Hercules',
  Hor: 'Horologium', Hya: 'Hydra', Hyi: 'Hydrus', Ind: 'Indus', LMi: 'Leo Minor',
  Lac: 'Lacerta', Leo: 'Leo', Lep: 'Lepus', Lib: 'Libra', Lup: 'Lupus',
  Lyn: 'Lynx', Lyr: 'Lyra', Men: 'Mensa', Mic: 'Microscopium',
  Mon: 'Monoceros', Mus: 'Musca', Nor: 'Norma', Oct: 'Octans', Oph: 'Ophiuchus',
  Ori: 'Orion', Pav: 'Pavo', Peg: 'Pegasus', Per: 'Perseus', Phe: 'Phoenix',
  Pic: 'Pictor', PsA: 'Piscis Austrinus', Psc: 'Pisces', Pup: 'Puppis',
  Pyx: 'Pyxis', Ret: 'Reticulum', Scl: 'Sculptor', Sco: 'Scorpius',
  Sct: 'Scutum', Ser: 'Serpens', Sex: 'Sextans', Sge: 'Sagitta',
  Sgr: 'Sagittarius', Tau: 'Taurus', Tel: 'Telescopium', TrA: 'Triangulum Australe',
  Tri: 'Triangulum', Tuc: 'Tucana', UMa: 'Ursa Major', UMi: 'Ursa Minor',
  Vel: 'Vela', Vir: 'Virgo', Vol: 'Volans', Vul: 'Vulpecula',
};

/**
 * The name to show a reader, given the catalogue's abbreviation and the `t`
 * from `useTranslation`. Falls back to Latin rather than to English, and to
 * the abbreviation itself only if the catalogue ever grows one we do not know.
 */
export function constellationName(abbreviation, t) {
  if (!abbreviation) return null;
  const translated = t('skyView', `constellations.${abbreviation}`);
  if (!translated.startsWith('skyView.')) return translated;
  return IAU_LATIN[abbreviation] ?? abbreviation;
}
