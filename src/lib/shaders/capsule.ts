import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SDF_PRIMITIVES } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SDF_PRIMITIVES +
  `
// Capsule — encapsulated forms releasing contents through membrane

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Rounded capsule SDF
float sdCapsule(vec2 p, float halfH, float r) {
  p.y -= clamp(p.y, -halfH, halfH);
  return length(p) - r;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.07;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark background
  float bgTex = fbm3(uv * 2.0 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.2 + 0.5,
    vec3(0.02, 0.02, 0.04),
    vec3(0.02, 0.01, 0.03),
    vec3(0.08, 0.06, 0.15),
    vec3(0.0, 0.02, 0.06)
  );

  // 3 capsules at different stages of release
  for (int cap = 0; cap < 3; cap++) {
    float fcap = float(cap);
    vec2 h = hash2(vec2(fcap * 5.7, fcap * 9.3));

    // Capsule position
    vec2 center = vec2(
      (fcap - 1.0) * 0.35 + sin(t * 0.2 + fcap * 2.0) * 0.04,
      sin(t * 0.15 + fcap * 1.5) * 0.08
    );

    // Capsule rotation
    float capAngle = sin(t * 0.1 + fcap * 1.2) * 0.3;
    vec2 local = rot2(capAngle) * (uv - center);

    float halfH = 0.1 + h.x * 0.03;
    float capR = 0.05 + h.y * 0.015 + bass * 0.005;

    float d = sdCapsule(local, halfH, capR);

    // Capsule wall — with weak point
    float wall = smoothstep(0.005, 0.0, abs(d));
    float body = smoothstep(0.005, -0.01, d);

    // Weak point in membrane — where contents escape
    float weakAngle = 1.0 + sin(t * 0.3 + fcap) * 0.5;
    vec2 weakDir = vec2(cos(weakAngle), sin(weakAngle));
    float weakPoint = dot(normalize(local), weakDir);
    weakPoint = smoothstep(0.6, 1.0, weakPoint);

    // Membrane thins at weak point
    float thinning = 0.5 + 0.5 * sin(t * 0.5 + fcap * 2.0);
    float membraneIntact = 1.0 - weakPoint * thinning;

    // Capsule wall color
    float colorT = fcap * 0.2 + t * 0.015 + u_amplitude * 0.08;
    vec3 wallColor = palette(
      colorT,
      vec3(0.2, 0.15, 0.25),
      vec3(0.15, 0.12, 0.2),
      vec3(0.4, 0.3, 0.6),
      vec3(0.02, 0.05, 0.15)
    );

    // Interior color — brighter
    vec3 interiorColor = palette(
      colorT + 0.3,
      vec3(0.15, 0.1, 0.2),
      vec3(0.1, 0.08, 0.15),
      vec3(0.35, 0.25, 0.5),
      vec3(0.0, 0.04, 0.12)
    );

    // Interior texture
    float innerTex = fbm3(local * 8.0 + fcap * 10.0 + t * 0.08);
    innerTex = innerTex * 0.5 + 0.5;

    color += wallColor * wall * membraneIntact * 0.6;
    color += interiorColor * body * innerTex * 0.15;

    // Weakened membrane glow
    float weakGlow = wall * weakPoint * thinning;
    vec3 weakColor = palette(
      colorT + 0.5 + mid,
      vec3(0.4, 0.25, 0.5),
      vec3(0.3, 0.2, 0.4),
      vec3(0.7, 0.5, 0.9),
      vec3(0.08, 0.06, 0.2)
    );
    color += weakColor * weakGlow * 0.5;

    // Escaping particles — through the weak point
    for (int p = 0; p < 12; p++) {
      float fp = float(p);
      vec2 ph = hash2(vec2(fcap * 7.0 + fp, fp * 13.0));

      // Particle escapes through weak point direction
      float escapePhase = fract(t * 0.25 + ph.x + fcap * 0.33);
      float escaped = smoothstep(0.0, 0.3, escapePhase) * thinning;

      // Start from capsule surface, move outward
      vec2 escapeDir = weakDir + vec2(ph.x - 0.5, ph.y - 0.5) * 0.5;
      escapeDir = normalize(escapeDir);
      float escapeDist = escapePhase * 0.3;

      vec2 particlePos = center + rot2(-capAngle) * (escapeDir * (capR + escapeDist));
      // Add drift
      particlePos += vec2(sin(t * 0.3 + fp * 2.0), cos(t * 0.25 + fp * 1.5)) * escapePhase * 0.05;

      float pd = length(uv - particlePos);
      float glow = 0.0006 / (pd * pd + 0.0003);
      glow *= escaped * (1.0 - escapePhase); // fade as they disperse

      vec3 particleColor = palette(
        ph.y + colorT + treble,
        vec3(0.4, 0.25, 0.5),
        vec3(0.3, 0.2, 0.4),
        vec3(0.8, 0.55, 0.9),
        vec3(0.08, 0.05, 0.25)
      );
      color += particleColor * glow * 0.4;
    }

    // Inner bright core — the payload
    float coreDist = length(local);
    float core = smoothstep(capR * 0.6, 0.0, coreDist) * body;
    float corePulse = 0.5 + 0.5 * sin(t * 1.0 + fcap * 2.0 + bass * 3.0);

    vec3 coreColor = palette(
      colorT + 0.4,
      vec3(0.5, 0.3, 0.6),
      vec3(0.4, 0.25, 0.5),
      vec3(0.85, 0.6, 1.0),
      vec3(0.1, 0.06, 0.3)
    );
    color += coreColor * core * corePulse * 0.3;
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
