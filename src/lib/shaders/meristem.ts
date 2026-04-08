import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Meristem — growth tip actively dividing, pushing outward

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.07;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark fertile background
  float bgTex = fbm3(uv * 2.0 + t * 0.02);
  vec3 color = palette(
    bgTex * 0.2 + 0.5,
    vec3(0.02, 0.03, 0.02),
    vec3(0.01, 0.02, 0.01),
    vec3(0.06, 0.1, 0.05),
    vec3(0.0, 0.02, 0.01)
  );

  // Growing from center outward
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Growth wave — radial expansion over time
  float growthFront = 0.15 + 0.25 * (0.5 + 0.5 * sin(t * 0.3));
  growthFront += bass * 0.05;

  // Active division zone — ring at growth front
  float divisionZone = smoothstep(0.06, 0.0, abs(r - growthFront));
  float interior = smoothstep(growthFront + 0.02, growthFront - 0.05, r);

  // Cell-like pattern from domain-warped noise
  vec2 cellP = uv * 8.0;
  vec2 warp = vec2(
    fbm3(cellP + vec2(t * 0.2, 0.0)),
    fbm3(cellP + vec2(5.2, t * 0.15))
  );
  float cellPattern = fbm3(cellP + warp * 0.6 + t * 0.05);

  // Cells are smaller/denser near growth front, larger in interior
  float cellScale = mix(12.0, 6.0, smoothstep(0.0, growthFront, r));
  vec2 cellP2 = uv * cellScale;
  vec2 warp2 = vec2(
    fbm3(cellP2 + vec2(t * 0.15, 3.0)),
    fbm3(cellP2 + vec2(7.0, t * 0.12))
  );
  float cellDetail = fbm3(cellP2 + warp2 * 0.5);

  // Ridge detection for cell walls
  float eps = 0.015;
  float cx = fbm3(cellP2 + warp2 * 0.5 + vec2(eps, 0.0));
  float cy = fbm3(cellP2 + warp2 * 0.5 + vec2(0.0, eps));
  float cellWall = length(vec2(cx - cellDetail, cy - cellDetail)) / eps;
  cellWall = smoothstep(0.2, 0.8, cellWall);

  // Interior tissue color — green cellular
  float colorT = cellDetail * 0.3 + r * 0.2 + t * 0.02 + u_amplitude * 0.08;
  vec3 cellColor = palette(
    colorT,
    vec3(0.1, 0.2, 0.08),
    vec3(0.08, 0.15, 0.06),
    vec3(0.3, 0.6, 0.2),
    vec3(0.0, 0.1, 0.03)
  );

  // Division zone — brighter, more active cells
  vec3 divColor = palette(
    colorT + 0.2 + mid * 0.3,
    vec3(0.2, 0.35, 0.1),
    vec3(0.15, 0.25, 0.08),
    vec3(0.5, 0.8, 0.3),
    vec3(0.02, 0.12, 0.04)
  );

  // Cell wall color — darker outlines
  vec3 wallColor = palette(
    colorT + 0.5,
    vec3(0.04, 0.08, 0.03),
    vec3(0.03, 0.06, 0.02),
    vec3(0.15, 0.25, 0.08),
    vec3(0.0, 0.04, 0.01)
  );

  // Compose cellular interior
  vec3 tissue = mix(cellColor, divColor, divisionZone);
  tissue = mix(tissue, wallColor, cellWall * 0.6);
  color += tissue * interior * 0.5;

  // Division zone glow — mitotic activity
  float mitotic = sin(a * 6.0 + t * 2.0 + r * 15.0) * 0.5 + 0.5;
  mitotic = pow(mitotic, 4.0);
  mitotic *= divisionZone;

  vec3 mitoticColor = palette(
    t * 0.03 + treble,
    vec3(0.3, 0.5, 0.15),
    vec3(0.2, 0.35, 0.1),
    vec3(0.6, 0.9, 0.3),
    vec3(0.04, 0.15, 0.05)
  );
  color += mitoticColor * mitotic * 0.3;

  // Expanding particles — new cells being pushed outward
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 5.3, fi * 9.7));

    float pAngle = h.x * 6.28318;
    float expandPhase = fract(t * 0.2 + h.y);
    float pR = growthFront + expandPhase * 0.05 - 0.02;

    vec2 pPos = vec2(cos(pAngle), sin(pAngle)) * pR;
    pPos += vec2(sin(t * 0.3 + fi), cos(t * 0.25 + fi * 1.3)) * 0.01;

    float d = length(uv - pPos);
    float glow = 0.0004 / (d * d + 0.0003);
    glow *= (1.0 - expandPhase);

    color += divColor * glow * 0.12;
  }

  // Growth front edge highlight
  float edgeHighlight = smoothstep(0.01, 0.0, abs(r - growthFront));
  color += divColor * edgeHighlight * 0.25;

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
