/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.line-scdn.net',
      },
      {
        protocol: 'https',
        hostname: 'sprofile.line-scdn.net',
      },
    ],
  },
  reactStrictMode: true,
  // Strict type checking enabled for production safety
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Auto-transform barrel imports to direct imports at build time.
    // lucide-react has 1,583 modules — this reduces cold start by ~40%
    // and dev boot by ~2-3s without touching any import statements.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
