import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader, AlertCircle, Maximize, Minimize } from 'lucide-react';

export default function StarFinderVisualization() {
  const canvasRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeStellariumVisualization = async () => {
      try {
        setLoading(true);
        
        // Load Stellarium web interface
        const scriptTag = document.createElement('script');
        scriptTag.src = 'https://stellarium-web.org/stellarium-web.js';
        scriptTag.async = true;
        
        scriptTag.onload = () => {
          if (window.StellariumWeb) {
            // Initialize Stellarium Web viewer
            const viewer = window.StellariumWeb.init({
              container: canvasRef.current,
              autostart: true,
              fullscreen: false,
              locationChoice: 'geolocation',
              showControlPanel: true,
              showBottomBar: true,
              showSearchBar: true,
              showDateTimePanel: true,
              showNightMode: true,
            });

            viewer.on('ready', () => {
              setLoading(false);
              console.log('✅ Stellarium Web loaded successfully');
            });

            viewer.on('error', (err) => {
              setError(`Stellarium error: ${err.message}`);
              setLoading(false);
            });
          }
        };
        
        scriptTag.onerror = () => {
          setError('Failed to load Stellarium Web');
          setLoading(false);
        };

        document.head.appendChild(scriptTag);

        return () => {
          if (scriptTag.parentNode) {
            document.head.removeChild(scriptTag);
          }
        };
      } catch (err) {
        setError(`Error: ${err.message}`);
        setLoading(false);
      }
    };

    initializeStellariumVisualization();
  }, []);

  const handleFullscreen = () => {
    if (canvasRef.current) {
      if (!isFullscreen) {
        canvasRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80 z-50"
        >
          <div className="text-center">
            <Loader className="w-12 h-12 text-neon-purple animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Loading Stellarium Web...</p>
            <p className="text-gray-400 text-sm mt-2">Real-time cosmic visualization</p>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 right-4 bg-red-500/20 border border-red-500 rounded-lg p-4 z-50 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-medium">Visualization Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Stellarium Container */}
      <div ref={canvasRef} className="w-full h-full" />

      {/* Fullscreen Button */}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-4 right-4 bg-black/60 hover:bg-neon-purple/20 border border-neon-purple/30 rounded-lg p-3 text-white transition z-40"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5" />
        ) : (
          <Maximize className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}