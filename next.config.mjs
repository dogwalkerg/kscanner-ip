/** @type {import("next").NextConfig} */

import withSerwistInit from "@serwist/next";

const isProd = process.env.NODE_ENV === 'production';

const withSerwist = withSerwistInit({
  disable: !isProd,
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig = {
  output: 'export',
  images: {   
    unoptimized: true,
  },  
  reactStrictMode: true,
};

export default withSerwist({
  ...nextConfig
});