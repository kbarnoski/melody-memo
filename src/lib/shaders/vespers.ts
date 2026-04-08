import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Vespers — Evening prayer: warm amber fading into deep blue

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;

  float bass = 0.5 + 0.5 * sin(u_bass * 3.14159);
  float amp = 0.5 + 0.5 * sin(u_amplitude * 3.14159);

  float r = length(uv);

  // Vertical gradient — warm amber top to deep blue bottom
  float grad = uv.y * 0.5 + 0.5; // 0 at bottom, 1 at top
  grad = smoothstep(-0.2, 1.2, grad);

  // Noise-modulated gradient boundary
  float n = fbm3(vec2(uv.x * 3.0, uv.y * 2.0 + t * 0.3));
  grad += n * 0.12;
  grad = clamp(grad, 0.0, 1.0);

  // Warm amber color
  vec3 amber = palette(
    grad * 0.5 + t * 0.05,
    vec3(0.7, 0.5, 0.2),
    vec3(0.4, 0.3, 0.1),
    vec3(1.0, 0.8, 0.3),
    vec3(0.0, 0.05, 0.1)
  );

  // Deep blue color
  vec3 deepBlue = palette(
    (1.0 - grad) * 0.5 + t * 0.03,
    vec3(0.1, 0.12, 0.25),
    vec3(0.1, 0.1, 0.2),
    vec3(0.3, 0.4, 0.8),
    vec3(0.5, 0.6, 0.7)
  );

  // Blend amber and blue
  vec3 color = mix(deepBlue, amber, grad);

  // Horizontal luminous bands — like clouds at sunset
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float yPos = 0.1 + fi * 0.1;
    float bandN = fbm3(vec2(uv.x * 4.0 + t * 0.2 + fi * 3.0, fi * 5.0));
    float band = exp(-(uv.y - yPos + bandN * 0.08) * (uv.y - yPos + bandN * 0.08) * 50.0);
    band *= 0.3 * (1.0 - fi * 0.1);

    vec3 bandColor = mix(
      vec3(1.0, 0.8, 0.4),
      vec3(0.9, 0.5, 0.2),
      fi * 0.2
    );
    color += bandColor * band;
  }

  // Central evening star glow
  vec2 starPos = vec2(0.0, 0.15 + sin(t * 0.3) * 0.02);
  float star = exp(-length(uv - starPos) * 8.0) * 0.6;
  star += exp(-length(uv - starPos) * 20.0) * 0.4;
  color += vec3(1.0, 0.95, 0.8) * star * (0.8 + amp * 0.2);

  // Gentle ambient warmth
  color += vec3(0.05, 0.03, 0.01) * exp(-r * 1.0);

  // Low blue ambient at bottom
  color += vec3(0.02, 0.03, 0.08) * (1.0 - grad) * 0.5;

  // Vignette
  color *= smoothstep(1.5, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
