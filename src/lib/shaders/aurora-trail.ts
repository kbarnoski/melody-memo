import { U, SMOOTH_NOISE, VISIONARY_PALETTE } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  `
// ---- Aurora Trail ----
// Flowing ribbons of small luminous points snaking in sinusoidal waves.
// Multiple ribbon layers at different speeds and amplitudes.
// Bass widens ribbons, treble increases particle density. Ethereal and flowing.

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.12;
  vec3 color = vec3(0.0);

  // Deep dark background with slight blue
  color = vec3(0.003, 0.005, 0.015);

  // Number of particle samples per ribbon — treble adds density
  // Base 50, up to ~70 with treble
  float densityF = 50.0 + u_treble * 20.0;
  int density = 50; // Fixed loop count, we'll use densityF for spacing

  // Ribbon width from bass
  float ribbonWidth = 0.03 + u_bass * 0.04;

  // 6 ribbon layers
  for (int ribbon = 0; ribbon < 6; ribbon++) {
    float fr = float(ribbon);

    // Each ribbon has different: vertical offset, speed, wave amplitude, color
    float yBase = -0.4 + fr * 0.14 + sin(t * 0.2 + fr * 1.3) * 0.05;
    float speed = (0.8 + fr * 0.15) * (1.0 + u_amplitude * 0.3);
    float waveAmp = 0.06 + fr * 0.01 + u_mid * 0.02;
    float waveFreq = 3.0 + fr * 0.5;

    // Draw particles along the ribbon
    for (int i = 0; i < 60; i++) {
      float fi = float(i);
      if (fi >= densityF) continue;

      // Horizontal position spans the screen
      float xParam = -0.9 + fi * 1.8 / densityF;

      // Vertical position: sinusoidal wave + noise for organic feel
      float wave1 = sin(xParam * waveFreq + t * speed + fr * 1.5) * waveAmp;
      float wave2 = sin(xParam * waveFreq * 1.7 + t * speed * 0.7 + fr * 2.3) * waveAmp * 0.5;
      float noiseOff = snoise(vec2(xParam * 2.0 + t * 0.3, fr * 3.7)) * 0.03;

      float yPos = yBase + wave1 + wave2 + noiseOff;

      // Add vertical spread within the ribbon (multiple sub-particles)
      for (int sub = 0; sub < 3; sub++) {
        float fs = float(sub);
        float subOff = (fs - 1.0) * ribbonWidth;
        subOff += snoise(vec2(xParam * 5.0 + fs * 7.1, t * 0.5 + fr * 2.0)) * ribbonWidth * 0.5;

        vec2 pt = vec2(xParam, yPos + subOff);
        float d = length(uv - pt);

        // Intensity varies along the ribbon for shimmer
        float shimmer = 0.5 + 0.5 * sin(fi * 0.7 + t * 3.0 + fr * 2.0 + fs * 1.5);
        shimmer = shimmer * shimmer;

        float glow = exp(-d * (70.0 + u_mid * 10.0)) * shimmer;
        float core = smoothstep(0.004, 0.0, d) * shimmer;

        // Aurora colors: greens, teals, purples, shifting per ribbon
        vec3 col = palette(
          fr * 0.16 + xParam * 0.3 + t * 0.1 + u_amplitude * 0.15,
          vec3(0.5, 0.55, 0.5),
          vec3(0.4, 0.45, 0.4),
          vec3(0.5, 1.0, 0.8),
          vec3(0.0, 0.15 + fr * 0.04, 0.2)
        );

        color += col * glow * 0.04;
        color += col * core * 0.06;
      }
    }

    // Soft diffuse glow underlying each ribbon (aurora backdrop)
    float ribbonDist = abs(uv.y - yBase);
    float ribbonGlow = exp(-ribbonDist * ribbonDist / (ribbonWidth * ribbonWidth * 8.0)) * 0.03;
    vec3 ribbonCol = palette(
      fr * 0.16 + t * 0.08,
      vec3(0.4, 0.5, 0.45),
      vec3(0.3, 0.4, 0.35),
      vec3(0.4, 0.9, 0.7),
      vec3(0.05, 0.2, 0.25)
    );
    color += ribbonCol * ribbonGlow * (0.5 + u_amplitude * 0.3);
  }

  // Vignette — soft edges
  float vig = 1.0 - smoothstep(0.5, 1.4, length(uv * vec2(0.8, 1.0)));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
