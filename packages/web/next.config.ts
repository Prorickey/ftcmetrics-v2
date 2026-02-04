import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ftcmetrics/shared"],
  allowedDevOrigins: ["192.168.7.5"],
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
});

export default pwaConfig(nextConfig);
