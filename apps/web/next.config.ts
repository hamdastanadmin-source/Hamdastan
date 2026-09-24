import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",

  // The workspace packages ship TypeScript source rather than a build
  // artifact, so Next has to compile them along with the app.
  transpilePackages: [
    "@hamdastan/config",
    "@hamdastan/shared",
    "@hamdastan/types",
    "@hamdastan/ui",
    "@hamdastan/validation",
  ],

  // Standalone tracing has to start at the monorepo root, otherwise the
  // hoisted node_modules and the sibling packages are left out of the build.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  images: {
    remotePatterns: [
      // Add remote image patterns here as needed
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizePackageImports: ["lucide-react", "@hamdastan/ui"],
  },

  async headers() {
    return [
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Immutable cache for static assets
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache for optimized images
        source: "/_next/image(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
