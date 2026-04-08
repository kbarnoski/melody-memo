import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Dual reflector curves bouncing light beams with interference caustics
// Two concentric reflective parabolic curves with light traces, 80 iterations

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 color = vec3(0.0);

  // Outer reflector (parabola opening left)
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = (fi - 0.5) * 3.14159;
    float rOuter = 0.7 + u_bass * 0.08;
    vec2 outerP = vec2(-rOuter + rOuter * cos(theta) * cos(theta), rOuter * sin(theta) * 0.8);
    outerP = rot2(t * 0.3) * outerP;
    float d1 = length(uv - outerP);
    float glow1 = 0.002 / (d1 + 0.001);
    vec3 c1 = palette(fi + t * 0.2, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                       vec3(1.0, 1.0, 0.5), vec3(0.3, 0.2, 0.2));
    color += c1 * glow1 * 0.06;
  }

  // Inner reflector (smaller parabola opening right)
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = (fi - 0.5) * 3.14159;
    float rInner = 0.3 + u_mid * 0.06;
    vec2 innerP = vec2(rInner - rInner * cos(theta) * cos(theta), rInner * sin(theta) * 0.5);
    innerP = rot2(t * 0.3) * innerP;
    float d2 = length(uv - innerP);
    float glow2 = 0.002 / (d2 + 0.001);
    vec3 c2 = palette(fi + t * 0.2 + 0.5, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                       vec3(0.5, 1.0, 1.0), vec3(0.0, 0.1, 0.3));
    color += c2 * glow2 * 0.06;
  }

  // Light beam traces bouncing between reflectors
  for (int i = 0; i < 40; i++) {
    float fi = float(i) / 40.0;
    float beam = sin(fi * 6.28318 * 3.0 + t * 2.0 + u_treble * 0.4);
    float x = mix(-0.6, 0.2, fi) * cos(t * 0.2);
    float y = beam * 0.3 * (1.0 - fi * 0.5);
    vec2 bp = rot2(t * 0.3) * vec2(x, y);
    float d3 = length(uv - bp);
    float glow3 = 0.0015 / (d3 + 0.001);
    color += vec3(0.8, 0.9, 1.0) * glow3 * 0.04;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;
