import type { NextConfig } from "next";

// lib/pdf-fonts.ts loads @pdf-lib/fontkit with createRequire(process.cwd() +
// "/package.json"). That call is not a static import, so listing the package
// in serverExternalPackages does not copy it into the traced function.
// Include the package files here. Fonts stay vendored; nothing is fetched
// per request.
const protocolServerFiles = [
  "./assets/fonts/**/*",
  "./node_modules/@pdf-lib/fontkit/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@pdf-lib/fontkit"],
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/protocol/download": protocolServerFiles,
    "/api/protocol/free": protocolServerFiles,
    "/api/paypal/capture-order": protocolServerFiles,
    "/api/paypal/create-order": protocolServerFiles,
  },
};

export default nextConfig;
