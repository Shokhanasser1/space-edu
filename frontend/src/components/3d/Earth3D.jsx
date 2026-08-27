import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * The Earth on the home page.
 *
 * Until 26 August 2026 this loaded Three.js r128 from cdnjs.cloudflare.com
 * with a `<script>` tag, and its night-lights texture from
 * raw.githubusercontent.com. `three` had been in package.json the whole time —
 * every other 3D screen uses it. On any network that blocks or slows either
 * host (a school, a phone on a bad day, a rate-limited GitHub) the script never
 * arrived, the promise never settled, and the home page opened on a black disc
 * where the planet should be. "Where did the planet go" was the report.
 *
 * Now: the bundled `three`, textures served from `/textures/`, and if the
 * browser has no WebGL at all a still image of the same Earth instead of an
 * empty circle. The canvas is sized to the space it gets, so a phone shows the
 * whole planet rather than the middle 75% of a 520px one.
 */

const TEXTURES = {
  day: '/textures/earth_atmos_2048.jpg',
  normal: '/textures/earth_normal_2048.jpg',
  specular: '/textures/earth_specular_2048.jpg',
  night: '/textures/earth_lights_2048.png',
  clouds: '/textures/earth_clouds_1024.png',
};

/** Shown when WebGL is unavailable: the same planet, not spinning. */
export const FALLBACK_IMAGE = '/earth_glow.png';

/** Probe before constructing the renderer — three logs an error when it fails. */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// three r155+ measures lights in physical units; these are the r128 values
// scaled to look the same.
const LIGHT_SCALE = Math.PI;

