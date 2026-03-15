import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment: no standalone output needed for Vercel
  // serverExternalPackages keeps the Speech SDK on the server only
  serverExternalPackages: ["microsoft-cognitiveservices-speech-sdk"],
};

export default nextConfig;
