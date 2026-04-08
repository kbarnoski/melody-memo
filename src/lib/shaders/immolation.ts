import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Immolation — self-consuming form with edges eating inward

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  vec3 color = vec3(0.0);

  // Contracting circle — the form consuming itself
  float cycle = fract(t * 0.06);
  float radius = mix(0.6, 0.05, cycle * cycle); // accelerating contraction
  float dist = length(uv);

  // Form boundary with noise erosion
  float erosion = fbm3(uv * 5.0 + t * 0.3) * 0.15;
  float form = dist - radius + erosion;

  // Dark interior
  float interior = smoothstep(0.02, -0.02, form) * 0.02;
  color += vec3(0.01, 0.005, 0.015) * interior;

  // Burning edge — glowing where form is being consumed
  float edge = exp(-abs(form) * 30.0);
  float edgeBright = edge * (0.1 + 0.05 * sin(atan(uv.y, uv.x) * 6.0 + t * 2.0));
  vec3 fireEdge = palette(form * 2.0 + t * 0.3,
    vec3(0.06, 0.02, 0.0),
    vec3(0.08, 0.04, 0.01),
    vec3(1.0, 0.6, 0.3),
    vec3(0.0, 0.1, 0.2)
  );
  color += fireEdge * edgeBright * (1.0 + 0.2 * u_bass);

  // Ash particles floating away from edge
  float angle = atan(uv.y, uv.x);
  float ashNoise = snoise(vec2(angle * 3.0, dist * 10.0 - t * 1.5));
  float ash = smoothstep(0.0, 0.15, dist - radius) * smoothstep(0.4, 0.15, dist - radius);
  ash *= smoothstep(0.4, 0.5, ashNoise) * 0.02;
  color += vec3(0.02, 0.01, 0.005) * ash;

  // Audio modulation
  color *= 1.0 + 0.1 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
