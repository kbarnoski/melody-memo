import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/audio/[id]": ["./node_modules/ffmpeg-static/**/*"],
  },
  webpack: (config, { isServer }) => {
    // Exclude TensorFlow.js and Basic Pitch from server-side bundling
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@tensorflow/tfjs", "@spotify/basic-pitch", "ffmpeg-static");
    }
    return config;
  },
};

export default nextConfig;
