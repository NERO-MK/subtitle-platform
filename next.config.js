/** @type {import('next').NextConfig} */
const nextConfig = {
  // yt-dlp is a system binary, not a node module
  serverExternalPackages: [],
}

module.exports = nextConfig
