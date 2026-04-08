import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Nocturne — blue-black undulations barely perceptible

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;
  vec3 color = vec3(0.0);

  // Extremely subtle wave layers — dark blue-black
  vec2 wave1UV = uv * 2.0 + vec2(t * 0.15, 0.0);
  float wave1 = fbm3(wave1UV) * 0.5 + 0.5;

  vec2 wave2UV = uv * 1.5 + vec2(-t * 0.1, t * 0.08);
  wave2UV = rot2(0.3) * wave2UV;
  float wave2 = fbm3(wave2UV) * 0.5 + 0.5;

  // Combine waves — very low amplitude
  float combined = wave1 * 0.5 + wave2 * 0.5;

  // Dark blue-indigo-black palette
  vec3 nightColor = palette(combined * 0.3 + t * 0.05,
    vec3(0.005, 0.005, 0.015),
    vec3(0.01, 0.008, 0.02),
    vec3(0.5, 0.6, 1.0),
    vec3(0.2, 0.15, 0.35)
  );

  color += nightColor * 0.8;

  // Slow undulating brightness variation
  float undulate = sin(uv.x * 3.0 + t * 0.5) * sin(uv.y * 2.0 + t * 0.3);
  color += vec3(0.002, 0.003, 0.006) * (undulate * 0.5 + 0.5);

  // Very subtle audio response — breathing
  float breath = 1.0 + 0.05 * sin(u_amplitude * 0.5 + t);
  color *= breath;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
