import * as THREE from 'three';

/**
 * The four spacecraft in the Satellite Control module, as 3D models.
 *
 * Ticket 12, second part: "convert all the remaining 2D models to 3D". The
 * inventory that produced this file, taken by reading every geometry in the
 * lab and then orbiting each model in a browser:
 *
 * | Model                | What it was                                    |
 * |----------------------|------------------------------------------------|
 * | Crew Dragon's array  | one `planeGeometry`, single sided - it vanished |
 * |                      | completely when you orbited behind it           |
 * | Soyuz's arrays       | not modelled at all; the "solar panels" toggle  |
 * |                      | was wired to Soyuz and moved nothing            |
 * | Tiangong's arrays    | two 0.05-thick slabs, no frame, no structure    |
 * | ISS's arrays         | four 0.04-thick slabs; the truss was one box    |
 *
 * All four now share `SolarArray`, which is an actual object: a spine, a frame
 * with four sides, and a cell panel inset inside it, so it reads as a panel
 * from any angle and has an edge when you look along it.
 *
 * The one thing deliberately left flat is the orbit track, which is a
 * `ringGeometry` because it is a drawn line rather than a model of anything.
 *
 * Nothing here is a claim about a dimension. These are recognisable
 * proportions, not measurements - the figures the lab states are in
 * `labFacts.js`, with their sources.
 */

const PANEL_BLUE = '#123d74';
const FRAME = '#8c98a8';
const HULL = '#cfd6df';

/**
 * One solar array: spine, frame and cells, with real thickness.
 *
 * Replaces four different flat stand-ins. `length` runs along local x, away
 * from the spacecraft; `width` across it.
 */
