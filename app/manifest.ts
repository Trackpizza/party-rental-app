import type { MetadataRoute } from "next";

// Dynamic web manifest — the app is white-labeled per business, so the name
// tracks NEXT_PUBLIC_BUSINESS_NAME (same as the page <title>). Next auto-injects
// the <link rel="manifest"> when this file exists.
export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Party Rentals";
  return {
    name,
    short_name: name.length <= 12 ? name : "Rentals",
    description: "Rental orders & e-signature",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#7c2d91",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
