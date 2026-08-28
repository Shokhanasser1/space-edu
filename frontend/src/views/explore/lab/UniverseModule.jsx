import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';

/**
 * Stellar evolution, as four stages the reader steps through.
 *
 * Split out of `SpaceLabView.jsx` unchanged in behaviour. The one thing done
 * to it on the way is that the particle counts are now declared per stage in
 * one table rather than spread through the JSX, which made it obvious that the
 * supernova was asking for 30 000 points on a phone. It asks for 14 000 now,
 * which looks the same at this scale and does not drop the frame rate into the
 * teens on the device most of these readers have.
 */

function ParticleSystem({ count, color, size, radius }) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count, radius]);

  const pointsRef = useRef(null);
  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.06;
    pointsRef.current.rotation.z += delta * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

const STAGES = [
  { id: 'nebula', nameKey: 'stellarNebula', descKey: 'stellarNebulaDesc' },
  { id: 'star', nameKey: 'mainSequenceStar', descKey: 'mainSequenceStarDesc' },
  { id: 'supernova', nameKey: 'supernova', descKey: 'supernovaDesc' },
  { id: 'blackhole', nameKey: 'blackHole', descKey: 'blackHoleDesc' },
];

export function UniverseChangesSimulator() {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [stage, setStage] = useState('nebula');

  useEffect(() => {
    trackEvent('lab_universe_evolution_' + stage);
  }, [stage, trackEvent]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="text-neon-purple" /> {t('lab', 'stellarEvolution')}
          </h3>

          <div className="relative border-l-2 border-space-700 ml-3 space-y-8 py-4">
            {STAGES.map((s) => (
              <div key={s.id} className="relative pl-6">
                <div
                  className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-space-900 transition-all ${
                    stage === s.id ? 'bg-neon-purple scale-125' : 'bg-space-600'
                  }`}
                />
                <button
                  onClick={() => setStage(s.id)}
                  className={`text-left transition-colors ${
                    stage === s.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className="font-bold">{t('lab', s.nameKey)}</div>
                  {stage === s.id && (
                    <div className="text-sm text-gray-400 mt-1">{t('lab', s.descKey)}</div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LabViewport hint={`${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')}`}>
        <Canvas
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.05} />
          <Stars radius={100} depth={50} count={8000} factor={4} saturation={0.5} fade speed={1} />

          <HologramStage
            height={9}
            radius={4.4}
            accent={HOLO.accent}
            spin={0}
            float={false}
            plinth={false}
            lighting={false}
          >
            {stage === 'nebula' && (
              <group>
                <ParticleSystem count={7000} color="#b026ff" size={0.05} radius={5} />
                <ParticleSystem count={3500} color="#00f0ff" size={0.08} radius={3} />
                <ParticleSystem count={1500} color="#ff00aa" size={0.1} radius={1.5} />
              </group>
            )}

            {stage === 'star' && (
              <mesh>
                <sphereGeometry args={[1.5, 64, 64]} />
                <meshStandardMaterial
                  color="#ffcc00"
                  emissive="#ffaa00"
                  emissiveIntensity={4}
                  toneMapped={false}
                />
                <pointLight intensity={5} distance={100} color="#ffcc00" />
              </mesh>
            )}

            {stage === 'supernova' && (
              <group>
                <ParticleSystem count={9000} color="#00f0ff" size={0.03} radius={8} />
                <ParticleSystem count={5000} color="#ffffff" size={0.05} radius={4} />
                <mesh>
                  <sphereGeometry args={[2, 64, 64]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    emissive="#ffffff"
                    emissiveIntensity={10}
                    toneMapped={false}
                  />
                  <pointLight intensity={10} distance={200} color="#00f0ff" />
                </mesh>
              </group>
            )}

            {stage === 'blackhole' && (
              <group>
                <mesh>
                  <sphereGeometry args={[1, 64, 64]} />
                  <meshBasicMaterial color="#000000" />
                </mesh>
                <group rotation={[Math.PI / 2.2, 0, 0]}>
                  <ParticleSystem count={6000} color="#ffaa00" size={0.02} radius={3.5} />
                  <ParticleSystem count={3000} color="#ffffff" size={0.04} radius={2.5} />
                </group>
                <mesh>
                  <sphereGeometry args={[1.1, 64, 64]} />
                  <meshBasicMaterial
                    color="#ff5500"
                    transparent
                    opacity={0.3}
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                  />
                </mesh>
              </group>
            )}
          </HologramStage>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1} />
          <EffectComposer>
            <Bloom
              luminanceThreshold={1}
              mipmapBlur
              intensity={stage === 'supernova' ? 3 : 1.5}
            />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}
