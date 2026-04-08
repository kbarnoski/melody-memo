import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SDF_PRIMITIVES, SMIN } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SDF_PRIMITIVES +
  SMIN +
  `
// Fruiting — mushroom caps emerging, releasing spore clouds

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Mushroom cap SDF — dome on a stem
float sdMushroom(vec2 p, vec2 base, float capR, float stemH, float stemW) {
  vec2 d = p - base;
  // Stem
  float stem = sdBox(d - vec2(0.0, stemH * 0.5), vec2(stemW, stemH * 0.5));
  // Cap — wide dome at top of stem
  float cap = sdCircle(d - vec2(0.0, stemH), capR);
  // Only top half of circle for dome
  float cut = d.y - stemH;
  cap = max(cap, -cut - capR * 0.3);
  return smin(stem, cap, 0.02);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.07;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark forest floor background
  float bgTex = fbm3(uv * 3.0 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.3 + 0.5,
    vec3(0.03, 0.02, 0.01),
    vec3(0.03, 0.02, 0.02),
    vec3(0.15, 0.1, 0.05),
    vec3(0.0, 0.03, 0.02)
  );

  // Ground line
  float groundY = -0.35 + fbm3(vec2(uv.x * 3.0, t * 0.1)) * 0.04;
  float ground = smoothstep(0.01, -0.02, uv.y - groundY);
  vec3 groundColor = palette(
    uv.x * 0.3 + t * 0.01,
    vec3(0.06, 0.04, 0.02),
    vec3(0.04, 0.03, 0.02),
    vec3(0.2, 0.15, 0.08),
    vec3(0.0, 0.05, 0.02)
  );
  color = mix(color, groundColor, ground);

  // 4 mushrooms at different positions and growth stages
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 5.7, fi * 3.1));

    // Position along the ground
    float xPos = -0.45 + fi * 0.3 + h.x * 0.1;
    float yBase = groundY + 0.01;
    vec2 base = vec2(xPos, yBase);

    // Growth animation — slow emergence
    float growth = 0.5 + 0.5 * sin(t * 0.5 + fi * 1.5);
    growth = growth * growth; // ease in

    float capR = (0.06 + h.x * 0.04) * (0.5 + growth * 0.5) + bass * 0.01;
    float stemH = (0.08 + h.y * 0.06) * growth;
    float stemW = capR * 0.25;

    float d = sdMushroom(uv, base, capR, stemH, stemW);

    // Body
    float body = smoothstep(0.01, -0.005, d);
    float edge = smoothstep(0.005, -0.005, abs(d));

    // Color — warm browns and golds
    float colorT = fi * 0.15 + t * 0.02 + u_amplitude * 0.08;
    vec3 capColor = palette(
      colorT,
      vec3(0.4, 0.25, 0.1),
      vec3(0.3, 0.2, 0.1),
      vec3(0.7, 0.5, 0.2),
      vec3(0.05, 0.08, 0.0)
    );

    vec3 stemColor = palette(
      colorT + 0.3,
      vec3(0.35, 0.28, 0.15),
      vec3(0.2, 0.15, 0.08),
      vec3(0.5, 0.4, 0.2),
      vec3(0.0, 0.05, 0.02)
    );

    // Cap vs stem coloring based on position
    float isCap = smoothstep(base.y + stemH * 0.7, base.y + stemH, uv.y);
    vec3 mushColor = mix(stemColor, capColor, isCap);

    // Gill lines under cap
    vec2 gillP = uv - base - vec2(0.0, stemH);
    float gillAngle = atan(gillP.y, gillP.x);
    float gills = sin(gillAngle * 20.0) * 0.5 + 0.5;
    gills *= smoothstep(0.0, -0.03, gillP.y) * smoothstep(-capR, 0.0, gillP.y);
    gills *= body;

    color += mushColor * body * 0.5;
    color += mushColor * 0.3 * edge;
    color -= vec3(0.05) * gills * body;

    // Spore cloud — particles rising from under cap
    for (int s = 0; s < 12; s++) {
      float fs = float(s);
      vec2 sh = hash2(vec2(fi * 7.0 + fs, fs * 13.0));

      // Spore position — rises from below cap
      float sporeAge = fract(t * 0.3 + sh.x + fi * 0.25);
      vec2 sporePos = base + vec2(
        (sh.x - 0.5) * capR * 2.0 + sin(sporeAge * 4.0 + fs) * 0.02,
        stemH - 0.01 + sporeAge * 0.25
      );

      float sporeDist = length(uv - sporePos);
      float sporeGlow = 0.0008 / (sporeDist * sporeDist + 0.0004);
      sporeGlow *= (1.0 - sporeAge) * growth; // fade as they rise and only when grown

      vec3 sporeColor = palette(
        sh.y + colorT + treble,
        vec3(0.5, 0.4, 0.2),
        vec3(0.3, 0.25, 0.15),
        vec3(0.8, 0.6, 0.3),
        vec3(0.1, 0.1, 0.0)
      );
      color += sporeColor * sporeGlow * 0.5;
    }
  }

  // Ambient mist
  float mist = fbm3(uv * 1.5 + vec2(t * 0.15, 0.0));
  mist = smoothstep(0.0, 0.5, mist) * 0.06;
  color += vec3(0.1, 0.08, 0.05) * mist;

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
