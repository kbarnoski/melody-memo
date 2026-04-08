import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Credo — Bold statement: strong 8-fold symmetry, confident gold-white

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // 8-fold symmetry
  float symAngle = mod(angle + t * 0.1, 0.7854) - 0.3927;
  vec2 symUV = vec2(cos(symAngle), sin(symAngle)) * r;

  // Bold radial spokes — strong bright lines
  float spokes = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float spokeAngle = fi * 0.7854;
    float angDist = abs(sin(angle - spokeAngle - t * 0.1));
    float spoke = smoothstep(0.04, 0.0, angDist);
    spoke *= smoothstep(0.8, 0.1, r);

    // Bold intensity — stronger than usual
    spokes += spoke * 0.3;
  }

  // Secondary thinner spokes at 22.5 degree offsets
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float spokeAngle = fi * 0.7854 + 0.3927;
    float angDist = abs(sin(angle - spokeAngle - t * 0.1));
    float spoke = smoothstep(0.02, 0.0, angDist);
    spoke *= smoothstep(0.6, 0.15, r);
    spokes += spoke * 0.15;
  }

  // Concentric rings — bold and defined
  float rings = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ringR = 0.12 + fi * 0.12;
    float breathe = sin(t * 0.6 + fi * 0.5) * 0.008;
    float ring = smoothstep(0.012, 0.0, abs(r - ringR - breathe));
    rings += ring * (0.6 - fi * 0.08);
  }

  // Noise detail in the symmetry
  float n = fbm3(symUV * 8.0 + t * 0.4);
  float detail = (n * 0.5 + 0.5) * exp(-r * 2.5) * 0.3;

  // Central bright declaration
  float core = exp(-r * 7.0) * 1.5;
  float innerCore = exp(-r * 18.0) * 0.8;

  // Gold-white palette — bold and declarative
  vec3 spokeColor = palette(
    r * 1.5 + t * 0.1,
    vec3(0.8, 0.65, 0.25),
    vec3(0.4, 0.35, 0.15),
    vec3(1.0, 0.9, 0.5),
    vec3(0.0, 0.05, 0.1)
  );

  vec3 ringColor = palette(
    r * 2.0 + t * 0.06,
    vec3(0.7, 0.55, 0.2),
    vec3(0.45, 0.35, 0.15),
    vec3(1.0, 0.85, 0.4),
    vec3(0.0, 0.08, 0.15)
  );

  vec3 color = vec3(0.0);
  color += spokeColor * spokes * (0.9 + bass * 0.2);
  color += ringColor * rings;
  color += vec3(0.9, 0.75, 0.35) * detail;
  color += vec3(1.0, 0.9, 0.6) * core;
  color += vec3(1.0, 0.97, 0.9) * innerCore;

  // Bold edge glow on spokes intersection with rings
  float intersection = spokes * rings * 2.0;
  color += vec3(1.0, 0.95, 0.8) * intersection * 0.5;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
