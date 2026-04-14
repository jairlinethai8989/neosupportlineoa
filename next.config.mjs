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
};

export default nextConfig;
