import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "microsoft-cognitiveservices-speech-sdk",
    "@prisma/client",
    "prisma",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
};

export default nextConfig;
