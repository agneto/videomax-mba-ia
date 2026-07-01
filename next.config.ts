import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // The ffmpeg/ffprobe installer packages resolve their binary via dynamic
  // require() at runtime, which the bundler can't trace. Keep them external so
  // they load as plain CommonJS from node_modules in the Node server runtime.
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
  ],
};

export default nextConfig;
