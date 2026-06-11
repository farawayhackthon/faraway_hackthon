import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack-compatible config (Next.js 16+)
  // Node.js built-ins (crypto, fs, path) are automatically available in Server Components/API Routes
  // No webpack fallbacks needed when using App Router server-side only
};

export default nextConfig;
