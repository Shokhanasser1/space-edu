import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { eqjToEcliptic } from '../ephemeris';
import { eclipticToScene } from '../scale';
import { STAR_FRAGMENT, STAR_VERTEX } from './shaders';

/**
 * The real sky: the 9 096 stars of the Yale Bright Star Catalogue, placed by
 * their J2000 coordinates and drawn by magnitude and colour. Orion is where
 * Orion is, and a class looking past Mars sees the constellations Mars is
 * actually in tonight. The old scene was 15 000 random points.
 */

const DATA_URL = '/data/stars-bsc5.json';
const RADIUS = 20000;

/** B−V colour index → approximate RGB (blue-white to orange-red). */
function tintFor(bv) {
  const t = Math.min(1, Math.max(0, (bv + 0.3) / 1.9));
  const r = 0.62 + 0.38 * Math.min(1, t * 1.6);
  const g = 0.72 + 0.28 * (1 - Math.abs(t - 0.45) * 1.6);
  const b = 1 - 0.55 * Math.max(0, t - 0.35) * 1.5;
  return [Math.min(1, r), Math.min(1, Math.max(0.55, g)), Math.min(1, Math.max(0.35, b))];
}

function buildGeometry(stars) {
  const n = stars.length;
  const position = new Float32Array(n * 3);
  const mag = new Float32Array(n);
  const tint = new Float32Array(n * 3);
  const eqj = [0, 0, 0];
  const ecl = [0, 0, 0];
  const scene = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const [ra, dec, v, bv] = stars[k];
    const raR = (ra * Math.PI) / 180;
    const decR = (dec * Math.PI) / 180;
    eqj[0] = Math.cos(decR) * Math.cos(raR);
    eqj[1] = Math.cos(decR) * Math.sin(raR);
    eqj[2] = Math.sin(decR);
    eqjToEcliptic(eqj, ecl);
    eclipticToScene(ecl, RADIUS, scene);
    position[k * 3] = scene[0];
    position[k * 3 + 1] = scene[1];
    position[k * 3 + 2] = scene[2];
    mag[k] = v;
    const c = tintFor(bv);
    tint[k * 3] = c[0];
    tint[k * 3 + 1] = c[1];
    tint[k * 3 + 2] = c[2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  return geometry;
}

export default function StarField({ visible = true }) {
  const [stars, setStars] = useState(null);
  const dpr = useThree((s) => s.viewport.dpr);

  useEffect(() => {
    let alive = true;
    if (typeof fetch !== 'function') return undefined;
    fetch(DATA_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.stars) setStars(d.stars);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const geometry = useMemo(() => (stars ? buildGeometry(stars) : null), [stars]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  uniforms.pixelRatio.value = dpr;

  if (!geometry) return null;
  return (
    <points geometry={geometry} visible={visible} frustumCulled={false}>
      <shaderMaterial
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
