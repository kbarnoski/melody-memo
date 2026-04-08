import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SDF_PRIMITIVES } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SDF_PRIMITIVES +
  `
// Cilium — hair-like appendages beating in coordinated metachronal waves

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.1;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Fluid medium background
  float bgTex = fbm3(uv * 2.0 + vec2(t * 0.1, 0.0));
  vec3 color = palette(
    bgTex * 0.2 + 0.6,
    vec3(0.02, 0.03, 0.06),
    vec3(0.01, 0.02, 0.04),
    vec3(0.08, 0.12, 0.25),
    vec3(0.0, 0.03, 0.1)
  );

  // Fluid flow lines in background — moved by cilia
  for (int fl = 0; fl < 5; fl++) {
    float ffl = float(fl);
    float flowY = -0.1 + ffl * 0.12;
    float flowWave = sin(uv.x * 4.0 + t * 1.5 + ffl * 1.2) * 0.03
                   + sin(uv.x * 8.0 - t * 0.8 + ffl * 2.5) * 0.01;
    float flowLine = smoothstep(0.008, 0.0, abs(uv.y - flowY - flowWave));
    flowLine *= smoothstep(-0.6, 0.0, uv.y); // only in upper region

    vec3 flowColor = palette(
      ffl * 0.15 + t * 0.02,
      vec3(0.05, 0.08, 0.15),
      vec3(0.04, 0.06, 0.12),
      vec3(0.15, 0.25, 0.5),
      vec3(0.0, 0.05, 0.15)
    );
    color += flowColor * flowLine * 0.15;
  }

  // Cell surface — curved membrane along bottom
  float membraneY = -0.3 + sin(uv.x * 2.0 + t * 0.2) * 0.03;
  float membrane = smoothstep(0.01, -0.02, uv.y - membraneY);
  float membraneEdge = smoothstep(0.01, 0.0, abs(uv.y - membraneY));

  vec3 membraneColor = palette(
    uv.x * 0.2 + t * 0.01,
    vec3(0.15, 0.1, 0.18),
    vec3(0.1, 0.08, 0.12),
    vec3(0.3, 0.2, 0.4),
    vec3(0.02, 0.04, 0.1)
  );
  color = mix(color, membraneColor, membrane * 0.6);
  color += membraneColor * 1.5 * membraneEdge * 0.3;

  // 40 cilia along the membrane
  for (int i = 0; i < 40; i++) {
    float fi = float(i);

    // Cilium base position along membrane
    float baseX = -0.7 + fi * 0.035;
    float baseY = membraneY + sin(baseX * 2.0 + t * 0.2) * 0.03;
    vec2 base = vec2(baseX, baseY);

    // Metachronal wave — each cilium has a phase offset from neighbors
    float metaPhase = fi * 0.25 - t * 3.0 + bass * 2.0;

    // Effective stroke vs recovery stroke
    // Power stroke: fast, cilium straight
    // Recovery stroke: slow, cilium curls
    float beatCycle = sin(metaPhase) * 0.5 + 0.5; // 0-1

    // Cilium tip angle relative to base
    float powerAngle = 1.2; // nearly upright
    float recoveryAngle = 0.3; // bent back
    float tipAngle = mix(recoveryAngle, powerAngle, beatCycle);
    tipAngle += mid * 0.1 * sin(metaPhase * 2.0);

    // Draw cilium as segmented curve
    float cilLen = 0.12 + 0.02 * sin(fi * 2.0);
    float cilGlow = 0.0;

    vec2 segStart = base;
    float segAngle = tipAngle;

    for (int seg = 0; seg < 8; seg++) {
      float fseg = float(seg);
      float segFrac = fseg / 7.0;

      // Bend increases toward tip during recovery
      float bend = (1.0 - beatCycle) * segFrac * 0.8;
      float currentAngle = segAngle - bend;

      vec2 segEnd = segStart + vec2(cos(currentAngle), sin(currentAngle)) * (cilLen / 8.0);

      float d = sdLine(uv, segStart, segEnd);
      float thickness = 0.0015 * (1.0 - segFrac * 0.3);
      float segGlow = smoothstep(thickness + 0.002, thickness, d);
      segGlow *= 1.0 - segFrac * 0.3; // fade toward tip

      cilGlow += segGlow;
      segStart = segEnd;
    }
    cilGlow = min(cilGlow, 1.0);

    // Cilium color
    float colorT = fi * 0.02 + t * 0.015 + u_amplitude * 0.08;
    vec3 cilColor = palette(
      colorT,
      vec3(0.15, 0.2, 0.35),
      vec3(0.12, 0.15, 0.28),
      vec3(0.4, 0.5, 0.8),
      vec3(0.0, 0.08, 0.2)
    );

    // Brighter during power stroke
    float strokeBright = 0.7 + beatCycle * 0.3;

    color += cilColor * cilGlow * strokeBright * 0.2;

    // Tip glow
    float tipGlow = 0.0002 / (length(uv - segStart) * length(uv - segStart) + 0.0001);
    tipGlow *= beatCycle; // brighter during power stroke
    color += cilColor * tipGlow * 0.02;
  }

  // Floating particles being swept by cilia flow
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 5.3, fi * 9.7));

    vec2 ppos = vec2(
      fract(h.x + t * 0.1 * (0.5 + h.y)) * 1.8 - 0.9,
      -0.15 + h.y * 0.4 + sin(t * 0.5 + fi * 2.0) * 0.03
    );

    float d = length(uv - ppos);
    float glow = 0.0003 / (d * d + 0.0003);
    glow *= 0.5 + 0.5 * sin(t * 1.0 + fi * 3.0 + treble * 3.0);

    color += vec3(0.1, 0.15, 0.3) * glow * 0.3;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
