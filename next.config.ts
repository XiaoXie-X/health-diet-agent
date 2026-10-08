import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式指定 Turbopack 根目录，避免误检测到用户主目录的 package-lock.json
  turbopack: {
    root: __dirname,
  },
  // better-sqlite3 是原生模块，排除出打包以兼容 Vercel Serverless
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
