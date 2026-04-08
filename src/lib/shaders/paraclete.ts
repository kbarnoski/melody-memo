import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Paraclete — Soft descending luminous forms, dove-like

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
  float treble = 0.5 + 0.5 * sin(u_treble * 3.14159);

  vec3 color = vec3(0.0);

  // Descending luminous feather/wing shapes
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float phase = fi * 0.7 + t * 0.3;

    // Horizontal position with gentle sway
    float xPos = sin(phase * 0.8 + fi * 2.3) * 0.4;
    // Downward descent — wrap around
    float yPos = mod(0.8 - t * 0.15 - fi * 0.18, 2.0) - 1.0;

    vec2 featherCenter = vec2(xPos, yPos);
    vec2 d = uv - featherCenter;

    // Rotate each feather slightly
    float rot = sin(t * 0.5 + fi) * 0.3;
    d = rot2(rot) * d;

    // Feather/wing shape — elongated horizontal ellipse with taper
    float wing = d.x * d.x * 4.0 + d.y * d.y * 25.0;
    float feather = exp(-wing * 30.0);

    // Trailing luminous edge
    float trail = exp(-(d.x * d.x * 2.0 + (d.y + 0.05) * (d.y + 0.05) * 60.0)) * 0.4;

    // Noise texture
    float n = fbm3(d * 10.0 + vec2(fi, t * 0.5));
    feather *= (0.7 + n * 0.3);

    // White-gold color, warmer for further ones
    vec3 featherColor = palette(
      fi * 0.15 + t * 0.05,
      vec3(0.85, 0.8, 0.6),
      vec3(0.2, 0.15, 0.1),
      vec3(1.0, 0.9, 0.6),
      vec3(0.0, 0.05, 0.1)
    );

    float intensity = 0.6 + 0.4 * (1.0 - fi * 0.08);
    color += featherColor * (feather + trail) * intensity;
  }

  // Upper source glow — where the forms descend from
  float sourceGlow = exp(-(uv.x * uv.x * 3.0 + (uv.y - 0.7) * (uv.y - 0.7) * 2.0));
  sourceGlow *= 0.4 * (1.0 + bass * 0.2);
  color += vec3(1.0, 0.95, 0.8) * sourceGlow;

  // Gentle overall luminosity
  float ambient = exp(-dot(uv, uv) * 1.5) * 0.1;
  color += vec3(0.8, 0.7, 0.5) * ambient;

  // Subtle sparkle from treble
  float sparkle = snoise(uv * 15.0 + t * 3.0);
  sparkle = smoothstep(0.65, 0.9, sparkle) * treble * 0.15;
  color += vec3(1.0, 0.95, 0.85) * sparkle;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
