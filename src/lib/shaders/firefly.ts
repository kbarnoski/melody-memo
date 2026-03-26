import { U, SMOOTH_NOISE, VISIONARY_PALETTE } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  `
// ---- Firefly Swarm on Flow Fields ----
// Dozens of tiny luminous particles drifting on noise-based flow fields.
// Each pulses independently. Bass = brightness, treble = speed.

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hash21(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.1;
  vec3 color = vec3(0.0);

  // Dark warm background with subtle fbm texture
  float bg = fbm(uv * 2.0 + t * 0.05) * 0.5 + 0.5;
  color = mix(vec3(0.004, 0.006, 0.012), vec3(0.01, 0.015, 0.008), bg * 0.4);

  // Speed factor from treble
  float speedMul = 1.0 + u_treble * 1.5;
  // Brightness factor from bass
  float brightMul = 0.6 + u_bass * 0.6;

  // 40 fireflies
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    vec2 seed = hash21(fi * 137.7 + 29.3);

    // Base position — large-scale wander using smooth noise flow
    float timeOff = fi * 0.73;
    float tLocal = t * speedMul + timeOff;

    // Flow field position: integrate noise-based velocity
    // Use Lissajous-like base path + noise perturbation
    vec2 basePos = vec2(
      sin(tLocal * 0.3 * (0.5 + seed.x * 0.6) + fi * 2.1) * 0.55,
      cos(tLocal * 0.25 * (0.4 + seed.y * 0.5) + fi * 1.7) * 0.45
    );

    // Add flow-field displacement from fbm
    vec2 flowOff = vec2(
      snoise(basePos * 2.0 + vec2(tLocal * 0.15, fi * 3.1)),
      snoise(basePos * 2.0 + vec2(fi * 5.7, tLocal * 0.12))
    ) * 0.2;

    vec2 pos = basePos + flowOff;

    // Independent pulse: each firefly has its own rhythm
    float pulseRate = 2.0 + seed.x * 3.0;
    float pulsePhase = fi * 1.37 + seed.y * 8.0;
    float rawPulse = sin(tLocal * pulseRate + pulsePhase);
    // Shape into soft on/off with smoothstep
    float pulse = smoothstep(0.1, 0.6, rawPulse) * smoothstep(1.0, 0.7, rawPulse);
    pulse = pulse * pulse; // sharper falloff

    float dist = length(uv - pos);

    // Warm glow
    float glow = exp(-dist * dist * 600.0) * pulse * brightMul;
    float outerGlow = exp(-dist * 25.0) * pulse * brightMul * 0.3;
    float core = smoothstep(0.008, 0.0, dist) * pulse * brightMul;

    // Color: warm golden-amber spectrum with per-firefly variation
    vec3 col = palette(
      seed.x * 0.3 + t * 0.08 + u_amplitude * 0.2,
      vec3(0.5, 0.4, 0.2),
      vec3(0.3, 0.2, 0.1),
      vec3(1.0, 0.8, 0.4),
      vec3(0.0, 0.05, 0.15)
    );

    color += col * glow * 0.35;
    color += col * outerGlow * 0.15;
    color += vec3(1.0, 0.95, 0.8) * core * 0.2;

    // Short trailing wake: 6 trail points
    vec2 vel = vec2(
      cos(tLocal * 0.3 * (0.5 + seed.x * 0.6) + fi * 2.1) * 0.3,
      -sin(tLocal * 0.25 * (0.4 + seed.y * 0.5) + fi * 1.7) * 0.25
    );
    vec2 trailDir = normalize(vel + 0.001) * 0.015;
    for (int j = 1; j <= 6; j++) {
      float fj = float(j);
      vec2 tp = pos - trailDir * fj;
      float td = length(uv - tp);
      float trailGlow = exp(-td * td * 900.0) * pulse * (1.0 - fj * 0.15);
      color += col * trailGlow * 0.04 * brightMul;
    }
  }

  // Subtle global warmth from amplitude
  color += vec3(0.01, 0.008, 0.003) * u_amplitude * 0.5;

  // Mid frequency gently adds depth haze
  color += vec3(0.003, 0.005, 0.004) * u_mid * 0.4;

  // Vignette — organic dark edges
  float vig = 1.0 - smoothstep(0.3, 1.3, length(uv * vec2(0.9, 0.95)));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
