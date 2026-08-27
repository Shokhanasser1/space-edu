import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass, MapPin, Search, Star, ChevronRight, ChevronLeft, Telescope, BookOpen,
  Bell, Camera, Layers, ChevronDown, Loader, LocateFixed,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cardinalKey, compassPoint, horizontalPosition } from './starPosition';

// The heavy tabs. None of them mounts until it is opened.
const StarCanvas3D = React.lazy(() => import('./StarCanvas3D'));
const ARCameraView = React.lazy(() => import('./ARCameraView'));
const StarCollection = React.lazy(() => import('./StarCollection'));

/** Where the sky is drawn from until somebody shares their own position. */
const TASHKENT = { lat: 41.2995, lon: 69.2401 };

/** How often the sky is recomputed while the page is open. */
const TICK_MS = 60_000;

// Bright stars visible from Uzbekistan, with J2000 coordinates in degrees.
// Canopus is not here: at declination −52.7° it never rises north of 37°N,
// so the finder could only ever have said "below the horizon".
const STARS = [
  { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', ra: 101.287, dec: -16.716, magnitude: -1.46, distance: 8.6, spectralType: 'A0V', story: 'The brightest star in Earth\'s night sky, also known as the "Dog Star". In ancient Egypt, its heliacal rising marked the beginning of the year.', visibilityScore: 10, bestSeason: 'Winter', recommendedTime: '10:00 PM - Midnight' },
  { id: 'arcturus', name: 'Arcturus', constellation: 'Boötes', ra: 213.915, dec: 19.183, magnitude: -0.05, distance: 36.7, spectralType: 'K1.5III', story: 'Guardian of the Bear, brightest star in the northern celestial hemisphere. Part of the spring sky.', visibilityScore: 9, bestSeason: 'Spring', recommendedTime: '9:00 PM - 1:00 AM' },
  { id: 'vega', name: 'Vega', constellation: 'Lyra', ra: 279.234, dec: 38.784, magnitude: 0.03, distance: 25, spectralType: 'A0V', story: 'Fifth brightest star. In Chinese mythology, Vega is the Weaver Girl separated from her lover by the Milky Way.', visibilityScore: 7, bestSeason: 'Summer', recommendedTime: '11:00 PM - 3:00 AM' },
  { id: 'capella', name: 'Capella', constellation: 'Auriga', ra: 79.172, dec: 45.998, magnitude: 0.08, distance: 42.9, spectralType: 'G3III', story: 'The Goat star, sixth brightest. A quadruple star system representing Amalthea from Greek mythology.', visibilityScore: 8, bestSeason: 'Winter', recommendedTime: '8:00 PM - Midnight' },
  { id: 'rigel', name: 'Rigel', constellation: 'Orion', ra: 78.634, dec: -8.202, magnitude: 0.13, distance: 860, spectralType: 'B8Ia', story: 'Blue supergiant marking Orion\'s left foot. Extraordinarily luminous despite being 860 light-years away.', visibilityScore: 8, bestSeason: 'Winter', recommendedTime: '9:00 PM - 1:00 AM' },
  { id: 'procyon', name: 'Procyon', constellation: 'Canis Minor', ra: 114.829, dec: 5.225, magnitude: 0.40, distance: 11.46, spectralType: 'F5IV', story: 'The "Dog before the Dog", eighth brightest star. Precedes Sirius across the night sky.', visibilityScore: 7, bestSeason: 'Winter', recommendedTime: '9:00 PM - Midnight' },
  { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orion', ra: 88.793, dec: 7.407, magnitude: 0.45, distance: 548, spectralType: 'M1Ia', story: 'Red supergiant at Orion\'s shoulder. May explode as a supernova within the next 100,000 years.', visibilityScore: 9, bestSeason: 'Winter', recommendedTime: '8:30 PM - 11:00 PM' },
  { id: 'altair', name: 'Altair', constellation: 'Aquila', ra: 297.696, dec: 8.868, magnitude: 0.77, distance: 16.7, spectralType: 'A7V', story: 'The Cowherd in Chinese folklore, separated from Vega by the Milky Way. Rotates extremely rapidly.', visibilityScore: 8, bestSeason: 'Summer', recommendedTime: '10:00 PM - 2:00 AM' },
  { id: 'polaris', name: 'Polaris', constellation: 'Ursa Minor', ra: 37.954, dec: 89.264, magnitude: 1.98, distance: 433, spectralType: 'F7Ib', story: 'The North Star. Has guided navigators for centuries. Nearly aligned with Earth\'s rotation axis.', visibilityScore: 8, bestSeason: 'Year-round', recommendedTime: '9:00 PM - 2:00 AM' },
].map((star) => ({
  ...star,
  // Three photographs per star are committed under public/images/stars.
  images: [1, 2, 3].map((n) => `/images/stars/${star.id}${n === 1 ? '' : `_${n}`}.webp`),
}));

