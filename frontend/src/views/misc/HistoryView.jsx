import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Landmark, PlayCircle, X, Compass, Telescope, Rocket, Orbit, Globe, Milestone } from 'lucide-react';
import { useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

// Icon mapping per era
const ICON_MAP = {
  'era-1': Compass,
  'era-2': Landmark,
  'era-3': Telescope,
  'era-4': Rocket,
  'era-5': Orbit,
  'era-6': Globe,
  'era-7': Milestone,
};

// Styling configurations per era
const ERA_THEMES = {
  'era-1': {
    color: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    borderColor: 'border-blue-500/30 group-hover:border-blue-500/60',
    glow: 'rgba(59,130,246,0.2)',
    text: 'text-blue-400',
    badge: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    dotGlow: 'shadow-[0_0_15px_rgba(59,130,246,0.85)] bg-blue-500',
  },
  'era-2': {
    color: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    borderColor: 'border-amber-500/30 group-hover:border-amber-500/60',
    glow: 'rgba(245,158,11,0.2)',
    text: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    dotGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.85)] bg-amber-500',
  },
  'era-3': {
    color: 'from-violet-500/20 via-purple-500/10 to-transparent',
    borderColor: 'border-violet-500/30 group-hover:border-violet-500/60',
    glow: 'rgba(139,92,246,0.2)',
    text: 'text-violet-400',
    badge: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    dotGlow: 'shadow-[0_0_15px_rgba(139,92,246,0.85)] bg-violet-500',
  },
  'era-4': {
    color: 'from-red-500/20 via-orange-500/10 to-transparent',
    borderColor: 'border-red-500/30 group-hover:border-red-500/60',
    glow: 'rgba(239,68,68,0.2)',
    text: 'text-red-400',
    badge: 'bg-red-500/10 border-red-500/30 text-red-400',
    dotGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.85)] bg-red-500',
  },
  'era-5': {
    color: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    borderColor: 'border-sky-500/30 group-hover:border-sky-500/60',
    glow: 'rgba(14,165,233,0.2)',
    text: 'text-sky-400',
    badge: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    dotGlow: 'shadow-[0_0_15px_rgba(14,165,233,0.85)] bg-sky-500',
  },
  'era-6': {
    color: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    borderColor: 'border-emerald-500/30 group-hover:border-emerald-500/60',
    glow: 'rgba(16,185,129,0.2)',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    dotGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.85)] bg-emerald-500',
  },
  'era-7': {
    color: 'from-fuchsia-500/20 via-pink-500/10 to-transparent',
    borderColor: 'border-fuchsia-500/30 group-hover:border-fuchsia-500/60',
    glow: 'rgba(217,70,239,0.2)',
    text: 'text-fuchsia-400',
    badge: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400',
    dotGlow: 'shadow-[0_0_15px_rgba(217,70,239,0.85)] bg-fuchsia-500',
  },
};

