import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Void Bloom — dark flowers opening in absolute darkness

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

  // Opening cycle
  float openPhase = sin(t * 0.3) * 0.5 + 0.5; // 0 = closed, 1 = open

  // 4 petal-like forms
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float petalAngle = angle + fi * 1.5708; // pi/2 apart
    float petalDist = dist;

    // Petal shape — elongated in one direction
    float spread = openPhase * 0.5;
    vec2 petalUV = vec2(cos(petalAngle) * petalDist, sin(petalAngle) * petalDist);
    float petal = smoothstep(0.3 + spread, 0.25 + spread, length(petalUV - vec2(0.15 + spread * 0.2, 0.0)));
    petal *= smoothstep(0.0, 0.1, petalDist); // hollow center

    // Very subtle petal texture
    float tex = fbm3(petalUV * 8.0 + fi) * 0.3 + 0.7;
    petal *= tex;

    // Dark petal color — barely visible except at edges
    float edgeBright = smoothstep(0.05, 0.0, abs(length(petalUV - vec2(0.15 + spread * 0.2, 0.0)) - (0.27 + spread)));
    float petalBright = petal * 0.01 + edgeBright * 0.06;

    vec3 petalColor = palette(fi * 0.25 + t * 0.1,
      vec3(0.02, 0.01, 0.03),
      vec3(0.03, 0.02, 0.04),
      vec3(0.6, 0.3, 0.8),
      vec3(0.1, 0.2, 0.3)
    );
    color += petalColor * petalBright;
  }

  // Center pistil glow — tiny
  float center = exp(-dist * 40.0) * openPhase * 0.05;
  color += vec3(0.04, 0.02, 0.05) * center;

  // Audio
  color *= 1.0 + 0.08 * u_amplitude;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