function CustomSelect({ value, onChange, options, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-black/40 border ${isOpen ? 'border-neon-purple' : 'border-white/20'} rounded-xl px-4 py-3 text-white focus:outline-none transition-all flex items-center justify-between`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-[#0c0518]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  value === option.value
                    ? 'bg-neon-purple/20 text-neon-purple font-medium border-l-2 border-neon-purple'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StarFinderView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('finder');
  const [selectedStar, setSelectedStar] = useState(STARS[0]);
  const [location, setLocation] = useState({ ...TASHKENT, source: 'default' });
  const [now, setNow] = useState(() => new Date());
  const [result, setResult] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReminderToast, setShowReminderToast] = useState(false);

  // The sky moves; a page left open for an hour should say so.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Every catalogue star placed for this spot and minute — the 3D dome draws
  // these, and the finder reads the selected one out of them.
  const skyStars = useMemo(
    () => STARS.map((star) => ({ ...star, ...horizontalPosition(star, location, now) })),
    [location, now],
  );

  // Asked for on a click, not on arrival: a permission prompt nobody asked
  // for is dismissed, and Chrome stops showing it at all after a few of those.
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ ...TASHKENT, source: 'denied' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'mine' }),
      () => setLocation({ ...TASHKENT, source: 'denied' }),
      { timeout: 10_000 },
    );
  };

  const handleFindStar = () => {
    const star = skyStars.find((s) => s.id === selectedStar.id);
    setResult({
      azimuth: Math.round(star.azimuth),
      altitude: Math.round(star.altitude * 10) / 10,
      point: compassPoint(star.azimuth),
      cardinal: t('starFinder', cardinalKey(star.azimuth)),
    });
  };

  const selectStar = (id) => {
    const star = STARS.find((s) => s.id === id);
    if (!star) return;
    setSelectedStar(star);
    setCurrentImageIndex(0);
    setResult(null);
  };

  const handleRemindMe = () => {
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 3000);
  };

  const stepImage = (delta) => {
    const count = selectedStar.images.length;
    setCurrentImageIndex((prev) => (prev + delta + count) % count);
  };

  const starOptions = STARS.map((s) => ({ value: s.id, label: `${s.name} (${s.constellation})` }));
  const locationLabel = location.source === 'mine'
    ? `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`
    : t('starFinder', 'defaultLocation');

  const TABS = [
    { id: 'finder', label: t('starFinder', 'tabFinder'), icon: Search },
    { id: '3d', label: t('starFinder', 'tab3d'), icon: Telescope },
    { id: 'ar', label: t('starFinder', 'tabAr'), icon: Camera },
    { id: 'collection', label: t('starFinder', 'tabCollection'), icon: Layers },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {showReminderToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md"
          >
            <Bell className="w-5 h-5" /> {t('starFinder', 'reminderSet')} {selectedStar.recommendedTime}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-purple/30 to-blue-500/30 flex items-center justify-center mx-auto mb-4 border border-neon-purple/50 shadow-lg shadow-neon-purple/20"
        >
          <Compass className="w-8 h-8 text-neon-purple" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bold mb-4 text-white"
        >
          {t('starFinder', 'title')}{' '}
          <span className="bg-gradient-to-r from-neon-purple via-blue-400 to-purple-500 bg-clip-text text-transparent">
            {t('starFinder', 'titleHighlight')}
          </span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-300 text-lg">
          {t('starFinder', 'subtitle').replace('{{count}}', STARS.length)}
        </motion.p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="glass p-1 rounded-2xl inline-flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-neon-purple text-black shadow-lg shadow-neon-purple/50' : 'text-gray-400 hover:text-white'}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'collection' && (
        <Suspense fallback={<div className="w-full h-96 glass rounded-3xl" />}>
          <StarCollection />
        </Suspense>
      )}

      {activeTab !== 'collection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Canvas/Finder */}
          <div className="lg:col-span-2">
            {(activeTab === 'finder' || activeTab === '3d') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass p-6 md:p-8 rounded-3xl border border-neon-purple/20 space-y-6"
              >
                {/* Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Star className="w-4 h-4" /> {t('starFinder', 'targetStar')}
                    </label>
                    <CustomSelect value={selectedStar.id} onChange={selectStar} options={starOptions} />
                  </div>
                  <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-end">
                    <button
                      type="button"
                      onClick={useMyLocation}
                      className="px-4 py-3 rounded-xl border border-white/15 text-gray-300 hover:text-white hover:border-neon-purple/50 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <LocateFixed className="w-4 h-4" />
                      <span className="truncate">{location.source === 'mine' ? locationLabel : t('starFinder', 'useMyLocation')}</span>
                    </button>
                    {activeTab === 'finder' && (
                      <button
                        type="button"
                        onClick={handleFindStar}
                        className="flex-1 bg-gradient-to-r from-neon-purple to-blue-500 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                      >
                        <Search className="w-5 h-5" /> {t('starFinder', 'calculate')}
                      </button>
                    )}
                  </div>
                </div>

                {location.source === 'denied' && (
                  <p className="text-xs text-amber-300/80">{t('starFinder', 'locationDenied')}</p>
                )}

                {/* 3D Canvas */}
                {activeTab === '3d' && (
                  <Suspense fallback={(
                    <div className="w-full h-[500px] bg-black/40 rounded-2xl flex items-center justify-center">
                      <Loader className="w-10 h-10 text-neon-purple animate-spin" />
                    </div>
                  )}>
                    <div className="rounded-2xl overflow-hidden border border-white/10">
                      <StarCanvas3D stars={skyStars} />
                    </div>
                  </Suspense>
                )}

                {/* Results */}
                {result && activeTab === 'finder' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Image Gallery */}
                    <div className="space-y-4">
                      <div className="relative rounded-2xl overflow-hidden border border-neon-purple/30 shadow-2xl shadow-neon-purple/20 aspect-[4/3] bg-black/60">
                        <AnimatePresence mode="wait">
                          <motion.img
                            key={`${selectedStar.id}-${currentImageIndex}`}
                            src={selectedStar.images[currentImageIndex]}
                            alt={selectedStar.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full object-cover"
                          />
                        </AnimatePresence>
                        <button type="button" onClick={() => stepImage(-1)} aria-label="previous" className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-neon-purple transition">
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button type="button" onClick={() => stepImage(1)} aria-label="next" className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-neon-purple transition">
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="bg-gradient-to-br from-neon-purple/10 to-transparent p-6 rounded-2xl border border-neon-purple/20">
                        <div className="flex items-center gap-3 mb-3">
                          <BookOpen className="w-5 h-5 text-neon-purple" />
                          <h4 className="text-white font-bold">{t('starFinder', 'storyTitle')}</h4>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed italic">"{selectedStar.story}"</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-4xl font-bold text-white mb-2">{selectedStar.name}</h3>
                        <p className="text-neon-purple text-lg flex items-center gap-2">
                          <Star className="w-5 h-5" /> {selectedStar.constellation}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{t('starFinder', 'visibilityToday')}</div>
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-white">{selectedStar.visibilityScore}</span>
                            <span className="text-gray-500 mb-1">/10</span>
                          </div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{t('starFinder', 'bestTime')}</div>
                          <div className="text-lg font-bold text-white">{selectedStar.recommendedTime}</div>
                        </div>
                      </div>

                      {/* Position */}
                      <div className="bg-gradient-to-r from-black/40 to-black/60 border border-neon-purple/30 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                          <MapPin className="w-5 h-5 text-neon-purple" />
                          <span className="text-gray-300 font-medium">{t('starFinder', 'viewingFrom')} {locationLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{t('starFinder', 'direction')}</div>
                            <div className="flex items-end gap-2">
                              <span className="text-4xl font-bold text-neon-purple">{result.cardinal}</span>
                              <span className="text-gray-500 mb-1">{result.point} · {result.azimuth}°</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{t('starFinder', 'altitude')}</div>
                            <div className="flex items-end gap-2">
                              <span className="text-4xl font-bold text-neon-purple">{result.altitude}°</span>
                              <span className="text-gray-500 mb-1">{t('starFinder', 'up')}</span>
                            </div>
                          </div>
                        </div>
                        {result.altitude < 0 && (
                          <p className="mt-4 text-sm text-amber-300/90">
                            {t('starFinder', 'belowHorizon').replace('{{time}}', selectedStar.recommendedTime)}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleRemindMe}
                          className="w-full mt-4 py-2 bg-white/10 hover:bg-neon-purple/20 text-white font-medium rounded-lg border border-white/10 transition flex items-center justify-center gap-2"
                        >
                          <Bell className="w-4 h-4" /> {t('starFinder', 'remindMe')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'ar' && (
              <Suspense fallback={<div className="w-full h-96 glass rounded-3xl" />}>
                <ARCameraView targetStar={selectedStar} targetAzimuth={result?.azimuth || 0} targetAltitude={result?.altitude || 0} />
              </Suspense>
            )}
          </div>

          {/* Right: Quick Info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-3xl p-6 border border-neon-purple/20 h-fit space-y-4 lg:sticky lg:top-32">
            <div className="flex items-center gap-2 mb-4">
              <Telescope className="w-5 h-5 text-neon-purple" />
              <h3 className="font-bold text-lg">{t('starFinder', 'quickInfo')}</h3>
            </div>
            <div className="bg-black/40 p-4 rounded-lg border border-white/5">
              <p className="text-gray-400 text-xs uppercase mb-1">{t('starFinder', 'selectedStar')}</p>
              <p className="text-white font-bold">{selectedStar.name}</p>
              <p className="text-gray-500 text-sm">{selectedStar.constellation}</p>
            </div>
            <div className="bg-black/40 p-4 rounded-lg border border-white/5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-gray-400">{t('starFinder', 'magnitude')}</span><span className="text-white">{selectedStar.magnitude}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-400">{t('starFinder', 'distance')}</span><span className="text-white">{selectedStar.distance} {t('starFinder', 'lightYears')}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-400">{t('starFinder', 'spectralType')}</span><span className="text-white font-mono">{selectedStar.spectralType}</span></div>
            </div>
            {result && (
              <div className="bg-gradient-to-r from-neon-purple/20 to-blue-500/20 p-4 rounded-lg border border-neon-purple/30">
                <p className="text-xs uppercase text-gray-400 mb-2">{t('starFinder', 'currentPosition')}</p>
                <p className="text-2xl font-bold text-neon-purple mb-1">{result.cardinal} <span className="text-base text-neon-purple/70">{result.point}</span></p>
                <p className="text-sm text-gray-300">{t('starFinder', 'azimuth')} {result.azimuth}° · {t('starFinder', 'altitude')} {result.altitude}°</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
