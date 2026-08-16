import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deva Construction",
    short_name: "Deva",
    description: "Construction site management dashboards by Deva Construction.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f9fc",
    theme_color: "#635bff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
