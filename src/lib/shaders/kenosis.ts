import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Kenosis — Self-emptying: luminous form dissolving outward

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Audio modulation — gentle sine-wave response
  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  // Central bright mass
  float core = exp(-r * 6.0) * (1.2 + bass * 0.3);

  // Dissolving particles expanding outward
  float expand = t * 0.5;
  float particles = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = fi * 0.7854 + t * 0.2;
    float dist = 0.15 + expand * (0.3 + fi * 0.08);
    dist = mod(dist, 1.2);
    vec2 pp = vec2(cos(a), sin(a)) * dist;
    float n = fbm3(pp * 3.0 + t);
    pp += vec2(n * 0.05);
    float d = length(uv - pp);
    float size = 0.04 + 0.02 * sin(t + fi);
    float fade = smoothstep(1.0, 0.2, dist);
    particles += smoothstep(size, size * 0.1, d) * fade * (0.5 + n * 0.3);
  }

  // Radial dissolving waves
  float wave = sin(r * 20.0 - t * 4.0) * 0.5 + 0.5;
  wave *= exp(-r * 3.0);
  float dissolve = fbm3(uv * 4.0 + t * 0.3) * 0.5 + 0.5;
  wave *= dissolve;

  // Golden palette
  vec3 coreColor = palette(
    r * 2.0 + t,
    vec3(0.6, 0.4, 0.2),
    vec3(0.5, 0.4, 0.2),
    vec3(1.0, 0.8, 0.4),
    vec3(0.0, 0.1, 0.15)
  );

  vec3 particleColor = palette(
    particles * 2.0 + t * 0.5,
    vec3(0.7, 0.5, 0.2),
    vec3(0.4, 0.3, 0.15),
    vec3(1.0, 0.7, 0.3),
    vec3(0.1, 0.05, 0.0)
  );

  vec3 color = vec3(0.0);
  color += coreColor * core * 1.5;
  color += particleColor * particles * 0.8;
  color += vec3(1.0, 0.9, 0.7) * wave * 0.4 * amp;

  // Warm ambient glow
  color += vec3(0.15, 0.08, 0.02) * exp(-r * 2.0);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
