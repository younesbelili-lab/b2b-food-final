import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://sofoodservice.example";
  const now = new Date();
  return [
    "",
    "/catalogue",
    "/commander",
    "/historique",
    "/support",
    "/admin",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));
}
