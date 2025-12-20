import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";
import ThemeInitScript from "@/components/ThemeInitScript";
import Providers from "./providers";

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["300", "400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
});

import type { Metadata, Viewport } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/+$/, "") || "https://kaprika.id";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "KAPRIKA // SYSTEM ENTRY",
    template: "%s // KAPRIKA",
  },

  description:
    "A restrained crowdfunding interface: structure first, narrative second. On-chain funding and governance with IPFS manifests.",

  applicationName: "Kaprika",
  referrer: "origin-when-cross-origin",

  icons: {
    shortcut: ["/favicon.ico"],
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },

  manifest: "/manifest.webmanifest",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "Kaprika",
    title: "KAPRIKA // CROWDFUNDING",
    description:
      "Crowdfunding and governance with enforceable structure and public commitments.",
    images: [
      {
        url: "/og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Kaprika — Crowdfunding & Governance",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "KAPRIKA // CROWDFUNDING",
    description:
      "Structure first. Narrative second. On-chain funding and governance.",
    images: ["/twitter-1200x630.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0F" },
    { media: "(prefers-color-scheme: light)", color: "#F7F7FA" },
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${ibmPlexMono.variable} antialiased`}>
        <ThemeInitScript />
        <Providers>
          <div className="bgGrid" aria-hidden="true" />
          <svg
            className="bgConstellation"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="constellation"
                x="0"
                y="0"
                width="200"
                height="200"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="20" cy="20" r="1" fill="currentColor" />
                <circle cx="150" cy="100" r="1" fill="currentColor" />
                <line
                  x1="20"
                  y1="20"
                  x2="150"
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
                <line
                  x1="150"
                  y1="100"
                  x2="200"
                  y2="40"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#constellation)" />
          </svg>
          <div className="sysId" aria-hidden="true">
            SYS_HASH_X99 // PROTOTYPE
          </div>
          <div className="appFrame">
            <TopBar />
            <div className="appBody">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
