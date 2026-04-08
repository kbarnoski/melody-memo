import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Whorl — spiral phyllotaxis, sunflower seed pattern (Fibonacci/golden angle)

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark rich background
  vec3 color = palette(
    length(uv) * 0.3 + t * 0.01,
    vec3(0.02, 0.02, 0.03),
    vec3(0.02, 0.01, 0.03),
    vec3(0.08, 0.06, 0.12),
    vec3(0.0, 0.02, 0.05)
  );

  // Golden angle in radians: 137.5077... degrees
  float goldenAngle = 2.39996;

  // Phyllotaxis spiral — 80 seeds
  float totalGlow = 0.0;
  for (int i = 0; i < 80; i++) {
    float fi = float(i);

    // Classic sunflower phyllotaxis
    float angle = fi * goldenAngle + t * 0.2;
    float radius = sqrt(fi) * 0.045 + bass * 0.01;

    vec2 seedPos = vec2(cos(angle), sin(angle)) * radius;

    // Gentle breathing — seeds pulse outward
    float breathe = 1.0 + 0.03 * sin(t * 0.8 + fi * 0.1);
    seedPos *= breathe;

    // Seed wobble
    seedPos += vec2(
      sin(t * 0.5 + fi * 0.3) * 0.003,
      cos(t * 0.4 + fi * 0.5) * 0.003
    );

    float d = length(uv - seedPos);

    // Seed size — smaller toward center, larger outer
    float seedR = 0.006 + sqrt(fi) * 0.001 + mid * 0.002;

    // Soft glowing dot
    float glow = smoothstep(seedR + 0.005, seedR * 0.3, d);
    float brightCore = smoothstep(seedR * 0.5, 0.0, d);

    // Pulsing brightness — wave propagates outward through spiral
    float wavePhase = fi * 0.08 - t * 1.5;
    float pulse = 0.5 + 0.5 * sin(wavePhase);

    // Fibonacci spiral coloring
    float spiralIndex = mod(fi * goldenAngle, 6.28318) / 6.28318;
    float colorT = spiralIndex * 0.8 + t * 0.02 + u_amplitude * 0.1;

    vec3 seedColor = palette(
      colorT,
      vec3(0.3, 0.2, 0.1),
      vec3(0.3, 0.25, 0.15),
      vec3(0.7, 0.5, 0.3),
      vec3(0.0, 0.1, 0.05)
    );

    vec3 coreColor = palette(
      colorT + 0.2,
      vec3(0.5, 0.4, 0.15),
      vec3(0.4, 0.3, 0.1),
      vec3(0.9, 0.7, 0.3),
      vec3(0.05, 0.1, 0.0)
    );

    color += seedColor * glow * (0.5 + pulse * 0.5) * 0.35;
    color += coreColor * brightCore * pulse * 0.4;
    totalGlow += glow;
  }

  // Connecting spiral arms — visible as faint curves
  // The eye naturally sees Fibonacci spirals in both directions
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Clockwise spirals (13 arms)
  float spiral13 = sin(a * 13.0 - log(r + 0.01) * 20.0 + t * 0.5) * 0.5 + 0.5;
  spiral13 = pow(spiral13, 6.0);
  spiral13 *= smoothstep(0.5, 0.05, r) * smoothstep(0.01, 0.04, r);

  // Counter-clockwise spirals (21 arms)
  float spiral21 = sin(a * 21.0 + log(r + 0.01) * 20.0 - t * 0.3) * 0.5 + 0.5;
  spiral21 = pow(spiral21, 6.0);
  spiral21 *= smoothstep(0.5, 0.05, r) * smoothstep(0.01, 0.04, r);

  vec3 spiralColor = palette(
    a * 0.15 + t * 0.02 + treble,
    vec3(0.15, 0.1, 0.05),
    vec3(0.1, 0.08, 0.04),
    vec3(0.4, 0.3, 0.15),
    vec3(0.0, 0.05, 0.02)
  );

  color += spiralColor * (spiral13 + spiral21) * 0.08;

  // Central glow
  float centerGlow = 0.005 / (r * r + 0.005);
  vec3 centerColor = palette(
    t * 0.03 + bass,
    vec3(0.5, 0.35, 0.15),
    vec3(0.35, 0.25, 0.1),
    vec3(0.85, 0.65, 0.25),
    vec3(0.08, 0.08, 0.0)
  );
  color += centerColor * centerGlow * 0.15;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
