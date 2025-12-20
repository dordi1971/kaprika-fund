import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/+$/, "") || "https://kaprika.id";

export default function robots(): MetadataRoute.Robots {
  const noIndex = process.env.NEXT_PUBLIC_NO_INDEX === "1";

  return {
    rules: noIndex
      ? [{ userAgent: "*", disallow: "/" }]
      : [{ userAgent: "*", allow: "/" }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
