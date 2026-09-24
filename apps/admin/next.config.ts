import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  transpilePackages: [
    "@hamdastan/config",
    "@hamdastan/shared",
    "@hamdastan/types",
    "@hamdastan/ui",
    "@hamdastan/validation",
  ],

  outputFileTracingRoot: path.join(__dirname, "../.."),

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The admin panel is never a search result.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
