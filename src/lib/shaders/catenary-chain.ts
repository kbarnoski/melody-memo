import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Chain of catenary curves linked end-to-end
// Multiple cosh curves connected at their endpoints, swaying, 60 points per link

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;
  vec3 color = vec3(0.0);

  int numLinks = 5;
  float linkWidth = 0.4;
  float startX = -1.0;

  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float x0 = startX + fj * linkWidth;
    float x1 = x0 + linkWidth;

    // Sway the endpoints
    float sway = sin(t * 0.8 + fj * 0.9) * 0.06 + u_mid * 0.02 * sin(t + fj);
    float y0 = 0.1 + sin(t * 0.5 + fj * 1.2) * 0.05 + sway;
    float y1 = 0.1 + sin(t * 0.5 + (fj + 1.0) * 1.2) * 0.05 - sway;

    // Catenary: y = a * cosh((x - center) / a) + offset
    float center = (x0 + x1) * 0.5;
    float halfSpan = (x1 - x0) * 0.5;
    // a controls the sag
    float sag = 0.15 + u_bass * 0.04 + sin(t * 0.3 + fj * 0.7) * 0.03;
    float a = sag;
    float yMid = (y0 + y1) * 0.5;
    float yDrop = a * (cosh(halfSpan / a) - 1.0);

    for (int i = 0; i < 60; i++) {
      float fi = float(i) / 60.0;
      float x = mix(x0, x1, fi);
      float localX = x - center;
      float y = yMid - yDrop + a * (cosh(localX / a) - 1.0);
      // Interpolate endpoint heights
      y += mix(y0 - yMid, y1 - yMid, fi) * 0.5;
      y = -y; // hang downward

      vec2 p = rot2(sin(t * 0.1) * 0.1) * vec2(x, y);
      float d = length(uv - p);
      float glow = 0.003 / (d + 0.001);
      float phase = fi * 0.3 + fj * 0.2 + t * 0.12;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.8, 0.5), vec3(0.0, 0.1, 0.2));
      color += c * glow * 0.07;
    }

    // Glowing connection nodes at endpoints
    vec2 n0 = rot2(sin(t * 0.1) * 0.1) * vec2(x0, -y0);
    float nd = length(uv - n0);
    float nGlow = 0.004 / (nd + 0.003);
    color += vec3(1.0, 0.9, 0.7) * nGlow * 0.15;
  }

  // Final node
  float lastX = startX + float(numLinks) * linkWidth;
  float lastY = 0.1 + sin(t * 0.5 + float(numLinks) * 1.2) * 0.05;
  vec2 lastN = rot2(sin(t * 0.1) * 0.1) * vec2(lastX, -lastY);
  float lastD = length(uv - lastN);
  color += vec3(1.0, 0.9, 0.7) * 0.004 / (lastD + 0.003) * 0.15;

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
