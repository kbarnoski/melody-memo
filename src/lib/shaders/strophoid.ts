import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Right strophoid — looping curve with self-crossing nodes that pulse
// Parametric: x = t^2 - a, y = t(t^2 - a) / (t + a_param)
// Audio-reactive loop size, 70 points, glowing nodes at crossings

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.18;
  vec3 color = vec3(0.0);

  float loopSize = 0.5 + u_bass * 0.15 + sin(t * 0.6) * 0.1;

  // Trace main strophoid curve
  for (int i = 0; i < 70; i++) {
    float fi = float(i) / 70.0;
    float param = (fi - 0.5) * 4.0;
    float a = loopSize;
    float x = (param * param - a) * 0.3;
    float denom = param + a + 0.01;
    float y = param * (param * param - a) / denom * 0.2;

    vec2 p = rot2(t * 0.25) * vec2(x, y);
    float d = length(uv - p);
    float glow = 0.003 / (d + 0.001);
    float phase = fi + t * 0.3;
    vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
    color += c * glow * 0.08;
  }

  // Crossing node glow — the strophoid crosses itself at origin
  float nodeGlow = 0.008 / (length(uv) + 0.005);
  float pulse = 0.6 + sin(t * 2.0 + u_treble * 1.5) * 0.4;
  color += vec3(1.0, 0.8, 0.5) * nodeGlow * pulse * 0.3;

  // Second strophoid rotated
  for (int i = 0; i < 70; i++) {
    float fi = float(i) / 70.0;
    float param = (fi - 0.5) * 4.0;
    float a = loopSize * 0.7;
    float x = (param * param - a) * 0.25;
    float denom = param + a + 0.01;
    float y = param * (param * param - a) / denom * 0.15;

    vec2 p = rot2(t * 0.25 + 1.5708) * vec2(x, y);
    float d = length(uv - p);
    float glow = 0.0025 / (d + 0.001);
    float phase = fi + t * 0.3 + 0.5;
    vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                      vec3(0.7, 1.0, 0.8), vec3(0.2, 0.1, 0.3));
    color += c * glow * 0.06;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
