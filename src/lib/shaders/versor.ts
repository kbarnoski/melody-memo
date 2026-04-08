import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Quaternion-inspired rotating cross-sections
// Multiple rotating ellipses at different phases suggesting 4D rotation, 70 points per ellipse

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 color = vec3(0.0);

  // Simulate 4D rotation projected to 2D via changing ellipse parameters
  for (int j = 0; j < 6; j++) {
    float fj = float(j);
    float phi = t * (0.4 + fj * 0.1) + fj * 1.047;
    float psi = t * (0.3 + fj * 0.07) + fj * 0.8;

    // 4D rotation changes the apparent axes of the ellipse
    float rx = 0.3 + 0.15 * sin(phi) + u_bass * 0.03;
    float ry = 0.3 + 0.15 * cos(psi) + u_mid * 0.03;
    float rotAngle = phi * 0.5 + psi * 0.3;

    for (int i = 0; i < 70; i++) {
      float fi = float(i) / 70.0;
      float theta = fi * 6.28318;
      vec2 p = vec2(rx * cos(theta), ry * sin(theta));
      p = rot2(rotAngle) * p;

      float d = length(uv - p);
      float glow = 0.002 / (d + 0.001);

      // Depth cue — simulate z-depth from 4D projection
      float depth = 0.5 + 0.5 * sin(theta + phi);
      float brightness = 0.4 + depth * 0.6;

      float phase = fi + fj * 0.166 + t * 0.1;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(0.8, 0.6, 1.0), vec3(0.1, 0.2, 0.35));
      color += c * glow * 0.04 * brightness;
    }
  }

  // Central crossing glow — where all ellipses intersect
  float centerD = length(uv);
  float centerGlow = 0.005 / (centerD + 0.008);
  color += vec3(0.7, 0.6, 1.0) * centerGlow * (0.3 + u_amplitude * 0.15);

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
