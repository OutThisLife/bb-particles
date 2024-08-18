/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['three'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
}
