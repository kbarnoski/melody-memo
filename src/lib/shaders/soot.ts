import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Soot — dense particulate settling downward through dark air

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

  // Particle field — hash-based soot particles drifting down
  for (int i = 0; i < 30; i++) {
    float fi = float(i);
    vec2 seed = vec2(fi * 1.17, fi * 2.93);
    vec2 basePos = hash2(seed);

    // Slow downward drift with slight horizontal wander
    float fallSpeed = 0.05 + 0.03 * fract(sin(fi * 47.3) * 1000.0);
    float yPos = fract(basePos.y - t * fallSpeed);
    float xPos = basePos.x + sin(t * 0.3 + fi * 0.7) * 0.05;

    vec2 pos = vec2(xPos, yPos * 2.0 - 1.0);
    float dist = length(uv - pos);

    // Particle size varies
    float size = 0.003 + 0.002 * fract(sin(fi * 31.7) * 1000.0);
    float particle = smoothstep(size, size * 0.3, dist);

    // Dark grey particles on black
    float grey = 0.03 + 0.02 * fract(sin(fi * 73.1) * 1000.0);
    color += vec3(grey) * particle;
  }

  // Background turbulence — very subtle dark haze
  float haze = fbm3(uv * 3.0 + vec2(t * 0.1, -t * 0.15));
  color += vec3(0.006, 0.005, 0.007) * (haze * 0.5 + 0.5);

  // Slight density variation — thicker areas
  float density = fbm3(uv * 1.5 + vec2(0.0, -t * 0.2) + 5.0);
  color += vec3(0.004) * smoothstep(0.0, 0.3, density);

  // Audio — particles drift slightly more in response
  color *= 1.0 + 0.06 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
