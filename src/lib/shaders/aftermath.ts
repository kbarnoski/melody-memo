import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Aftermath — settling debris field, dark scattered fragments drifting down

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;
  vec3 color = vec3(0.0);

  // Debris fragments — dark rectangles drifting down
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    vec2 seed = vec2(fi * 1.37, fi * 2.71);
    vec2 basePos = hash2(seed);

    // Settling motion — fast at first then slowing
    float fallPhase = fract(t * 0.03 + fi * 0.13);
    float settle = 1.0 - exp(-fallPhase * 3.0); // decelerating
    float yPos = basePos.y - settle * 0.6;
    float xPos = basePos.x + sin(t * 0.2 + fi) * 0.02 * (1.0 - settle);

    vec2 pos = vec2(xPos, yPos);

    // Rotate fragment
    float rot = fi * 0.7 + t * 0.1 * (1.0 - settle);
    vec2 localUV = rot2(rot) * (uv - pos);

    // Fragment shape — small dark rectangles
    float size1 = 0.01 + 0.015 * fract(sin(fi * 47.3) * 1000.0);
    float size2 = 0.005 + 0.01 * fract(sin(fi * 73.1) * 1000.0);
    float frag = smoothstep(0.002, 0.0, sdBox(localUV, vec2(size1, size2)));

    // Dark grey fragments
    float grey = 0.03 + 0.02 * fract(sin(fi * 31.7) * 1000.0);
    color += vec3(grey * 0.8, grey * 0.7, grey) * frag;
  }

  // Dust haze — very faint
  float dust = fbm3(uv * 3.0 + vec2(t * 0.05, -t * 0.1)) * 0.5 + 0.5;
  color += vec3(0.005, 0.004, 0.006) * dust;

  // Faint settling dust at bottom
  float groundDust = smoothstep(0.0, -0.4, uv.y) * 0.01;
  color += vec3(0.008, 0.006, 0.005) * groundDust;

  // Audio
  color *= 1.0 + 0.06 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
