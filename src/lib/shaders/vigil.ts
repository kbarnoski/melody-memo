import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Vigil — single wavering flame-point in vast darkness

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  vec3 color = vec3(0.0);

  // Flame position — slight wander
  vec2 flamePos = vec2(
    sin(t * 0.7) * 0.01 + sin(t * 1.3) * 0.005,
    cos(t * 0.5) * 0.008 + 0.0
  );

  float dist = length(uv - flamePos);

  // Flickering brightness
  float flicker = 0.6 + 0.4 * sin(t * 4.0) * sin(t * 5.7 + 1.0) * sin(t * 7.3 + 2.0);
  flicker = max(flicker, 0.2); // never fully out

  // Flame core — tiny bright point
  float core = exp(-dist * 80.0) * 0.12 * flicker;
  color += vec3(0.12, 0.08, 0.03) * core;

  // Inner glow
  float innerGlow = exp(-dist * 25.0) * 0.06 * flicker;
  vec3 warmGlow = palette(flicker * 0.3,
    vec3(0.06, 0.03, 0.01),
    vec3(0.04, 0.02, 0.005),
    vec3(1.0, 0.6, 0.2),
    vec3(0.0, 0.05, 0.1)
  );
  color += warmGlow * innerGlow;

  // Outer ambient light — very faint
  float ambient = exp(-dist * 4.0) * 0.008 * flicker;
  color += vec3(0.015, 0.008, 0.003) * ambient;

  // Flame upward wisp — tiny smoke trail
  vec2 wispUV = uv - flamePos;
  wispUV.y -= 0.03;
  float wisp = exp(-abs(wispUV.x) * 60.0) * smoothstep(0.0, 0.1, wispUV.y) * smoothstep(0.2, 0.05, wispUV.y);
  wisp *= (0.5 + 0.5 * snoise(vec2(wispUV.x * 20.0, wispUV.y * 8.0 - t * 3.0)));
  color += vec3(0.01, 0.006, 0.003) * wisp * 0.3 * flicker;

  // Audio — flame responds gently
  color *= 1.0 + 0.1 * sin(u_bass * 0.3 + t);

  // Near-total darkness base
  color += vec3(0.001);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
