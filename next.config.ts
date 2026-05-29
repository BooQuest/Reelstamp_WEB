// Next.js 설정 파일: 빌드, 이미지 최적화, 리다이렉트 등 Next.js 동작을 제어
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker를 위한 standalone 빌드 출력
  output: 'standalone',
  // 이미지 최적화 설정
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // 압축 설정
  compress: true,

  // 백엔드 프록시 (CORS 우회용)
  async rewrites() {
    return [
      {
        source: '/proxy/:path*',
        destination: 'http://140.245.70.80:8080/:path*',
      },
    ];
  },
};

export default nextConfig;