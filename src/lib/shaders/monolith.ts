import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Monolith — massive dark rectangular form with faint light at edges

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

  // Monolith SDF — tall dark rectangle
  float aspect = 0.25 + 0.02 * sin(t * 0.5);
  float box = sdBox(uv, vec2(aspect, 0.55));

  // Interior is near-black with subtle texture
  float interior = fbm3(uv * 3.0 + t * 0.3) * 0.02;
  color += vec3(interior) * smoothstep(0.0, -0.05, box);

  // Edge glow — thin luminous line at boundary
  float edge = exp(-abs(box) * 40.0);
  float audioEdge = 0.06 + 0.04 * sin(u_bass * 0.3 + t);
  vec3 edgeColor = palette(t * 0.2 + uv.y * 0.3, vec3(0.02), vec3(0.05), vec3(1.0, 0.8, 0.6), vec3(0.0, 0.1, 0.2));
  color += edgeColor * edge * audioEdge;

  // Faint vertical light streaks near edges
  float streakL = exp(-abs(uv.x + aspect) * 60.0) * 0.03;
  float streakR = exp(-abs(uv.x - aspect) * 60.0) * 0.03;
  color += vec3(0.04, 0.03, 0.05) * (streakL + streakR) * (1.0 + 0.2 * sin(uv.y * 8.0 + t));

  // Ambient haze around monolith
  float haze = exp(-box * 2.0) * 0.01;
  color += vec3(0.02, 0.015, 0.025) * haze * (1.0 + 0.15 * u_amplitude);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
