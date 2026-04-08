import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Rotating parametric curve frames creating animation illusion
// Multiple angular slices of a rotating curve, each slightly phase-shifted, 60 points per slice

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.2;
  vec3 color = vec3(0.0);

  float PI = 3.14159;
  int numSlices = 8;

  for (int j = 0; j < 8; j++) {
    float fj = float(j);
    float sliceAngle = fj / 8.0 * 6.28318;
    float phaseDelay = fj * 0.12;

    // Each slice is a parametric "running figure" — a deformed circle
    for (int i = 0; i < 60; i++) {
      float fi = float(i) / 60.0;
      float theta = fi * 6.28318;

      // Parametric shape that changes with phase (animation frames)
      float anim = t * 1.5 - phaseDelay;
      float rx = 0.12 + 0.04 * sin(theta * 3.0 + anim * 3.0) + u_bass * 0.01;
      float ry = 0.12 + 0.04 * cos(theta * 2.0 + anim * 2.0 + u_mid * 0.3);
      vec2 local = vec2(rx * cos(theta), ry * sin(theta));

      // Place at slice position around a circle
      float orbitR = 0.35 + u_amplitude * 0.05;
      vec2 center = vec2(cos(sliceAngle + t * 0.3), sin(sliceAngle + t * 0.3)) * orbitR;
      vec2 p = center + rot2(sliceAngle) * local;

      float d = length(uv - p);
      float glow = 0.002 / (d + 0.001);
      float phase = fi + fj * 0.125 + t * 0.15;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.8, 0.5), vec3(0.0, 0.2, 0.3));
      // Fade slices that are further from "playback head"
      float proximity = cos(sliceAngle - t * 0.3);
      float fade = 0.3 + 0.7 * max(proximity, 0.0);
      color += c * glow * 0.05 * fade;
    }
  }

  // Central disc outline
  float discD = abs(length(uv) - 0.35);
  float discGlow = 0.001 / (discD + 0.002);
  color += vec3(0.4, 0.3, 0.5) * discGlow * 0.15;

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
