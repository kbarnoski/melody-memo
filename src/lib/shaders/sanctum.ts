import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Sanctum — Protected luminous space, concentric light rings

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
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);
  float treble = 0.5 + 0.5 * sin(u_treble * 3.14159);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  vec3 color = vec3(0.0);

  // Concentric protective rings — temple-like
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float ringR = 0.08 + fi * 0.065;
    float breathe = sin(t * 0.7 + fi * 0.6) * 0.005;
    ringR += breathe;

    // Noise distortion on rings
    float n = fbm3(vec2(angle * 2.0 + fi, t * 0.3));
    float distortedR = r + n * 0.01;

    float ring = smoothstep(0.01, 0.0, abs(distortedR - ringR));

    // Brightness fades outward — inner rings are brighter (more protected)
    float brightness = 1.0 - fi * 0.07;

    // Width of glow around ring
    float glow = exp(-(distortedR - ringR) * (distortedR - ringR) * 800.0) * 0.3;

    vec3 ringColor = palette(
      fi * 0.1 + t * 0.04,
      vec3(0.65, 0.5, 0.18),
      vec3(0.4, 0.3, 0.12),
      vec3(1.0, 0.85, 0.4),
      vec3(fi * 0.01, 0.08, 0.12)
    );

    color += ringColor * (ring + glow) * brightness * (0.8 + bass * 0.1);
  }

  // Protected inner glow — the sanctum itself
  float innerGlow = exp(-r * 6.0) * 1.0;
  float deepCore = exp(-r * 14.0) * 0.7;

  // The sanctum has an especially warm, safe glow
  vec3 sanctumColor = palette(
    t * 0.08,
    vec3(0.8, 0.6, 0.25),
    vec3(0.3, 0.25, 0.1),
    vec3(1.0, 0.9, 0.5),
    vec3(0.0, 0.05, 0.08)
  );

  color += sanctumColor * innerGlow * (1.0 + amp * 0.2);
  color += vec3(1.0, 0.95, 0.85) * deepCore;

  // Subtle angular wavering — protective barrier shimmer
  float shimmer = sin(angle * 12.0 + t * 1.5 + r * 10.0) * 0.5 + 0.5;
  shimmer *= exp(-r * 3.0) * 0.08 * treble;
  color += vec3(1.0, 0.9, 0.65) * shimmer;

  // Warm fill between rings
  float n = fbm3(uv * 3.0 + t * 0.15);
  float fill = (n * 0.5 + 0.5) * exp(-r * 2.5) * 0.12;
  color += vec3(0.5, 0.38, 0.12) * fill;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
