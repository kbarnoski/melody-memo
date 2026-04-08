import { U, VISIONARY_PALETTE } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + `
// Chladni vibrating plate nodal lines — standing wave patterns
// cos(n*pi*x)*cos(m*pi*y) - cos(m*pi*x)*cos(n*pi*y) = 0
// Rendered as bright lines where value is near zero

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.1;
  vec3 color = vec3(0.0);

  float PI = 3.14159;

  // Smoothly interpolate mode numbers
  float n1 = 2.0 + sin(t * 0.7) * 1.5 + u_bass * 0.5;
  float m1 = 3.0 + cos(t * 0.5) * 1.5 + u_mid * 0.5;

  float n2 = 4.0 + sin(t * 0.3 + 1.5) * 1.0;
  float m2 = 1.0 + cos(t * 0.9 + 2.0) * 1.0;

  // First Chladni pattern
  float val1 = cos(n1 * PI * uv.x) * cos(m1 * PI * uv.y)
             - cos(m1 * PI * uv.x) * cos(n1 * PI * uv.y);
  float line1 = exp(-abs(val1) * 12.0);
  vec3 c1 = palette(val1 * 0.5 + t * 0.15, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                     vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
  color += c1 * line1 * 0.7;

  // Second Chladni pattern overlaid
  float val2 = cos(n2 * PI * uv.x) * cos(m2 * PI * uv.y)
             - cos(m2 * PI * uv.x) * cos(n2 * PI * uv.y);
  float line2 = exp(-abs(val2) * 14.0);
  vec3 c2 = palette(val2 * 0.5 + t * 0.15 + 0.5, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                     vec3(0.6, 1.0, 0.8), vec3(0.2, 0.1, 0.3));
  color += c2 * line2 * 0.4;

  // Nodal intersection highlights
  float intersect = line1 * line2;
  color += vec3(1.0, 0.95, 0.9) * intersect * 0.5 * (0.5 + u_amplitude * 0.3);

  // Subtle plate boundary
  float plate = smoothstep(0.48, 0.5, max(abs(uv.x), abs(uv.y)));
  color *= 1.0 - plate * 0.7;

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
