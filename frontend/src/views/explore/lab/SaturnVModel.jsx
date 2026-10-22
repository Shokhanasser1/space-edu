import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { SATURN_V, SATURN_V_STACK, explodeOffsetM } from './labFacts';

/**
 * The Saturn V as a solid, painted model rather than a glowing hologram.
 *
 * Readers asked for the rocket to look like the rocket: white, with the
 * black-and-white roll pattern that let cameras on the ground see it turn,
 * "UNITED STATES" down the first stage, five dark F-1 bells under four fins.
 * Everything is built from primitives and painted with canvas textures, so it
 * costs no download and no third-party asset.
 *
 * Overall height and width are to scale (labFacts). The section boundaries
 * are modelling numbers, as labFacts says, and the paint scheme is a faithful
 * simplification: the bands sit where they do on AS-506, but the exact panel
 * count and every small marking are not reproduced. The page says so.
 *
 * Each part is its own group so it can be lifted apart, clicked, and looked at
 * on its own: with `focusPart` set, every other part fades to a ghost and the
 * focused part shows what is normally hidden - the J-2 bells in the
 * interstages, the Lunar Module folded inside its adapter with the petals
 * opened, the Service Module's engine.
 */

/** 110.6 m of rocket into about 11 scene units. */
export const SCALE = 0.1;
export const HEIGHT = SATURN_V.heightM * SCALE;
export const RADIUS = (SATURN_V.diameterM / 2) * SCALE;
export const BASE_Y = -HEIGHT / 2;

/** A height above the base of the rocket, in metres, as a scene y. */
export function atMetres(metres) {
  return metres * SCALE - HEIGHT / 2;
}

const WHITE = '#eceef0';
const BLACK = '#121314';
const STEEL = '#a9b0b8';
const ENGINE = '#2a2623';

/** A canvas texture painted by `draw`, or null where there is no canvas (tests). */
function paint(width, height, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return null;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Canvas row for a height in metres within a section that runs from..to. */
function row(metres, from, to, height) {
  return (1 - (metres - from) / (to - from)) * height;
}

/** Alternating black and white panels round the stage between two heights. */
function rollBand(ctx, w, h, sectionFrom, sectionTo, fromM, toM, segments = 8, startBlack = true) {
  const top = row(toM, sectionFrom, sectionTo, h);
  const bottom = row(fromM, sectionFrom, sectionTo, h);
  for (let i = 0; i < segments; i += 1) {
    if ((i % 2 === 0) !== startBlack) continue;
    ctx.fillStyle = BLACK;
    ctx.fillRect((i * w) / segments, top, w / segments + 0.5, bottom - top);
  }
}

/** Faint panel seams, so a white surface reads as metal and not as plastic. */
function seams(ctx, w, h, rows, cols) {
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 2;
  for (let r = 1; r < rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, (r * h) / rows);
    ctx.lineTo(w, (r * h) / rows);
    ctx.stroke();
  }
  for (let c = 0; c < cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo((c * w) / cols, 0);
    ctx.lineTo((c * w) / cols, h);
    ctx.stroke();
  }
}

/** The lettering painted down the first stage, twice, on opposite sides. */
const STAGE_LETTERING = 'UNITED STATES';

function flag(ctx, x, y, width) {
  const height = width * 0.6;
  for (let i = 0; i < 13; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#b22234' : '#ffffff';
    ctx.fillRect(x, y + (i * height) / 13, width, height / 13 + 0.5);
  }
  ctx.fillStyle = '#3c3b6e';
  ctx.fillRect(x, y, width * 0.4, height * (7 / 13));
}

