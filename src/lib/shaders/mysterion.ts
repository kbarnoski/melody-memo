import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Mysterion — Hidden sacred: forms barely discernible in radiant fog

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float mid = 0.5 + 0.5 * sin(u_mid * 3.14159);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Radiant fog — layered noise
  float fog1 = fbm3(uv * 2.0 + t * 0.4);
  float fog2 = fbm3(uv * 3.0 - t * 0.3 + 10.0);
  float fog = (fog1 + fog2) * 0.5;
  fog = fog * 0.5 + 0.5; // normalize to 0..1

  // Fog brightness — bright near center, dim at edges
  float fogBright = fog * exp(-r * 1.5) * (1.0 + bass * 0.2);

  // Hidden geometric forms — very faint
  // Triangle form
  vec2 triUV = rot2(t * 0.1) * uv;
  float tri = abs(triUV.x) + abs(triUV.y + 0.15);
  tri = smoothstep(0.32, 0.28, tri) * 0.15;

  // Circle form
  float circle = smoothstep(0.02, 0.0, abs(r - 0.35 - sin(t * 0.5) * 0.03));
  circle *= 0.12;

  // Cross form
  vec2 crossUV = rot2(t * 0.08 + 0.78) * uv;
  float cross1 = smoothstep(0.015, 0.0, abs(crossUV.x)) * smoothstep(0.4, 0.0, abs(crossUV.y));
  float cross2 = smoothstep(0.015, 0.0, abs(crossUV.y)) * smoothstep(0.4, 0.0, abs(crossUV.x));
  float cross_shape = (cross1 + cross2) * 0.1;

  float hiddenForms = tri + circle + cross_shape;

  // These forms are only visible within the fog
  hiddenForms *= fog * (0.8 + mid * 0.2);

  // Warm golden fog palette
  vec3 fogColor = palette(
    fog + t * 0.1,
    vec3(0.5, 0.4, 0.2),
    vec3(0.3, 0.25, 0.1),
    vec3(1.0, 0.8, 0.4),
    vec3(0.0, 0.1, 0.15)
  );

  vec3 formColor = palette(
    hiddenForms * 3.0 + t * 0.05,
    vec3(0.8, 0.7, 0.4),
    vec3(0.3, 0.2, 0.1),
    vec3(1.0, 0.9, 0.6),
    vec3(0.0, 0.05, 0.1)
  );

  vec3 color = vec3(0.0);
  color += fogColor * fogBright * 0.6;
  color += formColor * hiddenForms;

  // Mysterious central glow
  float coreGlow = exp(-r * 4.0) * 0.5 * (1.0 + sin(t * 0.8) * 0.2);
  color += vec3(0.9, 0.75, 0.4) * coreGlow;

  // Ambient warmth
  color += vec3(0.06, 0.03, 0.01) * (1.0 - r * 0.5);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
