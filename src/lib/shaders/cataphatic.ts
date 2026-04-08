import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Cataphatic — Positive theology: additive overlapping lights

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

  vec3 color = vec3(0.0);

  // Multiple overlapping circles of warm colored light — additive blending
  for (int i = 0; i < 7; i++) {
    float fi = float(i);

    // Each light orbits slowly
    float orbitAngle = fi * 0.8976 + t * (0.2 + fi * 0.03);
    float orbitR = 0.15 + fi * 0.03;
    vec2 pos = vec2(cos(orbitAngle), sin(orbitAngle)) * orbitR;

    // Circle glow
    float d = length(uv - pos);
    float glow = exp(-d * d * 8.0);

    // Noise modulation for organic feel
    float n = fbm3(pos * 5.0 + t * 0.3);
    glow *= (0.7 + n * 0.3);

    // Each circle has a slightly different warm hue
    vec3 lightColor = palette(
      fi * 0.18 + t * 0.04,
      vec3(0.65, 0.5, 0.2),
      vec3(0.35, 0.3, 0.15),
      vec3(1.0, 0.8 - fi * 0.03, 0.35),
      vec3(fi * 0.02, 0.1, 0.15)
    );

    // Additive — each layer adds light
    color += lightColor * glow * (0.35 + bass * 0.08);
  }

  // Where lights overlap, the center becomes very bright (additive result)
  // Add extra bright center where everything converges
  float centerBright = exp(-dot(uv, uv) * 6.0) * 0.5;
  color += vec3(1.0, 0.95, 0.8) * centerBright * (1.0 + amp * 0.3);

  // Soft noise underlayer
  float n = fbm3(uv * 2.0 + t * 0.15);
  float underlayer = (n * 0.5 + 0.5) * exp(-dot(uv, uv) * 2.0) * 0.1;
  color += vec3(0.5, 0.4, 0.15) * underlayer;

  // Subtle outer ring as a frame
  float r = length(uv);
  float ring = smoothstep(0.02, 0.0, abs(r - 0.55)) * 0.15;
  color += vec3(0.6, 0.45, 0.2) * ring;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