export function SolarArray({ length = 2.3, width = 1, thickness = 0.05, spine = 0.35 }) {
  return (
    <group>
      <mesh position={[spine / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, spine, 10]} />
        <meshPhysicalMaterial color={FRAME} metalness={0.8} roughness={0.35} />
      </mesh>

      <group position={[spine + length / 2, 0, 0]}>
        {/* Cells, inset inside the frame so the frame reads as a frame. */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[length * 0.94, thickness, width * 0.9]} />
          <meshPhysicalMaterial color={PANEL_BLUE} metalness={0.9} roughness={0.16} />
        </mesh>
        {/* Frame: two long sides, two short ends. */}
        {[1, -1].map((side) => (
          <mesh key={`long-${side}`} position={[0, 0, (side * width) / 2]} castShadow>
            <boxGeometry args={[length, thickness * 1.6, width * 0.06]} />
            <meshPhysicalMaterial color={FRAME} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        {[1, -1].map((side) => (
          <mesh key={`end-${side}`} position={[(side * length) / 2, 0, 0]} castShadow>
            <boxGeometry args={[length * 0.04, thickness * 1.6, width]} />
            <meshPhysicalMaterial color={FRAME} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A pair of arrays on opposite sides, folded back along the hull when stowed. */
function ArrayPair({ deployed, offset, length, width, stowedAxis = 'z' }) {
  const stowed = stowedAxis === 'z' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  return (
    <>
      {[1, -1].map((side) => (
        <group
          key={side}
          position={[side * offset, 0, 0]}
          rotation={deployed ? [0, side > 0 ? 0 : Math.PI, 0] : stowed}
        >
          <SolarArray length={length} width={width} />
        </group>
      ))}
    </>
  );
}

function ISS({ deployed }) {
  // The truss is five segments with visible joints rather than one long box.
  const segments = [-1.6, -0.8, 0, 0.8, 1.6];
  return (
    <group scale={0.55}>
      {segments.map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.18, 0.2]} />
          <meshPhysicalMaterial color={HULL} metalness={0.86} roughness={0.18} />
        </mesh>
      ))}
      {segments.slice(0, -1).map((x) => (
        <mesh key={`joint-${x}`} position={[x + 0.4, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.14, 12]} />
          <meshPhysicalMaterial color={FRAME} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Pressurised modules across the truss. */}
      <mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.8, 28]} />
        <meshPhysicalMaterial color="#f8fafc" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.1, 20]} />
        <meshPhysicalMaterial color="#e8edf3" metalness={0.5} roughness={0.45} />
      </mesh>

      {/* Four wings a side, as the real truss carries. */}
      {[1, -1].map((side) =>
        [0.62, -0.62].map((z) => (
          <group
            key={`${side}-${z}`}
            position={[side * 1.55, 0, z]}
            rotation={deployed ? [0, side > 0 ? 0 : Math.PI, 0] : [Math.PI / 2, 0, 0]}
          >
            <SolarArray length={2.1} width={0.95} />
          </group>
        )),
      )}

      {/* Radiators: white, edge-on to the arrays, and unmistakably solid. */}
      {[1, -1].map((side) => (
        <mesh key={`rad-${side}`} position={[side * 0.85, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.07, 1.5]} />
          <meshPhysicalMaterial color="#f2f5f8" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Tiangong({ deployed }) {
  return (
    <group scale={0.72}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.44, 0.44, 2.2, 32]} />
        <meshPhysicalMaterial color="#ececec" metalness={0.65} roughness={0.32} />
      </mesh>
      {/* Docking hub at the front: it is a node, not a flat end cap. */}
      <mesh position={[-1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshPhysicalMaterial color="#dfe4ea" metalness={0.6} roughness={0.38} />
      </mesh>
      <mesh position={[-1.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.3, 18]} />
        <meshPhysicalMaterial color={FRAME} metalness={0.75} roughness={0.35} />
      </mesh>
      <ArrayPair deployed={deployed} offset={0.5} length={2.4} width={1.05} />
    </group>
  );
}

function CrewDragon({ deployed }) {
  // Crew Dragon's cells are mounted on the curved wall of the trunk - it has no
  // wings to unfold. The old model gave it one flat square that disappeared
  // when you looked at its back. It is a curved shell here, and the toggle
  // rolls the spacecraft to face the Sun, which is what it really does.
  return (
    <group scale={0.85} rotation={[0, deployed ? 0 : Math.PI * 0.55, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <coneGeometry args={[0.6, 1.2, 36]} />
        <meshPhysicalMaterial color="#ffffff" metalness={0.35} roughness={0.2} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.05, 32]} />
        <meshPhysicalMaterial color="#22272f" metalness={0.8} roughness={0.5} />
      </mesh>
      {[0, 1].map((half) => (
        <mesh
          key={half}
          castShadow
          receiveShadow
          position={[0, -0.62, 0]}
          rotation={[0, half * Math.PI, 0]}
        >
          <cylinderGeometry args={[0.63, 0.63, 0.92, 32, 1, false, -0.7, 1.4]} />
          <meshPhysicalMaterial
            color={PANEL_BLUE}
            metalness={0.92}
            roughness={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Trunk fins, which is what makes a Dragon a Dragon from behind. */}
      {[0.6, -0.6].map((z) => (
        <mesh key={z} position={[0, -1.0, z]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.36]} />
          <meshPhysicalMaterial color="#2b313a" metalness={0.6} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Soyuz({ deployed }) {
  // Soyuz had no arrays at all, so the "solar panels" toggle was wired to a
  // spacecraft that could not answer it. Its two wings are the thing everybody
  // recognises it by.
  return (
    <group scale={0.85}>
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <sphereGeometry args={[0.42, 30, 30]} />
        <meshPhysicalMaterial color="#e1e1e1" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.3, 0.5, 0.65, 32]} />
        <meshPhysicalMaterial color="#b2b2b2" metalness={0.65} roughness={0.52} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 32]} />
        <meshPhysicalMaterial color="#cecece" metalness={0.72} roughness={0.35} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -1.08, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 0.28, 24]} />
        <meshPhysicalMaterial color="#4a5058" metalness={0.85} roughness={0.45} />
      </mesh>
      <group position={[0, -0.45, 0]}>
        <ArrayPair deployed={deployed} offset={0.5} length={2.0} width={0.85} />
      </group>
    </group>
  );
}

const MODELS = { iss: ISS, tiangong: Tiangong, dragon: CrewDragon, soyuz: Soyuz };

/** Every spacecraft the module offers, by the id its button uses. */
export function Spacecraft({ type, deployed }) {
  const Model = MODELS[type] ?? ISS;
  return <Model deployed={deployed} />;
}

export const SPACECRAFT_TYPES = Object.keys(MODELS);
