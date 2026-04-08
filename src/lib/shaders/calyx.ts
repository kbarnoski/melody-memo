import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Calyx — flower cup shapes nested concentrically, rotating open

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Petal cup shape — radial flower form
float petalCup(vec2 uv, float petals, float radius, float openness, float rotation) {
  vec2 p = rot2(rotation) * uv;
  float angle = atan(p.y, p.x);
  float r = length(p);

  // Petal shape modulation
  float petalShape = 0.5 + 0.5 * cos(angle * petals);
  petalShape = pow(petalShape, 0.5 + openness * 1.5);

  // Radial envelope
  float innerR = radius * 0.3 * (1.0 - openness * 0.5);
  float outerR = radius * (0.7 + openness * 0.3);
  float radialShape = smoothstep(innerR, innerR + radius * 0.1, r)
                    * smoothstep(outerR + radius * 0.05, outerR - radius * 0.1, r);

  return petalShape * radialShape;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  float bass = u_bass * 0.2;
  float mid = u_mid * 0.18;
  float treble = u_treble * 0.12;

  // Dark background with warm undertone
  float bgTex = fbm3(uv * 2.0 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.2 + 0.3,
    vec3(0.03, 0.02, 0.02),
    vec3(0.02, 0.01, 0.02),
    vec3(0.1, 0.06, 0.1),
    vec3(0.0, 0.02, 0.04)
  );

  // 5 concentric petal layers — outermost first
  for (int i = 4; i >= 0; i--) {
    float fi = float(i);
    float layerFrac = fi / 4.0; // 0 = innermost, 1 = outermost

    // Opening animation — outer layers open first
    float openDelay = (1.0 - layerFrac) * 0.3;
    float openness = 0.3 + 0.5 * sin(t * 0.4 - openDelay + bass * 0.5);
    openness = clamp(openness, 0.0, 1.0);

    // Radius — outer layers are larger
    float radius = 0.08 + layerFrac * 0.2 + mid * 0.02;

    // Rotation — each layer rotates at different rate
    float rotation = t * (0.1 + fi * 0.05) * ((mod(fi, 2.0) < 1.0) ? 1.0 : -1.0);

    // Petal count varies per layer
    float petals = 5.0 + fi * 1.0;

    float cup = petalCup(uv, petals, radius, openness, rotation);

    // Color — warm pink to gold gradient from inner to outer
    float colorT = layerFrac * 0.4 + t * 0.02 + u_amplitude * 0.1;
    vec3 petalColor = palette(
      colorT,
      vec3(0.5, 0.25, 0.2),
      vec3(0.35, 0.2, 0.15),
      vec3(0.8, 0.5, 0.4),
      vec3(0.0, 0.1, 0.05)
    );

    // Inner layers are warmer/brighter
    vec3 innerTint = palette(
      colorT + 0.3,
      vec3(0.6, 0.35, 0.15),
      vec3(0.4, 0.25, 0.1),
      vec3(0.9, 0.65, 0.25),
      vec3(0.05, 0.1, 0.0)
    );

    vec3 layerColor = mix(innerTint, petalColor, layerFrac);

    // Translucent petal texture
    float tex = fbm3(rot2(rotation) * uv * (3.0 + fi * 2.0) + t * 0.05);
    tex = tex * 0.5 + 0.5;

    // Veining on petals
    float veinAngle = atan(uv.y, uv.x) + rotation;
    float veins = sin(veinAngle * petals * 3.0 + length(uv) * 20.0) * 0.5 + 0.5;
    veins = pow(veins, 4.0);

    color += layerColor * cup * (0.2 + tex * 0.15);
    color += layerColor * 0.5 * cup * veins * 0.08;
  }

  // Central pistil — bright glowing core
  float pistilDist = length(uv);
  float pistil = smoothstep(0.06, 0.0, pistilDist);
  float pistilPulse = 0.6 + 0.4 * sin(t * 1.5 + bass * 3.0);

  vec3 pistilColor = palette(
    t * 0.03 + treble * 0.5,
    vec3(0.7, 0.5, 0.15),
    vec3(0.4, 0.3, 0.1),
    vec3(0.95, 0.75, 0.3),
    vec3(0.1, 0.1, 0.0)
  );
  color += pistilColor * pistil * pistilPulse * 0.6;

  // Pollen glow around center
  float pollenRing = smoothstep(0.08, 0.04, pistilDist) * smoothstep(0.02, 0.05, pistilDist);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float angle = fi * 0.785 + t * 0.2;
    vec2 pollenPos = vec2(cos(angle), sin(angle)) * 0.05;
    float d = length(uv - pollenPos);
    float glow = 0.0003 / (d * d + 0.0003);
    glow *= 0.5 + 0.5 * sin(t * 2.0 + fi * 1.5);
    color += pistilColor * glow * 0.08;
  }

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
