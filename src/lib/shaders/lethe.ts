import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + SMOOTH_NOISE + VISIONARY_PALETTE + ROT2 + `
// Lethe — river of forgetting, dark flowing forms dissolving rightward

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;
  vec3 color = vec3(0.0);

  // Horizontal flow — forms moving rightward
  vec2 flowUV = uv;
  flowUV.x -= t * 0.3;
  flowUV.y += sin(uv.x * 2.0 + t) * 0.1;

  // Dark flowing substance
  float flow = fbm3(flowUV * 3.0);
  float flowShape = smoothstep(-0.2, 0.1, flow) * smoothstep(0.5, 0.2, flow);

  // Dissolving rightward — fade out as x increases
  float dissolve = smoothstep(0.6, -0.3, uv.x);
  flowShape *= dissolve;

  // Dark blue-black water tones
  vec3 waterColor = palette(flow * 0.3 + t * 0.1, vec3(0.01), vec3(0.03), vec3(0.4, 0.5, 0.8), vec3(0.2, 0.1, 0.3));
  color += waterColor * flowShape * 0.08 * (1.0 + 0.15 * u_mid);

  // Faint surface ripples
  float ripple = snoise(vec2(uv.x * 8.0 - t * 2.0, uv.y * 4.0));
  float rippleLine = smoothstep(0.02, 0.0, abs(ripple)) * dissolve * 0.03;
  color += vec3(0.02, 0.025, 0.04) * rippleLine;

  // Memory fragments — faint shapes appearing and dissolving
  float mem = fbm3(flowUV * 1.5 + 10.0);
  float memShape = smoothstep(0.3, 0.35, mem) * dissolve * 0.02;
  color += vec3(0.03, 0.02, 0.04) * memShape * (0.5 + 0.5 * sin(t * 0.3));

  // Dark ambient
  color += vec3(0.003, 0.003, 0.005);

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;
