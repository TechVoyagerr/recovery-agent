import type { NextConfig } from "next";
const nextConfig: NextConfig = { outputFileTracingRoot: process.cwd(), distDir: process.env.NEXT_DIST_DIR || ".next" };
export default nextConfig;
