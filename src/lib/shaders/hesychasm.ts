import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Hesychasm — Stillness prayer: nearly static, deep interior light

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.03; // Very slow — meditative stillness

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  float r = length(uv);

  // Deep interior light — very slow breathing
  float breath = sin(t * 1.5) * 0.5 + 0.5;
  float coreIntensity = 0.8 + breath * 0.2 + amp * 0.1;

  // Central warm glow — the heart of stillness
  float core = exp(-r * 5.0) * coreIntensity;
  float innerCore = exp(-r * 12.0) * 0.6;

  // Very subtle radial gradient
  float n = fbm3(uv * 2.0 + t * 0.5);
  float n2 = fbm3(uv * 1.5 - t * 0.3 + 7.0);
  float subtle = (n * 0.5 + 0.5) * exp(-r * 2.5) * 0.2;

  // Almost imperceptible movement
  float drift = sin(r * 8.0 - t * 0.8 + n2 * 2.0) * 0.5 + 0.5;
  drift *= exp(-r * 3.0) * 0.15;

  // Single faint ring
  float ring = smoothstep(0.01, 0.0, abs(r - 0.35 - breath * 0.02)) * 0.12;

  // Deep amber-gold palette
  vec3 coreColor = palette(
    r * 1.5 + t * 0.1,
    vec3(0.6, 0.4, 0.15),
    vec3(0.3, 0.2, 0.08),
    vec3(1.0, 0.8, 0.35),
    vec3(0.0, 0.08, 0.12)
  );

  vec3 ambientColor = palette(
    n + t * 0.05,
    vec3(0.5, 0.35, 0.1),
    vec3(0.2, 0.15, 0.05),
    vec3(0.8, 0.6, 0.25),
    vec3(0.0, 0.05, 0.1)
  );

  vec3 color = vec3(0.0);
  color += coreColor * core;
  color += vec3(1.0, 0.95, 0.85) * innerCore;
  color += ambientColor * subtle;
  color += vec3(0.8, 0.6, 0.25) * drift;
  color += vec3(0.9, 0.75, 0.4) * ring * (0.8 + bass * 0.15);

  // Very dark warm ambient
  color += vec3(0.04, 0.02, 0.01) * (1.0 - r * 0.5);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
