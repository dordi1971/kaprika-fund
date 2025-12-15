import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "SYSTEM ENTRY // CROWDFUNDING",
  description:
    "A restrained crowdfunding interface: structure first, narrative second.",
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
