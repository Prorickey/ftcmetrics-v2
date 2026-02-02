import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FTC Metrics",
  description: "Scouting and analytics platform for FIRST Tech Challenge teams",
  manifest: "/manifest.json",
  themeColor: "#f57c25",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FTC Metrics",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
