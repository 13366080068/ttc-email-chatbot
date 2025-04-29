import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 添加 Webpack 配置以支持 WASM
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    // @ts-expect-error - optional chaining needed ?.
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.(".svg"));

    config.module.rules.push(
      // Re-add the existing rule, but modify it to array index moieties svgs
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      },
       // Add rule for WASM files
      {
        test: /\.wasm$/,
        type: "webassembly/async",
      }
    );

    // Enable async WebAssembly experiments
    config.experiments = { 
      ...config.experiments, // Preserve existing experiments if any
      asyncWebAssembly: true 
    };

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
