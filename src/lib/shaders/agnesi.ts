import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Witch of Agnesi bell curves layered at different scales
// y = a^3 / (x^2 + a^2), 6 layers at different widths, 80 points each

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.12;
  vec3 color = vec3(0.0);

  for (int j = 0; j < 6; j++) {
    float fj = float(j);
    float a = 0.15 + fj * 0.1 + u_bass * 0.02;
    float a3 = a * a * a;
    float yOff = -0.3 + fj * 0.1 + sin(t * 0.8 + fj * 0.7) * 0.08;
    float rotAngle = sin(t * 0.3 + fj * 1.047) * 0.15 + u_mid * 0.05;

    for (int i = 0; i < 80; i++) {
      float fi = float(i) / 80.0;
      float x = (fi - 0.5) * 3.0;
      float y = a3 / (x * x + a * a);
      vec2 p = vec2(x * 0.4, y * 0.8 + yOff);
      p = rot2(rotAngle) * p;

      float d = length(uv - p);
      float glow = 0.0025 / (d + 0.001);
      float phase = fi * 0.5 + fj * 0.166 + t * 0.25;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 1.0, 0.5), vec3(0.0, 0.1, 0.2));
      color += c * glow * 0.05;
    }
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
