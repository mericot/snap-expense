import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: allow LAN access for phone testing. Update IP if DHCP reassigns it.
  allowedDevOrigins: ['10.0.0.151'],
  async redirects() {
    return [
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
      { source: '/terms', destination: '/legal/terms', permanent: true },
    ];
  },
};

export default nextConfig;
