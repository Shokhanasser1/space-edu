import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, MapPin, Search, Star, Info, Eye, ChevronRight, ChevronLeft, Telescope, Orbit, BookOpen, Bell, Camera, Layers, ChevronDown, ZoomIn, ZoomOut, Loader } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

// Lazy load heavy components
const StarCanvas3D = React.lazy(() => import('./StarCanvas3D'));
const ARCameraView = React.lazy(() => import('./ARCameraView'));

// Optimized star database with NASA precision
const STARS_DATABASE = [
  { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', ra: 101.287, dec: -16.716, magnitude: -1.46, distance: 8.6, spectralType: 'A0V', story: 'The brightest star in Earth\'s night sky, also known as the "Dog Star". In ancient Egypt, its heliacal rising marked the beginning of the year.', images: ['/images/stars/sirius.webp'], visibilityScore: 10, bestSeason: 'Winter', recommendedTime: '10:00 PM - Midnight' },
  { id: 'canopus', name: 'Canopus', constellation: 'Carina', ra: 95.987, dec: -52.696, magnitude: -0.74, distance: 310, spectralType: 'A9Ib', story: 'Second brightest star, visible only from Southern Hemisphere. A supergiant with incredible luminosity.', images: ['/images/stars/canopus.webp'], visibilityScore: 8, bestSeason: 'Winter', recommendedTime: '10:00 PM' },
  { id: 'arcturus', name: 'Arcturus', constellation: 'Boötes', ra: 213.915, dec: 19.183, magnitude: -0.05, distance: 36.7, spectralType: 'K1.5III', story: 'Guardian of the Bear, brightest star in Northern celestial hemisphere. Part of Spring sky.', images: ['/images/stars/arcturus.webp'], visibilityScore: 9, bestSeason: 'Spring', recommendedTime: '9:00 PM - 1:00 AM' },
  { id: 'vega', name: 'Vega', constellation: 'Lyra', ra: 279.234, dec: 38.784, magnitude: 0.03, distance: 25, spectralType: 'A0V', story: 'Fifth brightest star. In Chinese mythology, Vega is the Weaver Girl separated from her lover by the Milky Way.', images: ['/images/stars/vega.webp'], visibilityScore: 7, bestSeason: 'Summer', recommendedTime: '11:00 PM - 3:00 AM' },
  { id: 'capella', name: 'Capella', constellation: 'Auriga', ra: 79.172, dec: 45.998, magnitude: 0.08, distance: 42.9, spectralType: 'G3III', story: 'The Goat star, sixth brightest. A quadruple star system representing Amalthea from Greek mythology.', images: ['/images/stars/capella.webp'], visibilityScore: 8, bestSeason: 'Winter', recommendedTime: '8:00 PM - Midnight' },
  { id: 'rigel', name: 'Rigel', constellation: 'Orion', ra: 78.634, dec: 8.202, magnitude: 0.13, distance: 860, spectralType: 'B8Ia', story: 'Blue supergiant marking Orion\'s left foot. Extraordinarily luminous despite being 860 light-years away.', images: ['/images/stars/rigel.webp'], visibilityScore: 8, bestSeason: 'Winter', recommendedTime: '9:00 PM - 1:00 AM' },
  { id: 'procyon', name: 'Procyon', constellation: 'Canis Minor', ra: 114.829, dec: 5.225, magnitude: 0.40, distance: 11.46, spectralType: 'F5IV', story: 'The "Dog before the Dog", eighth brightest star. Precedes Sirius across the night sky.', images: ['/images/stars/procyon.webp'], visibilityScore: 7, bestSeason: 'Winter', recommendedTime: '9:00 PM - Midnight' },
  { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orion', ra: 88.793, dec: 7.407, magnitude: 0.45, distance: 548, spectralType: 'M1Ia', story: 'Red supergiant at Orion\'s shoulder. May explode as a supernova within the next 100,000 years.', images: ['/images/stars/betelgeuse.webp'], visibilityScore: 9, bestSeason: 'Winter', recommendedTime: '8:30 PM - 11:00 PM' },
  { id: 'altair', name: 'Altair', constellation: 'Aquila', ra: 297.696, dec: 8.868, magnitude: 0.77, distance: 16.7, spectralType: 'A7V', story: 'The Cowherd in Chinese folklore, separated from Vega by the Milky Way. Rotates extremely rapidly.', images: ['/images/stars/altair.webp'], visibilityScore: 8, bestSeason: 'Summer', recommendedTime: '10:00 PM - 2:00 AM' },
  { id: 'polaris', name: 'Polaris', constellation: 'Ursa Minor', ra: 37.954, dec: 89.264, magnitude: 1.98, distance: 433, spectralType: 'F7Ib', story: 'The North Star. Has guided navigators for centuries. Nearly aligned with Earth\'s rotation axis.', images: ['/images/stars/polaris.webp'], visibilityScore: 8, bestSeason: 'Year-round', recommendedTime: '9:00 PM - 2:00 AM' },
];

