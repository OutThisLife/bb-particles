/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['three'],
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    rules: {
      '*.vs': { loaders: ['raw-loader'], as: '*.js' },
      '*.fs': { loaders: ['raw-loader'], as: '*.js' }
    }
  }
}
