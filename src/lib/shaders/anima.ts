import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Anima — Soul essence: small luminous body trailing wisps

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
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  // Central luminous body with gentle drift
  vec2 center = vec2(sin(t * 0.8) * 0.05, cos(t * 0.6) * 0.04);
  float r = length(uv - center);

  // Bright core
  float core = exp(-r * 12.0) * 2.0;
  float innerGlow = exp(-r * 5.0) * 0.8;

  // Trailing wisps — like a luminous jellyfish
  float wisps = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float angle = fi * 0.628 + sin(t * 0.3 + fi) * 0.3;

    // Wisp curves downward/outward
    float wispLen = 0.3 + 0.15 * sin(t + fi * 0.7);
    for (int j = 0; j < 8; j++) {
      float fj = float(j) / 8.0;
      vec2 wispPos = center;
      wispPos += vec2(cos(angle), sin(angle)) * fj * wispLen;

      // Noise displacement along wisp
      float n = fbm3(vec2(fi + fj * 3.0, t * 0.5));
      wispPos += vec2(n * 0.04, n * 0.03);

      // Gravity-like droop
      wispPos.y -= fj * fj * 0.15;

      float d = length(uv - wispPos);
      float thickness = 0.012 * (1.0 - fj * 0.7);
      float fade = (1.0 - fj) * 0.6;
      wisps += smoothstep(thickness, 0.0, d) * fade;
    }
  }

  // Soul color — warm gold with inner white
  vec3 coreColor = vec3(1.0, 0.95, 0.8) * core;
  vec3 glowColor = palette(
    r * 2.0 + t * 0.2,
    vec3(0.7, 0.5, 0.2),
    vec3(0.4, 0.3, 0.15),
    vec3(1.0, 0.8, 0.4),
    vec3(0.0, 0.1, 0.1)
  ) * innerGlow;

  vec3 wispColor = palette(
    wisps + t * 0.15,
    vec3(0.5, 0.35, 0.1),
    vec3(0.4, 0.3, 0.1),
    vec3(1.0, 0.7, 0.3),
    vec3(0.05, 0.1, 0.2)
  );

  vec3 color = vec3(0.0);
  color += coreColor;
  color += glowColor * (1.0 + bass * 0.3);
  color += wispColor * wisps * (0.5 + amp * 0.3);

  // Ambient warmth
  color += vec3(0.08, 0.04, 0.01) * exp(-r * 1.5);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
