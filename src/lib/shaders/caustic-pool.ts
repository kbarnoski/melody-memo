import { U, VISIONARY_PALETTE } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + `
// Light caustic patterns like sunlight through water
// Overlapping sine wave distortions creating bright convergence lines

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 color = vec3(0.0);

  // Caustic computation — overlapping wave distortion
  float caustic = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float angle = fi * 1.2566 + t * 0.3;
    float ca = cos(angle), sa = sin(angle);
    vec2 dir = vec2(ca, sa);
    float freq = 4.0 + fi * 1.5 + u_bass * 0.5;
    float wave = sin(dot(uv, dir) * freq + t * (1.0 + fi * 0.3) + sin(dot(uv.yx, dir) * freq * 0.7) * 0.5);
    caustic += wave;
  }
  caustic = caustic / 5.0;

  // Bright convergence lines where caustic is high
  float brightness = exp(caustic * 3.0 - 2.0);
  vec3 c1 = palette(caustic * 0.4 + t * 0.08, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                     vec3(0.3, 0.7, 1.0), vec3(0.0, 0.15, 0.3));
  color += c1 * brightness * 0.35;

  // Second layer — finer caustics
  float caustic2 = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float angle = fi * 1.5708 + t * 0.5 + 0.8;
    float ca = cos(angle), sa = sin(angle);
    vec2 dir = vec2(ca, sa);
    float freq = 7.0 + fi * 2.0 + u_mid * 0.3;
    float wave = sin(dot(uv, dir) * freq + t * (1.5 + fi * 0.4) + sin(dot(uv.yx, dir) * freq * 0.6) * 0.4);
    caustic2 += wave;
  }
  caustic2 = caustic2 / 4.0;
  float brightness2 = exp(caustic2 * 3.0 - 2.5);
  vec3 c2 = palette(caustic2 * 0.3 + t * 0.08 + 0.4, vec3(0.5, 0.5, 0.5), vec3(0.4, 0.5, 0.5),
                     vec3(0.2, 0.5, 0.8), vec3(0.1, 0.2, 0.4));
  color += c2 * brightness2 * 0.25;

  // Gentle floor tone
  color += vec3(0.01, 0.02, 0.05);

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
