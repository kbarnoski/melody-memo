import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SMIN } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SMIN +
  `
// Zooid — colonial organisms pulsing independently but connected

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
  float treble = u_treble * 0.15;

  // Dark background with subtle organic texture
  float bgTex = fbm3(uv * 2.5 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.3 + 0.6,
    vec3(0.02, 0.01, 0.04),
    vec3(0.02, 0.02, 0.04),
    vec3(0.15, 0.1, 0.3),
    vec3(0.0, 0.05, 0.15)
  );

  // Colony centers — 7 zooids
  vec2 centers[7];
  float phases[7];
  float radii[7];

  // Define colony positions — clustered but distinct
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float angle = fi * 0.897 + t * 0.1;  // golden-angle-ish spacing
    float dist = 0.2 + 0.15 * sin(fi * 2.3);
    centers[i] = vec2(cos(angle), sin(angle)) * dist;
    // Each has independent breathing
    centers[i] += vec2(
      sin(t * 0.4 + fi * 1.8) * 0.04,
      cos(t * 0.35 + fi * 2.3) * 0.04
    );
    phases[i] = fi * 0.9 + t * 1.2;
    // Independent pulsing radii
    float pulse = 0.5 + 0.5 * sin(phases[i]);
    radii[i] = 0.06 + 0.03 * pulse + bass * 0.02;
  }

  // Draw connecting filaments between neighbors
  for (int i = 0; i < 7; i++) {
    for (int j = 0; j < 7; j++) {
      if (i >= j) continue;
      float dist = length(centers[i] - centers[j]);
      if (dist > 0.55) continue; // only connect nearby

      // Filament as a curved line
      for (int k = 0; k < 16; k++) {
        float fk = float(k) / 15.0;
        vec2 mid2 = mix(centers[i], centers[j], fk);
        // Curve the filament
        vec2 perp = vec2(-(centers[j].y - centers[i].y), centers[j].x - centers[i].x);
        perp = normalize(perp);
        float curve = sin(fk * 3.14159) * 0.04 * sin(t * 0.8 + float(i + j));
        mid2 += perp * curve;

        float d = length(uv - mid2);
        float thickness = 0.002 + 0.001 * sin(fk * 6.28 + t * 2.0);
        float fil = smoothstep(thickness, 0.0, d);

        // Pulse along the filament
        float flowPulse = 0.5 + 0.5 * sin(fk * 8.0 - t * 3.0 + float(i) * 2.0);

        float colorT = float(i + j) * 0.1 + t * 0.02 + treble;
        vec3 filColor = palette(
          colorT + 0.4,
          vec3(0.15, 0.1, 0.3),
          vec3(0.2, 0.15, 0.3),
          vec3(0.6, 0.4, 0.9),
          vec3(0.1, 0.05, 0.3)
        );
        color += filColor * fil * flowPulse * 0.5;
      }
    }
  }

  // Draw zooid bodies
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 d = uv - centers[i];
    float angle = atan(d.y, d.x);

    // Pulsing body with organic wobble
    float pulse = 0.5 + 0.5 * sin(phases[i]);
    float wobble = 1.0 + 0.12 * sin(angle * 4.0 + t * 1.5 + fi * 2.0)
                       + 0.06 * sin(angle * 7.0 - t * 2.0 + fi * 3.0);
    float dist = length(d) / (radii[i] * wobble);

    float body = smoothstep(1.0, 0.3, dist);
    float membrane = smoothstep(1.0, 0.85, dist) - smoothstep(0.85, 0.7, dist);
    float nucleus = smoothstep(0.35, 0.0, dist);

    // Body color
    float colorT = fi * 0.12 + t * 0.025 + u_amplitude * 0.1;
    vec3 bodyColor = palette(
      colorT,
      vec3(0.2, 0.1, 0.35),
      vec3(0.25, 0.15, 0.35),
      vec3(0.5, 0.3, 0.8),
      vec3(0.05, 0.0, 0.25)
    );

    // Bright nucleus
    vec3 nucleusColor = palette(
      colorT + 0.25,
      vec3(0.5, 0.3, 0.6),
      vec3(0.4, 0.3, 0.5),
      vec3(0.8, 0.5, 1.0),
      vec3(0.1, 0.05, 0.3)
    );

    // Membrane highlight
    vec3 memColor = palette(
      colorT + 0.5,
      vec3(0.3, 0.2, 0.5),
      vec3(0.3, 0.2, 0.4),
      vec3(0.7, 0.5, 0.9),
      vec3(0.15, 0.1, 0.35)
    );

    color += bodyColor * body * 0.4 * (0.7 + pulse * 0.3);
    color += memColor * membrane * 0.5;
    color += nucleusColor * nucleus * (0.5 + pulse * 0.5 + bass * 0.3);
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
