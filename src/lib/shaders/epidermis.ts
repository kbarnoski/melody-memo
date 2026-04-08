import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Epidermis — layered skin-like surface with subtle translucency

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  float bass = u_bass * 0.2;
  float mid = u_mid * 0.15;
  float treble = u_treble * 0.1;

  // Warm base — subsurface scattering effect
  vec3 color = palette(
    length(uv) * 0.2 + t * 0.01,
    vec3(0.08, 0.04, 0.03),
    vec3(0.05, 0.03, 0.02),
    vec3(0.2, 0.1, 0.08),
    vec3(0.0, 0.03, 0.02)
  );

  // 4 skin layers — each slightly offset for depth/translucency
  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float layerFrac = fl / 3.0; // 0 = deepest, 1 = surface

    // Layer offset — slight parallax for depth
    vec2 layerOffset = vec2(
      sin(t * 0.1 + fl * 1.5) * 0.01 * (1.0 - layerFrac),
      cos(t * 0.08 + fl * 2.0) * 0.008 * (1.0 - layerFrac)
    );

    vec2 p = (uv + layerOffset) * (4.0 + fl * 2.0);

    // Cellular pattern — domain-warped for organic irregularity
    vec2 warp = vec2(
      fbm3(p + vec2(fl * 5.0, t * 0.08)),
      fbm3(p + vec2(t * 0.06, fl * 7.0 + 3.0))
    );

    float cellNoise = fbm3(p + warp * 0.4 + fl * 3.0);

    // Cell boundary detection
    float eps = 0.02;
    float cnx = fbm3(p + warp * 0.4 + fl * 3.0 + vec2(eps, 0.0));
    float cny = fbm3(p + warp * 0.4 + fl * 3.0 + vec2(0.0, eps));
    float cellEdge = length(vec2(cnx - cellNoise, cny - cellNoise)) / eps;
    cellEdge = smoothstep(0.15, 0.6, cellEdge);

    // Layer color — deeper layers are redder (blood), surface is more neutral
    float colorT = cellNoise * 0.3 + fl * 0.2 + t * 0.01 + u_amplitude * 0.06;

    vec3 layerColor;
    if (layer == 0) {
      // Deepest — dermis, warm red
      layerColor = palette(
        colorT,
        vec3(0.3, 0.08, 0.06),
        vec3(0.2, 0.06, 0.05),
        vec3(0.5, 0.15, 0.1),
        vec3(0.0, 0.03, 0.02)
      );
    } else if (layer == 1) {
      // Mid-deep — warm pink
      layerColor = palette(
        colorT + 0.15,
        vec3(0.3, 0.15, 0.12),
        vec3(0.2, 0.1, 0.08),
        vec3(0.5, 0.3, 0.25),
        vec3(0.0, 0.05, 0.03)
      );
    } else if (layer == 2) {
      // Mid — transition
      layerColor = palette(
        colorT + 0.3,
        vec3(0.28, 0.2, 0.16),
        vec3(0.18, 0.12, 0.1),
        vec3(0.5, 0.35, 0.3),
        vec3(0.02, 0.06, 0.04)
      );
    } else {
      // Surface — slightly cool highlights
      layerColor = palette(
        colorT + 0.45,
        vec3(0.25, 0.2, 0.18),
        vec3(0.15, 0.12, 0.1),
        vec3(0.45, 0.38, 0.35),
        vec3(0.03, 0.06, 0.05)
      );
    }

    // Cell wall color — darker boundaries
    vec3 wallColor = layerColor * 0.4;

    // Translucency — deeper layers show through faintly
    float opacity = 0.15 + layerFrac * 0.1;

    // Surface layer is more visible
    if (layer == 3) opacity = 0.25;

    color += layerColor * (1.0 - cellEdge) * opacity;
    color += wallColor * cellEdge * opacity * 0.5;
  }

  // Subsurface scattering — warm glow from beneath
  float sss = fbm3(uv * 3.0 + t * 0.05);
  sss = sss * 0.5 + 0.5;
  sss = pow(sss, 2.0);

  vec3 sssColor = palette(
    sss * 0.3 + t * 0.01 + bass * 0.3,
    vec3(0.35, 0.1, 0.08),
    vec3(0.25, 0.08, 0.06),
    vec3(0.6, 0.2, 0.15),
    vec3(0.0, 0.04, 0.03)
  );
  color += sssColor * sss * 0.08;

  // Surface sheen — subtle specular
  float sheen = snoise(uv * 6.0 + t * 0.1);
  sheen = pow(sheen * 0.5 + 0.5, 6.0);
  vec3 sheenColor = vec3(0.3, 0.25, 0.22);
  color += sheenColor * sheen * 0.06 * (1.0 + mid * 0.5);

  // Pore-like details on surface
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 porePos = hash2(vec2(fi * 7.3, fi * 11.1)) * 1.4 - 0.7;
    porePos += vec2(sin(t * 0.1 + fi), cos(t * 0.08 + fi * 1.3)) * 0.02;
    float d = length(uv - porePos);
    float pore = smoothstep(0.01, 0.005, d);
    color -= vec3(0.03) * pore; // subtle dark spots
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
