import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle, ExternalLink, Orbit, Radio, Rocket, Satellite,
  Telescope, CloudSun, Navigation, MapPin, Calendar, Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The satellites this page introduces by name, with the facts we can source.
 *
 * The point of this component is the blank fields. A satellite can be real,
 * launched, photographed and announced by its own government and still have no
 * published orbital elements — Samarkand-2028 is exactly that — and the only
 * honest way to show it is its mission facts, a plain statement that we cannot
 * say where it is, and no dot on the globe.
 *
 * So an empty value here renders as a translated "not announced yet" rather
 * than being hidden. Hiding it would suggest there was nothing to know;
 * filling it in with something plausible is the failure this whole branch
 * exists to undo.
 */
const MISSION_ICONS = {
  station: Orbit,
  earth_obs: Satellite,
  weather: CloudSun,
  science: Telescope,
  navigation: Navigation,
  communication: Radio,
};

const MISSION_LABEL_KEYS = {
  station: 'missionStation',
  earth_obs: 'missionEarthObs',
  weather: 'missionWeather',
  science: 'missionScience',
  navigation: 'missionNavigation',
  communication: 'missionCommunication',
};

function Fact({ icon: Icon, label, value, missingLabel }) {
  const missing = !value;
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-[3px] h-3 w-3 shrink-0 text-white/25" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {label}
        </div>
        <div className={missing ? 'text-[13px] italic text-white/30' : 'text-[13px] text-white/75'}>
          {missing ? missingLabel : value}
        </div>
      </div>
    </div>
  );
}

export default function FeaturedSatellites() {
  const [satellites, setSatellites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { t, language } = useTranslation();

  useEffect(() => {
    let active = true;
    api.get('/satellites/')
      .then(({ data }) => {
        if (!active) return;
        // A bare array — `pagination_class = None` on the viewset, pinned by a
        // test, for the same reason the admin dashboard's tables need it.
        setSatellites(Array.isArray(data) ? data.filter((s) => s.is_featured) : []);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Could not load the satellite list', err);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const pick = (sat, field) => {
    const byLanguage = { UZB: `${field}_uz`, RUS: `${field}_ru`, ENG: `${field}_en` };
    return sat[byLanguage[language]] || sat[`${field}_en`] || '';
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-white/40">
        {t('liveSpace', 'loadingElements')}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="text-sm text-white/70">{t('liveSpace', 'satellitesUnavailable')}</div>
      </div>
    );
  }

  if (!satellites.length) return null;

  const notAnnounced = t('liveSpace', 'notAnnounced');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {satellites.map((sat, i) => {
        const Icon = MISSION_ICONS[sat.mission_type] || Satellite;
        const missionLabel = t('liveSpace', MISSION_LABEL_KEYS[sat.mission_type] || 'missionScience');
        // The distinction the whole component is built around.
        const tracked = sat.is_trackable;

        return (
          <motion.article
            key={sat.slug}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.4 }}
            className={`flex flex-col gap-4 rounded-2xl border p-5 backdrop-blur-xl transition-colors ${
              tracked
                ? 'border-white/[0.08] bg-white/[0.03] hover:border-cyan-300/25'
                : 'border-amber-300/20 bg-amber-300/[0.04] hover:border-amber-300/35'
            }`}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                  <Icon className="h-3 w-3" /> {missionLabel}
                </div>
                <h3 className="text-lg font-extrabold leading-tight text-white">
                  {pick(sat, 'name')}
                </h3>
                {sat.country && (
                  <div className="mt-0.5 text-xs text-white/40">{sat.country}</div>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  tracked
                    ? 'border border-emerald-300/25 bg-emerald-400/10 text-emerald-300'
                    : 'border border-amber-300/25 bg-amber-400/10 text-amber-200'
                }`}
              >
                {tracked ? t('liveSpace', 'trackedLive') : t('liveSpace', 'noOrbitData')}
              </span>
            </header>

            <p className="text-[13px] leading-relaxed text-white/55">
              {pick(sat, 'description')}
            </p>

            {!tracked && (
              <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2 text-xs leading-relaxed text-amber-100/70">
                {t('liveSpace', 'noOrbitDataWhy')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
              <Fact
                icon={Calendar}
                label={t('liveSpace', 'launchDate')}
                value={sat.launch_date}
                missingLabel={notAnnounced}
              />
              <Fact
                icon={Rocket}
                label={t('liveSpace', 'launchVehicle')}
                value={sat.launch_vehicle}
                missingLabel={notAnnounced}
              />
              <Fact
                icon={MapPin}
                label={t('liveSpace', 'launchSite')}
                value={sat.launch_site}
                missingLabel={notAnnounced}
              />
              <Fact
                icon={Building2}
                label={t('liveSpace', 'operator')}
                value={sat.operator}
                missingLabel={notAnnounced}
              />
            </div>

            {sat.source_url && (
              <a
                href={sat.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 text-xs text-cyan-300/70 transition-colors hover:text-cyan-200"
              >
                <ExternalLink className="h-3 w-3" />
                {t('liveSpace', 'source')}: {sat.source_name}
              </a>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
