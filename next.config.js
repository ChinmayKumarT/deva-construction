/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Site-update photos are stored in Supabase Storage and served via
    // public URLs -- allow next/image to fetch+optimize/resize them.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  // File uploads (agreement PDFs, photos) go through Server Actions, whose
  // default 1 MB body limit rejects most PDFs with "unexpected response".
  // ponytail: Vercel caps request bodies at 4.5 MB, so this can't go higher;
  // bigger files need a direct browser-to-Supabase upload instead.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};
module.exports = nextConfig;
