import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SKY_TEXTURE } from '../catalog';
import { useSolarStore } from '../clock';
import { isHiRes, loadFirst } from '../textures';

/**
 * The Milky Way behind the real stars.
 *
 * Solar System Scope's panorama is drawn in galactic coordinates — the
 * galactic centre sits in the middle of the image and longitude grows to the
 * left, as measured on the image itself (see ATTRIBUTION.md). So the shader
 * takes each pixel's direction in the J2000 equatorial frame, rotates it
 * into galactic coordinates with the IAU 1958 pole and origin, and samples
 * the map there. Orion, the Magellanic Clouds and Cygnus land where the
 * catalogue stars from StarField say they should.
 */

const RADIUS = 21000;
const OBLIQUITY = 23.4392911 * (Math.PI / 180);

/** J2000 equatorial → galactic (rows are the galactic axes in EQJ). */
const EQJ_TO_GAL = [
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.44482963, 0.7469822445,
  -0.867666149, -0.1980763734, 0.4559837762,
];

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform mat3 eqjToGal;
  uniform float brightness;
  varying vec3 vDir;
  void main() {
    vec3 g = eqjToGal * normalize(vDir);
    float l = atan(g.y, g.x);
    float b = asin(clamp(g.z, -1.0, 1.0));
    vec2 uv = vec2(fract(0.5 - l / 6.283185307), 0.5 - b / 3.141592654);
    vec3 c = texture2D(map, uv).rgb * brightness;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function SkyDome({ visible = true, brightness = 2.4 }) {
  const [map, setMap] = useState(null);
  const quality = useSolarStore((s) => s.quality);

  useEffect(() => {
    let alive = true;
    const candidates = quality === 'high' ? SKY_TEXTURE : SKY_TEXTURE.filter((c) => !isHiRes(c));
    loadFirst(candidates, true).then((hit) => {
      if (alive && hit) setMap(hit.texture);
    });
    return () => {
      alive = false;
    };
  }, [quality]);

  const uniforms = useMemo(() => {
    const m = new THREE.Matrix3();
    m.set(...EQJ_TO_GAL);
    return { map: { value: null }, eqjToGal: { value: m }, brightness: { value: brightness } };
  }, [brightness]);
  uniforms.map.value = map;

  // Local axes are J2000 equatorial; orient them into the scene frame
  // (ecliptic, y up) exactly as StarField does for its points.
  const quaternion = useMemo(() => {
    const c = Math.cos(OBLIQUITY);
    const s = Math.sin(OBLIQUITY);
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, -s, -c),
      new THREE.Vector3(0, c, -s),
    );
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }, []);

  if (!map) return null;
  return (
    <mesh quaternion={quaternion} visible={visible} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[RADIUS, 48, 32]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}
