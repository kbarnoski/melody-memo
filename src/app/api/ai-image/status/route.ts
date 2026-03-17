import { fal } from "@fal-ai/client";

const MODEL_ID = "fal-ai/flux/schnell";

let lastWarmTime = 0;
const WARM_INTERVAL_MS = 5 * 60 * 1000; // Re-warm every 5 minutes

export async function GET() {
  const enabled = !!process.env.FAL_KEY;

  // Pre-warm the model so first real generation is fast
  if (enabled && Date.now() - lastWarmTime > WARM_INTERVAL_MS) {
    lastWarmTime = Date.now();
    fal.config({ credentials: process.env.FAL_KEY! });

    // Fire-and-forget a tiny generation to wake the model
    fal.subscribe(MODEL_ID, {
      input: {
        prompt: "black",
        num_inference_steps: 1,
        image_size: { width: 128, height: 128 },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).catch(() => {
      // Warm-up failed — not critical
    });
  }

  return Response.json({
    enabled,
    estimatedCostPerImage: 0.003,
  });
}
