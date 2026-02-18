/** @type {import('next').NextConfig} */
export default {
  experimental: {
    serverComponentsExternalPackages: ['playwright']
  },
  transpilePackages: ['three'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.(vs|fs)$/,
      use: ['raw-loader']
    })

    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('playwright')
    }

    return config
  }
}
