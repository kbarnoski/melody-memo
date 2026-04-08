import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Eventide — last light fading, warm gradient to absolute dark

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;
  vec3 color = vec3(0.0);

  // Slow dimming cycle — light fades then returns
  float dimCycle = sin(t * 0.12) * 0.5 + 0.5; // 0 = dark, 1 = brightest (still dim)

  // Horizon line
  float horizon = uv.y + 0.2;

  // Warm sky gradient at top — fading
  float skyGrad = smoothstep(-0.1, 0.5, horizon);
  float skyBright = skyGrad * dimCycle * 0.08;

  // Warm amber-orange tones
  vec3 skyColor = palette(horizon * 0.5 + t * 0.08,
    vec3(0.04, 0.02, 0.005),
    vec3(0.04, 0.02, 0.005),
    vec3(1.0, 0.6, 0.3),
    vec3(0.0, 0.05, 0.15)
  );
  color += skyColor * skyBright;

  // Horizon glow — thin warm line
  float horizonGlow = exp(-abs(horizon) * 15.0) * dimCycle * 0.06;
  color += vec3(0.06, 0.03, 0.01) * horizonGlow;

  // Atmospheric noise in sky
  float skyNoise = fbm3(vec2(uv.x * 3.0 + t * 0.1, horizon * 2.0));
  float clouds = smoothstep(0.1, 0.3, skyNoise) * skyGrad * dimCycle * 0.02;
  color += vec3(0.03, 0.015, 0.005) * clouds;

  // Below horizon — total darkness with faint texture
  float ground = smoothstep(0.0, -0.3, horizon) * 0.005;
  color += vec3(0.003, 0.002, 0.004) * ground;

  // Faint stars appearing as light fades
  float starField = snoise(uv * 40.0);
  float stars = smoothstep(0.68, 0.72, starField) * (1.0 - dimCycle) * skyGrad * 0.03;
  color += vec3(0.03) * stars;

  // Audio — subtle warmth modulation
  color *= 1.0 + 0.08 * u_amplitude * dimCycle;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
