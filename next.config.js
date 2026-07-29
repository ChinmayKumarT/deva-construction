/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Site-update photos are stored in Supabase Storage and served via
    // public URLs -- allow next/image to fetch+optimize/resize them.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};
module.exports = nextConfig;
