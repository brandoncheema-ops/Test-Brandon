import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  basePath: "/aagm",
  output: "standalone",
};

export default nextConfig;