function useLivery() {
  const textures = useMemo(
    () => ({
      sic: paint(768, 1024, (ctx, w, h) => {
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, w, h);
        seams(ctx, w, h, 14, 16);
        rollBand(ctx, w, h, 0, 42, 4.5, 10);
        rollBand(ctx, w, h, 0, 42, 23, 27.5, 8, false);
        rollBand(ctx, w, h, 0, 42, 39, 42);
        ctx.fillStyle = BLACK;
        ctx.font = 'bold 34px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const u of [0.25, 0.75]) {
          ctx.save();
          ctx.translate(u * w, row(16, 0, 42, h));
          ctx.rotate(Math.PI / 2);
          ctx.fillText(STAGE_LETTERING.split('').join(' '), 0, 0);
          ctx.restore();
          flag(ctx, u * w - 30, row(34, 0, 42, h), 60);
        }
      }),
      sii: paint(512, 1024, (ctx, w, h) => {
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, w, h);
        seams(ctx, w, h, 10, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, row(47.2, 42, 66.8, h), w, 3);
      }),
      sivb: paint(512, 768, (ctx, w, h) => {
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, w, h);
        seams(ctx, w, h, 8, 12);
        rollBand(ctx, w, h, 70, 87.8, 70, 71.2, 8);
        rollBand(ctx, w, h, 70, 87.8, 84.6, 87.8, 8, false);
      }),
      service: paint(512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#b9bfc7';
        ctx.fillRect(0, 0, w, h);
        // Radiator panels: the lighter bands round the Service Module.
        for (let i = 0; i < 24; i += 1) {
          ctx.fillStyle = i % 2 === 0 ? '#d7dce1' : '#c3c9d0';
          ctx.fillRect((i * w) / 24, h * 0.15, w / 24, h * 0.55);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, h * 0.12, w, 3);
        ctx.fillRect(0, h * 0.72, w, 3);
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      for (const texture of Object.values(textures)) texture?.dispose();
    },
    [textures],
  );

  return textures;
}

/**
 * A surface material that fades to a ghost when another part is focused, and
 * warms slightly when its part is the one selected in the panel.
 */
function Surface({ ghost, active, color = WHITE, map = null, metalness = 0.12, roughness = 0.55, side, emissive }) {
  return (
    <meshStandardMaterial
      color={map ? '#ffffff' : color}
      map={map}
      metalness={metalness}
      roughness={roughness}
      side={side}
      transparent={ghost}
      opacity={ghost ? 0.12 : 1}
      depthWrite={!ghost}
      emissive={emissive ?? (active ? '#3a5b7a' : '#000000')}
      emissiveIntensity={emissive ? 0.6 : active ? 0.25 : 0}
    />
  );
}

/** A section of the stack between two heights, in metres. */
function Hull({ fromM, toM, bottomR, topR, ghost, active, map, color, metalness, roughness, openEnded = false }) {
  const length = (toM - fromM) * SCALE;
  return (
    <mesh position={[0, atMetres((fromM + toM) / 2), 0]}>
      <cylinderGeometry args={[topR * SCALE, bottomR * SCALE, length, 48, 1, openEnded]} />
      <Surface ghost={ghost} active={active} map={map} color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

/** A rocket engine bell, top (gimbal) at `topM`, drawn as a lathe. */
function Bell({ x = 0, z = 0, topM, throatR, exitR, lengthM, ghost, color = ENGINE }) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      points.push(new THREE.Vector2((throatR + (exitR - throatR) * Math.pow(t, 0.62)) * SCALE, -t * lengthM * SCALE));
    }
    return new THREE.LatheGeometry(points, 28);
  }, [throatR, exitR, lengthM]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[x * SCALE, atMetres(topM), z * SCALE]}>
      {/* Turbopump and gimbal block above the throat. */}
      <mesh position={[0, throatR * 0.9 * SCALE, 0]}>
        <cylinderGeometry args={[throatR * 0.85 * SCALE, throatR * SCALE, throatR * 1.8 * SCALE, 14]} />
        <Surface ghost={ghost} color="#3b3a39" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh geometry={geometry}>
        <Surface ghost={ghost} color={color} metalness={0.55} roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** A fin as an extruded trapezoid standing in the radial plane at `angle`. */
function Fin({ angle, ghost, active }) {
  const geometry = useMemo(() => {
    // In metres: root against the fairing, tip 2.6 m further out.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.6 * SCALE, 0.9 * SCALE);
    shape.lineTo(2.6 * SCALE, 4.2 * SCALE);
    shape.lineTo(0, 7.4 * SCALE);
    shape.lineTo(0, 0);
    const created = new THREE.ExtrudeGeometry(shape, { depth: 0.35 * SCALE, bevelEnabled: false });
    created.translate(0, 0, -0.175 * SCALE);
    return created;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[Math.cos(angle) * 5.2 * SCALE, atMetres(0.6), Math.sin(angle) * 5.2 * SCALE]}
      rotation={[0, -angle, 0]}
    >
      <Surface ghost={ghost} active={active} />
    </mesh>
  );
}

