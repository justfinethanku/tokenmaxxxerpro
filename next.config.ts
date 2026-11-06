import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@pdf-lib/fontkit"],
  turbopack: {
    root: process.cwd(),
  },
  // Protocol routes read vendored fonts from disk. Keep those files in the
  // server bundle so a deployment does not fetch them per request.
  outputFileTracingIncludes: {
    "/api/protocol/download": ["./assets/fonts/**/*"],
    "/api/protocol/free": ["./assets/fonts/**/*"],
    "/api/paypal/capture-order": ["./assets/fonts/**/*"],
    "/api/paypal/create-order": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
