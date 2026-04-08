import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Tabernacle — Dwelling of light: layered luminous enclosure

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

float rectFrame(vec2 p, vec2 size, float thickness) {
  vec2 d = abs(p) - size;
  float outer = max(d.x, d.y);
  vec2 d2 = abs(p) - (size - vec2(thickness));
  float inner = max(d2.x, d2.y);
  return smoothstep(0.01, 0.0, outer) * smoothstep(0.0, 0.01, inner);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  vec3 color = vec3(0.0);

  // Nested rectangular frames of light — sacred interior
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float scale = 0.6 - fi * 0.06;
    float breathe = sin(t * 0.8 + fi * 0.4) * 0.01;
    vec2 size = vec2(scale + breathe, scale * 0.7 + breathe * 0.7);

    // Slight rotation per frame
    float rotAngle = sin(t * 0.2 + fi * 0.3) * 0.03;
    vec2 ruv = rot2(rotAngle) * uv;

    // Noise distortion on frame edges
    float n = fbm3(ruv * 5.0 + vec2(fi, t * 0.3));
    ruv += vec2(n * 0.008);

    float frame = rectFrame(ruv, size, 0.008 + 0.003 * sin(t + fi));
    float frameFade = 1.0 - fi * 0.08;

    // Gold color that warms toward interior
    vec3 frameColor = palette(
      fi * 0.12 + t * 0.06,
      vec3(0.6 + fi * 0.03, 0.45, 0.15),
      vec3(0.4, 0.3, 0.1),
      vec3(1.0, 0.85, 0.4),
      vec3(0.0, 0.08, 0.15)
    );

    color += frameColor * frame * frameFade * (0.8 + bass * 0.15);
  }

  // Interior sacred glow — brightest at the innermost space
  float r = length(uv);
  float innerGlow = exp(-r * 6.0) * 0.8;
  float deepGlow = exp(-r * 12.0) * 0.5;
  color += vec3(1.0, 0.9, 0.6) * innerGlow * (1.0 + amp * 0.2);
  color += vec3(1.0, 0.95, 0.85) * deepGlow;

  // Soft light fills the enclosure
  float n = fbm3(uv * 3.0 + t * 0.15);
  float fill = (n * 0.5 + 0.5) * exp(-r * 2.0) * 0.2;
  color += vec3(0.6, 0.45, 0.2) * fill;

  // Corner glow accents
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float a = fi * 1.5708 + 0.7854;
    vec2 corner = vec2(cos(a), sin(a)) * 0.45;
    float cGlow = exp(-length(uv - corner) * 6.0) * 0.15;
    color += vec3(0.8, 0.65, 0.3) * cGlow;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