function CustomSelect({ value, onChange, options, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find(opt => opt.value === value);

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
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState('finder');
  const [stars, setStars] = useState(STARS_DATABASE);
  const [selectedStar, setSelectedStar] = useState(STARS_DATABASE[0]);
  const [userLocation, setUserLocation] = useState({ lat: 41.2995, lon: 69.2401 });
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  // The catalogue above is the sky this page draws.
  //
  // There used to be a poll here, every thirty seconds for as long as the page
  // was open. It asked `${VITE_API_URL}/api/stars/visible_now/`, which resolves
  // to /api/v1/api/stars/ — the prefix twice over — against a Django app that
  // was never wired into INSTALLED_APPS and had no urls, no views and no
  // __init__.py. Nothing answered it, so nothing is lost by taking it out.
  useEffect(() => {
    setLoading(false);
  }, [userLocation]);

  // Calculate position
  const handleFindStar = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const star = selectedStar;
      const lat = userLocation.lat * Math.PI / 180;
      const lon = userLocation.lon * Math.PI / 180;
      const ra = star.ra * Math.PI / 180;
      const dec = star.dec * Math.PI / 180;
      const now = new Date();
      const jd = 367*now.getUTCFullYear() - Math.floor(7*(now.getUTCFullYear() + Math.floor((now.getUTCMonth()+9)/12))/4) + Math.floor(275*now.getUTCMonth()/9) + now.getUTCDate() + 1721013.5;
      const t = (jd - 2451545.0) / 36525.0;
      const gmst = 67310.54841 + (876600.0*3600.0 + 8640184.812866)*t + 0.093104*t*t - 6.2e-6*t*t*t;
      const gst = (gmst % 86400) / 240.0;
      const ha = Math.PI/180 * (gst - userLocation.lon - star.ra);
      const sinAlt = Math.sin(dec)*Math.sin(lat) + Math.cos(dec)*Math.cos(lat)*Math.cos(ha);
      const alt = Math.asin(sinAlt) * 180 / Math.PI;
      const cosAz = (Math.sin(dec) - sinAlt*Math.sin(lat)) / (Math.cos(Math.asin(sinAlt))*Math.cos(lat));
      const sinAz = -Math.sin(ha)*Math.cos(dec) / Math.cos(Math.asin(sinAlt));
      const az = Math.atan2(sinAz, cosAz) * 180 / Math.PI % 360;
      const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      const direction = dirs[Math.round(az / 22.5) % 16];
      setResult({ azimuth: Math.round(az), altitude: Math.round(alt * 10) / 10, direction });
      setIsCalculating(false);
    }, 800);
  };

  const handleRemindMe = () => {
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 3000);
  };

  const nextImage = () => {
    if (selectedStar?.images) {
      setCurrentImageIndex((prev) => (prev + 1) % selectedStar.images.length);
    }
  };

  const prevImage = () => {
    if (selectedStar?.images) {
      setCurrentImageIndex((prev) => (prev - 1 + selectedStar.images.length) % selectedStar.images.length);
    }
  };

  const starOptions = stars.map(s => ({ value: s.id, label: `${s.name} (${s.constellation})` }));

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gradient-to-b from-black via-black to-black/80">
      {/* Toast */}
      <AnimatePresence>
        {showReminderToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md"
          >
            <Bell className="w-5 h-5" /> Reminder set for {selectedStar?.recommendedTime}!
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
          className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-neon-purple via-blue-400 to-purple-500 bg-clip-text text-transparent"
        >
          Stellarium Finder
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-300 text-lg"
        >
          Real-time cosmic navigation • {stars.length} stars available
        </motion.p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="glass p-1 rounded-2xl inline-flex">
          {[{ id: 'finder', label: 'Finder', icon: Search }, { id: '3d', label: '3D Map', icon: Telescope }, { id: 'ar', label: 'AR View', icon: Camera }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-neon-purple text-black shadow-lg shadow-neon-purple/50' : 'text-gray-400 hover:text-white'}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
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
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" /> Star
                  </label>
                  <CustomSelect
                    value={selectedStar.id}
                    onChange={(val) => {
                      const star = stars.find(s => s.id === val);
                      if (star) setSelectedStar(star);
                      setResult(null);
                    }}
                    options={starOptions}
                  />
                </div>
                <div className="md:col-span-2 flex gap-4 items-end">
                  <button
                    onClick={handleFindStar}
                    disabled={isCalculating}
                    className="flex-1 bg-gradient-to-r from-neon-purple to-blue-500 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCalculating ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    {isCalculating ? 'Calculating...' : 'Calculate Position'}
                  </button>
                </div>
              </div>

              {/* 3D Canvas */}
              {activeTab === '3d' && loading ? (
                <div className="w-full h-[500px] glass rounded-2xl flex items-center justify-center">
                  <Loader className="w-12 h-12 text-neon-purple animate-spin" />
                </div>
              ) : activeTab === '3d' ? (
                <Suspense fallback={<div className="w-full h-[500px] bg-black/40 rounded-2xl" />}>
                  <StarCanvas3D stars={stars} zoom={zoom} />
                </Suspense>
              ) : null}

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
                          key={currentImageIndex}
                          src={selectedStar?.images?.[currentImageIndex]}
                          alt={selectedStar?.name}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full object-cover"
                        />
                      </AnimatePresence>
                      <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-neon-purple transition">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-neon-purple transition">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="bg-gradient-to-br from-neon-purple/10 to-transparent p-6 rounded-2xl border border-neon-purple/20">
                      <div className="flex items-center gap-3 mb-3">
                        <BookOpen className="w-5 h-5 text-neon-purple" />
                        <h4 className="text-white font-bold">Story</h4>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed italic">"{selectedStar?.story}"</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-4xl font-bold text-white mb-2">{selectedStar?.name}</h3>
                      <p className="text-neon-purple text-lg flex items-center gap-2">
                        <Star className="w-5 h-5" /> {selectedStar?.constellation}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Visibility</div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-white">{selectedStar?.visibilityScore}</span>
                          <span className="text-gray-500 mb-1">/10</span>
                        </div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Best Time</div>
                        <div className="text-lg font-bold text-white">{selectedStar?.recommendedTime}</div>
                      </div>
                    </div>

                    {/* Position */}
                    <div className="bg-gradient-to-r from-black/40 to-black/60 border border-neon-purple/30 p-6 rounded-2xl">
                      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                        <MapPin className="w-5 h-5 text-neon-purple" />
                        <span className="text-gray-300 font-medium">Position from {userLocation.lat.toFixed(2)}°, {userLocation.lon.toFixed(2)}°</span>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Direction</div>
                          <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-neon-purple">{result.direction}</span>
                            <span className="text-gray-500 mb-1">{result.azimuth}°</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Altitude</div>
                          <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-neon-purple">{result.altitude}°</span>
                            <span className="text-gray-500 mb-1">up</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleRemindMe}
                        className="w-full mt-4 py-2 bg-white/10 hover:bg-neon-purple/20 text-white font-medium rounded-lg border border-white/10 transition flex items-center justify-center gap-2"
                      >
                        <Bell className="w-4 h-4" /> Set Reminder
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
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-3xl p-6 border border-neon-purple/20 h-fit space-y-4 sticky top-32">
          <div className="flex items-center gap-2 mb-4">
            <Telescope className="w-5 h-5 text-neon-purple" />
            <h3 className="font-bold text-lg">Quick Info</h3>
          </div>
          {selectedStar && (
            <>
              <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                <p className="text-gray-400 text-xs uppercase mb-1">Selected Star</p>
                <p className="text-white font-bold">{selectedStar.name}</p>
                <p className="text-gray-500 text-sm">{selectedStar.constellation}</p>
              </div>
              <div className="bg-black/40 p-4 rounded-lg border border-white/5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Magnitude:</span><span className="text-white">{selectedStar.magnitude}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Distance:</span><span className="text-white">{selectedStar.distance} ly</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Type:</span><span className="text-white font-mono">{selectedStar.spectralType}</span></div>
              </div>
              {result && (
                <div className="bg-gradient-to-r from-neon-purple/20 to-blue-500/20 p-4 rounded-lg border border-neon-purple/30">
                  <p className="text-xs uppercase text-gray-400 mb-2">Current Position</p>
                  <p className="text-2xl font-bold text-neon-purple mb-1">{result.direction}</p>
                  <p className="text-sm text-gray-300">Az: {result.azimuth}° Alt: {result.altitude}°</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