function EraCard({ era, onOpen }) {
  const { t } = useTranslation();
  const theme = ERA_THEMES[era.id] || ERA_THEMES['era-1'];
  const Icon = era.icon || Compass;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -6, scale: 1.015 }}
      onClick={() => onOpen(era)}
      className={`relative min-h-[260px] w-full max-w-[500px] overflow-hidden rounded-3xl border ${theme.borderColor} bg-white/[0.02] p-7 text-left backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04] group`}
      style={{
        boxShadow: `0 0 30px rgba(0,0,0,0.2), inset 0 0 20px rgba(255,255,255,0.01)`,
      }}
    >
      {/* Background radial glow */}
      <div 
        className="absolute inset-0 pointer-events-none bg-gradient-to-br transition-opacity duration-300 group-hover:opacity-100" 
        style={{
          background: `radial-gradient(circle at 80% 20%, ${theme.glow} 0%, transparent 60%)`,
        }}
      />
      
      <div className="relative flex h-full flex-col z-10">
        <div className="flex items-center justify-between gap-4">
          <span className={`inline-flex rounded-full border px-3.5 py-1 text-[11px] font-[800] uppercase tracking-widest ${theme.badge}`}>
            {era.period}
          </span>
          <div className={`p-2.5 rounded-2xl bg-white/5 border border-white/5 ${theme.text}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        
        <h2 className="mt-5 text-xl md:text-2xl font-[900] text-white tracking-tight group-hover:text-glow-purple transition-all duration-300">
          {era.title}
        </h2>
        
        <p className="mt-3 text-white/60 leading-relaxed text-sm md:text-base line-clamp-3 font-[400]">
          {era.summary}
        </p>
        
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
          <span className={`text-xs font-[800] uppercase tracking-widest ${theme.text} flex items-center gap-1.5 transition-transform duration-300 group-hover:translate-x-1`}>
            {t('history', 'viewMore')}
            <span className="text-[14px]">→</span>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function TimelineRow({ era, index, onOpen }) {
  const isLeft = index % 2 === 0;
  const theme = ERA_THEMES[era.id] || ERA_THEMES['era-1'];
  
  return (
    <div className="relative min-h-[300px] flex items-center">
      {/* Mobile layout */}
      <div className="md:hidden w-full pl-12 pb-8">
        {/* Animated timeline node */}
        <span className={`absolute left-[7px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-space-900 z-10 transition-transform duration-300 hover:scale-125 ${theme.dotGlow}`} />
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <EraCard era={era} onOpen={onOpen} />
        </motion.div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-12 md:w-full">
        {/* Left Side */}
        <div className="flex justify-end">
          {isLeft ? (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 80, damping: 15 }}
            >
              <EraCard era={era} onOpen={onOpen} />
            </motion.div>
          ) : (
            <div className="w-full max-w-[500px]" />
          )}
        </div>

        {/* Center dot marker */}
        <div className="relative flex items-center justify-center w-12">
          <span className={`h-5 w-5 rounded-full border-2 border-space-900 z-10 transition-transform duration-300 hover:scale-125 cursor-pointer ${theme.dotGlow}`} />
        </div>

        {/* Right Side */}
        <div className="flex justify-start">
          {!isLeft ? (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 80, damping: 15 }}
            >
              <EraCard era={era} onOpen={onOpen} />
            </motion.div>
          ) : (
            <div className="w-full max-w-[500px]" />
          )}
        </div>
      </div>
    </div>
  );
}

function MediaItem({ item, onImageOpen }) {
  const { t } = useTranslation();
  
  if (item.type === 'image' && item.src) {
    return (
      <button
        type="button"
        onClick={() => onImageOpen({ src: item.src, alt: item.alt || t('history', 'historicalImage') })}
        className="group relative h-60 md:h-72 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 transition-all duration-300 hover:border-violet-500/40"
      >
        <img
          src={item.src}
          alt={item.alt || t('history', 'historicalImage')}
          className="h-full w-full object-cover rounded-xl transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <span className="text-white/90 text-xs font-[800] uppercase tracking-wider">
            {t('history', 'viewMore')}
          </span>
        </div>
      </button>
    );
  }

  if (item.type === 'video') {
    return (
      <div className="h-56 w-full rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col justify-between shadow-[0_0_20px_rgba(139,92,246,0.05)]">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-10 w-10 text-violet-400 shrink-0" />
          <div>
            <p className="font-[800] text-white/90">{item.title || t('history', 'videoBlock')}</p>
            <p className="text-sm text-white/40">{t('history', 'videoPlaceholder')}</p>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/20 font-bold self-end">
          Ready for Video Embed
        </div>
      </div>
    );
  }

  return (
    <div className="h-56 w-full rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex items-center justify-center text-center text-white/40 text-sm">
      {item.title || t('history', 'imagePlaceholder')}
    </div>
  );
}

export default function HistoryView() {
  const { t } = useTranslation();
  const [activeEra, setActiveEra] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const containerRef = useRef(null);

  // Scroll tracking for growing timeline line
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 50, damping: 18, restDelta: 0.001 });

  // Array of 7 eras using our localized json translations
  const eras = [
    {
      id: 'era-1',
      title: t('history', 'era1.title'),
      period: t('history', 'era1.period'),
      summary: t('history', 'era1.summary'),
      details: t('history', 'era1.details'),
      icon: ICON_MAP['era-1'],
      media: [
        { type: 'image', src: '/history-step1/ancient-obelisk.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/misr-olchovlari.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/bobil-ink-rasadxona.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/yunon-geosentrik.png', alt: t('history', 'historicalImage') },
      ],
    },
    {
      id: 'era-2',
      title: t('history', 'era2.title'),
      period: t('history', 'era2.period'),
      summary: t('history', 'era2.summary'),
      details: t('history', 'era2.details'),
      icon: ICON_MAP['era-2'],
      media: [
        { type: 'image', src: '/history-step1/ulughbeg-observatory.jpg', alt: 'Samarkand Observatory of Mirzo Ulugh Beg' },
      ],
    },
    {
      id: 'era-3',
      title: t('history', 'era3.title'),
      period: t('history', 'era3.period'),
      summary: t('history', 'era3.summary'),
      details: t('history', 'era3.details'),
      icon: ICON_MAP['era-3'],
      media: [
        { type: 'image', src: '/history-step1/hans-lipperhey.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/telescope-1608.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/moon-sketches-bw.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/galileo-notes-moon.png', alt: t('history', 'historicalImage') },
      ],
    },
    {
      id: 'era-4',
      title: t('history', 'era4.title'),
      period: t('history', 'era4.period'),
      summary: t('history', 'era4.summary'),
      details: t('history', 'era4.details'),
      icon: ICON_MAP['era-4'],
      media: [
        { type: 'image', src: '/history-step1/sputnik-1.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/laika-dog.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/gagarin-flight.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/luna-spacecraft.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/valentina-tereshkova.png', alt: t('history', 'historicalImage') },
      ],
    },
    {
      id: 'era-5',
      title: t('history', 'era5.title'),
      period: t('history', 'era5.period'),
      summary: t('history', 'era5.summary'),
      details: t('history', 'era5.details'),
      icon: ICON_MAP['era-5'],
      media: [
        { type: 'image', src: '/history-step1/apollo11-moonwalk.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/venus-lander-model.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/voyager-artwork.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/venera-lander.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/mars-rover-lab.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/shuttle-launch.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/iss-orbit.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/hubble-space.png', alt: t('history', 'historicalImage') },
        { type: 'image', src: '/history-step1/ariane-launch.png', alt: t('history', 'historicalImage') },
      ],
    },
    {
      id: 'era-6',
      title: t('history', 'era6.title'),
      period: t('history', 'era6.period'),
      summary: t('history', 'era6.summary'),
      details: t('history', 'era6.details'),
      icon: ICON_MAP['era-6'],
      media: [
        { type: 'image', src: '/history-step1/spacex-falcon1-rocket.png', alt: t('history', 'historicalImage') },
        { type: 'video', title: 'SpaceX Falcon landing' },
      ],
    },
    {
      id: 'era-7',
      title: t('history', 'era7.title'),
      period: t('history', 'era7.period'),
      summary: t('history', 'era7.summary'),
      details: t('history', 'era7.details'),
      icon: ICON_MAP['era-7'],
      media: [
        { type: 'image', src: '/history-step1/iss-orbit.png', alt: 'Future space operations' },
        { type: 'video', title: 'Mars colony concept' },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-32 pb-24 bg-space-900">
      {/* Decorative stars and nebula glows */}
      <div
        className="fixed top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full blur-[150px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }}
      />
      <div
        className="fixed bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full blur-[150px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-md"
            style={{ boxShadow: '0 0 40px rgba(139,92,246,0.1)' }}
          >
            <Orbit className="h-10 w-10 text-violet-light animate-spin-slow" style={{ animationDuration: '20s' }} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-[clamp(36px,6vw,56px)] font-[900] tracking-tight text-white leading-none"
          >
            {t('history', 'title')} <span className="text-glow-purple text-violet-light">{t('history', 'titleHighlight')}</span>
          </motion.h1>
          <p className="mx-auto max-w-xl text-white/40 text-base md:text-lg">
            {t('history', 'subtitle')}
          </p>
        </div>

        {/* Timeline Container */}
        <div ref={containerRef} className="relative space-y-4">
          {/* Static timeline line container (background) */}
          <div className="absolute top-0 bottom-0 left-[16px] md:left-1/2 md:-translate-x-1/2 w-0.5 bg-white/5 rounded-full" />
          
          {/* Animated timeline progress line (grows on scroll) */}
          <motion.div
            style={{ scaleY }}
            className="absolute top-0 bottom-0 left-[15px] md:left-1/2 md:-translate-x-1/2 w-[3px] rounded-full bg-gradient-to-b from-neon-blue via-violet to-neon-pink origin-top shadow-[0_0_15px_rgba(56,189,248,0.45)]"
          />

          {eras.map((era, index) => (
            <TimelineRow key={era.id} era={era} index={index} onOpen={setActiveEra} />
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {activeEra && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
            onClick={() => {
              setSelectedImage(null);
              setActiveEra(null);
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="bg-space-800 border border-white/10 w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 md:p-10 shadow-[0_0_60px_rgba(139,92,246,0.15)] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setActiveEra(null);
                }}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Header */}
              <div className="mb-8 pr-12">
                <span className="mb-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-[11px] font-[800] uppercase tracking-widest text-violet-light">
                  {activeEra.period}
                </span>
                <h2 className="text-2xl md:text-4xl font-[900] text-white tracking-tight leading-none mt-1">
                  {activeEra.title}
                </h2>
              </div>

              {/* Details Paragraph */}
              <div className="mb-10 text-white/70 leading-relaxed md:text-lg whitespace-pre-line text-sm md:text-base border-l-2 border-violet/30 pl-4 py-1">
                {activeEra.details}
              </div>

              {/* Media Section */}
              {activeEra.media && activeEra.media.length > 0 && (
                <div>
                  <h3 className="text-xs font-[800] uppercase tracking-widest text-white/30 mb-5">
                    {t('history', 'historicalImage')} & Media
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {activeEra.media.map((item, idx) => (
                      <MediaItem key={`${activeEra.id}-media-${idx}`} item={item} onImageOpen={setSelectedImage} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Inner Full Image Preview Modal */}
            <AnimatePresence>
              {selectedImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-lg p-4 md:p-8 flex items-center justify-center"
                  onClick={() => setSelectedImage(null)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute right-6 top-6 rounded-xl border border-white/20 bg-black/50 p-2.5 text-white/80 hover:text-white hover:bg-black/75 transition-all"
                    aria-label="Close image preview"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex h-full w-full items-center justify-center p-2">
                    <img
                      src={selectedImage.src}
                      alt={selectedImage.alt}
                      className="max-h-[90vh] max-w-[95vw] rounded-2xl border border-white/10 bg-black/35 object-contain shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

