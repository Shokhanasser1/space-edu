/**
 * The three small shaders the scene needs and three.js does not ship.
 *
 * All of them light from the Sun at the origin, so "sun direction" is simply
 * minus the fragment's world position, normalised — no light uniforms to keep
 * in step with the scene graph.
 */

/** Earth: day map on the lit side, city lights on the dark side, a specular
 *  glint on water. Textures are sRGB-tagged, so sampling returns linear. */
export const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specMap;
  uniform float hasNight;
  uniform float hasSpec;
  uniform float sunStrength;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(-vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(N, L);
    float day = smoothstep(-0.08, 0.25, ndl);
    vec3 dayColor = texture2D(dayMap, vUv).rgb;
    vec3 nightColor = hasNight > 0.5 ? texture2D(nightMap, vUv).rgb : vec3(0.0);
    float specMask = hasSpec > 0.5 ? texture2D(specMap, vUv).r : 0.0;
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 28.0) * specMask * 0.35 * day;
    vec3 lit = dayColor * (max(ndl, 0.0) * sunStrength + 0.015);
    vec3 dark = nightColor * (1.0 - day) * 1.4;
    gl_FragColor = vec4(lit + dark + spec, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Atmosphere: a rim glow strongest on the sunlit limb, drawn on the back
 *  faces of a slightly larger sphere with additive blending. */
export const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(-vWorldPos);
    // Back faces: the normal points away from the viewer; flip it.
    float rim = pow(clamp(1.0 + dot(V, N), 0.0, 1.0), 2.6);
    float lit = clamp(dot(-N, L) * 0.9 + 0.35, 0.05, 1.0);
    gl_FragColor = vec4(color * rim * lit * strength, rim * lit * strength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Rings: a radial strip texture sampled by distance from the centre, an
 *  alpha band with the gaps cut out, and the planet's shadow cast across
 *  them analytically (the sun is a point at the origin). */
export const RING_VERTEX = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldPos;
  void main() {
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const RING_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float hasMap;
  uniform vec3 tint;
  uniform float inner;
  uniform float outer;
  uniform float planetRadius;
  uniform vec3 sunLocal;
  uniform vec3 normalLocal;
  uniform vec4 gap0;
  uniform float thin;
  varying vec3 vLocal;
  varying vec3 vWorldPos;
  void main() {
    float r = length(vLocal.xy);
    float t = clamp((r - inner) / (outer - inner), 0.0, 1.0);
    vec3 c = hasMap > 0.5 ? texture2D(map, vec2(t, 0.5)).rgb : tint;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float alpha = hasMap > 0.5 ? clamp(lum * 1.6, 0.0, 1.0) : 0.6;
    // Fade the edges and cut the divisions.
    alpha *= smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(0.96, 1.0, t));
    if (gap0.x < gap0.y) {
      float inGap = smoothstep(gap0.x - 0.01, gap0.x, t) * (1.0 - smoothstep(gap0.y, gap0.y + 0.01, t));
      alpha *= 1.0 - inGap * 0.92;
    }
    if (thin > 0.5) {
      // Uranus: thirteen narrow, dark rings. A faint dust band with a few
      // hairlines, the outermost (epsilon) the brightest; dark grey, not the
      // planet's colour.
      float hair = smoothstep(0.985, 1.0, abs(sin(t * 34.0))) * 0.22;
      float epsilon = smoothstep(0.955, 0.975, t) * (1.0 - smoothstep(0.985, 1.0, t)) * 0.55;
      alpha = 0.012 + hair + epsilon;
      c = vec3(0.42, 0.44, 0.46);
    }
    // Planet shadow: does the ray from here towards the sun cross the planet?
    vec3 p = vLocal;
    vec3 s = normalize(sunLocal);
    float tstar = -dot(p, s);
    float d2 = dot(p, p) - tstar * tstar;
    float d = sqrt(max(d2, 0.0));
    float shadow = tstar > 0.0 ? smoothstep(planetRadius * 0.97, planetRadius * 1.03, d) : 1.0;
    // Lit from either face; the unlit face still glows with transmitted light.
    float facing = abs(dot(normalize(normalLocal), s));
    float light = mix(0.25, 1.0, facing) * mix(0.12, 1.0, shadow);
    gl_FragColor = vec4(c * light, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Real stars: size from magnitude, colour from B−V, a soft disc. */
export const STAR_VERTEX = /* glsl */ `
  attribute float mag;
  attribute vec3 tint;
  uniform float pixelRatio;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vTint = tint;
    float size = clamp(7.5 - mag * 1.15, 1.2, 9.0);
    vAlpha = clamp(1.25 - mag * 0.13, 0.25, 1.0);
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * (0.7 + 0.3 * (1.0 - r)), a);
  }
`;

/** Small bodies: Kepler solved per vertex; see kepler.js for the twin. */
export const SMALL_BODY_VERTEX_HEAD = /* glsl */ `
  attribute vec4 elems1;
  attribute vec4 elems2;
  uniform float uDays;
  uniform float uAU;
  uniform float pixelRatio;
  varying float vDepth;
`;

export const SMALL_BODY_VERTEX_MAIN = /* glsl */ `
  void main() {
    vec3 ecl = keplerPosition(elems1, elems2, uDays);
    vec3 scene = vec3(ecl.x, ecl.z, -ecl.y) * uAU;
    vec4 mv = modelViewMatrix * vec4(scene, 1.0);
    float dist = -mv.z;
    gl_PointSize = clamp(elems2.w * 900.0 / dist, 1.0, 3.5) * pixelRatio;
    vDepth = dist;
    gl_Position = projectionMatrix * mv;
  }
`;

export const SMALL_BODY_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  varying float vDepth;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(color, 0.85);
  }
`;
