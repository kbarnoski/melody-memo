import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Ossuary — layered geometric forms suggesting stacked remains

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

  // Stacked horizontal dark rectangles
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float yOffset = (fi - 3.5) * 0.11;

    // Slight variation in position and size
    float xShift = sin(fi * 1.7 + t * 0.2) * 0.02;
    float width = 0.25 + 0.1 * sin(fi * 2.3 + 1.0);
    float height = 0.035 + 0.01 * sin(fi * 3.1);

    vec2 boxPos = vec2(xShift, yOffset);
    float box = sdBox(uv - boxPos, vec2(width, height));

    // Dark rectangle fill
    float fill = smoothstep(0.005, 0.0, box);
    float grey = 0.015 + 0.008 * sin(fi * 1.9);
    color += vec3(grey, grey * 0.9, grey * 1.1) * fill;

    // Thin light gap between stacked forms
    float gap = smoothstep(0.003, 0.0, abs(box)) * 0.04;
    vec3 gapColor = palette(fi * 0.15 + t * 0.1,
      vec3(0.02, 0.015, 0.01),
      vec3(0.03, 0.02, 0.015),
      vec3(0.7, 0.5, 0.3),
      vec3(0.1, 0.15, 0.2)
    );
    color += gapColor * gap;
  }

  // Subtle fbm texture over everything
  float tex = fbm3(uv * 6.0 + t * 0.05) * 0.005;
  color += vec3(tex);

  // Very faint vertical light seeping down from above
  float lightAbove = smoothstep(0.5, 0.0, uv.y) * smoothstep(-0.5, 0.0, uv.y);
  lightAbove *= exp(-abs(uv.x) * 5.0) * 0.005;
  color += vec3(0.01, 0.008, 0.006) * lightAbove;

  // Audio — slight brightening of gaps
  color *= 1.0 + 0.06 * u_bass;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