/** First stage: five F-1s under four fairings and fins, and the painted hull. */
function FirstStage({ livery, ghost, active }) {
  const outer = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2);
  return (
    <>
      <Hull fromM={4.5} toM={42} bottomR={5.05} topR={5.05} map={livery.sic} ghost={ghost} active={active} />
      {/* Thrust structure and heat shield at the base. */}
      <Hull fromM={4} toM={4.5} bottomR={4.8} topR={5.05} color={BLACK} ghost={ghost} active={active} />
      <Bell topM={4} throatR={0.5} exitR={1.88} lengthM={3.6} ghost={ghost} />
      {outer.map((angle) => (
        <group key={angle}>
          <Bell
            x={Math.cos(angle) * 3.9}
            z={Math.sin(angle) * 3.9}
            topM={4}
            throatR={0.5}
            exitR={1.88}
            lengthM={3.6}
            ghost={ghost}
          />
          {/* The fairing over the outer engine's upper half. */}
          <mesh position={[Math.cos(angle) * 4.4 * SCALE, atMetres(5.2), Math.sin(angle) * 4.4 * SCALE]}>
            <cylinderGeometry args={[0.8 * SCALE, 1.75 * SCALE, 5 * SCALE, 20]} />
            <Surface ghost={ghost} active={active} color={BLACK} roughness={0.6} />
          </mesh>
          <Fin angle={angle} ghost={ghost} active={active} />
        </group>
      ))}
    </>
  );
}

/** Second stage, its interstage (see-through once opened) and the J-2 cluster. */
function SecondStage({ livery, ghost, active, open }) {
  const outer = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2);
  return (
    <>
      <Hull fromM={47.2} toM={66.8} bottomR={5.05} topR={5.05} map={livery.sii} ghost={ghost} active={active} />
      {/* The interstage, dropped in flight; translucent once the stack is opened. */}
      <mesh position={[0, atMetres(44.6), 0]}>
        <cylinderGeometry args={[5.05 * SCALE, 5.05 * SCALE, 5.2 * SCALE, 48, 1, true]} />
        <meshStandardMaterial
          color={WHITE}
          roughness={0.55}
          side={THREE.DoubleSide}
          transparent
          opacity={ghost ? 0.08 : open ? 0.28 : 1}
          depthWrite={!open && !ghost}
        />
      </mesh>
      <Bell topM={47.2} throatR={0.32} exitR={1.0} lengthM={2.6} ghost={ghost} color="#4a4643" />
      {outer.map((angle) => (
        <Bell
          key={angle}
          x={Math.cos(angle) * 2.6}
          z={Math.sin(angle) * 2.6}
          topM={47.2}
          throatR={0.32}
          exitR={1.0}
          lengthM={2.6}
          ghost={ghost}
          color="#4a4643"
        />
      ))}
      {/* The cone up to the third stage's narrower diameter. */}
      <mesh position={[0, atMetres(68.4), 0]}>
        <cylinderGeometry args={[3.3 * SCALE, 5.05 * SCALE, 3.2 * SCALE, 48, 1, true]} />
        <meshStandardMaterial
          color={WHITE}
          roughness={0.55}
          side={THREE.DoubleSide}
          transparent
          opacity={ghost ? 0.08 : open ? 0.35 : 1}
          depthWrite={!open && !ghost}
        />
      </mesh>
    </>
  );
}

/** Third stage, its single J-2, and the two auxiliary propulsion pods. */
function ThirdStage({ livery, ghost, active }) {
  return (
    <>
      <Hull fromM={70} toM={87.8} bottomR={3.3} topR={3.3} map={livery.sivb} ghost={ghost} active={active} />
      <Bell topM={70} throatR={0.32} exitR={1.0} lengthM={2.6} ghost={ghost} color="#4a4643" />
      {[0, Math.PI].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 3.45 * SCALE, atMetres(71.6), Math.sin(angle) * 3.45 * SCALE]}>
          <boxGeometry args={[0.9 * SCALE, 2.2 * SCALE, 1.6 * SCALE]} />
          <Surface ghost={ghost} active={active} color={BLACK} />
        </mesh>
      ))}
    </>
  );
}

