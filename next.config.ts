import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: allow LAN access for phone testing. Update IP if DHCP reassigns it.
  allowedDevOrigins: ['10.0.0.151'],
};

export default nextConfig;
