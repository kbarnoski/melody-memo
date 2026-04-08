import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Catharsis — pressure building then releasing, compression/burst cycle

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  vec3 color = vec3(0.0);

  // Slow cycle — compression then release
  float cycle = fract(t * 0.08);
  float compress = smoothstep(0.0, 0.85, cycle); // long compression
  float burst = smoothstep(0.85, 0.9, cycle) * smoothstep(1.0, 0.92, cycle); // brief burst

  // Contracting dark forms during compression
  float scale = mix(2.0, 6.0, compress);
  vec2 compUV = uv * scale;
  float darkForm = fbm3(compUV + t * 0.2);
  float formShape = smoothstep(-0.1, 0.2, darkForm) * 0.04 * (1.0 - burst);
  color += vec3(0.02, 0.015, 0.025) * formShape;

  // Pressure lines converging to center
  float angle = atan(uv.y, uv.x);
  float dist = length(uv);
  float pressureLine = sin(angle * 8.0 + t * 0.5) * 0.5 + 0.5;
  pressureLine *= smoothstep(0.8, 0.2, dist) * compress * 0.02;
  color += vec3(0.01, 0.008, 0.02) * pressureLine;

  // Burst flash — brief bright expansion
  float burstRing = exp(-abs(dist - burst * 0.8) * 20.0) * burst;
  vec3 burstColor = palette(angle * 0.2, vec3(0.05), vec3(0.08), vec3(1.0, 0.7, 0.4), vec3(0.0, 0.1, 0.2));
  color += burstColor * burstRing * 0.12 * (1.0 + 0.2 * u_bass);

  // Residual glow after burst
  float residual = burst * exp(-dist * 4.0) * 0.04;
  color += vec3(0.04, 0.02, 0.01) * residual;

  // Dark ambient texture
  color += vec3(0.003, 0.002, 0.004) * (1.0 + fbm3(uv * 4.0) * 0.3);

  // Audio modulation on compression intensity
  color *= 1.0 + 0.1 * u_amplitude * compress;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
