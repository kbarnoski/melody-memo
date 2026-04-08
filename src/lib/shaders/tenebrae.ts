import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Tenebrae — lights extinguished one by one over time

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;
  vec3 color = vec3(0.0);

  // Full cycle period for all lights
  float cyclePeriod = 20.0; // seconds of t
  float phase = fract(t / cyclePeriod);

  // Seven candle-like light points
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    // Positions in a gentle arc
    float angle = (fi / 6.0 - 0.5) * 2.5;
    vec2 pos = vec2(sin(angle) * 0.5, cos(angle) * 0.15 - 0.05);

    // Each light extinguishes at a different phase
    float extinguishTime = (fi + 1.0) / 8.0;
    float alive = smoothstep(extinguishTime, extinguishTime - 0.04, phase);

    // Flickering
    float flicker = 0.7 + 0.3 * sin(t * 3.0 + fi * 2.1) * sin(t * 4.7 + fi * 1.3);
    float brightness = alive * flicker * 0.1;

    float dist = length(uv - pos);

    // Warm point light
    float light = exp(-dist * 30.0) * brightness;
    vec3 warmth = mix(vec3(0.12, 0.06, 0.02), vec3(0.1, 0.08, 0.04), fi / 6.0);
    color += warmth * light;

    // Soft halo
    float halo = exp(-dist * 8.0) * brightness * 0.15;
    color += vec3(0.03, 0.015, 0.005) * halo;
  }

  // Audio adds very subtle wavering
  color *= 1.0 + 0.08 * sin(u_mid * 0.3 + t);

  // Dark ambient
  color += vec3(0.002, 0.001, 0.003);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
