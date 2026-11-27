import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deluxe Messenger",
    short_name: "Deluxe",
    description: "Private, end-to-end encrypted chat and calls.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a0b2e",
    theme_color: "#1a0b2e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
