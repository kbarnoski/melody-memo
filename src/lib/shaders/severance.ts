import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Severance — form torn in two, drifting apart, light from wound

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  vec3 color = vec3(0.0);

  // Halves drifting apart — slow oscillation
  float drift = sin(t * 0.15) * 0.15 + 0.08; // minimum gap
  float tearLine = fbm3(vec2(0.0, uv.y * 3.0 + t * 0.2)) * 0.08; // jagged tear

  // Left half
  float leftEdge = -tearLine - drift * 0.5;
  float leftForm = smoothstep(leftEdge + 0.01, leftEdge - 0.1, uv.x);
  leftForm *= smoothstep(0.6, 0.5, abs(uv.y)); // vertical extent

  // Right half
  float rightEdge = tearLine + drift * 0.5;
  float rightForm = smoothstep(rightEdge - 0.01, rightEdge + 0.1, uv.x);
  rightForm *= smoothstep(0.6, 0.5, abs(uv.y));

  // Dark forms — near-black with subtle texture
  float tex = fbm3(uv * 5.0 + t * 0.05) * 0.015;
  color += vec3(tex * 0.5, tex * 0.3, tex * 0.6) * (leftForm + rightForm);

  // Bright wound between halves — light escaping from the tear
  float inGap = smoothstep(leftEdge, leftEdge + 0.02, uv.x) *
                smoothstep(rightEdge, rightEdge - 0.02, uv.x);
  inGap *= smoothstep(0.6, 0.4, abs(uv.y));

  // Wound glow — brightest at center of gap
  float gapCenter = (leftEdge + rightEdge) * 0.5;
  float woundBright = inGap * exp(-abs(uv.x - gapCenter) * 15.0 / max(drift, 0.01));
  vec3 woundColor = palette(uv.y * 0.5 + t * 0.2,
    vec3(0.05, 0.03, 0.01),
    vec3(0.06, 0.04, 0.02),
    vec3(1.0, 0.7, 0.4),
    vec3(0.0, 0.1, 0.25)
  );
  color += woundColor * woundBright * 0.1 * (1.0 + 0.15 * u_bass);

  // Edge glow on torn faces
  float leftEdgeGlow = exp(-abs(uv.x - leftEdge) * 40.0) * leftForm * 0.04;
  float rightEdgeGlow = exp(-abs(uv.x - rightEdge) * 40.0) * rightForm * 0.04;
  color += vec3(0.04, 0.025, 0.01) * (leftEdgeGlow + rightEdgeGlow);

  // Audio
  color *= 1.0 + 0.1 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
