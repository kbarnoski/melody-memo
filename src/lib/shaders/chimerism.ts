import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Chimerism — two organic textures merging at a shifting boundary

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  float bass = u_bass * 0.2;
  float mid = u_mid * 0.18;
  float treble = u_treble * 0.12;

  // Animated boundary — a wavy divide that shifts
  float boundary = sin(uv.y * 3.5 + t * 0.8) * 0.15
                 + sin(uv.y * 7.0 - t * 1.2) * 0.06
                 + fbm3(vec2(uv.y * 2.0, t * 0.3)) * 0.2
                 + bass * 0.1 * sin(uv.y * 5.0 + t);
  float boundaryMask = smoothstep(-0.08, 0.08, uv.x - boundary);

  // Texture A — flowing coral-like (warm side, left)
  vec2 pA = uv * 3.0;
  vec2 warpA = vec2(
    fbm3(pA + vec2(t * 0.15, 1.0)),
    fbm3(pA + vec2(3.5, t * 0.12))
  );
  float texA = fbm3(pA + warpA * 0.8 + t * 0.05);

  // Texture A colors — warm coral/rose
  vec3 colorA = palette(
    texA * 0.5 + t * 0.02 + u_amplitude * 0.1,
    vec3(0.4, 0.15, 0.12),
    vec3(0.3, 0.12, 0.1),
    vec3(0.8, 0.4, 0.3),
    vec3(0.0, 0.1, 0.05)
  );

  // Ridge highlighting on A
  float epsA = 0.02;
  float texAx = fbm3(pA + warpA * 0.8 + t * 0.05 + vec2(epsA, 0.0));
  float texAy = fbm3(pA + warpA * 0.8 + t * 0.05 + vec2(0.0, epsA));
  float ridgeA = length(vec2(texAx - texA, texAy - texA)) / epsA;
  ridgeA = smoothstep(0.3, 1.0, ridgeA);
  colorA += vec3(0.15, 0.08, 0.06) * ridgeA;

  // Texture B — flowing algae-like (cool side, right)
  vec2 pB = uv * 2.5 + vec2(10.0, 5.0);
  vec2 warpB = vec2(
    fbm3(pB + vec2(t * 0.1, 7.0)),
    fbm3(pB + vec2(2.0, t * 0.13))
  );
  float texB = fbm3(pB + warpB * 1.0 + t * 0.04);

  // Texture B colors — cool teal/green
  vec3 colorB = palette(
    texB * 0.5 + t * 0.02 + u_amplitude * 0.1 + 0.5,
    vec3(0.08, 0.25, 0.3),
    vec3(0.08, 0.2, 0.25),
    vec3(0.3, 0.7, 0.6),
    vec3(0.0, 0.15, 0.2)
  );

  // Ridge highlighting on B
  float texBx = fbm3(pB + warpB * 1.0 + t * 0.04 + vec2(epsA, 0.0));
  float texBy = fbm3(pB + warpB * 1.0 + t * 0.04 + vec2(0.0, epsA));
  float ridgeB = length(vec2(texBx - texB, texBy - texB)) / epsA;
  ridgeB = smoothstep(0.3, 1.0, ridgeB);
  colorB += vec3(0.05, 0.1, 0.08) * ridgeB;

  // Mix the two textures along the boundary
  vec3 color = mix(colorA, colorB, boundaryMask);

  // Boundary zone — bright reactive merge zone
  float boundaryGlow = 1.0 - smoothstep(0.0, 0.1, abs(uv.x - boundary));
  float mergeActivity = 0.5 + 0.5 * sin(uv.y * 15.0 + t * 3.0 + mid * 5.0);
  mergeActivity = pow(mergeActivity, 3.0);

  vec3 mergeColor = palette(
    uv.y * 0.3 + t * 0.03 + treble,
    vec3(0.5, 0.35, 0.3),
    vec3(0.3, 0.25, 0.2),
    vec3(0.9, 0.6, 0.5),
    vec3(0.05, 0.1, 0.1)
  );

  color += mergeColor * boundaryGlow * mergeActivity * 0.3;

  // Mixing tendrils — each side reaching into the other
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 5.3, fi * 8.7));
    float yPos = -0.5 + fi * 0.18 + h.x * 0.1;
    float reachDir = (fi < 3.0) ? 1.0 : -1.0;
    float reach = sin(t * 0.5 + fi * 1.2) * 0.15 * reachDir;

    vec2 tendrilPos = vec2(boundary + reach, yPos + sin(t * 0.3 + fi) * 0.05);
    float d = length(uv - tendrilPos);
    float tendrilGlow = 0.001 / (d * d + 0.001);
    tendrilGlow *= 0.5 + 0.5 * sin(t * 1.5 + fi * 2.0);

    vec3 tColor = (fi < 3.0) ? colorA : colorB;
    color += tColor * tendrilGlow * 0.03;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
