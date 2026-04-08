import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Xylem — vertical transport channels carrying luminous particles upward

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.07;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.18;
  float treble = u_treble * 0.12;

  // Woody background texture
  float bgTex = fbm3(vec2(uv.x * 1.5, uv.y * 0.5) + t * 0.02);
  vec3 color = palette(
    bgTex * 0.3 + 0.4,
    vec3(0.04, 0.03, 0.02),
    vec3(0.03, 0.02, 0.01),
    vec3(0.12, 0.08, 0.04),
    vec3(0.0, 0.02, 0.01)
  );

  // 7 vertical channels at different X positions
  for (int ch = 0; ch < 7; ch++) {
    float fch = float(ch);
    vec2 h = hash2(vec2(fch * 3.7, fch * 11.3));

    // Channel X position — spread across screen
    float channelX = -0.5 + fch * 0.15 + (h.x - 0.5) * 0.06;
    // Slight waviness to the channel
    float wavyX = channelX + sin(uv.y * 3.0 + t * 0.3 + fch * 1.5) * 0.01
                            + fbm3(vec2(fch * 5.0, uv.y * 2.0 + t * 0.1)) * 0.015;

    // Channel width varies
    float width = 0.012 + 0.005 * sin(uv.y * 4.0 + fch * 2.0) + bass * 0.003;

    // Channel wall
    float dist = abs(uv.x - wavyX);
    float channel = smoothstep(width + 0.008, width, dist);
    float wall = smoothstep(width + 0.008, width + 0.003, dist) - channel;
    float inner = smoothstep(width, width * 0.3, dist);

    // Wall color — woody brown
    float colorT = fch * 0.1 + 0.3;
    vec3 wallColor = palette(
      colorT,
      vec3(0.12, 0.08, 0.04),
      vec3(0.08, 0.05, 0.03),
      vec3(0.25, 0.18, 0.08),
      vec3(0.0, 0.03, 0.01)
    );

    // Inner channel glow — watery green
    vec3 innerColor = palette(
      colorT + 0.4 + t * 0.02 + u_amplitude * 0.08,
      vec3(0.05, 0.15, 0.08),
      vec3(0.05, 0.12, 0.06),
      vec3(0.2, 0.5, 0.3),
      vec3(0.0, 0.1, 0.05)
    );

    color += wallColor * wall * 0.5;
    color += innerColor * inner * 0.15;

    // Luminous particles moving upward through channels
    for (int p = 0; p < 8; p++) {
      float fp = float(p);
      vec2 ph = hash2(vec2(fch * 7.0 + fp, fp * 13.0 + fch));

      // Particle Y — loops upward
      float speed = 0.15 + ph.x * 0.1 + mid * 0.08;
      float particleY = fract(t * speed + ph.y) * 2.2 - 1.1;

      // Particle X — within channel bounds
      float particleX = wavyX + (ph.x - 0.5) * width * 0.6;
      // Recalculate wavyX at particle Y position
      particleX = channelX + sin(particleY * 3.0 + t * 0.3 + fch * 1.5) * 0.01;

      vec2 particlePos = vec2(particleX, particleY);
      float d = length(uv - particlePos);

      // Bright glowing particle
      float glow = 0.001 / (d * d + 0.0005);
      // Particle brightness pulses
      float pulse = 0.6 + 0.4 * sin(t * 2.0 + fp * 2.5 + fch * 1.3);

      // Upward trail
      float trail = smoothstep(0.002, 0.0, abs(uv.x - particleX))
                  * smoothstep(particleY, particleY - 0.06, uv.y)
                  * smoothstep(particleY - 0.1, particleY - 0.06, uv.y);

      vec3 particleColor = palette(
        ph.x * 0.5 + fch * 0.08 + t * 0.02 + treble,
        vec3(0.2, 0.5, 0.3),
        vec3(0.15, 0.4, 0.25),
        vec3(0.5, 0.9, 0.6),
        vec3(0.0, 0.15, 0.08)
      );

      color += particleColor * glow * pulse * 0.15 * inner;
      color += particleColor * trail * 0.1 * inner;
    }
  }

  // Cross-connections between channels — horizontal bridges
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float bridgeY = -0.4 + fi * 0.2 + sin(t * 0.2 + fi) * 0.05;
    float bridgeLine = smoothstep(0.003, 0.0, abs(uv.y - bridgeY));
    bridgeLine *= smoothstep(0.5, 0.3, abs(uv.x)); // only in center region
    color += vec3(0.06, 0.04, 0.02) * bridgeLine * 0.4;
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
