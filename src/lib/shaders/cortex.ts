import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Cortex — brain surface folds, sinuous ridges and valleys

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  float bass = u_bass * 0.2;
  float mid = u_mid * 0.15;
  float treble = u_treble * 0.1;

  // Domain warping for organic folding
  vec2 p = uv * 2.5;

  // First warp layer — large folds (gyri)
  vec2 warp1 = vec2(
    fbm3(p + vec2(t * 0.1, 0.0) + bass * 0.3),
    fbm3(p + vec2(0.0, t * 0.08) + vec2(5.2, 1.3))
  );

  // Second warp layer — smaller sulci detail
  vec2 warp2 = vec2(
    fbm3(p + warp1 * 1.5 + vec2(1.7, 9.2) + mid * 0.2),
    fbm3(p + warp1 * 1.5 + vec2(8.3, 2.8) + treble * 0.1)
  );

  // Combined warped noise — the surface height map
  float surface = fbm3(p + warp2 * 1.2 + t * 0.05);

  // Compute local gradient for ridge/valley detection
  float eps = 0.01;
  float sx = fbm3(p + warp2 * 1.2 + t * 0.05 + vec2(eps, 0.0));
  float sy = fbm3(p + warp2 * 1.2 + t * 0.05 + vec2(0.0, eps));
  float gradient = length(vec2(sx - surface, sy - surface)) / eps;

  // Ridges are where gradient is high — gyri crests
  float ridge = smoothstep(0.3, 1.2, gradient);
  // Valleys are where surface is low — sulci
  float valley = smoothstep(0.1, -0.3, surface);

  // Base brain tissue color — pinkish gray
  vec3 tissueColor = palette(
    surface * 0.3 + t * 0.01 + u_amplitude * 0.1,
    vec3(0.35, 0.2, 0.22),
    vec3(0.15, 0.08, 0.1),
    vec3(0.5, 0.3, 0.35),
    vec3(0.0, 0.05, 0.1)
  );

  // Ridge highlight — brighter, more saturated
  vec3 ridgeColor = palette(
    surface * 0.4 + 0.3 + t * 0.015,
    vec3(0.45, 0.3, 0.32),
    vec3(0.2, 0.12, 0.15),
    vec3(0.6, 0.4, 0.45),
    vec3(0.05, 0.08, 0.12)
  );

  // Valley shadow — deep, dark
  vec3 valleyColor = palette(
    surface * 0.2 + 0.6,
    vec3(0.08, 0.04, 0.06),
    vec3(0.05, 0.03, 0.05),
    vec3(0.2, 0.1, 0.2),
    vec3(0.0, 0.02, 0.08)
  );

  // Compose layers
  vec3 color = tissueColor;
  color = mix(color, ridgeColor, ridge * 0.7);
  color = mix(color, valleyColor, valley * 0.5);

  // Neural activity — electrical sparks along ridges
  float activity = sin(surface * 20.0 + t * 3.0 + warp1.x * 5.0) * 0.5 + 0.5;
  activity = pow(activity, 8.0); // sharp spikes
  activity *= ridge; // only on ridges
  float activityPulse = 0.5 + 0.5 * sin(t * 2.0 + bass * 5.0);

  vec3 sparkColor = palette(
    activity * 0.5 + t * 0.03 + treble * 2.0,
    vec3(0.5, 0.3, 0.6),
    vec3(0.4, 0.2, 0.5),
    vec3(0.8, 0.5, 1.0),
    vec3(0.1, 0.0, 0.3)
  );
  color += sparkColor * activity * activityPulse * 0.4;

  // Subtle pulsing glow — hemispheric
  float hemi = smoothstep(0.5, -0.2, uv.x + sin(t * 0.3) * 0.3);
  color += vec3(0.05, 0.02, 0.03) * hemi * (0.5 + bass * 0.5);

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
