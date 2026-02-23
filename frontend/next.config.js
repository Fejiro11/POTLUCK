/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Handle WASM files for fhevmjs
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM file handling
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },
};

module.exports = nextConfig;
