import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  VISIONARY_PALETTE +
  ROT2 +
  `
// ---- Fourier Epicycle Tracers ----
// Circles orbiting circles with luminous points at the tips tracing complex paths.
// Multiple independent epicycle chains. Traced paths glow and fade.
// Audio modulates orbital speeds.

vec2 epicycleTip(float s, float baseAngle, float speedScale) {
  vec2 p = vec2(0.0);
  // 5 nested circles with decreasing radii and increasing speeds
  for (int n = 0; n < 5; n++) {
    float fn = float(n + 1);
    float radius = 0.14 / fn;
    float speed = fn * s * speedScale;
    float ph = baseAngle + fn * 0.5;
    p += radius * vec2(cos(speed + ph), sin(speed + ph));
  }
  return p;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.2;
  vec3 color = vec3(0.0);

  // Speed modulation from audio
  float speedMod = 1.0 + u_amplitude * 0.6;

  // 3 independent epicycle chains at different screen positions
  for (int chain = 0; chain < 3; chain++) {
    float fch = float(chain);

    // Offset each chain to different part of screen
    vec2 offset = vec2(
      sin(fch * 2.094 + t * 0.05) * 0.25,
      cos(fch * 2.094 + t * 0.07) * 0.2
    );

    float baseAngle = fch * 2.094 + t * 0.1;
    float spd = (1.0 + fch * 0.3) * speedMod;

    // Draw the fading traced path: 100 trail points
    for (int i = 0; i < 100; i++) {
      float fi = float(i);
      float s = t * 2.0 - fi * 0.05;
      float fade = 1.0 - fi / 100.0;
      fade = fade * fade * fade; // cubic falloff

      vec2 pt = epicycleTip(s, baseAngle, spd) + offset;
      float d = length(uv - pt);

      float glow = exp(-d * (50.0 + u_mid * 12.0)) * fade;
      float core = smoothstep(0.004, 0.0, d) * fade;

      vec3 col = palette(
        fch * 0.33 + fi * 0.008 + t * 0.12 + u_amplitude * 0.15,
        vec3(0.5, 0.52, 0.55),
        vec3(0.42, 0.4, 0.5),
        vec3(0.7, 0.9, 1.1),
        vec3(0.02 + fch * 0.05, 0.08, 0.25)
      );

      color += col * glow * 0.05;
      color += col * core * 0.1;
    }

    // Draw the epicycle arm structure at current time
    vec2 armCenter = offset;
    float currentS = t * 2.0;
    for (int n = 0; n < 5; n++) {
      float fn = float(n + 1);
      float radius = 0.14 / fn;
      float speed = fn * currentS * spd;
      float ph = baseAngle + fn * 0.5;

      // Circle outline (very faint)
      float circD = abs(length(uv - armCenter) - radius);
      float circGlow = exp(-circD * 80.0) * 0.06 / fn;
      vec3 circCol = palette(fn * 0.2 + t * 0.1,
        vec3(0.35, 0.38, 0.45), vec3(0.2, 0.22, 0.3),
        vec3(0.5, 0.7, 1.0), vec3(0.1, 0.1, 0.3));
      color += circCol * circGlow * (0.5 + u_treble * 0.3);

      // Arm endpoint
      vec2 nextP = armCenter + radius * vec2(cos(speed + ph), sin(speed + ph));

      // Arm line (faint)
      vec2 pa = uv - armCenter;
      vec2 ba = nextP - armCenter;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float armD = length(pa - ba * h);
      float armGlow = exp(-armD * 100.0) * 0.04 / fn;
      color += circCol * armGlow * (0.4 + u_bass * 0.4);

      // Joint point
      float jointD = length(uv - nextP);
      float jointGlow = exp(-jointD * jointD * 3000.0) * 0.15 / fn;
      color += vec3(0.7, 0.75, 0.9) * jointGlow;

      armCenter = nextP;
    }

    // Bright tip point
    vec2 tip = epicycleTip(currentS, baseAngle, spd) + offset;
    float tipD = length(uv - tip);
    float tipGlow = exp(-tipD * tipD * 1200.0) * (0.7 + u_bass * 0.5);
    color += vec3(0.95, 0.92, 1.0) * tipGlow * 0.6;
    float tipBloom = exp(-tipD * 18.0) * 0.2;
    color += palette(fch * 0.33 + t * 0.12,
      vec3(0.6, 0.55, 0.5), vec3(0.4, 0.35, 0.45),
      vec3(0.9, 1.0, 1.1), vec3(0.0, 0.1, 0.3)) * tipBloom;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));

  gl_FragColor = vec4(color, 1.0);
}
`;
