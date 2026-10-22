import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Loading the real 3D models of nebulae and remnants, and drawing them as gas.
 *
 * The models are NASA and Chandra reconstructions (credits in
 * public/models/star-life/ATTRIBUTION.md and on the page), served from this
 * site as Draco-compressed .glb. They come as plain grey surfaces: the shape
 * is the science, the look is ours. `GasMaterial` draws a surface the way a
 * cloud of glowing or dusty gas looks - brightest where you look through the
 * most of it, at its edges - with a colour gradient and a slow shimmer.
 *
 * A model that has not arrived yet, or cannot be had, is simply not drawn;
 * the hand-built scene around it stays.
 */

const MODEL_CACHE = new Map();

/**
 * One Draco decoder for every model: each DRACOLoader starts its own pool of
 * workers, and a dozen of them at once slowed the first stage's model down.
 */
let sharedDraco = null;
function dracoLoader() {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader();
    sharedDraco.setDecoderPath('/draco/');
  }
  return sharedDraco;
}

/**
 * Fetches a model once per visit and hands back its meshes as geometries with
 * their node transforms baked in, plus any original materials.
 */
export function loadModel(url) {
  if (!MODEL_CACHE.has(url)) {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader());
    MODEL_CACHE.set(
      url,
      loader.loadAsync(url).then(
        (gltf) => {
          gltf.scene.updateMatrixWorld(true);
          const parts = [];
          gltf.scene.traverse((object) => {
            if (!object.isMesh) return;
            const geometry = object.geometry.clone();
            geometry.applyMatrix4(object.matrixWorld);
            if (!geometry.attributes.normal) geometry.computeVertexNormals();
            parts.push({ geometry, material: object.material });
          });
          const box = new THREE.Box3();
          for (const part of parts) {
            part.geometry.computeBoundingBox();
            box.union(part.geometry.boundingBox);
          }
          return { parts, box };
        },
        (error) => {
          MODEL_CACHE.delete(url);
          throw error;
        },
      ),
    );
  }
  return MODEL_CACHE.get(url);
}

/** The loaded model, or null while it is on its way (or missing). */
export function useModel(url) {
  const [model, setModel] = useState(null);
  useEffect(() => {
    let live = true;
    loadModel(url)
      .then((loaded) => {
        if (live) setModel(loaded);
      })
      .catch(() => {
        // Missing or unreadable: the scene goes on without it.
      });
    return () => {
      live = false;
    };
  }, [url]);
  return model;
}

/** Starts fetching models before they are needed, so a stage opens complete. */
export function preloadModels(urls) {
  for (const url of urls) loadModel(url).catch(() => {});
}

const GAS_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vView;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// uMode 0: glowing gas (added on top of what is behind it).
// uMode 1: dusty gas lit from one side, with a bright rim where light eats
//          into it - the look of the Pillars of Creation.
const GAS_FRAGMENT = /* glsl */ `
uniform vec3 uColourA;
uniform vec3 uColourB;
uniform vec3 uRimColour;
uniform vec3 uAxis;
uniform vec2 uRange;
uniform vec3 uLight;
uniform float uRadial;
uniform float uMode;
uniform float uTime;
uniform float uOpacity;
uniform float uIntensity;
uniform float uNoiseScale;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vView;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vView);
  float facing = abs(dot(n, v));
  float rim = 1.0 - facing;
  float t = uRadial > 0.5
    ? clamp((length(vLocal) - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0)
    : clamp((dot(vLocal, uAxis) - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
  vec3 base = mix(uColourA, uColourB, t);
  float shimmer = 0.75 + 0.5 * vnoise(vLocal * uNoiseScale + vec3(0.0, uTime * 0.25, uTime * 0.1));

  if (uMode < 0.5) {
    float a = clamp((0.12 + 0.88 * rim * rim) * shimmer * uOpacity, 0.0, 1.0);
    gl_FragColor = vec4(base * uIntensity * a, a);
  } else {
    float lit = max(dot(n, normalize(uLight)), 0.0);
    // Where light grazes the surface it boils gas off: a glowing edge.
    float edge = rim * rim * (0.35 + 0.65 * lit);
    vec3 col = base * (0.18 + 0.75 * lit) * shimmer + uRimColour * edge * 1.6 * uIntensity;
    gl_FragColor = vec4(col, clamp(uOpacity * (0.86 + 0.14 * rim), 0.0, 1.0));
  }
  #include <colorspace_fragment>
}
`;

