import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket, Flame, Globe2, Sparkles, Satellite, Orbit, ChartScatter, Earth, Moon, Sun, Landmark, Target,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { ApolloHologramModule } from './lab/ApolloModule';
import { ApolloLaunchSimulator } from './lab/LaunchModule';
import { SatelliteControlSimulator } from './lab/SatelliteModule';
import { PlanetaryProcessesLab } from './lab/PlanetaryModule';
import { UniverseChangesSimulator } from './lab/UniverseModule';
import { ExoplanetHunterLab } from './lab/ExoplanetModule';
import { HrDiagramLab } from './lab/HrDiagramModule';
import { HabitableZoneLab } from './lab/HabitableZoneModule';
import { MoonPhasesLab } from './lab/MoonPhasesModule';
import { SeasonsLab } from './lab/SeasonsModule';
import { BiruniObservatoryLab } from './lab/BiruniModule';
import { CraterImpactLab } from './lab/CraterModule';
import { FalconTrackerLab } from './lab/FalconModule';
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
 *
 * **One window, on a desktop.** Thirteen modules made the sidebar taller than
 * the module beside it, and because the list was allowed to overflow it ran
 * down over the footer. On `lg` screens the page is now exactly the window:
 * the list scrolls inside its own column, folds to an icon rail with one
 * button (remembered per browser), and the module fills what is left. The
 * footer is hidden on `/lab`, as it is on the other full-screen tools.
 */

const DEFAULT_MODULE = 'apollo';

/** Whether the reader folded the sidebar. A per-browser convenience, nothing more. */
const SIDEBAR_KEY = 'lab.sidebarCollapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode or blocked storage: the toggle still works for this visit.
  }
}

export default function SpaceLabView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleSidebar = () => {
    setCollapsed((was) => {
      writeCollapsed(!was);
      return !was;
    });
  };

  const modules = [
    { id: 'apollo', name: t('lab', 'apolloTitle'), icon: Rocket, color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
    { id: 'launch', name: t('lab', 'launchSimulator'), icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'satellite', name: t('lab', 'satelliteControl'), icon: Satellite, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'planet', name: t('lab', 'planetaryProcesses'), icon: Globe2, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'universe', name: t('lab', 'universeChanges'), icon: Sparkles, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
    { id: 'exoplanet', name: t('lab', 'exoTitle'), icon: Orbit, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'hr', name: t('lab', 'hrTitle'), icon: ChartScatter, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    { id: 'habitable', name: t('lab', 'hzTitle'), icon: Earth, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'moon', name: t('lab', 'moonTitle'), icon: Moon, color: 'text-violet-300', bg: 'bg-violet-300/10' },
    { id: 'seasons', name: t('lab', 'seasonTitle'), icon: Sun, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { id: 'biruni', name: t('lab', 'biruniSidebar'), icon: Landmark, color: 'text-amber-300', bg: 'bg-amber-300/10' },
    { id: 'crater', name: t('lab', 'craterTitle'), icon: Target, color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 'falcon', name: t('lab', 'satelliteTracker'), icon: Rocket, color: 'text-slate-200', bg: 'bg-slate-200/10' },
  ];

  // An unknown id in the URL opens the default rather than an empty panel.
  const activeModule = modules.some((mod) => mod.id === moduleId) ? moduleId : DEFAULT_MODULE;

  const openModule = useCallback(
    (id) => navigate(id === DEFAULT_MODULE ? '/lab' : `/lab/${id}`),
    [navigate],
  );

  return (
    // The height is pinned to the window only where the panel and the viewer
    // sit side by side (lg). Stacked on a phone they are taller than any
    // window, and a fixed height there made the Apollo panel overflow the
    // container and land on top of the footer. The 640 px floor keeps a very
    // short window scrolling rather than squashing every module flat.
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto lg:h-dvh lg:min-h-[640px] lg:pb-6 lg:flex lg:flex-col">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:flex-1 lg:min-h-0">
        <nav
          aria-label={t('lab', 'modulesTitle')}
          className={`w-full shrink-0 flex flex-col gap-3 lg:min-h-0 lg:transition-[width] lg:duration-300 ${
            collapsed ? 'lg:w-[76px]' : 'lg:w-64'
          }`}
        >
          <div className={`hidden lg:flex items-center gap-2 ${collapsed ? 'justify-center' : 'justify-between pl-1'}`}>
            {collapsed ? null : (
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                {t('lab', 'modulesTitle')}
              </span>
            )}
            <button
              onClick={toggleSidebar}
              aria-expanded={!collapsed}
              aria-label={t('lab', collapsed ? 'expandModules' : 'collapseModules')}
              title={t('lab', collapsed ? 'expandModules' : 'collapseModules')}
              className="w-9 h-9 grid place-items-center rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-row lg:flex-col gap-3 lg:gap-2 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:flex-1 lg:min-h-0 pb-4 lg:pb-0">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => openModule(mod.id)}
                aria-current={activeModule === mod.id}
                title={collapsed ? mod.name : undefined}
                // `relative` keeps the folded, visually hidden name inside the
                // scrolling list; without it the absolutely positioned label
                // escaped the list and stretched the page past the window.
                className={`relative flex shrink-0 items-center gap-3 p-4 lg:p-3 rounded-2xl transition-all whitespace-nowrap lg:whitespace-normal ${
                  collapsed ? 'lg:justify-center' : ''
                } ${
                  activeModule === mod.id
                    ? 'glass border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${mod.bg}`}>
                  <mod.icon className={`w-5 h-5 ${mod.color}`} />
                </div>
                {/* Folded, the name stays for screen readers and in the tooltip. */}
                <span
                  className={`font-bold text-left ${collapsed ? 'lg:sr-only' : ''} ${
                    activeModule === mod.id ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {mod.name}
                </span>
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-grow min-w-0 lg:min-h-0">
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
                {activeModule === 'exoplanet' && <ExoplanetHunterLab />}
                {activeModule === 'hr' && <HrDiagramLab />}
                {activeModule === 'habitable' && <HabitableZoneLab />}
                {activeModule === 'moon' && <MoonPhasesLab />}
                {activeModule === 'seasons' && <SeasonsLab />}
                {activeModule === 'biruni' && <BiruniObservatoryLab />}
                {activeModule === 'crater' && <CraterImpactLab />}
                {activeModule === 'falcon' && <FalconTrackerLab />}
              </motion.div>
            </AnimatePresence>
          </LabErrorBoundary>
        </div>
      </div>
    </div>
  );
}
