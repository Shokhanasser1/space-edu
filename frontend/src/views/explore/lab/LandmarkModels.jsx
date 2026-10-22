import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { BASE_Y, SCALE } from './SaturnVModel';

/**
 * The things that stand beside the Saturn V, as models rather than outlines.
 *
 * Heights are exact (labFacts names the source of each); shapes are
 * simplified but recognisable, and coloured as the real things are: the
 * Statue of Liberty in oxidised copper on its granite pedestal and star-shaped
 * fort, Tashkent's TV tower in steel with its three splayed legs, blue-glazed
 * observation deck and red-and-white mast, a 36-storey office block with its
 * windows. The page says the shapes are simplified.
 *
 * All sizes are in metres and scaled by SCALE; every model stands on the same
 * ground as the rocket.
 *
 * The Statue of Liberty and the TV tower prefer real, artist-made models
 * (CC BY, from Sketchfab; authors and links in public/models/landmarks/
 * ATTRIBUTION.md and on the page). They are fetched from this site, scaled
 * to the true height, and stood on the ground. Until one has loaded - or if
 * it is missing - the hand-built model below is shown instead, so the
 * comparison never has a hole in it.
 */

/** The artist-made models, served from this site, Draco-compressed. */
export const LANDMARK_MODELS = {
  liberty: '/models/landmarks/statue-of-liberty.glb',
  tower: '/models/landmarks/tashkent-tv-tower.glb',
};

/** Loaded scenes, kept for the visit so switching comparisons is instant. */
const SCENE_CACHE = new Map();

function loadLandmark(url) {
  if (!SCENE_CACHE.has(url)) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    SCENE_CACHE.set(
      url,
      loader.loadAsync(url).then(
        (gltf) => gltf.scene,
        (error) => {
          SCENE_CACHE.delete(url);
          throw error;
        },
      ),
    );
  }
  return SCENE_CACHE.get(url);
}

/**
 * An artist-made model scaled so its height is `heightM`, its base on y = 0
 * and centred on the axis; `fallback` is drawn until it arrives or if it
 * cannot be had. `turn` spins it about the vertical axis to face the camera.
 */
function GltfLandmark({ url, heightM, fallback, turn = 0 }) {
  const [scene, setScene] = useState(null);

  useEffect(() => {
    let live = true;
    loadLandmark(url)
      .then((loaded) => {
        if (live) setScene(loaded);
      })
      .catch(() => {
        // Missing or unreadable: keep the hand-built model.
      });
    return () => {
      live = false;
    };
  }, [url]);

  const placed = useMemo(() => {
    if (!scene) return null;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const factor = size.y > 0 ? (heightM * SCALE) / size.y : 1;
    const centre = box.getCenter(new THREE.Vector3());
    return {
      scale: factor,
      position: [-centre.x * factor, -box.min.y * factor, -centre.z * factor],
    };
  }, [scene, heightM]);

  if (!scene || !placed) return fallback;
  return (
    <group rotation={[0, turn, 0]}>
      <group position={placed.position} scale={placed.scale}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

const s = SCALE;

function Stone({ color, roughness = 0.85, metalness = 0 }) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />;
}

/** A cylinder between two points, for limbs and legs. */
function Strut({ from, to, radiusTop, radiusBottom = radiusTop, children }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return (
    <mesh position={mid.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[radiusTop, radiusBottom, length, 12]} />
      {children}
    </mesh>
  );
}

function Person() {
  return (
    <group>
      <Strut from={[-0.12 * s, 0, 0]} to={[-0.1 * s, 0.85 * s, 0]} radiusTop={0.07 * s}>
        <Stone color="#2d3748" />
      </Strut>
      <Strut from={[0.12 * s, 0, 0]} to={[0.1 * s, 0.85 * s, 0]} radiusTop={0.07 * s}>
        <Stone color="#2d3748" />
      </Strut>
      <mesh position={[0, 1.2 * s, 0]}>
        <cylinderGeometry args={[0.2 * s, 0.17 * s, 0.7 * s, 12]} />
        <Stone color="#2f6fb0" />
      </mesh>
      <mesh position={[0, 1.66 * s, 0]}>
        <sphereGeometry args={[0.12 * s, 16, 16]} />
        <Stone color="#d9a679" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** The office block, with a window grid painted on every face. */
function Building({ widthM, heightM, floors }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return null;
    ctx.fillStyle = '#8f979f';
    ctx.fillRect(0, 0, 256, 1024);
    const rowH = 1024 / floors;
    const cols = 10;
    for (let r = 0; r < floors; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        // A few windows lit, as a block looks at dusk.
        const lit = (r * 7 + c * 3) % 11 === 0;
        ctx.fillStyle = lit ? '#e8c77a' : '#23344a';
        ctx.fillRect(c * (256 / cols) + 3, r * rowH + rowH * 0.22, 256 / cols - 6, rowH * 0.6);
      }
    }
    const created = new THREE.CanvasTexture(canvas);
    created.colorSpace = THREE.SRGBColorSpace;
    created.anisotropy = 4;
    return created;
  }, [floors]);

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <group>
      <mesh position={[0, (heightM * s) / 2, 0]}>
        <boxGeometry args={[widthM * s, heightM * s, widthM * s]} />
        <meshStandardMaterial color={texture ? '#ffffff' : '#8f979f'} map={texture} roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[0, heightM * s + 0.6 * s, 0]}>
        <boxGeometry args={[widthM * 0.9 * s, 1.2 * s, widthM * 0.9 * s]} />
        <Stone color="#5d636a" />
      </mesh>
    </group>
  );
}

