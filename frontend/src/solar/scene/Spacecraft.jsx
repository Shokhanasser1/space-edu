import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BODIES, SPACECRAFT } from '../catalog';
import { msToJd, simClock, useSolarStore } from '../clock';
import { getRadius, getWorld, setWorld } from '../positions';
import { AU_UNITS, eclipticToScene } from '../scale';
import { dotTexture } from './dot';

/**
 * Deep-space probes on their real trajectories.
 *
 * JPL Horizons knows where Voyager 1 is to the kilometre; our backend asks it
 * once a day for a window of positions (`/api/v1/space/ephemeris/`) and the
 * page interpolates. Outside the fetched window the marker hides rather than
 * guess — a probe drawn in the wrong place is worse than no probe.
 *
 * Each probe is NASA's own model (VTAD, public domain; Draco-compressed to a
 * few hundred kilobytes), drawn at a constant angular size: a four-metre
 * spacecraft at true scale is a millionth of a pixel, so the model is scaled
 * with the camera distance and reads as a labelled icon that grows into the
 * real thing when you fly to it. A failed model load leaves the dot.
 */

const modelCache = new Map();
let loader = null;

function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  }
  return loader;
}

/** Loads once per URL and hands back a normalised template (radius 1). */
function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(
      url,
      new Promise((resolve) => {
        getLoader().load(
          url,
          (gltf) => {
            const scene = gltf.scene;
            const box = new THREE.Box3().setFromObject(scene);
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            const k = sphere.radius > 0 ? 1 / sphere.radius : 1;
            const holder = new THREE.Group();
            scene.position.sub(sphere.center);
            holder.add(scene);
            holder.scale.setScalar(k);
            resolve(holder);
          },
          undefined,
          () => resolve(null),
        );
      }),
    );
  }
  return modelCache.get(url);
}

function interpolate(samples, jd, out) {
  const n = samples.length;
  if (!n || jd < samples[0][0] || jd > samples[n - 1][0]) return false;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= jd) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = hi === lo ? 0 : (jd - a[0]) / (b[0] - a[0]);
  out[0] = a[1] + (b[1] - a[1]) * t;
  out[1] = a[2] + (b[2] - a[2]) * t;
  out[2] = a[3] + (b[3] - a[3]) * t;
  return true;
}

function Probe({ craft, track, selected, onSelect }) {
  const groupRef = useRef();
  const modelRef = useRef();
  const camera = useThree((s) => s.camera);
  const [model, setModel] = useState(null);
  const ecl = useMemo(() => [0, 0, 0], []);
  const scene = useMemo(() => [0, 0, 0], []);
  const trail = useMemo(
    () => track.samples.map((s) => {
      eclipticToScene([s[1], s[2], s[3]], AU_UNITS, scene);
      return [scene[0], scene[1], scene[2]];
    }),
    [track, scene],
  );

  useEffect(() => {
    if (!craft.model) return undefined;
    let alive = true;
    loadModel(craft.model).then((template) => {
      if (alive && template) setModel(template.clone());
    });
    return () => {
      alive = false;
    };
  }, [craft.model]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const ok = interpolate(track.samples, msToJd(simClock.ms), ecl);
    g.visible = ok;
    if (!ok) return;
    eclipticToScene(ecl, AU_UNITS, scene);
    g.position.set(scene[0], scene[1], scene[2]);
    // At visual scale a planet is drawn hundreds of times too large, so an
    // orbiter (Juno is 0.02 units from Jupiter's centre) would be inside it.
    // Keep the real direction, push it just outside the drawn sphere — the
    // same compromise the moons make. True scale leaves it alone.
    if (useSolarStore.getState().scaleMode !== 'true') {
      for (const body of BODIES) {
        const bp = getWorld(body.id);
        const br = getRadius(body.id);
        if (!bp || br === 0) continue;
        const d = g.position.distanceTo(bp);
        if (d < br * 1.25) {
          if (d < 1e-6) g.position.set(bp.x + br * 1.25, bp.y, bp.z);
          else g.position.sub(bp).multiplyScalar((br * 1.25) / d).add(bp);
          break;
        }
      }
    }
    setWorld(craft.id, g.position, 0);
    if (modelRef.current && camera) {
      const dist = camera.position.distanceTo(g.position);
      modelRef.current.scale.setScalar(dist * (selected ? 0.1 : 0.014));
      modelRef.current.rotation.y += dt * 0.15;
    }
  });

  const select = (e) => {
    e.stopPropagation();
    onSelect?.(craft.id);
  };

  return (
    <group>
      {trail.length > 1 && <Line points={trail} color={craft.color} lineWidth={1} transparent opacity={0.45} depthWrite={false} />}
      <group ref={groupRef}>
        {model ? (
          <group ref={modelRef} onClick={select}>
            <primitive object={model} />
          </group>
        ) : (
          <sprite scale={[0.022, 0.022, 1]} onClick={select}>
            <spriteMaterial map={dotTexture()} color={craft.color} sizeAttenuation={false} depthWrite={false} transparent toneMapped={false} />
          </sprite>
        )}
      </group>
    </group>
  );
}

export default function Spacecraft({ enabled, onSelect }) {
  const [tracks, setTracks] = useState({});
  const setCraftStatus = useSolarStore((s) => s.setCraftStatus);
  const selectedId = useSolarStore((s) => s.selectedId);

  useEffect(() => {
    if (!enabled || typeof fetch !== 'function') return undefined;
    let alive = true;
    setCraftStatus('loading');
    // One probe at a time: six simultaneous Horizons queries from every
    // browser is a burst JPL does not need, and the backend caches each for a day.
    (async () => {
      const next = {};
      for (const c of SPACECRAFT) {
        try {
          const r = await fetch(`/api/v1/space/ephemeris/?body=${encodeURIComponent(c.id)}&days=60`);
          if (!r.ok) continue;
          const body = await r.json();
          if (body?.samples?.length > 1) next[c.id] = body;
        } catch {
          // Skip the probe; the layer shows what it could get.
        }
        if (!alive) return;
      }
      setTracks(next);
      setCraftStatus(Object.keys(next).length ? 'ready' : 'error');
    })();
    return () => {
      alive = false;
    };
  }, [enabled, setCraftStatus]);

  if (!enabled) return null;
  return (
    <group>
      {SPACECRAFT.filter((c) => tracks[c.id]).map((c) => (
        <Probe key={c.id} craft={c} track={tracks[c.id]} selected={selectedId === c.id} onSelect={onSelect} />
      ))}
    </group>
  );
}
