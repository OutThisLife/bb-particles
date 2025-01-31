/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['three'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: cfg => ({
    ...cfg,
    module: {
      ...cfg.module,
      rules: [
        ...cfg.module.rules,
        {
          test: /\.(glsl|vs|fs|vert|frag)$/,
          exclude: /node_modules/,
          use: [
            'raw-loader',
            {
              loader: 'glslify-loader',
              options: {
                transform: [['glslify-hex'], ['glslify-import']]
              }
            }
          ]
        }
      ]
    }
  })
}
