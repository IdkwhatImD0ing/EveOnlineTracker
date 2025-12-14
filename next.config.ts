import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { hostname: 'images.evetech.net' }
    ]
  },
  // Allow Serwist's webpack config to work with Next.js 16 Turbopack
  turbopack: {},
};

export default withSerwist(nextConfig);
