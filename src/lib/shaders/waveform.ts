import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Overlapping audio waveforms in Lissajous space
// 4 layered waveform traces responding to different audio bands, 80 points each

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.2;
  vec3 color = vec3(0.0);

  // Waveform 1 — bass-driven Lissajous
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 6.28318 * 2.0;
    float x = 0.4 * sin(theta * 2.0 + t) * (1.0 + u_bass * 0.2);
    float y = 0.4 * sin(theta * 3.0 + t * 1.3);
    vec2 p = vec2(x, y);
    float d = length(uv - p);
    float glow = 0.003 / (d + 0.001);
    vec3 c = palette(fi + t * 0.1, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(1.0, 0.3, 0.3), vec3(0.0, 0.1, 0.2));
    color += c * glow * 0.06;
  }

  // Waveform 2 — mid-driven
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 6.28318 * 2.0;
    float x = 0.35 * sin(theta * 3.0 + t * 0.8) * (1.0 + u_mid * 0.2);
    float y = 0.35 * sin(theta * 4.0 + t * 1.1);
    vec2 p = rot2(0.3) * vec2(x, y);
    float d = length(uv - p);
    float glow = 0.0025 / (d + 0.001);
    vec3 c = palette(fi + t * 0.1 + 0.25, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(0.3, 1.0, 0.5), vec3(0.1, 0.2, 0.1));
    color += c * glow * 0.05;
  }

  // Waveform 3 — treble-driven
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 6.28318 * 2.0;
    float x = 0.3 * sin(theta * 5.0 + t * 1.5) * (1.0 + u_treble * 0.2);
    float y = 0.3 * sin(theta * 4.0 + t * 0.9);
    vec2 p = rot2(-0.4) * vec2(x, y);
    float d = length(uv - p);
    float glow = 0.002 / (d + 0.001);
    vec3 c = palette(fi + t * 0.1 + 0.5, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(0.4, 0.4, 1.0), vec3(0.15, 0.1, 0.3));
    color += c * glow * 0.05;
  }

  // Waveform 4 — amplitude-driven
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 6.28318 * 2.0;
    float x = 0.25 * sin(theta * 1.0 + t * 0.6) * (1.0 + u_amplitude * 0.3);
    float y = 0.25 * sin(theta * 2.0 + t * 1.7);
    vec2 p = rot2(t * 0.1) * vec2(x, y);
    float d = length(uv - p);
    float glow = 0.002 / (d + 0.001);
    vec3 c = palette(fi + t * 0.1 + 0.75, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                      vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
    color += c * glow * 0.05;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
