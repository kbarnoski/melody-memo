import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Lectio — Sacred reading: horizontal flowing luminous patterns

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.07;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float mid = 0.5 + 0.5 * sin(u_mid * 3.14159);

  vec3 color = vec3(0.0);

  // Horizontal bands of warm light — like lines of sacred text
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float yPos = (fi - 5.5) * 0.07;

    // Noise creates the "text" pattern flowing left to right
    float textNoise = fbm3(vec2(uv.x * 6.0 - t * (0.4 + fi * 0.03), fi * 4.0 + yPos * 10.0));
    textNoise = smoothstep(-0.1, 0.4, textNoise); // threshold to create gaps (like words)

    // Band shape
    float y = uv.y - yPos;
    float band = exp(-y * y * 200.0);

    // "Reading" highlight — a bright spot that moves across
    float readPos = mod(t * 0.3 + fi * 0.15, 2.0) - 1.0;
    float readHighlight = exp(-(uv.x - readPos) * (uv.x - readPos) * 8.0) * 0.4;

    // Shimmer
    float shimmer = sin(uv.x * 20.0 - t * 2.0 + fi * 3.0) * 0.5 + 0.5;
    shimmer *= 0.2;

    // Color per line — warm gold
    vec3 lineColor = palette(
      fi * 0.08 + t * 0.03,
      vec3(0.6, 0.45, 0.15),
      vec3(0.35, 0.28, 0.1),
      vec3(1.0, 0.8, 0.4),
      vec3(0.0, 0.08, 0.15)
    );

    float intensity = band * textNoise * (0.4 + readHighlight + shimmer);
    intensity *= (0.7 + mid * 0.2);
    intensity *= (1.0 - abs(fi - 5.5) * 0.06); // fade toward edges

    color += lineColor * intensity;
  }

  // Central glow — the illuminated page
  float r = length(uv);
  float pageGlow = exp(-r * 2.0) * 0.2;
  color += vec3(0.5, 0.4, 0.15) * pageGlow;

  // Bright reading focus area
  float focus = exp(-uv.y * uv.y * 8.0 - uv.x * uv.x * 2.0) * 0.15;
  color += vec3(0.8, 0.65, 0.3) * focus * (1.0 + bass * 0.2);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
