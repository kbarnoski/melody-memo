import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Benediction — Blessing from above: descending warm rays

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float treble = 0.5 + 0.5 * sin(u_treble * 3.14159);

  // Light source above
  vec2 lightSrc = vec2(0.0, 0.8);
  vec2 toLight = uv - lightSrc;
  float distToLight = length(toLight);

  vec3 color = vec3(0.0);

  // Descending rays of warm golden light — like cathedral windows
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float rayAngle = (fi - 4.0) * 0.15 + sin(t * 0.3 + fi * 0.5) * 0.03;

    // Ray direction from light source downward
    vec2 rayDir = normalize(vec2(sin(rayAngle), -1.0));

    // Distance from uv to this ray line
    vec2 toUV = uv - lightSrc;
    float proj = dot(toUV, rayDir);
    vec2 closest = lightSrc + rayDir * max(proj, 0.0);
    float d = length(uv - closest);

    // Only show ray below the source
    float below = smoothstep(0.0, 0.1, proj);

    // Ray width varies — broader at bottom
    float width = 0.02 + proj * 0.03;
    float ray = exp(-d * d / (width * width * 2.0));

    // Noise along the ray — dust motes in light
    float n = fbm3(vec2(proj * 5.0 - t * 0.5, fi * 3.0 + d * 10.0));
    ray *= (0.6 + n * 0.4);

    // Fade at distance
    float fade = exp(-proj * 1.5);

    vec3 rayColor = palette(
      fi * 0.1 + t * 0.05,
      vec3(0.7, 0.55, 0.2),
      vec3(0.4, 0.3, 0.12),
      vec3(1.0, 0.85, 0.4),
      vec3(0.0, 0.08, 0.12)
    );

    color += rayColor * ray * below * fade * (0.5 + bass * 0.15);
  }

  // Source glow at top
  float srcGlow = exp(-distToLight * 3.0) * 0.8;
  float srcCore = exp(-distToLight * 8.0) * 0.6;
  color += vec3(1.0, 0.9, 0.6) * srcGlow;
  color += vec3(1.0, 0.95, 0.8) * srcCore;

  // Dust particles caught in the light
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float px = sin(fi * 3.7 + t * 0.15) * 0.3;
    float py = mod(0.6 - t * 0.08 - fi * 0.12, 1.8) - 0.6;
    vec2 pp = vec2(px, py);
    float pd = length(uv - pp);
    float mote = exp(-pd * 40.0) * 0.3;
    // Mote only visible in the ray light
    float inLight = smoothstep(0.3, 0.0, abs(px - sin((4.0 - fi * 0.5) * 0.15) * (0.6 - py)));
    color += vec3(1.0, 0.9, 0.7) * mote * inLight * treble;
  }

  // Warm ambient at bottom where light accumulates
  float floorGlow = exp(-(uv.y + 0.5) * (uv.y + 0.5) * 3.0) * 0.15;
  color += vec3(0.6, 0.45, 0.2) * floorGlow;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
