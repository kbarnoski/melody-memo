import { U, VISIONARY_PALETTE } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + `
// 5-7 sine waves at irrational frequency ratios creating beating patterns
// Frequencies: pi, e, sqrt(2), sqrt(3), phi ratios, 80 points per wave

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.12;
  vec3 color = vec3(0.0);

  // Irrational frequency ratios
  float freqs[7];
  freqs[0] = 3.14159;   // pi
  freqs[1] = 2.71828;   // e
  freqs[2] = 1.41421;   // sqrt(2)
  freqs[3] = 1.73205;   // sqrt(3)
  freqs[4] = 1.61803;   // phi
  freqs[5] = 2.23607;   // sqrt(5)
  freqs[6] = 1.25992;   // cbrt(2)

  for (int j = 0; j < 7; j++) {
    float fj = float(j);
    float freq = freqs[j];
    float amp = 0.15 + sin(t + fj * 0.9) * 0.05 + u_bass * 0.03;
    float yBase = (fj - 3.0) * 0.1;

    for (int i = 0; i < 80; i++) {
      float fi = float(i) / 80.0;
      float x = (fi - 0.5) * 2.2;
      float y = amp * sin(freq * x * 4.0 + t * freq * 0.5 + u_mid * 0.3) + yBase;
      vec2 p = vec2(x, y);

      float d = length(uv - p);
      float glow = 0.002 / (d + 0.001);
      float phase = fj * 0.143 + fi * 0.3 + t * 0.1;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.8, 0.6), vec3(0.0, 0.1, 0.2));
      color += c * glow * 0.04;
    }
  }

  // Beating interference highlight — where waves align
  float beat = 0.0;
  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float freq = freqs[j];
    beat += sin(freq * uv.x * 8.0 + t * freq * 0.5);
  }
  beat = beat / 5.0;
  float beatGlow = exp(-8.0 * (1.0 - beat * beat)) * 0.08;
  color += vec3(0.9, 0.8, 1.0) * beatGlow * (0.5 + u_treble * 0.2);

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