/**
 * A gas material for a model. `mode` 'glow' adds light; 'dust' is lit from
 * `light` with a glowing rim. The colour runs from `from` to `to` along
 * `axis` over `range` (or outward from the centre, with `radial`).
 */
export function useGasMaterial({
  mode = 'glow',
  from = '#3fd0ff',
  to = '#ff4d6d',
  rim = '#ffd9a0',
  axis = [0, 1, 0],
  range = [-1, 1],
  radial = false,
  light = [0.3, 1, 0.4],
  intensity = 1.4,
  noiseScale = 3,
} = {}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GAS_VERTEX,
        fragmentShader: GAS_FRAGMENT,
        uniforms: {
          uColourA: { value: new THREE.Color() },
          uColourB: { value: new THREE.Color() },
          uRimColour: { value: new THREE.Color() },
          uAxis: { value: new THREE.Vector3(0, 1, 0) },
          uRange: { value: new THREE.Vector2(-1, 1) },
          uLight: { value: new THREE.Vector3(0, 1, 0) },
          uRadial: { value: 0 },
          uMode: { value: 0 },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uIntensity: { value: 1.4 },
          uNoiseScale: { value: 3 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const glow = mode === 'glow';
  material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
  material.depthWrite = !glow;
  const u = material.uniforms;
  u.uMode.value = glow ? 0 : 1;
  u.uColourA.value.set(from);
  u.uColourB.value.set(to);
  u.uRimColour.value.set(rim);
  u.uAxis.value.set(axis[0], axis[1], axis[2]).normalize();
  u.uRange.value.set(range[0], range[1]);
  u.uLight.value.set(light[0], light[1], light[2]).normalize();
  u.uRadial.value = radial ? 1 : 0;
  u.uIntensity.value = intensity;
  u.uNoiseScale.value = noiseScale;

  useFrame((state) => {
    u.uTime.value = state.clock.elapsedTime;
    // A stage morph fades materials by their opacity; follow it.
    u.uOpacity.value = material.opacity;
  });
  return material;
}

/** Several models at once; null until every one of them has arrived. */
export function useModels(urls) {
  const key = urls.join('|');
  const [models, setModels] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all(key.split('|').map((url) => loadModel(url)))
      .then((loaded) => {
        if (live) setModels(loaded);
      })
      .catch(() => {
        // One missing: draw none of them rather than half a picture.
      });
    return () => {
      live = false;
    };
  }, [key]);
  return models;
}

/**
 * Models that belong together (the parts of one object, in one coordinate
 * frame), centred as a whole - or on `centreAt`, in model units - and scaled
 * so their largest side is `fit`.
 * `materials` gives one material per model, or one for all. `children` is a
 * function given each part's group, for parts that move on their own.
 */
export function FittedModels({ urls, materials, fit = 6, centreAt, onReady, partRefs, ...group }) {
  const models = useModels(urls);
  const placed = useMemo(() => {
    if (!models) return null;
    const box = new THREE.Box3();
    for (const model of models) box.union(model.box);
    const size = box.getSize(new THREE.Vector3());
    const centre = centreAt ? new THREE.Vector3(...centreAt) : box.getCenter(new THREE.Vector3());
    return { scale: fit / Math.max(size.x, size.y, size.z, 1e-6), centre, size };
    // centreAt is a fixed literal at each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, fit]);
  const told = useRef(false);
  useEffect(() => {
    if (models && placed && !told.current) {
      told.current = true;
      onReady?.(placed, models);
    }
  }, [models, placed, onReady]);
  if (!models || !placed) return null;
  return (
    <group {...group}>
      <group scale={placed.scale}>
        <group position={[-placed.centre.x, -placed.centre.y, -placed.centre.z]}>
          {models.map((model, i) => (
            <group
              key={urls[i]}
              ref={(g) => {
                if (partRefs) partRefs.current[i] = g;
              }}
            >
              {model.parts.map((part, k) => (
                <mesh
                  key={k}
                  geometry={part.geometry}
                  material={(Array.isArray(materials) ? materials[i] : materials) ?? part.material}
                />
              ))}
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
