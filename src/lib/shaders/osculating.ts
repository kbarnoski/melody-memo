import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Osculating circles rolling along a master curve
// A smooth base curve with circles of curvature visualized at several points

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 color = vec3(0.0);

  // Master curve — a smooth sinusoidal path
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float x = (fi - 0.5) * 2.4;
    float amp = 0.35 + u_bass * 0.05;
    float y = amp * sin(x * 3.0 + t);
    vec2 p = vec2(x, y);
    float d = length(uv - p);
    float glow = 0.002 / (d + 0.001);
    vec3 c = palette(fi + t * 0.1, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
    color += c * glow * 0.06;
  }

  // Osculating circles at 6 points along the curve
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float xi = (fk / 5.0 - 0.5) * 2.4;
    // Move the contact point along the curve over time
    xi += sin(t * 0.5 + fk * 0.8) * 0.2;
    float amp = 0.35 + u_bass * 0.05;
    float freq = 3.0;

    // y and derivatives
    float yi = amp * sin(freq * xi + t);
    float dy = amp * freq * cos(freq * xi + t);
    float ddy = -amp * freq * freq * sin(freq * xi + t);

    // Curvature radius: R = (1 + y'^2)^(3/2) / |y''|
    float denom = abs(ddy) + 0.01;
    float R = pow(1.0 + dy * dy, 1.5) / denom;
    R = min(R, 1.5); // clamp for visual sanity

    // Normal direction (pointing toward center of curvature)
    float nx = -dy;
    float ny = 1.0;
    float nl = sqrt(nx * nx + ny * ny);
    nx /= nl; ny /= nl;
    float signCurv = sign(ddy) * -1.0;
    vec2 center = vec2(xi, yi) + vec2(nx, ny) * R * signCurv;

    // Draw osculating circle
    for (int i = 0; i < 50; i++) {
      float fi = float(i) / 50.0;
      float theta = fi * 6.28318;
      vec2 cp = center + vec2(cos(theta), sin(theta)) * R;
      float d = length(uv - cp);
      float glow = 0.0015 / (d + 0.001);
      float phase = fk * 0.166 + t * 0.2 + 0.3;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                        vec3(0.6, 1.0, 0.8), vec3(0.2, 0.1, 0.3));
      color += c * glow * 0.03;
    }

    // Center of curvature dot
    float cd = length(uv - center);
    color += vec3(1.0, 0.9, 0.7) * 0.003 / (cd + 0.003) * 0.2;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
