/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['three'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    config.module.rules.push({
      test: /\.(vs|fs)$/,
      use: ['raw-loader']
    })
    return config
  }
}