/**
 * The Statue of Liberty, 93 m from the ground to the tip of the torch:
 * foundation and Fort Wood's star 20 m, pedestal 27 m, statue 46 m.
 */
function Liberty() {
  const fort = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 11;
    for (let i = 0; i <= points * 2; i += 1) {
      const radius = (i % 2 === 0 ? 15 : 11.5) * s;
      const angle = (i / (points * 2)) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const created = new THREE.ExtrudeGeometry(shape, { depth: 7 * s, bevelEnabled: false });
    created.rotateX(-Math.PI / 2);
    return created;
  }, []);

  const robe = useMemo(() => {
    // Radius against height above the statue's feet, in metres.
    const profile = [
      [0, 0], [4.6, 0], [4.4, 3], [3.8, 9], [3.4, 15], [3.1, 21], [3.3, 24.5], [2.6, 26.2], [0.9, 27], [0, 27.2],
    ];
    const created = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 36);
    return created;
  }, []);

  useEffect(
    () => () => {
      fort.dispose();
      robe.dispose();
    },
    [fort, robe],
  );

  const feet = 47;

  return (
    <group>
      <mesh geometry={fort}>
        <Stone color="#8c877e" />
      </mesh>
      {/* Foundation: a truncated pyramid from the fort to the pedestal. */}
      <mesh position={[0, 13.5 * s, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[13.4 * s, 16.9 * s, 13 * s, 4]} />
        <Stone color="#a39a8d" />
      </mesh>
      {/* Granite pedestal, with its cornice and the dark band of the loggia. */}
      <mesh position={[0, 25 * s, 0]}>
        <boxGeometry args={[16 * s, 10 * s, 16 * s]} />
        <Stone color="#b9ac95" />
      </mesh>
      <mesh position={[0, 36 * s, 0]}>
        <boxGeometry args={[13 * s, 12 * s, 13 * s]} />
        <Stone color="#b4a78f" />
      </mesh>
      <mesh position={[0, 37.5 * s, 0]}>
        <boxGeometry args={[13.3 * s, 2.6 * s, 13.3 * s]} />
        <Stone color="#5d564c" />
      </mesh>
      <mesh position={[0, 43 * s, 0]}>
        <boxGeometry args={[15 * s, 2 * s, 15 * s]} />
        <Stone color="#c2b59e" />
      </mesh>
      <mesh position={[0, 45.5 * s, 0]}>
        <boxGeometry args={[11.5 * s, 3 * s, 11.5 * s]} />
        <Stone color="#b9ac95" />
      </mesh>

      {/* The statue: the artist-made one when it has loaded. */}
      <group position={[0, feet * s, 0]}>
        <GltfLandmark
          url={LANDMARK_MODELS.liberty}
          heightM={46}
          turn={-Math.PI / 2}
          fallback={<LibertyFigure robe={robe} />}
        />
      </group>
    </group>
  );
}

/** The hand-built statue, from its feet to the torch: 46 m. */
function LibertyFigure({ robe }) {
  const copper = <meshStandardMaterial color="#5c9c86" roughness={0.62} metalness={0.25} />;
  const rays = [-75, -50, -25, 0, 25, 50, 75].map((d) => (d * Math.PI) / 180);
  return (
    <group>
      <mesh geometry={robe}>{copper}</mesh>
      <mesh position={[0, 28.3 * s, 0.3 * s]}>
        <sphereGeometry args={[2.2 * s, 24, 20]} />
        {copper}
      </mesh>
      {/* Crown: a band and seven rays. */}
      <mesh position={[0, 29.6 * s, 0.3 * s]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.25 * s, 0.35 * s, 8, 24]} />
        {copper}
      </mesh>
      {rays.map((angle) => (
        <Strut
          key={angle}
          from={[Math.sin(angle) * 2 * s, 29.8 * s, (0.3 + Math.cos(angle) * 2) * s]}
          to={[Math.sin(angle) * 4.2 * s, 31.6 * s, (0.3 + Math.cos(angle) * 4.2) * s]}
          radiusTop={0.05 * s}
          radiusBottom={0.32 * s}
        >
          {copper}
        </Strut>
      ))}
      {/* Raised right arm and the torch, its flame covered in gold leaf. */}
      <Strut from={[2.5 * s, 25.5 * s, 0]} to={[3.4 * s, 41 * s, 0.4 * s]} radiusTop={0.75 * s} radiusBottom={1.0 * s}>
        {copper}
      </Strut>
      <mesh position={[3.45 * s, 42.2 * s, 0.4 * s]}>
        <cylinderGeometry args={[1.3 * s, 0.6 * s, 1.6 * s, 16]} />
        {copper}
      </mesh>
      <mesh position={[3.45 * s, 44.4 * s, 0.4 * s]}>
        <coneGeometry args={[1.0 * s, 2.8 * s, 16]} />
        <meshStandardMaterial color="#e2b54a" metalness={0.8} roughness={0.3} emissive="#7a5410" emissiveIntensity={0.35} />
      </mesh>
      {/* Left arm holding the tablet. */}
      <Strut from={[-2.6 * s, 25 * s, 0]} to={[-2.9 * s, 19 * s, 1.6 * s]} radiusTop={0.7 * s}>
        {copper}
      </Strut>
      <mesh position={[-2.9 * s, 20.5 * s, 2.0 * s]} rotation={[-0.25, 0.2, 0.1]}>
        <boxGeometry args={[2.6 * s, 7.2 * s, 0.7 * s]} />
        {copper}
      </mesh>
    </group>
  );
}

