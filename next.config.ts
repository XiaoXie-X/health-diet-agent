import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式指定 Turbopack 根目录，避免误检测到用户主目录的 package-lock.json
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
