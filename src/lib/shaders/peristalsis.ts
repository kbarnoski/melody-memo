import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Peristalsis — rhythmic wave contraction through a tubular form

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;
  float bass = u_bass * 0.3;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark cavity background
  float bgTex = fbm3(uv * 2.0 + t * 0.02);
  vec3 color = palette(
    bgTex * 0.2 + 0.7,
    vec3(0.02, 0.01, 0.03),
    vec3(0.02, 0.01, 0.03),
    vec3(0.08, 0.04, 0.12),
    vec3(0.0, 0.02, 0.05)
  );

  // Tube runs vertically — center of screen
  float tubeWidth = 0.18 + 0.02 * sin(t * 0.3);

  // Peristaltic compression waves traveling upward
  float waveFreq = 4.0;
  float waveSpeed = 1.5;

  // Multiple compression waves at different phases
  float compression = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float phase = fi * 2.094; // 120 degrees apart
    float wave = sin(uv.y * waveFreq - t * waveSpeed + phase + bass * 2.0);
    wave = max(0.0, wave); // only positive (squeezing)
    compression += wave * 0.35;
  }

  // Tube wall shape — contracts with compression
  float contractedWidth = tubeWidth * (1.0 - compression * 0.5);

  // Outer wall
  float outerWall = smoothstep(contractedWidth + 0.03, contractedWidth, abs(uv.x));
  // Inner lumen
  float innerWall = smoothstep(contractedWidth - 0.02, contractedWidth - 0.04, abs(uv.x));
  // Wall band
  float wallBand = outerWall - innerWall;

  // Muscle layer texture — circular fibers
  float muscleTex = sin(uv.y * 30.0 + t * 0.5) * 0.5 + 0.5;
  muscleTex *= sin(abs(uv.x) * 40.0) * 0.5 + 0.5;
  muscleTex = pow(muscleTex, 0.5);

  // Wall color — warm tissue tones, darker when compressed
  float colorT = uv.y * 0.1 + t * 0.02 + u_amplitude * 0.1;
  vec3 wallColor = palette(
    colorT,
    vec3(0.35, 0.12, 0.15),
    vec3(0.25, 0.1, 0.12),
    vec3(0.6, 0.3, 0.35),
    vec3(0.0, 0.05, 0.08)
  );

  // Compressed regions are more saturated/active
  vec3 activeColor = palette(
    colorT + 0.2,
    vec3(0.5, 0.15, 0.18),
    vec3(0.3, 0.12, 0.15),
    vec3(0.8, 0.4, 0.4),
    vec3(0.05, 0.08, 0.1)
  );

  vec3 tissueColor = mix(wallColor, activeColor, compression);
  tissueColor *= 0.8 + muscleTex * 0.2;

  color += tissueColor * wallBand * 0.7;

  // Inner lumen — darker interior with contents moving
  float lumen = innerWall;
  vec3 lumenColor = palette(
    colorT + 0.5,
    vec3(0.06, 0.02, 0.04),
    vec3(0.04, 0.02, 0.03),
    vec3(0.2, 0.08, 0.15),
    vec3(0.0, 0.03, 0.06)
  );

  // Contents being pushed through — bolus-like shapes
  float content = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // Contents move with the peristaltic wave
    float bolusY = sin(t * 0.3 + fi * 1.57) * 0.5;
    float bolusR = 0.04 + 0.02 * sin(fi * 2.0);
    // Squeeze when passing through compression
    float localComp = 0.0;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float wave = sin(bolusY * waveFreq - t * waveSpeed + fj * 2.094);
      localComp += max(0.0, wave) * 0.35;
    }
    float squeezeX = 1.0 + localComp * 0.5;
    float squeezeY = 1.0 - localComp * 0.3;
    vec2 bDist = (uv - vec2(0.0, bolusY)) * vec2(squeezeX, squeezeY);
    float bolus = smoothstep(bolusR, bolusR * 0.3, length(bDist));
    content += bolus;
  }
  content = min(content, 1.0);

  vec3 contentColor = palette(
    content * 0.3 + t * 0.03 + mid * 0.5,
    vec3(0.25, 0.1, 0.2),
    vec3(0.2, 0.1, 0.15),
    vec3(0.5, 0.3, 0.5),
    vec3(0.05, 0.05, 0.15)
  );

  color += lumenColor * lumen * 0.3;
  color += contentColor * content * lumen * 0.4;

  // Mucosa glow along inner wall edge
  float mucosa = smoothstep(0.04, 0.0, abs(abs(uv.x) - (contractedWidth - 0.03)));
  mucosa *= outerWall;
  vec3 mucosaColor = palette(
    colorT + 0.35 + treble,
    vec3(0.4, 0.15, 0.2),
    vec3(0.3, 0.12, 0.18),
    vec3(0.7, 0.4, 0.5),
    vec3(0.05, 0.08, 0.12)
  );
  color += mucosaColor * mucosa * 0.25;

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