/**
 * One of the four adapter panels, hinged at its bottom edge. `open` swings
 * the top outward, as the panels opened in space to let the Lunar Module out.
 */
function AdapterPanel({ index, open, ghost, active }) {
  const centre = Math.PI / 4 + (index * Math.PI) / 2;
  const bottomR = 3.3 * SCALE;
  const length = 7.7 * SCALE;
  return (
    <group position={[Math.cos(centre) * bottomR, atMetres(87.8), Math.sin(centre) * bottomR]} rotation={[0, -centre, 0]}>
      <group rotation={[0, 0, -open * 0.75]}>
        <mesh position={[-bottomR, length / 2, 0]}>
          <cylinderGeometry args={[1.95 * SCALE, bottomR, length, 16, 1, true, Math.PI / 4, Math.PI / 2]} />
          <Surface ghost={ghost} active={active} color="#dfe3e7" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** The Lunar Module, folded, as it rode inside the adapter. */
function LunarModule({ ghost }) {
  const legs = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2);
  return (
    <group position={[0, atMetres(88.4), 0]}>
      {/* Descent stage in its gold foil. */}
      <mesh position={[0, 0.85 * SCALE, 0]}>
        <cylinderGeometry args={[1.6 * SCALE, 1.6 * SCALE, 1.7 * SCALE, 8]} />
        <Surface ghost={ghost} color="#c79a2b" metalness={0.75} roughness={0.32} />
      </mesh>
      {/* Ascent stage, where the two astronauts flew. */}
      <mesh position={[0, 2.55 * SCALE, 0]}>
        <cylinderGeometry args={[1.05 * SCALE, 1.3 * SCALE, 1.7 * SCALE, 7]} />
        <Surface ghost={ghost} color="#8d9096" metalness={0.4} roughness={0.5} />
      </mesh>
      {legs.map((angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 1.75 * SCALE, 1.4 * SCALE, Math.sin(angle) * 1.75 * SCALE]}
          rotation={[Math.sin(angle) * 0.25, 0, -Math.cos(angle) * 0.25]}
        >
          <cylinderGeometry args={[0.07 * SCALE, 0.07 * SCALE, 3 * SCALE, 6]} />
          <Surface ghost={ghost} color="#c79a2b" metalness={0.75} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}

/** Adapter with the Lunar Module, Service Module and Command Module. */
function Spacecraft({ livery, ghost, active, open }) {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <AdapterPanel key={index} index={index} open={open} ghost={ghost} active={active} />
      ))}
      <LunarModule ghost={ghost} />
      {/* The Service Module's main engine, under it inside the adapter. */}
      <Bell topM={95.5} throatR={0.35} exitR={1.25} lengthM={2.9} ghost={ghost} color="#5b5752" />
      <Hull
        fromM={95.5}
        toM={103}
        bottomR={1.95}
        topR={1.95}
        map={livery.service}
        ghost={ghost}
        active={active}
        metalness={0.55}
        roughness={0.35}
      />
      {/* Four thruster quads round the top of the Service Module. */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2;
        return (
          <mesh key={angle} position={[Math.cos(angle) * 2.05 * SCALE, atMetres(101.6), Math.sin(angle) * 2.05 * SCALE]}>
            <boxGeometry args={[0.45 * SCALE, 0.9 * SCALE, 0.45 * SCALE]} />
            <Surface ghost={ghost} color="#7d828a" metalness={0.5} roughness={0.4} />
          </mesh>
        );
      })}
      {/* Command Module under its white boost protective cover. */}
      <Hull fromM={103} toM={106.5} bottomR={1.95} topR={0.6} color="#f3f3f1" ghost={ghost} active={active} roughness={0.5} />
    </>
  );
}

