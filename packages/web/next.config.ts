import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@ftcmetrics/shared"],
  allowedDevOrigins: ["192.168.7.5"],
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  workboxOptions: {
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\//,
        handler: "NetworkOnly",
      },
    ],
  },
});

export default pwaConfig(nextConfig);
