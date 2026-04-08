import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Cissoid of Diocles — cusp-shaped curves compressing toward a singularity
// y^2 = x^3 / (2a - x), 3 layers converging, 60 points each

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.16;
  vec3 color = vec3(0.0);

  for (int j = 0; j < 3; j++) {
    float fj = float(j);
    float a = 0.3 + fj * 0.15 + u_mid * 0.04;
    float phase_off = fj * 2.094 + t * 0.5;
    float scale = 0.6 + fj * 0.2;

    // Trace both branches (positive and negative y)
    for (int i = 0; i < 60; i++) {
      float fi = float(i) / 60.0;
      float x = fi * (2.0 * a - 0.05);  // x in [0, 2a)
      float denom = 2.0 * a - x;
      float ySq = x * x * x / max(denom, 0.01);
      float y = sqrt(max(ySq, 0.0));

      vec2 p1 = vec2(x - a, y) * scale * 0.5;
      vec2 p2 = vec2(x - a, -y) * scale * 0.5;
      p1 = rot2(phase_off * 0.4) * p1;
      p2 = rot2(phase_off * 0.4) * p2;

      float d1 = length(uv - p1);
      float d2 = length(uv - p2);
      float glow1 = 0.003 / (d1 + 0.001);
      float glow2 = 0.003 / (d2 + 0.001);
      float phase = fi + fj * 0.33 + t * 0.2;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(0.8, 0.6, 1.0), vec3(0.1, 0.2, 0.35));
      color += c * (glow1 + glow2) * 0.06;
    }
  }

  // Bright cusp singularity glow
  float cuspD = length(uv - vec2(-0.15, 0.0));
  color += vec3(0.9, 0.7, 1.0) * 0.01 / (cuspD + 0.01) * (0.5 + u_bass * 0.2);

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