export default function Earth3D({ size = 520 }) {
  const mountRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || fallback) return undefined;
    if (!hasWebGL()) {
      setFallback(true);
      return undefined;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFallback(true);
      return undefined;
    }

    const measure = () => mount.clientWidth || size;
    let px = measure();

    // ── Scene ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    camera.position.z = 2.6;

    renderer.setSize(px, px);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const disposables = [];

    // ── Stars ──
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 600;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 600;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeo, starMat));
    disposables.push(starGeo, starMat);

    // ── Textures ──
    // A missing file leaves the material without a map rather than throwing;
    // if the day map fails the globe is painted a flat ocean blue so something
    // round and lit is still there.
    const loader = new THREE.TextureLoader();
    const load = (path, { srgb = false, onError } = {}) =>
      loader.load(
        path,
        (texture) => { if (srgb) texture.colorSpace = THREE.SRGBColorSpace; },
        undefined,
        onError,
      );

    const earthMat = new THREE.MeshPhongMaterial({
      specular: new THREE.Color(0x446688),
      shininess: 25,
      bumpScale: 0.03,
    });
    earthMat.map = load(TEXTURES.day, {
      srgb: true,
      onError: () => { earthMat.map = null; earthMat.color.set(0x2f5f9e); earthMat.needsUpdate = true; },
    });
    earthMat.bumpMap = load(TEXTURES.normal);
    earthMat.specularMap = load(TEXTURES.specular);
    const earthNight = load(TEXTURES.night, { srgb: true });
    const cloudMap = load(TEXTURES.clouds, { srgb: true });
    disposables.push(earthMat.map, earthMat.bumpMap, earthMat.specularMap, earthNight, cloudMap);

    // ── Earth ──
    const earthGeo = new THREE.SphereGeometry(1, 128, 128);
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.x = 0.41;
    scene.add(earth);
    disposables.push(earthGeo, earthMat);

    // ── Night lights (city glow) ──
    const nightMat = new THREE.ShaderMaterial({
      uniforms: {
        nightTexture: { value: earthNight },
        sunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.002, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          float sunDot = dot(vNormal, sunDirection);
          float nightFactor = smoothstep(-0.1, -0.3, sunDot);
          vec4 nightColor = texture2D(nightTexture, vUv);
          gl_FragColor = vec4(nightColor.rgb * nightFactor * 1.8, nightFactor * nightColor.r);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nightMesh = new THREE.Mesh(earthGeo, nightMat);
    nightMesh.rotation.x = 0.41;
    scene.add(nightMesh);
    disposables.push(nightMat);

    // ── Clouds ──
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cloudGeo = new THREE.SphereGeometry(1.008, 128, 128);
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    clouds.rotation.x = 0.41;
    scene.add(clouds);
    disposables.push(cloudGeo, cloudMat);

    // ── Atmosphere glow ──
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
          vec3 color = vec3(0.65, 0.54, 0.98); // #a78bfa (Purple)
          gl_FragColor = vec4(color, 1.0) * intensity * 2.0;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosGeo = new THREE.SphereGeometry(1.15, 64, 64);
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));
    disposables.push(atmosGeo, atmosMat);

    // ── Lights ──
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8 * LIGHT_SCALE);
    sunLight.position.set(5, 1.5, 2.5);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x111122, 0.15 * LIGHT_SCALE));
    const fillLight = new THREE.DirectionalLight(0x334466, 0.3 * LIGHT_SCALE);
    fillLight.position.set(-5, -1, -3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x6644aa, 0.4 * LIGHT_SCALE);
    rimLight.position.set(-3, 2, -4);
    scene.add(rimLight);

    // ── Mouse / touch drag ──
    let isDragging = false;
    const prevMouse = { x: 0, y: 0 };
    const rotVelocity = { x: 0, y: 0 };
    const targetRot = { x: 0.41, y: 0 };
    const clampX = (x) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, x));

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse.x = e.clientX;
      prevMouse.y = e.clientY;
      rotVelocity.x = 0;
      rotVelocity.y = 0;
    };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      rotVelocity.x = dy * 0.003;
      rotVelocity.y = dx * 0.003;
      targetRot.x = clampX(targetRot.x + rotVelocity.x);
      targetRot.y += rotVelocity.y;
      prevMouse.x = e.clientX;
      prevMouse.y = e.clientY;
    };

    const onTouchStart = (e) => {
      isDragging = true;
      prevMouse.x = e.touches[0].clientX;
      prevMouse.y = e.touches[0].clientY;
    };
    const onTouchEnd = () => { isDragging = false; };
    const onTouchMove = (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - prevMouse.x;
      const dy = e.touches[0].clientY - prevMouse.y;
      targetRot.x = clampX(targetRot.x + dy * 0.003);
      targetRot.y += dx * 0.003;
      prevMouse.x = e.touches[0].clientX;
      prevMouse.y = e.touches[0].clientY;
    };

    const onResize = () => {
      const next = measure();
      if (next === px) return;
      px = next;
      renderer.setSize(px, px);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onResize);

    // ── Animate ──
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isDragging) {
        targetRot.y += 0.0012;
        rotVelocity.x *= 0.95;
        rotVelocity.y *= 0.95;
        targetRot.x = clampX(targetRot.x + rotVelocity.x);
        targetRot.y += rotVelocity.y;
      }

      earth.rotation.x += (targetRot.x - earth.rotation.x) * 0.08;
      earth.rotation.y += (targetRot.y - earth.rotation.y) * 0.08;
      nightMesh.rotation.x = earth.rotation.x;
      nightMesh.rotation.y = earth.rotation.y;
      clouds.rotation.x = earth.rotation.x;
      clouds.rotation.y = earth.rotation.y + Date.now() * 0.000003;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      for (const item of disposables) item?.dispose?.();
      renderer.dispose();
      if (mount.contains(canvas)) mount.removeChild(canvas);
    };
  }, [size, fallback]);

  const box = {
    // Never wider than the viewport minus the hero padding: on a phone the
    // 520px globe used to hang 68px off each edge.
    width: `min(${size}px, calc(100vw - 2rem))`,
    aspectRatio: '1 / 1',
    borderRadius: '50%',
    overflow: 'hidden',
    // subtle outer glow ring, purple theme
    boxShadow: '0 0 80px rgba(167,139,250,0.18), 0 0 160px rgba(139,92,246,0.12)',
  };

  if (fallback) {
    return (
      <div style={box} data-testid="earth-fallback">
        <img
          src={FALLBACK_IMAGE}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return <div ref={mountRef} style={{ ...box, cursor: 'grab' }} />;
}
