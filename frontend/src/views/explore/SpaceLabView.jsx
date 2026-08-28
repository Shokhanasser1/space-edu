import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Flame, Globe2, Sparkles, Satellite } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { ApolloHologramModule } from './lab/ApolloModule';
import { ApolloLaunchSimulator } from './lab/LaunchModule';
import { SatelliteControlSimulator } from './lab/SatelliteModule';
import { PlanetaryProcessesLab } from './lab/PlanetaryModule';
import { UniverseChangesSimulator } from './lab/UniverseModule';
import { LabErrorBoundary } from './lab/LabCanvas';

/**
 * The Laboratory: a sidebar, and one module at a time.
 *
 * This file used to be 743 lines, because three of the six modules were
 * declared inside it. They are in `lab/` now, one file each, which is where
 * `SpaceLabView.test.js` already looks — the rules it holds the lab to (a
 * released WebGL context per canvas, no user-facing text in the source, no
 * undisposed GPU resource, no third-party asset host) followed the code across
 * without anything being added to them.
 *
 * Two things the shell itself now does:
 *
 * **The module is in the URL.** `/lab/satellite` opens the satellite module.
 * Every Learn topic page has a "lab" button and all of them called
 * `navigate('/lab')`, so a physics lesson about rockets and an astronomy
 * lesson about planets both dropped the reader on the Apollo module and left
 * them to find their way. A bare `/lab` still works and still opens Apollo.
 *
 * **One module failing is one module failing.** Every module owns a WebGL
 * canvas, and a lost context or a bad texture used to throw past this view to
 * `RouteErrorBoundary`, which replaces the entire page. Each is wrapped now.
 */

const DEFAULT_MODULE = 'apollo';

export default function SpaceLabView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { moduleId } = useParams();

  const modules = [
    { id: 'apollo', name: t('lab', 'apolloTitle'), icon: Rocket, color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
    { id: 'launch', name: t('lab', 'launchSimulator'), icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'satellite', name: t('lab', 'satelliteControl'), icon: Globe2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'planet', name: t('lab', 'planetaryProcesses'), icon: Globe2, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'universe', name: t('lab', 'universeChanges'), icon: Sparkles, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
    { id: 'falcon', name: t('lab', 'satelliteTracker'), icon: Satellite, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  // An unknown id in the URL opens the default rather than an empty panel.
  const activeModule = modules.some((mod) => mod.id === moduleId) ? moduleId : DEFAULT_MODULE;

  const openModule = useCallback(
    (id) => navigate(id === DEFAULT_MODULE ? '/lab' : `/lab/${id}`),
    [navigate],
  );

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* The height is pinned to the viewport only where the panel and the
          viewer sit side by side. Stacked on a phone they are taller than
          that, and a fixed height made the Apollo panel overflow the
          container and land on top of the footer. */}
      <div className="flex flex-col lg:flex-row gap-8 lg:h-[calc(100vh-140px)] lg:min-h-[600px]">
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => openModule(mod.id)}
              aria-current={activeModule === mod.id}
              className={`flex items-center gap-3 p-4 rounded-2xl transition-all whitespace-nowrap lg:whitespace-normal ${
                activeModule === mod.id
                  ? 'glass border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              <div className={`p-2 rounded-xl ${mod.bg}`}>
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
              </div>
              <span className={`font-bold ${activeModule === mod.id ? 'text-white' : 'text-gray-400'}`}>
                {mod.name}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-grow">
          <LabErrorBoundary resetKey={activeModule} message={t('lab', 'moduleFailed')}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {activeModule === 'apollo' && <ApolloHologramModule />}
                {activeModule === 'launch' && <ApolloLaunchSimulator />}
                {activeModule === 'satellite' && <SatelliteControlSimulator />}
                {activeModule === 'planet' && <PlanetaryProcessesLab />}
                {activeModule === 'universe' && <UniverseChangesSimulator />}
                {activeModule === 'falcon' && <FalconTrackerLab />}
              </motion.div>
            </AnimatePresence>
          </LabErrorBoundary>
        </div>
      </div>
    </div>
  );
}

/**
 * The Falcon 9 tracker, which is a separate prebuilt application served from
 * `public/falcon9-simulator/` and shown in an iframe.
 *
 * Kept as it was. It is 2.9 MB of assets for something the Live page now does
 * with real element sets, so it is the strongest candidate in the lab for
 * removal — but removing a module a reader may be using is a decision to take
 * deliberately, not a side effect of tidying this file.
 */
const FalconTrackerLab = () => {
  return (
    <div className="w-full h-full bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative min-h-[600px] flex">
      <iframe
        src="/falcon9-simulator/index.html"
        className="w-full h-full border-0 flex-1"
        allow="camera; microphone; fullscreen"
        title="Falcon 9 tracker"
      />
    </div>
  );
};
