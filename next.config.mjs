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
};

export default nextConfig;
