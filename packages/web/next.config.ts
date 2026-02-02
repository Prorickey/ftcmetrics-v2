import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ftcmetrics/shared"],
  allowedDevOrigins: ["192.168.7.5"],
  // Silence Turbopack webpack config warning
  turbopack: {},
};

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

export default pwaConfig(nextConfig);
