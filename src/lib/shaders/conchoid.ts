import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Conchoid of Nicomedes shells-within-shells building outward
// r = a/cos(theta) + b, nested at 4 scales, 70 points each

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.14;
  vec3 color = vec3(0.0);

  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float a = 0.15 + fj * 0.08 + u_bass * 0.03;
    float b = 0.2 + fj * 0.12 + sin(t + fj) * 0.05;
    float baseAngle = t * (0.3 + fj * 0.1);

    for (int i = 0; i < 70; i++) {
      float fi = float(i) / 70.0;
      float theta = fi * 6.28318 - 3.14159;
      float cosTheta = cos(theta);
      // Avoid division by near-zero
      float safecos = sign(cosTheta) * max(abs(cosTheta), 0.05);
      float r = a / safecos + b;
      vec2 p = vec2(r * cos(theta), r * sin(theta));
      p = rot2(baseAngle) * p;

      float d = length(uv - p);
      float glow = 0.003 / (d + 0.001);
      float phase = fi + fj * 0.25 + t * 0.15;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.8, 0.6), vec3(0.0, 0.33, 0.67));
      color += c * glow * 0.06;
    }
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
