import { useMemo } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { propagate, gstime, eciToGeodetic } from 'satellite.js';
import { BODY_BY_ID, moonsOf, rotationHoursOf } from '../catalog';
import { useSolarStore } from '../clock';
import { distanceAU, helioPositionAU, lightMinutes, moonOffsetAU } from '../ephemeris';
import { orbitPeriodDays } from '../scene/OrbitLine';
import { formatAU, formatHours, formatInt, formatLightTime, formatMass, formatPeriod } from './format';

/**
 * Facts about the selected body: the fixed ones from the catalogue and the
 * live ones (distance from the Sun and from us, light time) recomputed from
 * the ephemeris each time the clock's 10 Hz mirror ticks.
 */

function Row({ label, value, mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-white/55">{label}</span>
      <span className={`${mono ? 'font-mono tabular-nums' : ''} text-right text-white`}>{value}</span>
    </div>
  );
}

function bodyLive(entry, ms) {
  const sun = [0, 0, 0];
  const earth = helioPositionAU(BODY_BY_ID.get('earth'), ms);
  let pos;
  if (entry.parent) {
    const parent = BODY_BY_ID.get(entry.parent);
    const p = helioPositionAU(parent, ms);
    const off = moonOffsetAU(entry, parent, ms);
    pos = [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
  } else {
    pos = helioPositionAU(entry, ms);
  }
  return {
    fromSun: distanceAU(pos, sun),
    fromEarth: entry.id === 'earth' ? 0 : distanceAU(pos, earth),
  };
}

export function SatellitePanel({ sat, t, units, onClose }) {
  const epochMs = useSolarStore((s) => s.epochMs);
  const metrics = useMemo(() => {
    const date = new Date(epochMs);
    const pv = propagate(sat.satrec, date);
    if (!pv?.position || !pv.velocity) return null;
    const geo = eciToGeodetic(pv.position, gstime(date));
    const speed = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
    return {
      alt: geo.height,
      speed: speed * 3600,
      inc: (sat.satrec.inclo * 180) / Math.PI,
      lat: (geo.latitude * 180) / Math.PI,
      lon: (geo.longitude * 180) / Math.PI,
    };
  }, [sat, epochMs]);

  return (
    <Panel onClose={onClose} title={sat.name} kind={t('kind.satellite')} color="#ffd166">
      <Row label={t('sat.norad')} value={sat.id} />
      {metrics ? (
        <>
          <Row label={t('sat.altitude')} value={`${formatInt(metrics.alt)} ${units.km}`} />
          <Row label={t('sat.speed')} value={`${formatInt(metrics.speed)} ${units.km}/${units.h}`} />
          <Row label={t('sat.inclination')} value={`${metrics.inc.toFixed(2)}°`} />
          <Row label={t('sat.position')} value={`${metrics.lat.toFixed(2)}°, ${metrics.lon.toFixed(2)}°`} />
        </>
      ) : (
        <p className="text-xs text-amber-300">{t('satStatus.outOfRange')}</p>
      )}
    </Panel>
  );
}

function Panel({ onClose, title, kind, color, children }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto w-full rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl md:w-80"
    >
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{kind}</div>
          <h2 className="truncate text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="close" className="rounded-full bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </motion.aside>
  );
}

export default function InfoPanel({ id, t, names, units, onClose, onSelect }) {
  const entry = BODY_BY_ID.get(id);
  const epochMs = useSolarStore((s) => s.epochMs);
  const live = useMemo(() => (entry ? bodyLive(entry, epochMs) : null), [entry, epochMs]);
  if (!entry) return null;

  const kind = entry.parent ? 'moon' : entry.kind;
  const moons = entry.parent ? [] : moonsOf(entry.id);
  const hours = rotationHoursOf(entry);
  const period = entry.parent ? entry.periodDays : entry.kind === 'star' ? null : orbitPeriodDays(entry);

  return (
    <Panel onClose={onClose} title={names[entry.id]} kind={t(`kind.${kind}`)} color={entry.color}>
      <Row label={t('facts.radius')} value={`${formatInt(entry.radiusKm)} ${units.km}`} />
      <Row label={t('facts.mass')} value={formatMass(entry.massKg)} />
      {entry.gravity != null && <Row label={t('facts.gravity')} value={`${entry.gravity} m/s²`} />}
      {entry.tempC != null && <Row label={t('facts.temp')} value={`${entry.tempC > 0 ? '+' : ''}${entry.tempC} °C`} />}
      <Row label={t('facts.day')} value={`${formatHours(hours, units)}${hours < 0 ? ` (${t('facts.retrograde')})` : ''}`} />
      {entry.axialTilt != null && <Row label={t('facts.tilt')} value={`${entry.axialTilt}°`} />}
      {entry.kind !== 'star' && (
        <Row label={t('facts.atmosphere')} value={entry.atmosphere?.length ? entry.atmosphere.join(', ') : t('facts.none')} mono={false} />
      )}

      <div className="!mt-3 border-t border-white/10 pt-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neon-purple">{t('live.title')}</div>
        {entry.kind !== 'star' && live && (
          <>
            <Row label={t('live.distSun')} value={formatAU(live.fromSun, units)} />
            {entry.id !== 'earth' && <Row label={t('live.distEarth')} value={formatAU(live.fromEarth, units)} />}
            {entry.id !== 'earth' && <Row label={t('live.light')} value={formatLightTime(lightMinutes(live.fromEarth), units)} />}
          </>
        )}
        {entry.kind === 'star' && live && (
          <Row label={t('live.distEarth')} value={formatAU(distanceAU(helioPositionAU(BODY_BY_ID.get('earth'), epochMs), [0, 0, 0]), units)} />
        )}
        {period && (
          <Row
            label={`${t('live.period')}${entry.parent ? ` (${names[entry.parent]})` : ''}`}
            value={formatPeriod(period, units)}
          />
        )}
      </div>

      {moons.length > 0 && (
        <div className="!mt-3 border-t border-white/10 pt-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
            {t('facts.moonsCount')}: {moons.length}
          </div>
          <div className="flex flex-wrap gap-1">
            {moons.map((m) => (
              <button key={m.id} type="button" onClick={() => onSelect(m.id)} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/80 transition-colors hover:bg-white/15">
                {names[m.id]}
              </button>
            ))}
          </div>
        </div>
      )}
      {entry.parent && (
        <div className="!mt-3 border-t border-white/10 pt-2">
          <Row label={t('live.orbits')} value={<button type="button" className="underline decoration-white/30 underline-offset-2" onClick={() => onSelect(entry.parent)}>{names[entry.parent]}</button>} mono={false} />
        </div>
      )}
    </Panel>
  );
}
