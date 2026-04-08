import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Metanoia — Transformation: soft 6-fold polar symmetry

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float mid = 0.5 + 0.5 * sin(u_mid * 3.14159);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // 6-fold symmetry — fold angle into 0..PI/3
  float symAngle = mod(angle + t * 0.2, 1.0472) - 0.5236;
  vec2 symUV = vec2(cos(symAngle), sin(symAngle)) * r;

  // Slow rotation
  symUV = rot2(t * 0.15) * symUV;

  // Breathing scale
  float breathe = 1.0 + sin(t * 1.2) * 0.08 * bass;
  symUV *= breathe;

  // Noise-based luminous pattern
  float n1 = fbm3(symUV * 5.0 + t * 0.3);
  float n2 = fbm3(symUV * 3.0 - t * 0.2 + 5.0);

  // Radial petals
  float petals = sin(symAngle * 6.0 + n1 * 2.0) * 0.5 + 0.5;
  petals *= exp(-r * 2.5);

  // Luminous rings modulated by noise
  float rings = sin(r * 15.0 - t * 2.0 + n2 * 3.0) * 0.5 + 0.5;
  rings *= exp(-r * 2.0);

  // Central glow
  float core = exp(-r * 6.0) * 1.2;

  // Warm gold palette
  vec3 petalColor = palette(
    petals + r * 2.0 + t * 0.15,
    vec3(0.6, 0.45, 0.15),
    vec3(0.5, 0.4, 0.2),
    vec3(1.0, 0.8, 0.35),
    vec3(0.0, 0.1, 0.2)
  );

  vec3 ringColor = palette(
    rings + t * 0.1 + n1,
    vec3(0.7, 0.5, 0.2),
    vec3(0.3, 0.25, 0.1),
    vec3(1.0, 0.85, 0.5),
    vec3(0.05, 0.08, 0.15)
  );

  vec3 color = vec3(0.0);
  color += petalColor * petals * (0.7 + mid * 0.3);
  color += ringColor * rings * 0.5;
  color += vec3(1.0, 0.9, 0.7) * core;

  // Symmetry edge highlights
  float edgeGlow = exp(-abs(symAngle) * 20.0) * exp(-r * 3.0) * 0.3;
  color += vec3(1.0, 0.85, 0.5) * edgeGlow;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
