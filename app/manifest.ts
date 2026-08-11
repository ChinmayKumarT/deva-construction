import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deva Construction",
    short_name: "Deva Construction",
    description: "Construction site management dashboards by Deva Construction.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f9fc",
    theme_color: "#635bff",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
