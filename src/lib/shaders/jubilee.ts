import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Jubilee — Celebration: multiple radiant bursts in sequence

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float mid = 0.5 + 0.5 * sin(u_mid * 3.14159);

  vec3 color = vec3(0.0);

  // Multiple burst points that ignite in sequence
  for (int i = 0; i < 7; i++) {
    float fi = float(i);

    // Each burst has a fixed position
    float bx = sin(fi * 2.4 + 1.0) * 0.35;
    float by = cos(fi * 1.7 + 0.5) * 0.3;
    vec2 burstPos = vec2(bx, by);

    // Burst timing — each ignites at a different phase
    float burstPhase = mod(t * 0.6 - fi * 0.4, 3.5);
    float burstActive = smoothstep(0.0, 0.3, burstPhase) * smoothstep(3.0, 1.5, burstPhase);

    if (burstActive > 0.01) {
      vec2 d = uv - burstPos;
      float r = length(d);
      float angle = atan(d.y, d.x);

      // Radial burst rays
      float rays = 0.0;
      for (int j = 0; j < 8; j++) {
        float fj = float(j);
        float rayAngle = fj * 0.7854;
        float rayDist = abs(sin(angle - rayAngle));
        float ray = exp(-rayDist * 15.0) * exp(-r * 4.0 / (burstPhase * 0.5 + 0.5));
        rays += ray;
      }

      // Central glow of burst
      float glow = exp(-r * 8.0 / (burstPhase * 0.3 + 0.3)) * burstActive;

      // Expanding ring
      float ringR = burstPhase * 0.25;
      float ring = smoothstep(0.015, 0.0, abs(r - ringR)) * smoothstep(2.5, 0.5, burstPhase);

      // Warm golden color varying per burst
      vec3 burstColor = palette(
        fi * 0.25 + t * 0.05,
        vec3(0.7, 0.5, 0.2),
        vec3(0.4, 0.35, 0.15),
        vec3(1.0, 0.85, 0.4),
        vec3(fi * 0.03, 0.1, 0.15)
      );

      color += burstColor * (rays * 0.3 + glow + ring * 0.6) * burstActive;
    }
  }

  // Warm ambient underlayer
  float n = fbm3(uv * 2.0 + t * 0.2);
  float ambient = (n * 0.5 + 0.5) * exp(-dot(uv, uv) * 1.5) * 0.15;
  color += vec3(0.5, 0.35, 0.1) * ambient;

  // Central persistent warmth
  color += vec3(0.15, 0.1, 0.03) * exp(-dot(uv, uv) * 2.0) * (0.8 + bass * 0.2);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
