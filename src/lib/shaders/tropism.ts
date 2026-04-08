import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Tropism — forms bending toward a light source, phototropic motion

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

  // Dark background
  float bgTex = fbm3(uv * 1.5 + t * 0.02);
  vec3 color = palette(
    bgTex * 0.2 + 0.4,
    vec3(0.02, 0.02, 0.03),
    vec3(0.01, 0.01, 0.02),
    vec3(0.06, 0.05, 0.1),
    vec3(0.0, 0.01, 0.04)
  );

  // Light source — moves slowly across upper area
  vec2 lightPos = vec2(
    sin(t * 0.25) * 0.4,
    0.35 + sin(t * 0.15) * 0.1
  );

  // Light glow
  float lightDist = length(uv - lightPos);
  float lightGlow = 0.01 / (lightDist * lightDist + 0.01);
  vec3 lightColor = palette(
    t * 0.02 + treble,
    vec3(0.8, 0.7, 0.4),
    vec3(0.4, 0.35, 0.2),
    vec3(1.0, 0.9, 0.5),
    vec3(0.15, 0.12, 0.0)
  );
  color += lightColor * lightGlow * 0.08;

  // Radial light gradient — illumination field
  float illumination = 0.02 / (lightDist + 0.1);

  // 12 stem-like forms growing upward and bending toward light
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 3.7, fi * 11.3));

    // Base position — rooted at bottom
    float baseX = -0.55 + fi * 0.1 + (h.x - 0.5) * 0.05;
    float baseY = -0.5 + h.y * 0.1;
    vec2 base = vec2(baseX, baseY);

    // Draw stem as series of segments bending toward light
    vec2 segStart = base;
    float segAngle = 1.5708; // start pointing up (pi/2)
    float segLen = 0.03 + h.x * 0.01;
    float growthPhase = 0.5 + 0.5 * sin(t * 0.3 + fi * 0.8);
    int numSegs = 10 + int(growthPhase * 5.0);

    float stemGlow = 0.0;
    vec2 tipPos = base;

    for (int seg = 0; seg < 15; seg++) {
      if (seg >= numSegs) break;
      float fseg = float(seg);

      // Direction toward light from current position
      vec2 toLightDir = normalize(lightPos - segStart);
      float toLightAngle = atan(toLightDir.y, toLightDir.x);

      // Tropism strength — increases with light proximity and audio
      float tropStrength = 0.15 + mid * 0.1;
      tropStrength *= illumination * 5.0;

      // Blend current angle toward light direction
      float angleDiff = toLightAngle - segAngle;
      // Wrap angle difference
      if (angleDiff > 3.14159) angleDiff -= 6.28318;
      if (angleDiff < -3.14159) angleDiff += 6.28318;
      segAngle += angleDiff * tropStrength;

      // Natural upward bias
      segAngle = mix(segAngle, 1.5708, 0.05);

      // Organic wobble
      segAngle += sin(t * 0.4 + fi * 1.5 + fseg * 0.5) * 0.03;

      vec2 segEnd = segStart + vec2(cos(segAngle), sin(segAngle)) * segLen;

      // Draw segment
      float d = sdLine(uv, segStart, segEnd);
      float thickness = 0.004 * (1.0 - fseg * 0.04); // thinner at tip
      float seg_glow = smoothstep(thickness + 0.003, thickness, d);

      // Segment brightness — brighter toward tip
      float segBright = 0.3 + 0.7 * (fseg / float(numSegs));

      stemGlow += seg_glow * segBright;
      tipPos = segEnd;
      segStart = segEnd;
    }
    stemGlow = min(stemGlow, 1.0);

    // Stem color — green with light-facing side brighter
    float colorT = fi * 0.08 + t * 0.015 + u_amplitude * 0.08;
    vec3 stemColor = palette(
      colorT,
      vec3(0.08, 0.2, 0.06),
      vec3(0.06, 0.15, 0.05),
      vec3(0.25, 0.55, 0.2),
      vec3(0.0, 0.08, 0.02)
    );

    color += stemColor * stemGlow * 0.35;

    // Tip bud — small bright spot at the growth tip
    float tipDist = length(uv - tipPos);
    float bud = smoothstep(0.012, 0.003, tipDist);
    float budPulse = 0.6 + 0.4 * sin(t * 1.0 + fi * 1.8 + bass * 2.0);

    vec3 budColor = palette(
      colorT + 0.3,
      vec3(0.2, 0.4, 0.1),
      vec3(0.15, 0.3, 0.08),
      vec3(0.5, 0.8, 0.3),
      vec3(0.02, 0.12, 0.04)
    );

    color += budColor * bud * budPulse * 0.5;

    // Light catch — highlight on parts facing the light
    vec2 toLight = normalize(lightPos - tipPos);
    float facing = max(0.0, dot(toLight, vec2(0.0, 1.0)));
    color += lightColor * bud * facing * 0.15;
  }

  // Scattered light particles
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 pp = lightPos + (hash2(vec2(fi * 7.1, fi * 13.3)) - 0.5) * 0.3;
    pp += vec2(sin(t * 0.3 + fi), cos(t * 0.25 + fi * 1.3)) * 0.05;
    float d = length(uv - pp);
    float glow = 0.0002 / (d * d + 0.0003);
    glow *= 0.5 + 0.5 * sin(t * 1.5 + fi * 2.5);
    color += lightColor * glow * 0.06;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
