import type { NextConfig } from "next";

/**
 * Baseline security headers. A nonce-based Content-Security-Policy will be
 * added together with authentication in a later phase.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source and are compiled by Next.
  transpilePackages: ["@pbs-attend/shared", "@pbs-attend/types", "@pbs-attend/validation"],
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default nextConfig;
