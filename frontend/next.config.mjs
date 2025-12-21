/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Static export for IPFS/Pinata deployment
  output: "export",

  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },

  // Trailing slash for better IPFS compatibility
  trailingSlash: true,
};

export default nextConfig;
