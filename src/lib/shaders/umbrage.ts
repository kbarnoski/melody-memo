import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Umbrage — tree-shadow patterns with light filtering through dark branches

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

  // Domain-warped branching shadows
  vec2 warpedUV = uv * 3.0;
  float warp1 = fbm3(warpedUV + vec2(t * 0.2, 0.0));
  float warp2 = fbm3(warpedUV + vec2(0.0, t * 0.15) + 5.0);
  vec2 branchUV = warpedUV + vec2(warp1, warp2) * 0.6;

  // Branch structure — dark overlapping forms
  float branch1 = smoothstep(0.05, 0.0, abs(snoise(branchUV * 1.5)));
  float branch2 = smoothstep(0.04, 0.0, abs(snoise(branchUV * 2.2 + 3.0)));
  float branches = max(branch1, branch2);

  // Dark canopy — branches block light
  float canopy = 1.0 - branches * 0.7;

  // Tiny light spots filtering through gaps
  float lightSpots = smoothstep(0.55, 0.6, fbm3(uv * 6.0 + t * 0.1));
  float dapple = lightSpots * canopy * (0.06 + 0.03 * sin(t * 0.7 + uv.x * 2.0));
  vec3 lightColor = palette(t * 0.15, vec3(0.03), vec3(0.04), vec3(0.6, 0.8, 0.5), vec3(0.1, 0.2, 0.0));
  color += lightColor * dapple * (1.0 + 0.15 * u_treble);

  // Very subtle ambient — dark green-black
  color += vec3(0.005, 0.008, 0.004) * (1.0 + fbm3(uv * 2.0 + t * 0.05) * 0.5);

  // Slight warmth where light touches
  color += vec3(0.01, 0.008, 0.003) * lightSpots * 0.3;

  // Audio-reactive sway in branches
  float sway = sin(t * 2.0 + uv.y * 3.0) * 0.003 * u_mid;
  color += vec3(0.01, 0.012, 0.008) * abs(sway);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
