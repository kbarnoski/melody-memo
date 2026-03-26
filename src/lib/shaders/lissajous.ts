import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  VISIONARY_PALETTE +
  ROT2 +
  `
// ---- Lissajous Curve Tracers ----
// Small luminous points tracing Lissajous figures with fading trails.
// Multiple curves with different a:b ratios create intricate overlapping patterns.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;
  vec3 color = vec3(0.0);

  // Background: very subtle dark noise
  float bgN = sin(uv.x * 3.0 + uv.y * 2.0 + t * 0.1) * 0.003;
  color += vec3(0.005 + bgN, 0.007 + bgN, 0.015 + bgN);

  // Define 5 Lissajous curves with different frequency ratios
  // Each curve has: freqA, freqB, phase evolution, rotation, scale
  for (int curve = 0; curve < 5; curve++) {
    float fc = float(curve);

    // Frequency ratios: 3:2, 5:4, 7:6, 4:3, 5:3
    float freqA, freqB;
    if (curve == 0) { freqA = 3.0; freqB = 2.0; }
    else if (curve == 1) { freqA = 5.0; freqB = 4.0; }
    else if (curve == 2) { freqA = 7.0; freqB = 6.0; }
    else if (curve == 3) { freqA = 4.0; freqB = 3.0; }
    else { freqA = 5.0; freqB = 3.0; }

    // Audio-reactive phase offset
    float phase = t * (0.4 + fc * 0.1) + u_bass * 0.8 + fc * 1.2;
    float scale = 0.32 - fc * 0.02 + u_amplitude * 0.04;

    // Slight rotation per curve
    mat2 r = rot2(fc * 0.628 + t * 0.03);

    // Draw trail: 80 points along the parametric curve, fading from bright to dim
    for (int i = 0; i < 80; i++) {
      float fi = float(i);
      // Parameter goes backward from current position to create trail
      float s = t * 2.5 + fc * 0.9 - fi * 0.04;
      float fade = 1.0 - fi / 80.0;
      fade = fade * fade; // quadratic falloff for more emphasis on head

      // Lissajous parametric position
      vec2 pt = scale * vec2(
        sin(freqA * s + phase),
        sin(freqB * s)
      );
      pt = r * pt;

      float d = length(uv - pt);

      // Glow intensity — tighter for trail points, brighter for head
      float glow = exp(-d * (60.0 + u_mid * 15.0)) * fade;
      float core = smoothstep(0.005, 0.0, d) * fade;

      vec3 col = palette(
        fc * 0.2 + fi * 0.005 + t * 0.15 + u_amplitude * 0.3,
        vec3(0.5, 0.52, 0.55),
        vec3(0.45, 0.4, 0.5),
        vec3(0.8, 0.9, 1.1),
        vec3(0.0, 0.08 + fc * 0.05, 0.25)
      );

      color += col * glow * 0.06;
      color += col * core * 0.12;
    }

    // Bright leading point for each curve
    float s0 = t * 2.5 + fc * 0.9;
    vec2 head = scale * vec2(sin(freqA * s0 + phase), sin(freqB * s0));
    head = r * head;
    float hd = length(uv - head);
    float headGlow = exp(-hd * hd * 800.0) * (0.8 + u_treble * 0.4);
    color += vec3(0.9, 0.92, 1.0) * headGlow * 0.5;
    // Secondary bloom around head
    float bloom = exp(-hd * 20.0) * 0.15;
    vec3 headCol = palette(fc * 0.2 + t * 0.15,
      vec3(0.6, 0.55, 0.5), vec3(0.4, 0.35, 0.45),
      vec3(0.9, 1.0, 1.1), vec3(0.0, 0.1, 0.3));
    color += headCol * bloom;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
