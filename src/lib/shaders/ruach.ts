import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Ruach — Divine breath: horizontal flowing luminous streams

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float treble = 0.5 + 0.5 * sin(u_treble * 3.14159);

  vec3 color = vec3(0.0);

  // Layered horizontal luminous streams
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float yOffset = (fi - 3.0) * 0.12;

    // Flowing noise displacement
    float speed = 0.3 + fi * 0.05;
    vec2 noiseUV = vec2(uv.x * 2.0 + t * speed, (uv.y + yOffset) * 3.0 + fi * 1.5);
    float n = fbm3(noiseUV);

    // Stream shape — horizontal band with noise displacement
    float y = uv.y + yOffset + n * 0.15;
    float stream = exp(-y * y * 40.0);

    // Brightness variation along stream
    float brightness = 0.5 + 0.5 * sin(uv.x * 4.0 - t * (1.0 + fi * 0.2) + fi * 2.0);
    brightness *= 0.6 + 0.4 * fbm3(vec2(uv.x * 1.5 - t * speed, fi));

    // Warm gold palette per stream
    vec3 streamColor = palette(
      fi * 0.15 + uv.x * 0.3 + t * 0.1,
      vec3(0.6, 0.45, 0.15),
      vec3(0.5, 0.35, 0.15),
      vec3(1.0, 0.8, 0.4),
      vec3(0.0 + fi * 0.02, 0.1, 0.15)
    );

    float intensity = (0.6 + bass * 0.2) * (1.0 - fi * 0.08);
    color += streamColor * stream * brightness * intensity;
  }

  // Central breath glow
  float breath = sin(t * 1.5) * 0.5 + 0.5;
  float centerGlow = exp(-dot(uv, uv) * 3.0) * (0.3 + breath * 0.2);
  color += vec3(1.0, 0.9, 0.6) * centerGlow;

  // Subtle treble sparkle on streams
  float sparkle = snoise(uv * 20.0 + t * 2.0);
  sparkle = smoothstep(0.6, 0.9, sparkle) * treble * 0.3;
  color += vec3(1.0, 0.95, 0.8) * sparkle * exp(-length(uv) * 2.0);

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
