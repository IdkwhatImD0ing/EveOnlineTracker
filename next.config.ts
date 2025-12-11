import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { hostname: 'images.evetech.net' }
    ]
  }
};

export default nextConfig;
