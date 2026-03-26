import { U, VISIONARY_PALETTE } from "./shared";

export const FRAG =
  U +
  VISIONARY_PALETTE +
  `
// ---- Constellation Network ----
// Star-like points drifting slowly, with thin glowing lines connecting
// nearby points (proximity graph). Network breathes — connections form
// and dissolve. Bass pulses brightness, amplitude controls drift speed.

vec2 hash21(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// Line segment SDF
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;
  vec3 color = vec3(0.0);

  // Dark background
  color = vec3(0.004, 0.005, 0.012);

  // Drift speed from amplitude
  float driftSpeed = 0.6 + u_amplitude * 1.0;
  // Brightness pulse from bass
  float brightPulse = 0.7 + u_bass * 0.5;
  // Connection threshold — breathes with time and mid
  float connectDist = 0.28 + sin(t * 0.5) * 0.04 + u_mid * 0.06;

  // Number of stars
  const int NUM_STARS = 30;

  // Compute star positions (we need them twice — once for stars, once for connections)
  // Store in arrays is not available in GLSL ES 1.0 with dynamic indexing,
  // so we use a two-pass approach: first draw connections, then draw stars.

  // --- Pass 1: Connections (thin glowing lines between nearby stars) ---
  for (int i = 0; i < NUM_STARS; i++) {
    float fi = float(i);
    vec2 seedi = hash21(fi * 127.1 + 31.7);
    vec2 pi = vec2(
      sin(t * driftSpeed * 0.15 * (0.3 + seedi.x * 0.7) + fi * 2.39) * 0.65
      + cos(t * driftSpeed * 0.08 + fi * 4.17) * 0.2,
      cos(t * driftSpeed * 0.12 * (0.4 + seedi.y * 0.6) + fi * 1.73) * 0.55
      + sin(t * driftSpeed * 0.06 + fi * 3.31) * 0.15
    );

    // Check connections to other stars (only j > i to avoid doubles)
    for (int j = 0; j < NUM_STARS; j++) {
      if (j <= i) continue;
      float fj = float(j);
      vec2 seedj = hash21(fj * 127.1 + 31.7);
      vec2 pj = vec2(
        sin(t * driftSpeed * 0.15 * (0.3 + seedj.x * 0.7) + fj * 2.39) * 0.65
        + cos(t * driftSpeed * 0.08 + fj * 4.17) * 0.2,
        cos(t * driftSpeed * 0.12 * (0.4 + seedj.y * 0.6) + fj * 1.73) * 0.55
        + sin(t * driftSpeed * 0.06 + fj * 3.31) * 0.15
      );

      float starDist = length(pi - pj);
      if (starDist < connectDist) {
        // Connection strength fades with distance
        float strength = 1.0 - starDist / connectDist;
        strength = strength * strength; // smooth falloff

        // Line distance
        float ld = sdSeg(uv, pi, pj);
        float lineGlow = exp(-ld * (120.0 + u_treble * 20.0)) * strength;

        vec3 lineCol = palette(
          (fi + fj) * 0.05 + t * 0.1,
          vec3(0.4, 0.42, 0.5),
          vec3(0.25, 0.28, 0.4),
          vec3(0.6, 0.8, 1.0),
          vec3(0.05, 0.1, 0.3)
        );

        color += lineCol * lineGlow * 0.12 * brightPulse;
      }
    }
  }

  // --- Pass 2: Star points ---
  for (int i = 0; i < NUM_STARS; i++) {
    float fi = float(i);
    vec2 seedi = hash21(fi * 127.1 + 31.7);
    vec2 pi = vec2(
      sin(t * driftSpeed * 0.15 * (0.3 + seedi.x * 0.7) + fi * 2.39) * 0.65
      + cos(t * driftSpeed * 0.08 + fi * 4.17) * 0.2,
      cos(t * driftSpeed * 0.12 * (0.4 + seedi.y * 0.6) + fi * 1.73) * 0.55
      + sin(t * driftSpeed * 0.06 + fi * 3.31) * 0.15
    );

    float d = length(uv - pi);

    // Star twinkle
    float twinkle = 0.6 + 0.4 * sin(t * (2.0 + seedi.x * 3.0) + fi * 4.7);

    // Point glow
    float glow = exp(-d * d * 1500.0) * twinkle * brightPulse;
    float outerGlow = exp(-d * 30.0) * twinkle * brightPulse * 0.15;
    float core = smoothstep(0.006, 0.0, d) * twinkle * brightPulse;

    // Slight cross/spike on brighter stars
    float spike = 0.0;
    spike += exp(-abs(uv.x - pi.x) * 200.0) * exp(-abs(uv.y - pi.y) * 30.0) * 0.03;
    spike += exp(-abs(uv.y - pi.y) * 200.0) * exp(-abs(uv.x - pi.x) * 30.0) * 0.03;

    vec3 starCol = palette(
      fi * 0.07 + t * 0.05 + u_amplitude * 0.1,
      vec3(0.55, 0.55, 0.6),
      vec3(0.35, 0.35, 0.45),
      vec3(0.8, 0.9, 1.0),
      vec3(0.0, 0.05, 0.2)
    );

    color += starCol * glow * 0.5;
    color += starCol * outerGlow;
    color += vec3(0.9, 0.92, 1.0) * core * 0.3;
    color += starCol * spike * twinkle;
  }

  // Very faint background stars (static, tiny)
  for (int i = 0; i < 20; i++) {
    float fi = float(i) + 100.0;
    vec2 sp = hash21(fi * 311.7) * 2.0 - 1.0;
    sp *= 0.8;
    float sd = length(uv - sp);
    float sg = exp(-sd * sd * 5000.0) * 0.15;
    float tw = 0.5 + 0.5 * sin(t * 1.5 + fi * 3.3);
    color += vec3(0.5, 0.55, 0.7) * sg * tw;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.5, 1.5, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
