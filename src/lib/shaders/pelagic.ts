import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SMIN } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SMIN +
  `
// Pelagic — deep-sea organisms trailing bioluminescent filaments

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Soft organism body
float organism(vec2 uv, vec2 center, float radius, float phase, float t) {
  vec2 d = uv - center;
  // Undulating body shape
  float angle = atan(d.y, d.x);
  float wobble = 1.0 + 0.15 * sin(angle * 3.0 + t * 1.5 + phase)
                     + 0.08 * sin(angle * 5.0 - t * 2.0 + phase * 1.3);
  float dist = length(d) / (radius * wobble);
  return smoothstep(1.0, 0.0, dist);
}

// Trailing filament
float filament(vec2 uv, vec2 origin, float seed, float t) {
  float total = 0.0;
  vec2 pos = origin;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    // Trail curves downward and backward
    pos += vec2(
      sin(fi * 0.8 + seed * 3.0 + t * 0.8) * 0.015,
      -0.02 - 0.005 * fi * 0.3
    );
    float d = length(uv - pos);
    float brightness = 1.0 - fi / 12.0;
    total += brightness * 0.002 / (d + 0.003);
  }
  return total;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;
  float bass = u_bass * 0.3;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.15;

  // Deep ocean background
  float bgNoise = fbm3(uv * 2.0 + t * 0.05);
  vec3 color = palette(
    bgNoise * 0.3 + 0.7,
    vec3(0.01, 0.02, 0.06),
    vec3(0.01, 0.03, 0.06),
    vec3(0.1, 0.2, 0.5),
    vec3(0.0, 0.05, 0.2)
  );

  // 10 floating organisms
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float seed = fi * 1.618;

    // Smooth drifting paths
    vec2 center = vec2(
      sin(t * 0.3 + seed * 2.7) * 0.6 + cos(t * 0.17 + seed * 4.1) * 0.2,
      sin(t * 0.22 + seed * 3.3) * 0.5 + cos(t * 0.14 + seed * 1.9) * 0.15
    );

    // Bass gently expands organisms
    float radius = 0.04 + 0.02 * sin(seed * 5.0) + bass * 0.02;
    float phase = seed * 6.28;

    float body = organism(uv, center, radius, phase, t);

    // Per-organism color
    float colorT = fi * 0.1 + t * 0.02 + u_amplitude * 0.15;
    vec3 orgColor = palette(
      colorT,
      vec3(0.1, 0.3, 0.5),
      vec3(0.2, 0.3, 0.4),
      vec3(0.5, 0.8, 1.0),
      vec3(0.0, 0.15, 0.4)
    );

    // Bright bioluminescent core
    float core = smoothstep(0.6, 1.0, body);
    vec3 coreColor = palette(
      colorT + 0.3,
      vec3(0.3, 0.6, 0.7),
      vec3(0.3, 0.4, 0.5),
      vec3(0.6, 0.9, 1.0),
      vec3(0.1, 0.2, 0.5)
    );

    color += orgColor * body * 0.3 + coreColor * core * 0.5;

    // Trailing filaments — 2 per organism
    float fil1 = filament(uv, center - vec2(0.01, 0.0), seed, t);
    float fil2 = filament(uv, center + vec2(0.01, 0.0), seed + 3.14, t);

    vec3 filColor = palette(
      colorT + 0.5 + treble,
      vec3(0.1, 0.4, 0.5),
      vec3(0.15, 0.3, 0.4),
      vec3(0.4, 0.9, 0.8),
      vec3(0.0, 0.2, 0.5)
    );
    color += filColor * (fil1 + fil2) * 0.6;
  }

  // Ambient floating particles
  for (int i = 0; i < 20; i++) {
    float fi = float(i);
    vec2 ppos = hash2(vec2(fi * 7.3, fi * 11.1));
    ppos = ppos * 2.0 - 1.0;
    ppos += vec2(sin(t * 0.2 + fi), cos(t * 0.15 + fi * 1.3)) * 0.3;
    float d = length(uv - ppos);
    float glow = 0.0005 / (d * d + 0.001);
    glow *= 0.5 + 0.5 * sin(t * 1.5 + fi * 2.0 + mid * 3.0);
    color += vec3(0.1, 0.3, 0.5) * glow;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
