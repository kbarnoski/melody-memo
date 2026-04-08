import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Pyre — dying embers in darkness, hot points cooling

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  vec3 color = vec3(0.0);

  // Scattered embers — use hash-based positions
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    vec2 seed = vec2(fi * 1.73, fi * 2.31);
    vec2 pos = hash2(seed) * 0.7;

    // Slow drift upward
    pos.y += sin(t * 0.5 + fi) * 0.05;
    pos.x += sin(t * 0.3 + fi * 1.5) * 0.03;

    float dist = length(uv - pos);

    // Ember cycle — fade in and out
    float cycle = sin(t * 0.4 + fi * 0.9) * 0.5 + 0.5;
    float brightness = cycle * cycle * 0.12;

    // Hot core — orange to red falloff
    float ember = exp(-dist * 50.0) * brightness;
    vec3 emberColor = mix(vec3(0.1, 0.02, 0.0), vec3(0.12, 0.06, 0.01), cycle);
    color += emberColor * ember * (1.0 + 0.2 * u_bass);

    // Tiny glow halo
    float glow = exp(-dist * 15.0) * brightness * 0.1;
    color += vec3(0.04, 0.01, 0.0) * glow;
  }

  // Ash texture — very faint
  float ash = fbm3(uv * 5.0 + vec2(0.0, -t * 0.2)) * 0.008;
  color += vec3(ash);

  // Faint smoke rising
  float smoke = fbm3(vec2(uv.x * 3.0, uv.y * 2.0 - t * 0.4)) * 0.01;
  smoke *= smoothstep(-0.2, 0.3, uv.y);
  color += vec3(0.01, 0.008, 0.006) * smoke * (1.0 + 0.1 * u_amplitude);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
