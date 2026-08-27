import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'claude-opal-gamma.vercel.app' }],
        destination: 'https://www.euroscrubby-wholesale.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
