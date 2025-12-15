import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth-gate";
import { SidebarLayout } from "@/components/sidebar-layout";
import { AppleSplashLinks } from "@/components/apple-splash-links";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "EVE Online Tracker";
const APP_DESCRIPTION = "Track your EVE Online industry, trading, and market analysis";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: APP_NAME,
  description: APP_DESCRIPTION,
  // manifest is auto-generated from app/manifest.ts
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EVE Tracker",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/favicon-196.png",
    apple: "/icons/apple-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <AppleSplashLinks />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthGate>
          <SidebarLayout>{children}</SidebarLayout>
        </AuthGate>
      </body>
    </html>
  );
}
