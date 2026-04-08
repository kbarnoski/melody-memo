import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Residuum — faint structure of what once was, ghost afterimage

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

  // Ghost structure — faded fbm3 architectural forms
  float structure = fbm3(uv * 2.5 + t * 0.05);
  float structLines = smoothstep(0.01, 0.0, abs(structure - 0.1))
                    + smoothstep(0.01, 0.0, abs(structure + 0.2)) * 0.7;

  // Very faint — like a burned-in afterimage
  float fade = sin(t * 0.2) * 0.3 + 0.5; // slow breathing fade
  vec3 ghostColor = palette(structure * 0.5 + t * 0.08,
    vec3(0.01, 0.008, 0.015),
    vec3(0.015, 0.01, 0.02),
    vec3(0.5, 0.4, 0.7),
    vec3(0.2, 0.15, 0.3)
  );
  color += ghostColor * structLines * 0.04 * fade;

  // Residual glow — faint warm center
  float dist = length(uv);
  float residualGlow = exp(-dist * 3.0) * 0.015 * fade;
  color += vec3(0.015, 0.01, 0.02) * residualGlow;

  // Phantom noise — barely visible texture
  float phantom = fbm3(uv * 6.0 - t * 0.08);
  color += vec3(0.004, 0.003, 0.005) * (phantom * 0.5 + 0.5);

  // Faint geometric echo — circles that once were
  float ring1 = exp(-abs(dist - 0.3) * 40.0) * 0.015 * fade;
  float ring2 = exp(-abs(dist - 0.5) * 40.0) * 0.008 * fade;
  color += vec3(0.01, 0.008, 0.015) * (ring1 + ring2);

  // Audio response — subtle brightening
  color *= 1.0 + 0.08 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
