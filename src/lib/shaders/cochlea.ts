import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Logarithmic spiral with internal chamber divisions
// r = a * e^(b*theta) with radial dividers creating shell chambers

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.12;
  vec3 color = vec3(0.0);

  float a = 0.02;
  float b = 0.15 + u_bass * 0.02;
  float rotBase = t * 0.3;

  // Main logarithmic spiral — 80 points over many revolutions
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 20.0; // ~3 full turns
    float r = a * exp(b * theta);

    if (r < 1.2) {
      vec2 p = rot2(rotBase) * vec2(r * cos(theta), r * sin(theta));
      float d = length(uv - p);
      float glow = 0.0025 / (d + 0.001);
      float phase = fi * 0.5 + t * 0.15;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.8, 0.5), vec3(0.0, 0.1, 0.2));
      color += c * glow * 0.07;
    }
  }

  // Chamber dividers — radial lines at each half-turn
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float divAngle = fk * 3.14159 + sin(t * 0.4 + fk) * 0.15;
    float rStart = a * exp(b * divAngle);
    float rEnd = a * exp(b * (divAngle + 3.14159));

    for (int i = 0; i < 30; i++) {
      float fi = float(i) / 30.0;
      float r = mix(rStart, rEnd, fi);
      if (r < 1.2) {
        vec2 p = rot2(rotBase) * vec2(r * cos(divAngle), r * sin(divAngle));
        float d = length(uv - p);
        float glow = 0.0015 / (d + 0.001);
        float phase = fk * 0.14 + t * 0.1 + 0.5;
        vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                          vec3(0.6, 0.9, 1.0), vec3(0.1, 0.2, 0.35));
        color += c * glow * 0.04;
      }
    }
  }

  // Inner core glow
  vec2 core = rot2(rotBase) * vec2(0.0, 0.0);
  float coreD = length(uv - core);
  float coreGlow = 0.006 / (coreD + 0.005);
  color += vec3(1.0, 0.85, 0.6) * coreGlow * (0.3 + u_amplitude * 0.15);

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
