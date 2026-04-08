import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Nested parabolic arcs sweeping in opposite directions
// 5 parabolas at different scales/rotations, 60 points each

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;
  vec3 color = vec3(0.0);

  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float dir = (mod(fj, 2.0) < 0.5) ? 1.0 : -1.0;
    float scale = 0.4 + fj * 0.15 + u_bass * 0.05;
    float angle = t * dir + fj * 1.2566;
    mat2 r = rot2(angle);

    for (int i = 0; i < 60; i++) {
      float fi = float(i) / 60.0;
      float x = (fi - 0.5) * 2.0;
      float a = 1.0 + sin(t * 0.7 + fj) * 0.5 + u_mid * 0.2;
      float y = a * x * x * dir;
      vec2 p = r * vec2(x, y) * scale;
      float d = length(uv - p);
      float glow = 0.003 / (d + 0.001);
      float phase = fi + fj * 0.2 + t * 0.3;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
      color += c * glow * 0.08;
    }
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
