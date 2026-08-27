import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { msToJd, simClock } from '../clock';
import { KEPLER_GLSL, meanMotionDegPerDay } from '../kepler';
import { AU_UNITS } from '../scale';
import { SMALL_BODY_FRAGMENT, SMALL_BODY_VERTEX_HEAD, SMALL_BODY_VERTEX_MAIN } from './shaders';

/**
 * The asteroid belt and the Kuiper belt, from real orbital elements.
 *
 * `public/data/small-bodies.json` holds 2 500 main-belt asteroids and 1 100
 * trans-Neptunian objects sampled from JPL's Small-Body Database. Each vertex
 * carries its own elements and the vertex shader solves Kepler's equation for
 * the current date, so scrubbing time moves 3 600 bodies with no JavaScript
 * per frame — the old belt was 3 000 random ellipses updated on the CPU and
 * ignored the date.
 */

const DEG = Math.PI / 180;
const DATA_URL = '/data/small-bodies.json';

let dataPromise = null;
function loadData() {
  if (!dataPromise) {
    dataPromise = (typeof fetch === 'function' ? fetch(DATA_URL) : Promise.reject(new Error('no fetch')))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return dataPromise;
}

function buildGeometry(rows) {
  const n = rows.length;
  const position = new Float32Array(n * 3);
  const elems1 = new Float32Array(n * 4);
  const elems2 = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const [a, e, i, om, w, ma] = rows[k];
    elems1[k * 4] = a;
    elems1[k * 4 + 1] = e;
    elems1[k * 4 + 2] = i * DEG;
    elems1[k * 4 + 3] = om * DEG;
    elems2[k * 4] = w * DEG;
    elems2[k * 4 + 1] = ma * DEG;
    elems2[k * 4 + 2] = meanMotionDegPerDay(a) * DEG;
    // A deterministic spread of dot sizes; no Math.random so frames repeat.
    elems2[k * 4 + 3] = 0.6 + ((k * 7919) % 97) / 97;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('elems1', new THREE.BufferAttribute(elems1, 4));
  geometry.setAttribute('elems2', new THREE.BufferAttribute(elems2, 4));
  // Positions are computed in the shader; tell three the cloud fills the belt.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 120 * AU_UNITS);
  return geometry;
}

export default function SmallBodies({ set = 'mainBelt', color = '#9c9284', visible = true }) {
  const [data, setData] = useState(null);
  const materialRef = useRef();
  const dpr = useThree((s) => s.viewport.dpr);

  useEffect(() => {
    let alive = true;
    loadData().then((d) => {
      if (alive && d) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const geometry = useMemo(() => (data?.[set] ? buildGeometry(data[set]) : null), [data, set]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uDays: { value: 0 },
      uAU: { value: AU_UNITS },
      pixelRatio: { value: 1 },
      color: { value: new THREE.Color(color) },
    }),
    [color],
  );
  uniforms.pixelRatio.value = dpr;

  useFrame(() => {
    if (!data) return;
    uniforms.uDays.value = msToJd(simClock.ms) - data.epochJd;
  });

  if (!geometry) return null;
  return (
    <points geometry={geometry} visible={visible} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={`${SMALL_BODY_VERTEX_HEAD}${KEPLER_GLSL}${SMALL_BODY_VERTEX_MAIN}`}
        fragmentShader={SMALL_BODY_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
