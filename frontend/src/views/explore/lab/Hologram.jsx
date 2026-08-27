import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * One holographic treatment, shared by every model in the Laboratory.
 *
 * Ticket 12 asks for the models to be shown "gallagrammalik" - as holograms.
 * The point of putting it in one file is that there is one of them: a model
 * dropped into `HologramStage` floats over the same projector plinth, inside
 * the same scan-lined cylinder of light, under the same sweep, with labels in
 * the same style. Five modules that each invented their own glow would look
 * like five different products.
 *
 * Everything here that lives on the GPU is built once in `useMemo` and given
 * back in the matching cleanup. That is the rule `SpaceRunScene.leaks.test.js`
 * exists to hold, and `SpaceLabView.test.js` now holds the lab to it too.
 */

/** The instrument's colours. Every module reads these, none of them pick. */
export const HOLO = {
  accent: '#7de3ff',
  accentWarm: '#ffb266',
  grid: '#2f6f8f',
};

const HologramContext = createContext(null);

/** Shared materials, so a model of forty meshes uploads two of them. */
function useHologramMaterials(accent) {
  const materials = useMemo(() => {
    const tint = new THREE.Color(accent);
    return {
      body: new THREE.MeshStandardMaterial({
        color: tint.clone().multiplyScalar(0.35),
        emissive: tint.clone().multiplyScalar(0.16),
        transparent: true,
        opacity: 0.42,
        metalness: 0.1,
        roughness: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      bodyActive: new THREE.MeshStandardMaterial({
        // Bright enough to pick out, dim enough that bloom does not turn the
        // selected stage into a white bar - which it did at 0.5 emissive.
        color: tint.clone().multiplyScalar(0.5),
        emissive: tint.clone().multiplyScalar(0.24),
        transparent: true,
        opacity: 0.5,
        metalness: 0.1,
        roughness: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      wire: new THREE.MeshBasicMaterial({
        color: tint,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      wireActive: new THREE.MeshBasicMaterial({
        color: tint.clone().lerp(new THREE.Color('#ffffff'), 0.55),
        wireframe: true,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    };
  }, [accent]);

  useEffect(() => () => {
    for (const material of Object.values(materials)) material.dispose();
  }, [materials]);

  return materials;
}

/**
 * A shell of horizontal scan lines around the model.
 *
 * A shader rather than stacked rings: forty ring meshes to draw a hundred scan
 * lines is forty draw calls on a phone, and this is one.
 */
function ScanShell({ radius, height, accent }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(accent) },
          uHalfHeight: { value: height / 2 },
        },
        vertexShader: `
          varying vec3 vLocal;
          void main() {
            vLocal = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uHalfHeight;
          varying vec3 vLocal;
          void main() {
            // Normalised against the shell's own height, so a 110 m rocket and
            // a 4 m satellite get the same number of lines rather than the
            // taller one getting fifty.
            float lines = sin((vLocal.y / uHalfHeight) * 11.0 - uTime * 1.6) * 0.5 + 0.5;
            lines = smoothstep(0.62, 1.0, lines);
            // Fade out at the top and bottom so the shell has no visible rim.
            float fade = 1.0 - clamp(abs(vLocal.y) / uHalfHeight, 0.0, 1.0);
            gl_FragColor = vec4(uColor, lines * fade * 0.10);
          }
        `,
      }),
    [accent, height],
  );

  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh material={material}>
      <cylinderGeometry args={[radius, radius, height, 48, 1, true]} />
    </mesh>
  );
}

/** The bright line that climbs the model and starts again, like a scanner. */
function ScanSweep({ radius, height, accent }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const cycle = (state.clock.elapsedTime * 0.22) % 1;
    ref.current.position.y = -height / 2 + cycle * height;
    // Dim at both ends so it appears and disappears rather than jumping.
    ref.current.material.opacity = 0.5 * Math.sin(cycle * Math.PI);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.2, radius * 1.06, 64]} />
      <meshBasicMaterial
        color={accent}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** The projector: a lit disc with rings around it, under the floating model. */
function Plinth({ radius, y, accent }) {
  return (
    <group position={[0, y, 0]}>
      {[1, 1.35, 1.75].map((scale, index) => (
        <mesh key={scale} rotation={[-Math.PI / 2, 0, 0]} position={[0, index * 0.004, 0]}>
          <ringGeometry args={[radius * scale, radius * scale * 1.03, 72]} />
          <meshBasicMaterial
            color={index === 0 ? accent : HOLO.grid}
            transparent
            opacity={0.5 - index * 0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.98, 64]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The stage. Put a model inside it and it becomes a hologram of that model.
 *
 * `height` and `radius` describe the model's own bounding cylinder in scene
 * units; everything - the shell, the sweep, the plinth - is sized from them, so
 * a rocket 110 m tall and a satellite 4 m across get the same treatment at
 * their own scale.
 */
export function HologramStage({
  height,
  radius,
  accent = HOLO.accent,
  spin = 0.12,
  float = true,
  children,
}) {
  const materials = useHologramMaterials(accent);
  const modelRef = useRef(null);

  useFrame((state, delta) => {
    if (!modelRef.current) return;
    if (spin) modelRef.current.rotation.y += delta * spin;
    modelRef.current.position.y = float ? Math.sin(state.clock.elapsedTime * 0.7) * height * 0.012 : 0;
  });

  const context = useMemo(() => ({ materials, accent }), [materials, accent]);

  return (
    <HologramContext.Provider value={context}>
      {/* The light the hologram is made of, rather than a light in the room. */}
      <ambientLight intensity={0.55} />
      <pointLight position={[0, height * 0.6, radius * 3]} intensity={radius * 6} color={accent} />

      <Plinth radius={radius * 1.1} y={-height / 2 - height * 0.04} accent={accent} />
      <ScanShell radius={radius * 1.25} height={height * 1.08} accent={accent} />
      <ScanSweep radius={radius * 1.25} height={height * 1.08} accent={accent} />

      <group ref={modelRef}>{children}</group>
    </HologramContext.Provider>
  );
}

/**
 * A solid surface inside the hologram: the shared translucent body, with a
 * wireframe of the same shape over it so the edges read as drawn light.
 *
 * The geometry element is given as a child and used twice on purpose - two
 * meshes, one geometry description. Both are created and disposed by
 * react-three-fiber, which owns anything declared in JSX.
 */
export function HoloMesh({ active = false, children, ...props }) {
  const holo = useContext(HologramContext);
  if (!holo) return null;
  const { body, bodyActive, wire, wireActive } = holo.materials;

  return (
    <group {...props}>
      <mesh material={active ? bodyActive : body}>{children}</mesh>
      <mesh material={active ? wireActive : wire} scale={1.004}>
        {children}
      </mesh>
    </group>
  );
}

/**
 * A label with a leader line, pinned to a point on the model.
 *
 * Hidden below `md`. On a phone the labels overlap each other and the model
 * within a few degrees of rotation, and everything they say is also in the
 * panel above the viewer, which is where a phone reader gets it.
 */
export function HoloLabel({ position, title, subtitle, accent = HOLO.accent, side = 1 }) {
  const reach = 1.1 * side;
  return (
    <group position={position}>
      <mesh position={[reach / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, Math.abs(reach), 6]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshBasicMaterial color={accent} depthWrite={false} />
      </mesh>
      <Html position={[reach, 0, 0]} center={side < 0} distanceFactor={12} zIndexRange={[10, 0]}>
        <div
          className="hidden md:block pointer-events-none select-none whitespace-nowrap"
          style={{ transform: side < 0 ? 'translateX(-50%)' : 'none' }}
        >
          <div
            className="font-mono text-[11px] font-bold tracking-wider"
            style={{ color: accent, textShadow: '0 0 8px rgba(0,0,0,0.9)' }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className="font-mono text-[9px] text-white/70"
              style={{ textShadow: '0 0 8px rgba(0,0,0,0.9)' }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

/**
 * Frames the model so the whole of it is on screen, at any shape of viewport.
 *
 * A camera position that suits a wide desktop viewer leaves the model a sliver
 * on a phone, because the vertical field of view is fixed and the horizontal
 * one shrinks with the width. This works out the distance both ways round and
 * takes the larger, so a 110 m rocket fills a tall narrow canvas and a wide
 * short one equally.
 *
 * It runs on resize rather than per frame, so OrbitControls still owns the
 * camera afterwards - the controls read the live camera position on every
 * update, which is exactly why the old chase camera lost its fight with them.
 */
export function FitToViewport({ height, radius, azimuth = 0.26, elevation = 0.04, margin = 1.3 }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (!camera?.isPerspectiveCamera || !size?.width) return;
    const aspect = size.width / Math.max(1, size.height);
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
    const distance = Math.max(
      (height * margin) / (2 * Math.tan(vertical / 2)),
      (radius * 2.6 * margin) / (2 * Math.tan(horizontal / 2)),
    );
    camera.position.set(
      Math.sin(azimuth) * distance,
      height * elevation,
      Math.cos(azimuth) * distance,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size?.width, size?.height, height, radius, azimuth, elevation, margin]);

  return null;
}

/**
 * Hands the WebGL context back when the module closes.
 *
 * The lab logged `THREE.WebGLRenderer: Context Lost` after four module
 * switches, which is the browser evicting the oldest of its handful of live
 * contexts. React removing the canvas does not free one - only
 * `forceContextLoss()` does, and three.js does not call it for you. One of
 * these goes inside every <Canvas> in the lab; `SpaceLabView.test.js` counts
 * them against the canvases.
 */
export function ReleaseContextOnUnmount() {
  const gl = useThree((state) => state.gl);
  useEffect(
    () => () => {
      gl?.forceContextLoss?.();
      gl?.dispose?.();
    },
    [gl],
  );
  return null;
}