/** The escape tower: a red-orange lattice, the solid motor, and the nose. */
function EscapeSystem({ ghost, active }) {
  const legs = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2);
  const towerFrom = 106.5;
  const towerTo = 108;
  const lean = 0.18;
  return (
    <>
      {legs.map((angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 0.45 * SCALE, atMetres((towerFrom + towerTo) / 2), Math.sin(angle) * 0.45 * SCALE]}
          rotation={[Math.sin(angle) * lean, 0, -Math.cos(angle) * lean]}
        >
          <cylinderGeometry args={[0.05 * SCALE, 0.05 * SCALE, (towerTo - towerFrom) * SCALE, 6]} />
          <Surface ghost={ghost} active={active} color="#c8482b" roughness={0.5} />
        </mesh>
      ))}
      {[106.9, 107.5].map((m) => (
        <mesh key={m} position={[0, atMetres(m), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.45 * SCALE, 0.035 * SCALE, 6, 4]} />
          <Surface ghost={ghost} active={active} color="#c8482b" roughness={0.5} />
        </mesh>
      ))}
      {/* Four angled nozzles at the bottom of the escape motor. */}
      {legs.map((angle) => (
        <mesh
          key={`n-${angle}`}
          position={[Math.cos(angle) * 0.3 * SCALE, atMetres(108.05), Math.sin(angle) * 0.3 * SCALE]}
          rotation={[Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6]}
        >
          <coneGeometry args={[0.16 * SCALE, 0.4 * SCALE, 10, 1, true]} />
          <Surface ghost={ghost} color={ENGINE} metalness={0.5} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Hull fromM={108.2} toM={110} bottomR={0.33} topR={0.33} color="#f0f0ee" ghost={ghost} active={active} />
      <Hull fromM={108} toM={108.2} bottomR={0.36} topR={0.33} color={BLACK} ghost={ghost} active={active} />
      <mesh position={[0, atMetres(110.3), 0]}>
        <coneGeometry args={[0.33 * SCALE, 0.6 * SCALE, 24]} />
        <Surface ghost={ghost} active={active} color={BLACK} />
      </mesh>
    </>
  );
}

/**
 * The whole stack. `explode` lifts each part apart; `focusPart` ghosts every
 * other part and opens the focused one up.
 */
export function SaturnV({ activePart, focusPart, onSelect, explode }) {
  const livery = useLivery();
  return (
    <group>
      {SATURN_V_STACK.map((part, index) => {
        const lift = explodeOffsetM(index, explode) * SCALE;
        const ghost = Boolean(focusPart) && focusPart !== part.id;
        const active = !focusPart && activePart === part.id;
        const focused = focusPart === part.id;
        const open = focused || explode > 0.05;
        return (
          <group
            key={part.id}
            position={[0, lift, 0]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(part.id);
            }}
          >
            {part.id === 's-ic' && <FirstStage livery={livery} ghost={ghost} active={active} />}
            {part.id === 's-ii' && <SecondStage livery={livery} ghost={ghost} active={active} open={open} />}
            {part.id === 's-ivb' && <ThirdStage livery={livery} ghost={ghost} active={active} />}
            {part.id === 'spacecraft' && (
              <Spacecraft livery={livery} ghost={ghost} active={active} open={focused ? 1 : explode > 0.6 ? 0.5 : 0} />
            )}
            {part.id === 'les' && <EscapeSystem ghost={ghost} active={active} />}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Where a part sits and how big it is, in scene units before the frame shift:
 * the camera flies here when the part is focused.
 */
export function partBounds(partId, explode) {
  const index = SATURN_V_STACK.findIndex((part) => part.id === partId);
  if (index < 0) return null;
  const part = SATURN_V_STACK[index];
  const fromM = part.sections[0].fromM;
  const toM = part.sections[part.sections.length - 1].toM;
  const widest = Math.max(...part.sections.map((s) => Math.max(s.bottomRadiusM, s.topRadiusM)));
  // The first stage's fins and the open adapter reach past the hull.
  const reachM = part.id === 's-ic' ? 7.8 : part.id === 'spacecraft' ? 4.5 : widest;
  return {
    centreY: atMetres((fromM + toM) / 2) + explodeOffsetM(index, explode) * SCALE,
    height: (toM - fromM) * SCALE,
    width: reachM * 2 * SCALE,
  };
}