/**
 * Tashkent's TV tower, 375 m: three splayed legs, the blue-glazed observation
 * deck and restaurant around 100 m, the steel shaft, and the red-and-white
 * mast at the top.
 */
function TvTowerBuilt() {
  const steel = <meshStandardMaterial color="#b4bac2" metalness={0.65} roughness={0.38} />;
  const glass = <meshStandardMaterial color="#3f6f9e" metalness={0.35} roughness={0.15} />;
  const legs = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
  const mastBands = [0, 1, 2, 3, 4, 5];

  return (
    <group>
      {legs.map((angle) => (
        <Strut
          key={angle}
          from={[Math.cos(angle) * 24 * s, 0, Math.sin(angle) * 24 * s]}
          to={[Math.cos(angle) * 3 * s, 92 * s, Math.sin(angle) * 3 * s]}
          radiusTop={1.4 * s}
          radiusBottom={2.4 * s}
        >
          {steel}
        </Strut>
      ))}
      <mesh position={[0, 47 * s, 0]}>
        <cylinderGeometry args={[3 * s, 3.4 * s, 94 * s, 16]} />
        {steel}
      </mesh>

      {/* The observation deck and the restaurant above it. */}
      <mesh position={[0, 96 * s, 0]}>
        <cylinderGeometry args={[14 * s, 5 * s, 4 * s, 32]} />
        {steel}
      </mesh>
      <mesh position={[0, 101 * s, 0]}>
        <cylinderGeometry args={[14 * s, 14 * s, 6 * s, 32]} />
        {glass}
      </mesh>
      <mesh position={[0, 105 * s, 0]}>
        <cylinderGeometry args={[12.8 * s, 14 * s, 2 * s, 32]} />
        {steel}
      </mesh>
      <mesh position={[0, 108 * s, 0]}>
        <cylinderGeometry args={[12.5 * s, 12.5 * s, 4 * s, 32]} />
        {glass}
      </mesh>
      <mesh position={[0, 111.5 * s, 0]}>
        <cylinderGeometry args={[4 * s, 12.5 * s, 3 * s, 32]} />
        {steel}
      </mesh>

      {/* The shaft above the deck, with rings every 20 m. */}
      <mesh position={[0, 176.5 * s, 0]}>
        <cylinderGeometry args={[1.8 * s, 3 * s, 127 * s, 16]} />
        {steel}
      </mesh>
      {[130, 150, 170, 190, 210].map((m) => (
        <mesh key={m} position={[0, m * s, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3 * s, 0.3 * s, 6, 20]} />
          {steel}
        </mesh>
      ))}
      <mesh position={[0, 221 * s, 0]}>
        <cylinderGeometry args={[5 * s, 5 * s, 2 * s, 24]} />
        {steel}
      </mesh>
      <mesh position={[0, 285 * s, 0]}>
        <cylinderGeometry args={[0.9 * s, 1.8 * s, 90 * s, 12]} />
        {steel}
      </mesh>
      {/* The mast, banded red and white for aircraft. */}
      {mastBands.map((i) => (
        <mesh key={i} position={[0, (330 + 3.75 + i * 7.5) * s, 0]}>
          <cylinderGeometry args={[(0.7 - i * 0.07) * s, (0.75 - i * 0.07) * s, 7.5 * s, 10]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#c8322f' : '#eeeeee'} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 375 * s, 0]}>
        <sphereGeometry args={[0.6 * s, 10, 10]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

/** Whatever stands beside the rocket, its base on the rocket's ground. */
export function ComparisonModel({ comparison, x }) {
  let model = null;
  if (comparison.id === 'person') model = <Person />;
  else if (comparison.id === 'building') model = <Building widthM={comparison.widthM} heightM={comparison.heightM} floors={comparison.floors} />;
  else if (comparison.id === 'liberty') model = <Liberty />;
  else if (comparison.id === 'tower') {
    model = <GltfLandmark url={LANDMARK_MODELS.tower} heightM={375} fallback={<TvTowerBuilt />} />;
  }
  if (!model) return null;
  return <group position={[x, BASE_Y, 0]}>{model}</group>;
}
