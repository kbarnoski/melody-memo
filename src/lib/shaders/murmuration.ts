import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Murmuration — flock-like particle cloud swirling as one body

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Twilight sky gradient
  vec3 color = palette(
    uv.y * 0.3 + 0.4,
    vec3(0.02, 0.02, 0.05),
    vec3(0.02, 0.02, 0.04),
    vec3(0.08, 0.06, 0.15),
    vec3(0.0, 0.02, 0.06)
  );

  // Flock center of mass — moves in smooth curves
  vec2 flockCenter = vec2(
    sin(t * 0.3) * 0.3 + sin(t * 0.17) * 0.15,
    cos(t * 0.25) * 0.25 + sin(t * 0.13) * 0.1
  );

  // Flock rotation and scale breathing
  float flockAngle = t * 0.15 + sin(t * 0.4) * 0.3;
  float flockScale = 0.3 + 0.08 * sin(t * 0.35 + bass * 2.0);

  // 60 particles in coordinated swirl
  for (int i = 0; i < 60; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 3.7, fi * 11.3));

    // Base position in flock formation — sphere-ish distribution
    float birdAngle = h.x * 6.28318;
    float birdDist = sqrt(h.y) * flockScale;
    vec2 basePos = vec2(cos(birdAngle), sin(birdAngle)) * birdDist;

    // Apply flock rotation
    basePos = rot2(flockAngle + fi * 0.01) * basePos;

    // Individual jitter — slight independence
    vec2 jitter = vec2(
      snoise(vec2(fi * 1.3, t * 0.5 + fi * 0.7)),
      snoise(vec2(fi * 2.1, t * 0.45 + fi * 1.1))
    ) * 0.03;

    // Wave-like coordination — birds move in waves through the flock
    float wavePhase = dot(basePos, normalize(vec2(sin(t * 0.2), cos(t * 0.2))));
    vec2 waveMotion = vec2(
      sin(wavePhase * 8.0 + t * 2.0 + mid * 3.0),
      cos(wavePhase * 6.0 + t * 1.8)
    ) * 0.02;

    vec2 birdPos = flockCenter + basePos + jitter + waveMotion;

    float d = length(uv - birdPos);

    // Bird body — elongated in flight direction
    vec2 vel = vec2(
      snoise(vec2(fi * 1.3, t * 0.5 + fi * 0.7 + 0.01)) - snoise(vec2(fi * 1.3, t * 0.5 + fi * 0.7)),
      snoise(vec2(fi * 2.1, t * 0.45 + fi * 1.1 + 0.01)) - snoise(vec2(fi * 2.1, t * 0.45 + fi * 1.1))
    );
    float speed = length(vel) + 0.001;

    // Point glow for each bird
    float glow = 0.0004 / (d * d + 0.0002);

    // Wing beat — tiny oscillation
    float wingBeat = 0.8 + 0.2 * sin(t * 8.0 + fi * 3.0);
    glow *= wingBeat;

    // Color — varies subtly across flock
    float colorT = fi * 0.015 + t * 0.02 + u_amplitude * 0.1;
    vec3 birdColor = palette(
      colorT,
      vec3(0.15, 0.12, 0.2),
      vec3(0.15, 0.12, 0.2),
      vec3(0.5, 0.4, 0.7),
      vec3(0.0, 0.08, 0.2)
    );

    color += birdColor * glow;
  }

  // Density enhancement — where many birds cluster, add extra glow
  // Sample flock density at a coarser level
  float density = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i) * 5.0; // sample every 5th bird
    vec2 h = hash2(vec2(fi * 3.7, fi * 11.3));
    float birdAngle = h.x * 6.28318;
    float birdDist = sqrt(h.y) * flockScale;
    vec2 basePos = rot2(flockAngle + fi * 0.01) * vec2(cos(birdAngle), sin(birdAngle)) * birdDist;
    vec2 birdPos = flockCenter + basePos;
    float d = length(uv - birdPos);
    density += smoothstep(0.15, 0.0, d);
  }

  // Cloud-like glow in dense regions
  vec3 cloudColor = palette(
    density * 0.2 + t * 0.01 + treble,
    vec3(0.1, 0.08, 0.18),
    vec3(0.1, 0.08, 0.15),
    vec3(0.3, 0.25, 0.5),
    vec3(0.0, 0.05, 0.15)
  );
  color += cloudColor * density * 0.01;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
