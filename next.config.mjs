/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ["lucide-react", "recharts", "framer-motion"] },
};
export default nextConfig;
