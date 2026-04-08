import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Endospore — dormant forms with layered walls, glowing inner core

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark dormant background
  float bgTex = fbm3(uv * 1.5 + t * 0.02);
  vec3 color = palette(
    bgTex * 0.2 + 0.6,
    vec3(0.02, 0.02, 0.03),
    vec3(0.01, 0.01, 0.02),
    vec3(0.06, 0.05, 0.1),
    vec3(0.0, 0.01, 0.04)
  );

  // 4 endospore bodies
  for (int sp = 0; sp < 4; sp++) {
    float fsp = float(sp);
    vec2 h = hash2(vec2(fsp * 5.7, fsp * 9.3));

    // Spore positions — slowly drifting
    vec2 center = vec2(
      (h.x - 0.5) * 1.0 + sin(t * 0.15 + fsp * 2.0) * 0.08,
      (h.y - 0.5) * 0.8 + cos(t * 0.12 + fsp * 1.5) * 0.06
    );

    float dist = length(uv - center);
    vec2 local = uv - center;
    float angle = atan(local.y, local.x);

    // 6 concentric shell layers
    for (int shell = 5; shell >= 0; shell--) {
      float fshell = float(shell);
      float shellFrac = fshell / 5.0;

      // Shell radius — outer to inner
      float shellR = 0.04 + shellFrac * 0.08 + bass * 0.01;

      // Shell wobble — dormant but alive
      float wobble = 1.0 + 0.03 * sin(angle * (3.0 + fshell) + t * 0.5 + fsp * 2.0);
      wobble += 0.015 * sin(angle * (7.0 + fshell * 2.0) - t * 0.3);
      float adjustedDist = dist / wobble;

      // Shell band
      float thickness = 0.005 + 0.002 * shellFrac;
      float band = smoothstep(thickness, 0.0, abs(adjustedDist - shellR));

      // Shell fill (for depth)
      float fill = smoothstep(shellR + 0.005, shellR - 0.005, adjustedDist);

      // Shell color — cooler outer, warmer inner
      float colorT = shellFrac * 0.5 + fsp * 0.15 + t * 0.015 + u_amplitude * 0.08;
      vec3 shellColor = palette(
        colorT,
        vec3(0.1 + shellFrac * 0.15, 0.08, 0.15),
        vec3(0.12, 0.08, 0.15),
        vec3(0.3 + shellFrac * 0.3, 0.2, 0.5),
        vec3(0.0 + shellFrac * 0.05, 0.05, 0.2)
      );

      // Wall texture — grainy protective coating
      float wallTex = fbm3(local * (20.0 + fshell * 5.0) + fsp * 10.0 + t * 0.03);
      wallTex = wallTex * 0.5 + 0.5;

      color += shellColor * band * (0.3 + wallTex * 0.2);
      color += shellColor * fill * 0.03 * (1.0 - shellFrac); // dim interior
    }

    // Glowing inner core — the dormant life
    float coreR = 0.035;
    float core = smoothstep(coreR, 0.0, dist);
    float corePulse = 0.4 + 0.6 * sin(t * 0.8 + fsp * 1.5 + bass * 2.0);

    // Core color — bright warm glow
    vec3 coreColor = palette(
      fsp * 0.2 + t * 0.025 + treble * 0.5,
      vec3(0.6, 0.4, 0.2),
      vec3(0.4, 0.3, 0.15),
      vec3(0.9, 0.7, 0.3),
      vec3(0.1, 0.08, 0.0)
    );

    // Bright nucleus at very center
    float nucleus = smoothstep(0.015, 0.0, dist);
    vec3 nucleusColor = palette(
      fsp * 0.15 + t * 0.03 + mid,
      vec3(0.8, 0.6, 0.3),
      vec3(0.5, 0.4, 0.2),
      vec3(1.0, 0.85, 0.5),
      vec3(0.15, 0.1, 0.0)
    );

    color += coreColor * core * corePulse * 0.4;
    color += nucleusColor * nucleus * corePulse * 0.6;

    // Radial glow emanating from core — subtle life signs
    float radialGlow = 0.003 / (dist + 0.01);
    radialGlow *= 0.5 + 0.5 * sin(t * 1.0 + fsp * 2.5);
    color += coreColor * radialGlow * 0.05;
  }

  // Ambient dormant particles
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 pp = hash2(vec2(fi * 9.3, fi * 7.1)) * 2.0 - 1.0;
    pp += vec2(sin(t * 0.1 + fi), cos(t * 0.08 + fi * 1.3)) * 0.05;
    float d = length(uv - pp);
    float glow = 0.0002 / (d * d + 0.0005);
    color += vec3(0.1, 0.08, 0.15) * glow;
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
