import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Sepulchre — dark horizontal strata with faint light between cracks

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  vec3 color = vec3(0.0);

  // Horizontal strata — layered bands
  float strataY = uv.y * 6.0;
  float warp = fbm3(vec2(uv.x * 2.0 + t * 0.2, strataY * 0.3)) * 0.4;
  float strata = fract(strataY + warp);

  // Thin bright seams between layers
  float seam = smoothstep(0.02, 0.0, strata) + smoothstep(0.98, 1.0, strata);
  float seamBright = seam * (0.08 + 0.04 * sin(t + uv.x * 3.0));
  vec3 seamColor = palette(uv.x * 0.5 + t * 0.1, vec3(0.04), vec3(0.06), vec3(0.8, 0.6, 0.4), vec3(0.0, 0.15, 0.3));
  color += seamColor * seamBright * (1.0 + 0.2 * u_bass);

  // Dark rock texture on the strata
  float rockTex = fbm3(uv * 8.0 + vec2(t * 0.1, 0.0)) * 0.015;
  color += vec3(rockTex * 0.5, rockTex * 0.4, rockTex * 0.6);

  // Deeper cracks — occasional brighter fissures
  float crack = fbm3(vec2(uv.x * 12.0, uv.y * 1.5 + t * 0.15));
  float crackLine = smoothstep(0.01, 0.0, abs(crack)) * 0.04;
  color += vec3(0.06, 0.03, 0.02) * crackLine;

  // Faint geological glow from below
  float underglow = exp(-(uv.y + 0.5) * 3.0) * 0.02;
  color += vec3(0.04, 0.02, 0.01) * underglow * (1.0 + 0.15 * u_amplitude);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
