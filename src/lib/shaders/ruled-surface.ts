import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Straight lines swept into a curved surface illusion
// 40 straight lines connecting two curves, sweeping in time

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;
  vec3 color = vec3(0.0);

  for (int i = 0; i < 40; i++) {
    float fi = float(i) / 40.0;
    float param = (fi - 0.5) * 2.0;

    // Upper curve — sinusoidal
    float topX = param;
    float topY = 0.4 + 0.15 * sin(param * 4.0 + t + u_bass * 0.3);

    // Lower curve — cosine shifted
    float botX = param + sin(t * 0.3 + fi * 3.0) * 0.1;
    float botY = -0.4 + 0.15 * cos(param * 3.0 + t * 0.7 + u_mid * 0.3);

    vec2 a = rot2(t * 0.15) * vec2(topX, topY);
    vec2 b = rot2(t * 0.15) * vec2(botX, botY);

    // Distance from uv to line segment
    vec2 pa = uv - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);

    float glow = 0.0015 / (d + 0.0008);
    float phase = fi + h * 0.3 + t * 0.12;
    vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
    // Fade towards line midpoint for surface highlight
    float midBright = 1.0 + exp(-16.0 * (h - 0.5) * (h - 0.5)) * 0.5;
    color += c * glow * 0.05 * midBright;
  }

  // Trace the upper and lower guide curves more brightly
  for (int i = 0; i < 60; i++) {
    float fi = float(i) / 60.0;
    float param = (fi - 0.5) * 2.0;

    vec2 top = rot2(t * 0.15) * vec2(param, 0.4 + 0.15 * sin(param * 4.0 + t + u_bass * 0.3));
    vec2 bot = rot2(t * 0.15) * vec2(param + sin(t * 0.3 + fi * 3.0) * 0.1,
                                       -0.4 + 0.15 * cos(param * 3.0 + t * 0.7 + u_mid * 0.3));
    float d1 = length(uv - top);
    float d2 = length(uv - bot);
    float g1 = 0.002 / (d1 + 0.001);
    float g2 = 0.002 / (d2 + 0.001);
    color += vec3(0.9, 0.85, 1.0) * (g1 + g2) * 0.03;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
