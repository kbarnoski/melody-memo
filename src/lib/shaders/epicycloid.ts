import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Epicycloid gear-tooth curves with rolling circles
// Outer circle rolling on inner, tracing pointed curves, multiple gear ratios

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 color = vec3(0.0);

  // Multiple epicycloid curves with different gear ratios
  for (int j = 0; j < 4; j++) {
    float fj = float(j);

    // Gear ratio: R/r determines number of cusps
    float R = 0.25 + fj * 0.05;
    float cusps = 3.0 + fj * 2.0; // 3, 5, 7, 9 cusps
    float r = R / cusps;
    float scale = 0.7 - fj * 0.08;

    float phaseOff = t * (0.3 + fj * 0.1) + fj * 0.8;

    // Epicycloid: x = (R+r)*cos(t) - r*cos((R+r)/r * t)
    //             y = (R+r)*sin(t) - r*sin((R+r)/r * t)
    for (int i = 0; i < 80; i++) {
      float fi = float(i) / 80.0;
      float theta = fi * 6.28318 + phaseOff;
      float Rr = R + r;
      float ratio = Rr / r;
      float x = (Rr * cos(theta) - r * cos(ratio * theta)) * scale;
      float y = (Rr * sin(theta) - r * sin(ratio * theta)) * scale;

      // Audio modulation — smooth breathing
      float breathe = 1.0 + sin(t * 0.5 + fj) * 0.08 + u_bass * 0.05;
      vec2 p = rot2(t * 0.1) * vec2(x, y) * breathe;

      float d = length(uv - p);
      float glow = 0.003 / (d + 0.001);
      float phase = fi + fj * 0.25 + t * 0.12;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
      color += c * glow * 0.06;
    }

    // Rolling circle visualization
    float rollTheta = mod(t * 0.8 + fj * 1.5, 6.28318);
    vec2 rollCenter = vec2((R + r) * cos(rollTheta + phaseOff),
                           (R + r) * sin(rollTheta + phaseOff)) * scale;
    rollCenter = rot2(t * 0.1) * rollCenter;
    for (int i = 0; i < 30; i++) {
      float fi = float(i) / 30.0;
      float cTheta = fi * 6.28318;
      vec2 cp = rollCenter + vec2(cos(cTheta), sin(cTheta)) * r * scale;
      cp = rot2(t * 0.1) * (rot2(-t * 0.1) * cp); // keep rotation consistent
      float d = length(uv - cp);
      float glow = 0.001 / (d + 0.001);
      color += vec3(0.6, 0.5, 0.8) * glow * 0.02;
    }
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
