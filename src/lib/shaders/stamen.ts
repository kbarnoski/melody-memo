import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SDF_PRIMITIVES } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SDF_PRIMITIVES +
  `
// Stamen — radiating pollen-bearing structures with delicate filaments

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

  // Deep warm background
  float bgTex = fbm3(uv * 2.0 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.2 + 0.35,
    vec3(0.03, 0.02, 0.02),
    vec3(0.02, 0.01, 0.01),
    vec3(0.1, 0.06, 0.05),
    vec3(0.0, 0.02, 0.02)
  );

  // Central flower body — soft receptacle
  float centerDist = length(uv);
  float receptacle = smoothstep(0.06, 0.02, centerDist);
  vec3 receptacleColor = palette(
    t * 0.02 + u_amplitude * 0.1,
    vec3(0.2, 0.15, 0.08),
    vec3(0.15, 0.1, 0.06),
    vec3(0.4, 0.3, 0.15),
    vec3(0.0, 0.05, 0.02)
  );
  color += receptacleColor * receptacle * 0.5;

  // 8 radiating stamens
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float baseAngle = fi * 0.785398 + t * 0.08; // pi/4 spacing, slow rotation

    // Filament sway — gentle pendulum motion
    float sway = sin(t * 0.5 + fi * 1.2 + bass * 2.0) * 0.08;
    float finalAngle = baseAngle + sway;

    // Filament length
    float filLength = 0.25 + 0.05 * sin(fi * 1.7) + mid * 0.03;

    // Filament as thin curved line
    vec2 filStart = vec2(cos(finalAngle), sin(finalAngle)) * 0.04;
    vec2 filEnd = vec2(cos(finalAngle), sin(finalAngle)) * filLength;

    // Draw filament with slight curve
    float filGlow = 0.0;
    for (int seg = 0; seg < 20; seg++) {
      float fseg = float(seg) / 19.0;
      vec2 segPos = mix(filStart, filEnd, fseg);
      // Curve perpendicular to filament direction
      vec2 perp = vec2(-sin(finalAngle), cos(finalAngle));
      float curve = sin(fseg * 3.14159) * 0.02 * sin(t * 0.3 + fi);
      segPos += perp * curve;

      float d = length(uv - segPos);
      float thickness = 0.002 * (1.0 - fseg * 0.3);
      filGlow += smoothstep(thickness + 0.002, thickness, d) * (1.0 - fseg * 0.2);
    }
    filGlow = min(filGlow, 1.0);

    // Filament color
    float colorT = fi * 0.1 + t * 0.015;
    vec3 filColor = palette(
      colorT + 0.2,
      vec3(0.2, 0.25, 0.1),
      vec3(0.15, 0.18, 0.08),
      vec3(0.4, 0.5, 0.2),
      vec3(0.0, 0.08, 0.03)
    );
    color += filColor * filGlow * 0.25;

    // Anther (pollen sac) at tip
    vec2 anthPos = filEnd + vec2(cos(finalAngle), sin(finalAngle)) * 0.01;
    float anthDist = length(uv - anthPos);
    float anthR = 0.018 + 0.005 * sin(t * 0.8 + fi * 2.0) + bass * 0.003;

    float anther = smoothstep(anthR, anthR * 0.3, anthDist);
    float anthCore = smoothstep(anthR * 0.5, 0.0, anthDist);

    // Pollen pulse — anther brightens rhythmically
    float pollenPulse = 0.5 + 0.5 * sin(t * 1.2 + fi * 0.8);

    vec3 antherColor = palette(
      colorT + 0.4,
      vec3(0.55, 0.45, 0.1),
      vec3(0.4, 0.3, 0.08),
      vec3(0.9, 0.7, 0.2),
      vec3(0.08, 0.08, 0.0)
    );

    vec3 pollenColor = palette(
      colorT + 0.5 + treble,
      vec3(0.7, 0.55, 0.15),
      vec3(0.45, 0.35, 0.1),
      vec3(0.95, 0.8, 0.3),
      vec3(0.1, 0.1, 0.0)
    );

    color += antherColor * anther * 0.5;
    color += pollenColor * anthCore * pollenPulse * 0.5;

    // Released pollen grains — tiny particles drifting from anthers
    for (int p = 0; p < 5; p++) {
      float fp = float(p);
      vec2 ph = hash2(vec2(fi * 7.0 + fp, fp * 11.0));

      float age = fract(t * 0.15 + ph.x + fi * 0.12);
      vec2 drift = vec2(
        sin(age * 4.0 + fp * 3.0 + fi) * 0.04,
        age * 0.08
      );

      vec2 pollenPos = anthPos + drift;
      float pd = length(uv - pollenPos);
      float glow = 0.0003 / (pd * pd + 0.0002);
      glow *= (1.0 - age) * pollenPulse;

      color += pollenColor * glow * 0.15;
    }
  }

  // Subtle radial light from center
  float radial = 0.003 / (centerDist + 0.01);
  color += receptacleColor * radial * 0.03;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
