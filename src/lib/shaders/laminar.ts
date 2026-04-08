import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Laminar — layered flowing membranes like living geological strata

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
  float mid = u_mid * 0.15;
  float treble = u_treble * 0.1;

  // Deep background
  vec3 color = palette(
    t * 0.01 + 0.8,
    vec3(0.02, 0.02, 0.04),
    vec3(0.02, 0.02, 0.03),
    vec3(0.1, 0.08, 0.2),
    vec3(0.0, 0.02, 0.08)
  );

  // 8 flowing membrane layers
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float layerY = -0.5 + fi * 0.14; // base Y spacing

    // Each layer flows at a different speed and direction
    float speed = 0.1 + fi * 0.03;
    float flowDir = (mod(fi, 2.0) < 1.0) ? 1.0 : -1.0;
    float flowOffset = t * speed * flowDir;

    // Wavy membrane shape
    float wave = layerY
               + sin(uv.x * 3.0 + flowOffset + fi * 1.2) * 0.05
               + sin(uv.x * 6.0 - flowOffset * 0.7 + fi * 2.5) * 0.025
               + fbm3(vec2(uv.x * 2.0 + flowOffset, fi * 3.0 + t * 0.05)) * 0.04
               + bass * 0.03 * sin(uv.x * 4.0 + t + fi);

    // Layer thickness varies
    float thickness = 0.015 + 0.008 * sin(uv.x * 5.0 + t * 0.4 + fi * 1.7);
    thickness += mid * 0.005;

    // Soft membrane band
    float membrane = smoothstep(thickness, 0.0, abs(uv.y - wave));

    // Interior texture — flowing patterns within the membrane
    float interior = smoothstep(thickness * 0.7, 0.0, abs(uv.y - wave));
    float flowTex = snoise(vec2(uv.x * 8.0 + flowOffset * 2.0, fi * 5.0 + t * 0.1));
    flowTex = flowTex * 0.5 + 0.5;

    // Layer color — each stratum has its own hue
    float colorT = fi * 0.12 + t * 0.015 + u_amplitude * 0.08;
    vec3 layerColor = palette(
      colorT,
      vec3(0.15 + fi * 0.03, 0.1, 0.2),
      vec3(0.2, 0.15, 0.25),
      vec3(0.5 + fi * 0.05, 0.4, 0.7),
      vec3(fi * 0.02, 0.1, 0.25)
    );

    // Brighter core of the membrane
    vec3 coreColor = palette(
      colorT + 0.25,
      vec3(0.3, 0.2, 0.4),
      vec3(0.25, 0.2, 0.35),
      vec3(0.7, 0.5, 0.9),
      vec3(0.05 + fi * 0.02, 0.12, 0.3)
    );

    // Edge glow — translucent edges
    float edgeGlow = membrane - interior;

    // Translucent layering — deeper layers are dimmer
    float depthFade = 0.4 + 0.6 * (fi / 7.0);

    color += layerColor * membrane * 0.15 * depthFade;
    color += coreColor * interior * flowTex * 0.12 * depthFade;
    color += layerColor * edgeGlow * 0.2 * depthFade;
  }

  // Ambient particles between layers
  for (int i = 0; i < 15; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 7.1, fi * 13.3));
    vec2 ppos = h * 2.0 - 1.0;
    ppos.x += sin(t * 0.3 + fi * 1.5) * 0.1;
    ppos.y += cos(t * 0.25 + fi * 2.0) * 0.05;

    float d = length(uv - ppos);
    float glow = 0.0003 / (d * d + 0.0005);
    glow *= 0.5 + 0.5 * sin(t * 1.2 + fi * 2.5 + treble * 3.0);

    float colorT = h.x + t * 0.02;
    vec3 particleColor = palette(
      colorT,
      vec3(0.2, 0.15, 0.3),
      vec3(0.2, 0.15, 0.25),
      vec3(0.6, 0.4, 0.8),
      vec3(0.05, 0.1, 0.25)
    );
    color += particleColor * glow;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
